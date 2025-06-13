import { Express, Request, Response } from 'express';
import mongoose, { Connection, Document, Model } from 'mongoose'; // Import mongoose for Types.ObjectId
import { getModlServersModel, connectToServerDb, connectToGlobalModlDb } from '../db/connectionManager';
import {
  Player,
  Staff,
  Ticket,
  Log,
  Settings,
  settingsSchema
} from '../models/mongodb-schemas';
import { ModlServerSchema } from '../models/modl-global-schemas';

interface IModlServer extends Document {
  serverName: string;
  customDomain: string;
  adminEmail: string;
  emailVerificationToken?: string | undefined;
  emailVerified: boolean;
  provisioningStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  databaseName?: string;
  // Mongoose Document provides _id. Explicitly typed here.
  _id: mongoose.Types.ObjectId; 
  // Mongoose Document provides save method.
  // save: () => Promise<this & Document<any, any, any>>; // More precise type for save if needed
  // Add any other fields from ModlServerSchema that are directly accessed
  provisioningNotes?: string; 
  updatedAt?: Date; // from schema
  createdAt?: Date; // from schema
}

export async function provisionNewServerInstance(
  dbConnection: Connection,
  serverName: string,
  globalConnection: Connection, // Added globalConnection parameter
  serverConfigId: string // Added serverConfigId to update the document
) {
  dbConnection.model('Player', Player.schema);
  dbConnection.model('Staff', Staff.schema);
  dbConnection.model('Ticket', Ticket.schema);
  dbConnection.model('Log', Log.schema);

  const Settings = mongoose.model('Settings', settingsSchema);
  const existingSettings = await Settings.findOne();
  const punishmentTypes = [
        { ordinal: 0, name: 'Kick', category: 'Gameplay' },
        { ordinal: 1, name: 'Manual Mute', category: 'Social' },
        { ordinal: 2, name: 'Manual Ban', category: 'Gameplay' },
        { ordinal: 3, name: 'Security Ban', category: 'Gameplay' },
        { ordinal: 4, name: 'Linked Ban', category: 'Gameplay' },
        { ordinal: 5, name: 'Blacklist', category: 'Gameplay' },
        { ordinal: 6, name: 'Bad Skin', category: 'Social' },
        { ordinal: 7, name: 'Bad Name', category: 'Social' },
        { ordinal: 8, name: 'Chat Abuse', category: 'Social' },
        { ordinal: 9, name: 'Anti Social', category: 'Social' },
        { ordinal: 10, name: 'Targeting', category: 'Social' },
        { ordinal: 11, name: 'Bad Content', category: 'Social' },
        { ordinal: 12, name: 'Team Abuse', category: 'Gameplay' },
        { ordinal: 13, name: 'Game Abuse', category: 'Gameplay' },
        { ordinal: 14, name: 'Cheating', category: 'Gameplay' },
        { ordinal: 15, name: 'Game Trading', category: 'Gameplay' },
        { ordinal: 16, name: 'Account Abuse', category: 'Gameplay' },
        { ordinal: 17, name: 'Scamming', category: 'Social' }
      ];  if (!existingSettings) {
    const settings = new Settings({
      settings: new Map()
    });
    settings.settings!.set('punishmentTypes', JSON.stringify(punishmentTypes));
    await settings.save();
    console.log('Initialized punishment types in settings');
  } else if (existingSettings.settings && !existingSettings.settings.has('punishmentTypes')) {
    existingSettings.settings.set('punishmentTypes', JSON.stringify(punishmentTypes));
    await existingSettings.save();
    console.log('Added punishment types to existing settings');
  }
    

  const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
  await ModlServerModel.findByIdAndUpdate(serverConfigId, {
    provisioningStatus: 'completed',
    databaseName: dbConnection.name, // Store the actual database name used
    updatedAt: new Date()
  });
}

