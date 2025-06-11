import { Express, Request, Response } from 'express';
import { Connection, Document, Model } from 'mongoose'; // Import Connection type
import { getModlServersModel, connectToServerDb, connectToGlobalModlDb } from '../db/connectionManager';
// Import the models. We will access their schemas via Model.schema
import {
  Player, // Assuming Player is the model exported from mongodb-schemas
  Staff,
  Ticket,
  Log,
  Settings
} from '../models/mongodb-schemas';
import { ModlServerSchema } from '../models/modl-global-schemas'; // Import ModlServerSchema

// Define an interface for the ModlServer document for type safety
interface IModlServer extends Document {
  serverName: string;
  provisioningStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  databaseName?: string;
  // Add other fields from ModlServerSchema as needed
}

// TODO: Define a more robust initial data seeding function for new servers
export async function provisionNewServerInstance(
  dbConnection: Connection, 
  serverName: string,
  globalConnection: Connection, // Added globalConnection parameter
  serverConfigId: string // Added serverConfigId to update the document
) {
  // console.log(`Starting provisioning for ${serverName} using DB: ${dbConnection.name}...`);

  // Register models on the server-specific connection using their schemas
  dbConnection.model('Player', Player.schema);
  dbConnection.model('Staff', Staff.schema);
  dbConnection.model('Ticket', Ticket.schema);
  dbConnection.model('Log', Log.schema);
  dbConnection.model('Settings', Settings.schema);
  // console.log(`Models registered on DB ${dbConnection.name} for ${serverName}.`);

  // Example: Seed initial settings
  const SettingsModel = dbConnection.model('Settings');
  const existingSettings = await SettingsModel.findOne();
  if (!existingSettings) {
    await SettingsModel.create({ settings: new Map([['initialSetup', true]]) });
    // console.log(`Initial settings seeded for ${serverName}`);
  }

  // After successful provisioning, update the ModlServer document in the global DB
  const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
  await ModlServerModel.findByIdAndUpdate(serverConfigId, {
    provisioningStatus: 'completed',
    databaseName: dbConnection.name, // Store the actual database name used
    updatedAt: new Date()
  });
  // console.log(`Provisioning status updated to 'completed' for ${serverName}`);
}

