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
    
    // Check if API keys document exists - create it if missing (for existing servers)
    if (!apiKeysDoc || !apiKeysDoc.data) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key document not found. Creating default API key document.`);
      
      // Create default API key document for existing servers
      const newApiKey = generateTicketApiKey();
      const newApiKeysDoc = await Settings.findOneAndUpdate(
        { type: 'apiKeys' },
        {
          type: 'apiKeys',
          data: {
            api_key: newApiKey
          }
        },
        { upsert: true, new: true }
      );
      
      console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Created default API key document with key: ${newApiKey}`);
      
      // Use the newly created API key
      if (newApiKeysDoc && newApiKeysDoc.data && newApiKeysDoc.data.api_key) {
        const configuredApiKey = newApiKeysDoc.data.api_key;
        console.log(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Using newly created API key for authentication`);
        
        // Verify the provided API key against the new one
        if (configuredApiKey !== apiKey) {
          console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Invalid API key provided. Please use the API key from the admin panel.`);
          return res.status(401).json({
            status: 401,
            message: 'Invalid API key. Please use the API key from the admin panel.'
          });
        }
        
        // API key is valid, proceed
        return next();
      }
      
      // If creation failed, return error
      return res.status(401).json({
        status: 401, 
        message: 'API key authentication is not properly configured for this server'
      });
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
