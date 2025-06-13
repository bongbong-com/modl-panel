import dotenv from 'dotenv';
import mongoose, { Connection } from 'mongoose';
import {
  playerSchema,
  ticketSchema,
  staffSchema,
  settingsSchema,
  logSchema
} from '../models/mongodb-schemas';
import { invitationSchema } from '../models/invitation-schema';
import { ModlServerSchema } from '../models/modl-global-schemas';

dotenv.config();

const GLOBAL_MODL_DB_URI = process.env.GLOBAL_MODL_DB_URI;
const PANEL_DB_PREFIX = process.env.PANEL_DB_PREFIX || 'server_';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

let globalModlConnection: Connection | null = null;
const serverConnections = new Map<string, Connection>();

// Helper to register all tenant-specific models on a given connection
// Using the correctly imported raw schema variables
const tenantSchemas: Record<string, mongoose.Schema<any>> = {
  Player: playerSchema,
  Ticket: ticketSchema,
  Staff: staffSchema,
  Settings: settingsSchema,
  Log: logSchema,
  Invitation: invitationSchema,
};

function registerTenantModels(connection: Connection): void {
  for (const modelName in tenantSchemas) {
    if (Object.prototype.hasOwnProperty.call(tenantSchemas, modelName) && tenantSchemas[modelName]) {
      connection.model(modelName, tenantSchemas[modelName]);
    } else {
      console.warn(`Schema for model '${modelName}' not found or not provided, skipping registration for DB: '${connection.name}'.`);
    }
  }
}

/**
 * Connects to the main 'modl' database.
 * This database holds the 'servers' collection with info about each registered server.
 */
export async function connectToGlobalModlDb(): Promise<Connection> {
  if (globalModlConnection && globalModlConnection.readyState === 1) {
    return globalModlConnection;
  }
  try {
    if (!GLOBAL_MODL_DB_URI) {
      throw new Error('GLOBAL_MODL_DB_URI is not defined in environment variables.');
    }
    const conn = mongoose.createConnection(GLOBAL_MODL_DB_URI);
    await conn.asPromise();
    console.log('Successfully connected to Global MODL Database.');
    globalModlConnection = conn;

    conn.model('Server', ModlServerSchema);

    return conn;
  } catch (error) {
    console.error('Error connecting to Global MODL Database:', error);
    throw error;
  }
}

/**
 * Retrieves the Mongoose model for the 'servers' collection from the global 'modl' database.
 */
export async function getModlServersModel() {
  const conn = await connectToGlobalModlDb();
  return conn.model('Server');
}

/**
 * Connects to a specific server's dedicated MongoDB database.
 * @param serverName The unique name of the server (e.g., "byteful").
 * @returns The Mongoose connection object for the server's database.
 */
export async function connectToServerDb(serverName: string): Promise<Connection> {
  let connectionKeyInMap: string;
  let serverDbUri: string;
  let actualDbNameForConnection: string;

  if (IS_DEVELOPMENT) {
    actualDbNameForConnection = 'modl_test';
    connectionKeyInMap = 'dev_shared_modl_test_connection';
  } else {
    actualDbNameForConnection = `${PANEL_DB_PREFIX}${serverName}`;
    connectionKeyInMap = serverName;
  }

  if (serverConnections.has(connectionKeyInMap)) {
    const existingConn = serverConnections.get(connectionKeyInMap)!;
    if (existingConn.readyState === 1) {
      return existingConn;
    } else {
      try {
        await existingConn.close();
      } catch (closeError) {
        console.error(`Error closing stale connection for ${connectionKeyInMap}:`, closeError);
      }
      serverConnections.delete(connectionKeyInMap);
    }
  }

  const panelDbUriTemplate = process.env.MONGODB_URI_TEMPLATE;
  if (!panelDbUriTemplate) {
    throw new Error('MONGODB_URI_TEMPLATE is not defined in environment variables. Please set it (e.g., mongodb://user:pass@host/<dbName>?authSource=admin).');
  }
  serverDbUri = panelDbUriTemplate.replace('<dbName>', actualDbNameForConnection);

  if (serverConnections.has(connectionKeyInMap)) {
    const existingConnection = serverConnections.get(connectionKeyInMap)!;
    if (existingConnection.readyState === 1) {
      return existingConnection;
    }
    try {
      await existingConnection.close();
    } catch (closeError) {
      console.error(`Error closing stale connection for ${connectionKeyInMap}:`, closeError);
    }
    serverConnections.delete(connectionKeyInMap);
  }

  try {
    const newConnection = mongoose.createConnection(serverDbUri);
    registerTenantModels(newConnection);
    await newConnection.openUri(serverDbUri);

    serverConnections.set(connectionKeyInMap, newConnection);
    return newConnection;
  } catch (error) {
    console.error(`[connectionManager] Error connecting to database (Target DB: ${actualDbNameForConnection}, URI: ${serverDbUri}, Connection Key: ${connectionKeyInMap}):`, error);
    throw error;
  }
}

/**
 * Closes the connection to a specific server's database.
 * @param serverName The name of the server.
 */
export async function closeServerDbConnection(serverName: string): Promise<void> {
  let keyToClose: string;
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    keyToClose = 'dev_shared_modl_test_connection';
    console.log(`Development mode: close request for '${serverName}', targeting shared key '${keyToClose}'.`);
  } else {
    keyToClose = serverName;
  }

  if (serverConnections.has(keyToClose)) {
    const conn = serverConnections.get(keyToClose)!;
    console.log(`Closing database connection for key: ${keyToClose} (DB: ${conn.name})`);
    await conn.close();
    serverConnections.delete(keyToClose);
    console.log(`Closed and removed database connection for key: ${keyToClose}`);
  } else {
    console.warn(`Attempted to close connection for key '${keyToClose}', but no active connection found.`);
  }
}

/**
 * Closes the connection to the global 'modl' database.
 */
export async function closeGlobalModlDbConnection(): Promise<void> {
  if (globalModlConnection) {
    await globalModlConnection.close();
    globalModlConnection = null;
    console.log('Closed Global MODL Database connection.');
  }
}

/**
 * Closes all active database connections.
 */
export async function closeAllConnections(): Promise<void> {
  await closeGlobalModlDbConnection();
  const serverClosePromises = Array.from(serverConnections.keys()).map(serverName => closeServerDbConnection(serverName));
  await Promise.all(serverClosePromises);
  console.log('All database connections closed.');
}

process.on('SIGINT', async () => {
  await closeAllConnections();
  process.exit(0);
});