export function setupVerificationAndProvisioningRoutes(app: Express) {
  // Route to handle email verification
  app.get('/verify-email', async (req: Request, res: Response) => {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is missing.' });
    }

    let globalConnection: Connection;
    try {
      globalConnection = await connectToGlobalModlDb(); // Ensure global connection
      const ModlServerModel = globalConnection.model<IModlServer>('ModlServer', ModlServerSchema);
      const server = await ModlServerModel.findOne({ emailVerificationToken: token });

      if (!server) {
        return res.status(404).json({ message: 'Invalid or expired verification token.' });
      }

      if (server.emailVerified) {
        // If already verified, redirect to panel and show a toast.
        // The user might click an old link.
        // Auto-login: This part requires session management. Assuming a function `logInUser` exists.
        // This is a simplified example. Robust auto-login needs careful implementation.
        if (req.logIn && server.adminEmail) { // req.logIn is from Passport
            // Fetch or construct user object that passport expects for serialization
            // This is a placeholder - you need to fetch the actual user from your users collection
            // based on server.adminEmail or a related user ID if stored on ModlServer.
            // For now, we'll assume a simplified user object can be created for the session.
            // This part is highly dependent on your User model and how users are stored/managed globally.
            // Let's assume you have a global User model.
            // const UserModel = globalConnection.model('User'); // Hypothetical global user model
            // const userToLogIn = await UserModel.findOne({ email: server.adminEmail });
            // if (userToLogIn) { ... }
            
            // Simplified: For demonstration, creating a mock user object for login.
            // In a real app, you MUST fetch the full user object that passport expects.
            const mockUserForLogin = {
                // _id: userToLogIn._id, // From actual user record
                email: server.adminEmail,
                // ... other necessary fields for req.user
            };
            // @ts-ignore
            req.logIn(mockUserForLogin, async (err) => {
                if (err) {
                    console.error('Auto-login after email verification failed:', err);
                    // Fallback: redirect without login, but still show success
                    return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully!`);
                }

                // Successfully logged in. Now, trigger provisioning if it's still pending.
                if (server.provisioningStatus === 'pending') {
                    try {
                        // Connect to the specific server's DB for provisioning
                        const serverDbConnection = await connectToServerDb(server.customDomain as string);
                        await provisionNewServerInstance(serverDbConnection, server.customDomain as string, globalConnection, server._id.toString());
                        server.provisioningStatus = 'completed'; // Assuming provisionNewServerInstance is synchronous for status update
                                                              // or it handles its own status update internally.
                                                              // For safety, explicitly mark as completed if provisionNewServerInstance succeeded.
                        // No, provisionNewServerInstance updates the status itself.
                    } catch (provisionError) {
                        console.error(`Error during post-verification provisioning for ${server.customDomain}:`, provisionError);
                        // Decide how to handle provisioning failure. Maybe redirect with an error toast.
                        return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified, but panel setup encountered an issue. Please contact support.&provision_error=true`);
                    }
                }
                await server.save(); // Save changes like provisioningStatus if updated here
                return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully! Panel is ready.`);
            });
        } else {
            // Fallback if req.logIn is not available or user cannot be determined for login
            console.warn('req.logIn not available or user details missing for auto-login during email verification.');
            // Still proceed with verification and redirect
            server.emailVerified = true;
            server.emailVerificationToken = undefined; // Clear the token
            // server.provisioningStatus remains 'pending' or as is, to be handled by middleware or first login
            await server.save();
            return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully! You can now log in.`);
        }
        return; // End execution after handling already-verified case or starting login
      }

      server.emailVerified = true;
      server.emailVerificationToken = undefined; // Clear the token
      // server.provisioningStatus = 'pending'; // Set/confirm as pending, provisioning will be triggered.
                                            // This is already handled by the registration logic usually.
                                            // The key is that emailVerified is now true.

      // Auto-login attempt after successful verification
      if (req.logIn && server.adminEmail) {
        // Similar to the "already verified" block, attempt to log the user in.
        // Placeholder for fetching/constructing the user object for Passport's req.logIn
        const mockUserForLogin = {
            email: server.adminEmail,
            // ... other necessary fields for req.user
        };
        // @ts-ignore
        req.logIn(mockUserForLogin, async (err) => {
            if (err) {
                console.error('Auto-login after email verification failed:', err);
                // Fallback: redirect without login, but still show success
                await server.save(); // Save verification status
                return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully! Please log in.`);
            }

            // Successfully logged in. Now, trigger provisioning if it's still pending.
            if (server.provisioningStatus === 'pending') {
                try {
                    const serverDbConnection = await connectToServerDb(server.customDomain as string);
                    await provisionNewServerInstance(serverDbConnection, server.customDomain as string, globalConnection, server._id.toString());
                    // provisionNewServerInstance handles updating the serverConfig's provisioningStatus to 'completed'.
                } catch (provisionError) {
                    console.error(`Error during post-verification provisioning for ${server.customDomain}:`, provisionError);
                    await server.save(); // Save verification status even if provisioning fails
                    return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified, but panel setup encountered an issue. Please contact support.&provision_error=true`);
                }
            }
            await server.save(); // Save verification status and any changes by provisioning
            return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully! Panel is ready.`);
        });
      } else {
        // Fallback if req.logIn is not available
        await server.save();
        return res.redirect(`http://${server.customDomain}.${process.env.DOMAIN || 'modl.gg'}/?email_verified=true&toast=Email verified successfully! You can now log in.`);
      }

    } catch (error: any) {
      console.error('Error during email verification:', error);
      // It's crucial to know which server this error pertains to, if possible, for debugging.
      // However, with just a token, we might not know the server context if the token is invalid.
      return res.status(500).json({ message: 'An error occurred during email verification. ', error: error.message });
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
            await provisionNewServerInstance(serverDbConnection, serverName, ModlServer.getConnection(), server._id.toString());
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
