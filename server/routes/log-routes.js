const { Log } = require('../models/mongodb-schemas');

/**
 * Creates a system log entry
 * @param {string} description - Description of the system event
 * @param {string} level - Log level (info, warning, error, moderation)
 * @param {string} source - Source of the log (system, staff username, etc)
 * @returns {Promise<Object>} - The created log entry
 */
async function createSystemLog(description, level = 'info', source = 'system') {
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

module.exports = {
  createSystemLog
};