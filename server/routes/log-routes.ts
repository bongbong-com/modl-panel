import { Log } from '../models/mongodb-schemas';

/**
 * Creates a system log entry
 * @param description - Description of the system event
 * @param level - Log level (info, warning, error, moderation)
 * @param source - Source of the log (system, staff username, etc)
 * @returns - The created log entry
 */
export async function createSystemLog(
  description: string, 
  level: 'info' | 'warning' | 'error' | 'moderation' = 'info', 
  source: string = 'system'
) {
  try {
    const logEntry = new Log({
      description,
      level,
      source,
      created: new Date()
    });
    await logEntry.save();
    console.log(`LOG: ${description}`);
    return logEntry;
  } catch (error) {
    console.error('Error creating system log:', error);
    // Don't throw - logging should never interrupt the main flow
    return null;
  }
}