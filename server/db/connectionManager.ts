import dotenv from 'dotenv';
import mongoose, { Connection } from 'mongoose'; // Removed Schema from here as it's not directly used in this way after changes
import { 
    playerSchema, 
    ticketSchema, 
    staffSchema, 
    settingsSchema, 
    logSchema // Ensure logSchema is imported from mongodb-schemas
} from '../models/mongodb-schemas';
import { ModlServerSchema } from '../models/modl-global-schemas'; // Correct import for ModlServerSchema

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
    // Appeal model might be derived or part of another schema, or handled differently.
    // If appeals are stored in the tickets collection with a specific type, 
    // then TicketSchema is already covering it.
};

function registerTenantModels(connection: Connection): void {
    for (const modelName in tenantSchemas) {
        if (Object.prototype.hasOwnProperty.call(tenantSchemas, modelName) && tenantSchemas[modelName]) {
            // console.log(`Registering model '${modelName}' on connection for DB: '${connection.name}'`);
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

    // Register models on this global connection
    conn.model('Server', ModlServerSchema); // For the 'servers' collection
    conn.model('Log', logSchema);          // For panel-main system logs

    return conn;
  } catch (error) {
    console.error('Error connecting to Global MODL Database:', error);
    throw error; // Re-throw the error to be caught by the caller
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
  // if (IS_DEVELOPMENT) {
  //   console.log(`Development mode: Request for server '${serverName}', target DB '${PANEL_DB_PREFIX}${serverName}'.`);
  // } else {
  //   console.log(`Production mode: Request for server '${serverName}', target DB '${PANEL_DB_PREFIX}${serverName}'.`);
  // }

  let connectionKeyInMap: string;
  let serverDbUri: string;
  let actualDbNameForConnection: string;
  // const isDevelopment = process.env.NODE_ENV === 'development';
  // Use the already defined IS_DEVELOPMENT
  // const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';


  if (IS_DEVELOPMENT) {
    actualDbNameForConnection = 'modl_test';
    // In development, all serverName instances share a single connection to 'modl_test'.
    // Use a fixed key in the map for this shared connection.
    connectionKeyInMap = 'dev_shared_modl_test_connection'; 
    console.log(`Development mode: Request for server '${serverName}', will use shared DB '${actualDbNameForConnection}'.`);
  } else { // Production logic
    actualDbNameForConnection = `${PANEL_DB_PREFIX}${serverName}`;
    connectionKeyInMap = serverName; // Use actual serverName as key in prod
    console.log(`Production mode: Request for server '${serverName}', target DB '${actualDbNameForConnection}'.`);
  }

  if (serverConnections.has(connectionKeyInMap)) {
    const existingConn = serverConnections.get(connectionKeyInMap)!;
    if (existingConn.readyState === 1) { // 1 === connected
      // console.log(`Reusing existing connection for key '${connectionKeyInMap}' (DB: ${existingConn.name}).`);
      return existingConn;
    } else {
      console.warn(`Found stale connection for key '${connectionKeyInMap}' (readyState: ${existingConn.readyState}). Removing to attempt reconnect.`);
      try {
        await existingConn.close();
      } catch (closeError) {
        console.error(`Error closing stale connection for ${connectionKeyInMap}:`, closeError);
      }
      serverConnections.delete(connectionKeyInMap);
    }
  }

  // Construct URI
  if (IS_DEVELOPMENT) {
    serverDbUri = `mongodb://localhost:27017/${actualDbNameForConnection}`;
    // console.log(`Constructed URI for dev DB '${actualDbNameForConnection}': ${serverDbUri}`);
  } else {
    const mongoUser = process.env.PANEL_DB_USER;
    const mongoPass = process.env.PANEL_DB_PASS;
    const mongoHost = process.env.PANEL_DB_HOST;
    const mongoAuthDb = process.env.PANEL_DB_AUTH_DB || 'admin';
    serverDbUri = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}/${actualDbNameForConnection}?authSource=${mongoAuthDb}`;
    // console.log(`Constructed URI for prod DB '${actualDbNameForConnection}': ${serverDbUri}`);
  }

  if (serverConnections.has(connectionKeyInMap)) {
    const existingConnection = serverConnections.get(connectionKeyInMap)!;
    if (existingConnection.readyState === 1) { // 1 for connected
      // console.log(`Reusing existing connection for key '${connectionKeyInMap}' (DB: ${actualDbNameForConnection}).`);
      return existingConnection;
    }
    // console.warn(`Found stale connection for key '${connectionKeyInMap}'. Attempting to remove and reconnect.`);
    try {
      await existingConnection.close();
    } catch (closeError) {
      console.error(`Error closing stale connection for ${connectionKeyInMap}:`, closeError);
    }
    serverConnections.delete(connectionKeyInMap);
  }

  // New connection logic
  try {
    const newConnection = mongoose.createConnection(serverDbUri);
    registerTenantModels(newConnection); // Register models on the new connection
    await newConnection.openUri(serverDbUri);

    // console.log(`Successfully connected to database: '${actualDbNameForConnection}' (URI: ${serverDbUri}). Storing with key '${connectionKeyInMap}'.`);
    serverConnections.set(connectionKeyInMap, newConnection);
    return newConnection;
  } catch (error) {
    console.error(`Error connecting to database (Target DB: ${actualDbNameForConnection}, URI: ${serverDbUri}, Connection Key: ${connectionKeyInMap}):`, error);
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
    // In dev, all serverNames use the same shared connection key.
    // If an individual serverName is passed, we map it to the shared key.
    // However, this function is typically called by closeAllConnections with the actual map keys.
    // If called directly with a serverName, it should resolve to the shared key.
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

// Ensure connections are closed gracefully on application shutdown
process.on('SIGINT', async () => {
  await closeAllConnections();
  process.exit(0);
});