export function setupVerificationAndProvisioningRoutes(app: Express) {
  app.get('/verify-email', async (req: Request, res: Response) => {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is missing.' });
    }

    let globalConnection: Connection;
    try {
      globalConnection = await connectToGlobalModlDb();
      const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
      const server = await ModlServerModel.findOne({ emailVerificationToken: token });

      if (!server) {
        return res.status(404).json({ message: 'Invalid or expired verification token.' });
      }

      // Case 1: Already verified
      if (server.emailVerified) {
        if (server.provisioningStatus === 'completed') {
          // Verified and provisioned: redirect to their panel's root.
          return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?message=email_already_verified_and_provisioned&toastType=info`);
        } else {
          // Verified but provisioning not complete: redirect to provisioning page.
          return res.redirect(`/provisioning-in-progress?server=${server.serverName}&message=email_already_verified_provisioning_pending&toastType=info`);
        }
      }

      // Case 2: Not yet verified - proceed with verification
      server.emailVerified = true;
      server.emailVerificationToken = undefined; // Clear the token

      // Set provisioning to pending if it's not already started or completed.
      // This ensures that if it was 'failed', it gets a chance to retry.
      if (server.provisioningStatus !== 'completed' && server.provisioningStatus !== 'in-progress') {
        server.provisioningStatus = 'pending';
      }
      
      await server.save();
      
      // After successful verification and status update, redirect to the provisioning page.
      return res.redirect(`/provisioning-in-progress?server=${server.serverName}&status=verification_successful&toastType=success`);

    } catch (error: any) {
      console.error(`Error during email verification for token ${token}:`, error);
      return res.status(500).json({ message: 'An error occurred during email verification.', details: error.message });
    }
  });

  app.get('/api/provisioning/status/:serverName', async (req: Request, res: Response) => {
    const { serverName } = req.params;

    if (!serverName) {
      return res.status(400).json({ error: 'Server name is missing.' });
    }
    
    let globalConnection: Connection;
    try {
      globalConnection = await connectToGlobalModlDb();
      const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
      const server = await ModlServerModel.findOne({ serverName: serverName });

      if (!server) {
        return res.status(404).json({ error: `Server '${serverName}' not found.` });
      }

      if (!server.emailVerified) {
        // This state should ideally not be hit if /verify-email redirects correctly.
        return res.status(403).json({ error: 'Email not verified for this server.', status: 'email_unverified' });
      }

      if (server.provisioningStatus === 'completed') {
        return res.json({ status: 'completed', message: `Server '${serverName}' is provisioned and ready.` });
      }

      if (server.provisioningStatus === 'in-progress') {
        return res.json({ status: 'in-progress', message: 'Provisioning is currently in progress. Please wait.' });
      }

      // If status is 'pending', and email is verified, trigger provisioning.
      if (server.provisioningStatus === 'pending') {
        server.provisioningStatus = 'in-progress'; // Optimistically update
        server.updatedAt = new Date();
        await server.save();

        // Asynchronously start the provisioning process.
        // No await here for a quick response; client polls.
        connectToServerDb(server.customDomain)
          .then(async (serverDbConnection) => {
            if (!server._id) { // Should always exist for a found document
                console.error(`Critical: Server _id is undefined for ${server.serverName} after findOne. Cannot provision.`);
                const freshServer = await ModlServerModel.findById(server._id); // Re-fetch to be safe
                if (freshServer) {
                    freshServer.provisioningStatus = 'failed';
                    freshServer.provisioningNotes = 'Failed to start provisioning due to missing _id reference internally.';
                    await freshServer.save();
                }
                return;
            }
            await provisionNewServerInstance(serverDbConnection, server.customDomain, globalConnection, server._id.toString());
            console.log(`Provisioning process initiated via API for ${server.serverName}.`);
          })
          .catch(async (err) => {
            console.error(`Error connecting to server DB or during provisioning for ${server.serverName}:`, err);
            // Re-fetch to avoid versioning issues if server doc was modified elsewhere
            const freshServer = await ModlServerModel.findById(server._id);
            if (freshServer) {
                freshServer.provisioningStatus = 'failed';
                freshServer.provisioningNotes = err.message || 'An unexpected error occurred during provisioning initiation.';
                freshServer.updatedAt = new Date();
                await freshServer.save();
            }
          });

        return res.json({ status: 'in-progress', message: 'Provisioning started. Please refresh in a few moments.' });
      }
      
      // Handle 'failed' or any other unexpected status
      return res.status(200).json({ // Return 200 so client can parse status
          status: server.provisioningStatus || 'unknown', 
          message: server.provisioningNotes || `Server is in an unexpected state: ${server.provisioningStatus}. Please contact support.` 
      });

    } catch (error: any) {
      console.error(`Error in /api/provisioning/status/${serverName}:`, error);
      return res.status(500).json({ error: 'An internal error occurred while checking provisioning status.', details: error.message });
    }
  });
}
