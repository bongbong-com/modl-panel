import { Request, Response, NextFunction } from 'express';
import { generateTicketApiKey } from './ticket-api-auth';

/**
 * Middleware to verify API key for Minecraft routes
 * This ensures that only authorized Minecraft plugins can access these endpoints
 * Now uses the unified API key
 */
export async function verifyMinecraftApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Get API key from request header
    const apiKey = req.header('X-API-Key');
    
    // Skip auth check if in development mode and SKIP_API_AUTH is true
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_API_AUTH === 'true') {
      return next();
    }
    
    // If no API key provided
    if (!apiKey) {
      return res.status(401).json({
        status: 401,
        message: 'Unauthorized - API key required'
      });
    }
    
    // First check environment variable for API key (global override)
    const envApiKey = process.env.MINECRAFT_API_KEY;
    if (envApiKey && apiKey === envApiKey) {
      return next();
    }

    // Check for serverDbConnection (should be populated by preceding middleware)
    if (!req.serverDbConnection) {
      console.error('[Unified API Auth] Error: serverDbConnection not found on request. Ensure subdomainDbMiddleware runs before this.');
      return res.status(503).json({
        status: 503,
        message: 'Service unavailable. Database connection not configured for authentication.'
      });
    }

    const Settings = req.serverDbConnection.model('Settings');
    // Check database settings for the specific tenant using separate documents schema
    const apiKeysDoc = await Settings.findOne({ type: 'apiKeys' });
    
    console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API Keys Document:`, apiKeysDoc ? 'Found' : 'Not Found');
    if (apiKeysDoc) {
      console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API Keys Data:`, apiKeysDoc.data);
    }
    
    // Check if API keys document exists and has data
    if (!apiKeysDoc || !apiKeysDoc.data || !apiKeysDoc.data.api_key) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key document exists but has no api_key. Updating document.`);
      
      // Generate a new API key
      const newApiKey = generateTicketApiKey();
      
      // If document exists but has no data, update it
      if (apiKeysDoc) {
        apiKeysDoc.data = { api_key: newApiKey };
        await apiKeysDoc.save();
        console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Updated existing API key document with key: ${newApiKey}`);
      } else {
        // Document doesn't exist, create it (should not happen due to createDefaultSettings)
        console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key document not found. This should not happen.`);
        return res.status(401).json({
          status: 401, 
          message: 'API key authentication is not properly configured for this server'
        });
      }
      
      // Use the newly created API key
      const configuredApiKey = newApiKey;
      console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Using newly created API key for authentication`);
      
      // Verify the provided API key against the new one
      if (configuredApiKey !== apiKey) {
        console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Invalid API key provided. New API key: ${newApiKey}`);
        return res.status(401).json({
          status: 401,
          message: `Invalid API key. Please use the new API key: ${newApiKey}`
        });
      }
      
      // API key is valid, proceed
      return next();
    }
    
    // Get unified API key from API keys document (only use api_key, remove legacy fallbacks)
    const configuredApiKey = apiKeysDoc.data.api_key;
    
    console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Configured API Key:`, configuredApiKey ? 'Found' : 'Not Found');
    console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Provided API Key:`, apiKey ? 'Provided' : 'Not Provided');
    
    if (configuredApiKey === undefined || configuredApiKey === null) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key not configured in settings. Please generate an API key in the admin panel.`);
      return res.status(401).json({
        status: 401,
        message: 'API key not configured in server settings. Please generate an API key in the admin panel.'
      });
    }
    
    // Verify the provided API key
    if (configuredApiKey !== apiKey) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Invalid API key provided.`);
      return res.status(401).json({
        status: 401, 
        message: 'Invalid API key'
      });
    }
    
    // API key is valid, proceed
    next();
  } catch (error) {
    console.error(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Error verifying API key:`, error);
    return res.status(500).json({
      status: 500,
      message: 'Internal server error during authentication'
    });
  }
}
