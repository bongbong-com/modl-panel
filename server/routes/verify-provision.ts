import { Express, Request, Response } from 'express';
import { Connection } from 'mongoose'; // Import Connection type
import { getModlServersModel, connectToServerDb } from '../db/connectionManager';
// Import the models. We will access their schemas via Model.schema
import {
  Player, // Assuming Player is the model exported from mongodb-schemas
  Staff,
  Ticket,
  Log,
  Settings
} from '../models/mongodb-schemas';

// TODO: Define a more robust initial data seeding function for new servers
async function provisionNewServerInstance(dbConnection: Connection, serverName: string) {
  // console.log(`Starting provisioning for ${serverName} using DB: ${dbConnection.name}...`);

  // Register models on the server-specific connection using their schemas
  dbConnection.model('Player', Player.schema);
  dbConnection.model('Staff', Staff.schema);
  dbConnection.model('Ticket', Ticket.schema);
  dbConnection.model('Log', Log.schema);
  dbConnection.model('Settings', Settings.schema);
  // console.log(`Models registered on DB ${dbConnection.name} for ${serverName}.`);

  // Example: Seed initial settings
  const SettingsModelOnNewConnection = dbConnection.model('Settings');
  try {
    await SettingsModelOnNewConnection.create({
      settings: new Map<string, any>([['initialSetupComplete', true], ['serverName', serverName], ['welcomeMessage', `Welcome to ${serverName}!`]]),
      formTemplates: [] // Initialize with empty form templates or default ones
    });
    console.log(`Initial settings seeded for ${serverName}.`);
  } catch (seedError) {
    console.error(`Error seeding initial settings for ${serverName}:`, seedError);
    // Decide if this error should halt provisioning or be logged
    throw seedError; // Re-throw to mark provisioning as failed for now
  }

  // Add other seeding logic here (e.g., default staff account if necessary, etc.)

  console.log(`Provisioning for ${serverName} completed successfully.`);
  return true;
}

export function setupVerificationAndProvisioningRoutes(app: Express) {
  // Route to handle email verification
  app.get('/verify-email', async (req: Request, res: Response) => {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is missing.' });
    }

    try {
      const ModlServer = await getModlServersModel();
      const server = await ModlServer.findOne({ emailVerificationToken: token });

      if (!server) {
        return res.status(404).json({ message: 'Invalid or expired verification token.' });
      }

      if (server.emailVerified) {
        // Potentially redirect to a page saying already verified or to the panel if provisioned
        return res.status(200).json({ message: 'Email already verified.', serverName: server.serverName, customDomain: server.customDomain });
      }

      server.emailVerified = true;
      server.emailVerificationToken = undefined; // Remove token after verification
      server.provisioningStatus = 'pending'; // Set status to pending for provisioning
      await server.save();

      // Respond to the user immediately, provisioning will happen in the background or on first login to panel
      // Redirect to a page that will then trigger the provisioning status check
      let redirectToUrl = `/provisioning-status?server=${server.serverName}`;
      if (process.env.NODE_ENV === 'development') {
        // For local development, ensure dev_server_name is passed so middleware picks it up
        // The client will be on localhost:5000 (or other dev port), so this path is relative to that.
        redirectToUrl += `&dev_server_name=${server.serverName}`;
      }
      
      res.status(200).json({
        message: 'Email verified successfully. Your server is being provisioned.',
        serverName: server.serverName,
        customDomain: server.customDomain, // This might be 'localhost:xxxx' in dev if configured, or the prod domain
        redirectTo: redirectToUrl
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Error verifying email address.' });
    }
  });

  // Route to check provisioning status and trigger provisioning if needed
  app.get('/api/provisioning/status/:serverName', async (req: Request, res: Response) => {
    const { serverName } = req.params;

    if (!serverName) {
      return res.status(400).json({ message: 'Server name is missing.' });
    }

    try {
      const ModlServer = await getModlServersModel();
      const server = await ModlServer.findOne({ serverName: serverName });

      if (!server) {
        return res.status(404).json({ message: 'Server not found.' });
      }

      if (!server.emailVerified) {
        return res.status(403).json({ message: 'Email not verified for this server.' });
      }

      if (server.provisioningStatus === 'completed') {
        return res.status(200).json({ status: 'completed', message: 'Server is provisioned.' });
      }

      if (server.provisioningStatus === 'in-progress') {
        return res.status(200).json({ status: 'in-progress', message: 'Provisioning is currently in progress.' });
      }

      // If pending, start provisioning
      if (server.provisioningStatus === 'pending' || server.provisioningStatus === 'failed') {
        server.provisioningStatus = 'in-progress';
        await server.save();

        // Perform provisioning asynchronously
        (async () => {
          try {
            const serverDbConnection = await connectToServerDb(serverName);
            // Store the generated DB name if not already stored (connectToServerDb might formalize it)
            // server.databaseName = serverDbConnection.name;
            await provisionNewServerInstance(serverDbConnection, serverName);
            server.provisioningStatus = 'completed';
            await server.save();
            console.log(`Provisioning for server ${serverName} marked as completed.`);
          } catch (provisionError) {
            console.error(`Error during provisioning for ${serverName}:`, provisionError);
            server.provisioningStatus = 'failed';
            await server.save();
          }
        })();

        return res.status(202).json({ status: 'in-progress', message: 'Provisioning started.' });
      }

      res.status(200).json({ status: server.provisioningStatus });

    } catch (error) {
      console.error('Provisioning status error:', error);
      res.status(500).json({ message: 'Error fetching provisioning status.' });
    }
  });
}
