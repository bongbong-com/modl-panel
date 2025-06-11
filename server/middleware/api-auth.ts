import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to verify API key for Minecraft routes
 * This ensures that only authorized Minecraft plugins can access these endpoints
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
      console.error('[API Auth] Error: serverDbConnection not found on request. Ensure subdomainDbMiddleware runs before this.');
      return res.status(503).json({
        status: 503,
        message: 'Service unavailable. Database connection not configured for authentication.'
      });
    }

    const Settings = req.serverDbConnection.model('Settings');
    // If no match in env var, check database settings for the specific tenant
    const settingsDoc = await Settings.findOne({}); // settingsDoc to avoid conflict with 'settings' variable name
    
    // Check if settings exists and has the right structure
    if (!settingsDoc || !settingsDoc.settings) {
      console.warn(`[API Auth - ${req.serverName || 'Unknown Server'}] API key authentication is not properly configured. No settings document found or settings map is missing.`);
      return res.status(401).json({
        status: 401, 
        message: 'API key authentication is not properly configured for this server'
      });
    }
    
    // Get API key from settings
    let configuredApiKey: string | undefined;
    
    // settingsDoc.settings is expected to be a Map
    if (settingsDoc.settings instanceof Map) {
      configuredApiKey = settingsDoc.settings.get('minecraft_api_key');
    } else {
      // This case should ideally not happen if schema is enforced
      console.warn(`[API Auth - ${req.serverName || 'Unknown Server'}] settingsDoc.settings is not a Map. Attempting to access as object.`);
      configuredApiKey = (settingsDoc.settings as any).minecraft_api_key;
    }
    
    if (configuredApiKey === undefined) {
      console.warn(`[API Auth - ${req.serverName || 'Unknown Server'}] Minecraft API key not configured in settings.`);
      return res.status(401).json({
        status: 401,
        message: 'API key not configured in server settings'
      });
    }
    
    // Verify the provided API key
    if (configuredApiKey !== apiKey) {
      console.warn(`[API Auth - ${req.serverName || 'Unknown Server'}] Invalid API key provided.`);
      return res.status(401).json({
        status: 401, 
        message: 'Invalid API key'
      });
    }
    
    // API key is valid, proceed
    next();
  } catch (error) {
    console.error(`[API Auth - ${req.serverName || 'Unknown Server'}] Error verifying API key:`, error);
    return res.status(500).json({
      status: 500,
      message: 'Internal server error during authentication'
    });
  }
}
