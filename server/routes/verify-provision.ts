import { Express, Request, Response } from 'express';
import mongoose, { Connection, Document, Model } from 'mongoose'; // Import mongoose for Types.ObjectId
import { randomBytes } from 'crypto';
import { getModlServersModel, connectToServerDb, connectToGlobalModlDb } from '../db/connectionManager';
import { 
  PlayerSchema, 
  StaffSchema, 
  TicketSchema, 
  LogSchema, 
  SettingsSchema,
  ModlServerSchema
} from 'modl-shared-web';
import { seedDefaultHomepageCards } from '../db/seed-data';
import { strictRateLimit } from '../middleware/rate-limiter';
import { createDefaultSettings, addDefaultPunishmentTypes } from './settings-routes';

interface IModlServer extends Document {
  serverName: string;
  customDomain: string;
  adminEmail: string;
  emailVerificationToken?: string | undefined;
  emailVerified: boolean;
  provisioningSignInToken?: string;
  provisioningSignInTokenExpiresAt?: Date;
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

  // Create default settings with core Administrative punishment types
  await createDefaultSettings(dbConnection, serverName);
  
  // Add default Social and Gameplay punishment types
  await addDefaultPunishmentTypes(dbConnection);

  // Seed default homepage cards
  await seedDefaultHomepageCards(dbConnection);
    

  const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
  await ModlServerModel.findByIdAndUpdate(serverConfigId, {
    provisioningStatus: 'completed',
    databaseName: dbConnection.name, // Store the actual database name used
    updatedAt: new Date()
  });
}

export function setupVerificationAndProvisioningRoutes(app: Express) {
  app.get('/verify-email', strictRateLimit, async (req: Request, res: Response) => {
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
      server.emailVerificationToken = undefined; // Clear the email verification token

      // Generate and store the provisioning sign-in token
      const signInToken = randomBytes(32).toString('hex');
      const signInTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // Token valid for 30 minutes

      server.provisioningSignInToken = signInToken;
      server.provisioningSignInTokenExpiresAt = signInTokenExpiry;

      // Set provisioning to pending if it's not already started or completed.
      if (server.provisioningStatus !== 'completed' && server.provisioningStatus !== 'in-progress') {
        server.provisioningStatus = 'pending';
      }
      
      await server.save();
      
      // After successful verification and status update, redirect to the provisioning page with the sign-in token.
      return res.redirect(`/provisioning-in-progress?server=${server.serverName}&signInToken=${signInToken}&status=verification_successful&toastType=success`);

    } catch (error: any) {
      console.error(`Error during email verification for token ${token}:`, error);
      return res.status(500).json({ message: 'An error occurred during email verification.', details: error.message });
    }
  });

  app.get('/api/provisioning/status/:serverName', async (req: Request, res: Response) => {
    const { serverName } = req.params;
    const clientSignInToken = req.query.signInToken as string; // Get token from query

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
        // Server is provisioned and ready - no auto-login, users must authenticate normally
        const message = `Server '${serverName}' is provisioned and ready. Please log in to access your panel.`;

        // Clear the provisioning sign-in token to prevent any potential misuse
        if (server.provisioningSignInToken || server.provisioningSignInTokenExpiresAt) {
          server.provisioningSignInToken = undefined;
          server.provisioningSignInTokenExpiresAt = undefined;
          try {
            await server.save();
          } catch (saveError: any) {
            console.error(`[verify-provision] Error clearing provisioningSignInToken for ${serverName}:`, saveError);
            // Non-critical for the response, but log it.
          }
        }
        
        return res.json({
          status: 'completed',
          message: message,
          user: null // No user session created - users must authenticate normally
        });
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