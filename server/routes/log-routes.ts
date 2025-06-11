import { Connection, Document } from 'mongoose';

// This interface should align with the actual Log schema defined in mongodb-schemas.ts
interface ILogDocument extends Document {
  description: string;
  level: string;
  source: string;
  created: Date;
  // Any other fields from the Log schema should be added here
}

/**
 * Creates a system log entry.
 * Assumes 'Log' model (based on Log.schema from mongodb-schemas) is registered on dbConnection.
 * @param dbConnection Mongoose connection for the tenant. Can be null or undefined.
 * @param serverName Name of the server instance. Can be null or undefined.
 * @param description Description of the system event.
 * @param level Log level ('info', 'warning', 'error', 'moderation'). Defaults to 'info'.
 * @param source Source of the log (e.g., 'system', 'staff username'). Defaults to 'system'.
 * @returns A promise that resolves to the created log document or null if an error occurs or dbConnection is not provided.
 */
export async function createSystemLog(
  dbConnection: Connection | undefined | null,
  serverName: string | undefined | null,
  description: string,
  level: 'info' | 'warning' | 'error' | 'moderation' = 'info',
  source: string = 'system'
): Promise<ILogDocument | null> {
  if (!dbConnection) {
    console.error('createSystemLog called without a dbConnection. Log will not be saved.');
    const serverIdMessage = serverName || 'Unknown Server';
    console.log(`LOG_ATTEMPT (${serverIdMessage} - NO DB): ${description} [${level}, ${source}]`);
    return null;
  }
  try {
    // Retrieve the 'Log' model, assuming it's been registered on this specific dbConnection
    const LogModel = dbConnection.model<ILogDocument>('Log');
    const logEntry = new LogModel({
      description,
      level,
      source,
      created: new Date(),
    });
    await logEntry.save();
    const serverIdMessage = serverName || dbConnection.name; // Use connection name as fallback for logging
    console.log(`LOG (${serverIdMessage}): ${description} [${level}, ${source}]`);
    return logEntry;
  } catch (error) {
    const serverIdMessage = serverName || (dbConnection ? dbConnection.name : 'Unknown Server');
    console.error(`Error creating system log for ${serverIdMessage}:`, error);
    return null;
  }
}