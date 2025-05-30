import { Request, Response, NextFunction } from 'express';
import { Settings } from '../models/mongodb-schemas';

/**
 * Middleware to verify API key for Minecraft routes
 * This ensures that only authorized Minecraft plugins can access these endpoints
 */
export async function verifyMinecraftApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Get API key from request header
    const apiKey = req.header('X-API-Key');
    
    // Skip auth check if in development mode and no API key is set
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
    
    // First check environment variable for API key
    const envApiKey = process.env.MINECRAFT_API_KEY;
    if (envApiKey && apiKey === envApiKey) {
      return next();
    }
      // If no match in env var, check database settings
    const settings = await Settings.findOne({});
    
    // Check if settings exists and has the right structure
    if (!settings || !settings.settings) {
      return res.status(401).json({
        status: 401, 
        message: 'API key authentication is not properly configured'
      });
    }
    
    // Get API key from settings
    let configuredApiKey: string | undefined;
    
    // Handle different potential formats of settings.settings
    if (settings.settings instanceof Map) {
      configuredApiKey = settings.settings.get('minecraft_api_key');
    } else if (typeof settings.settings === 'object') {
      configuredApiKey = (settings.settings as any).minecraft_api_key;
    }
    
    if (configuredApiKey === undefined) {
      return res.status(401).json({
        status: 401,
        message: 'API key not configured in settings'
      });
    }
    
    // Verify the provided API key
    if (configuredApiKey !== apiKey) {
      return res.status(401).json({
        status: 401, 
        message: 'Invalid API key'
      });
    }
    
    // API key is valid, proceed
    next();
  } catch (error) {
    console.error('Error verifying API key:', error);
    return res.status(500).json({
      status: 500,
      message: 'Internal server error during authentication'
    });
  }
}
