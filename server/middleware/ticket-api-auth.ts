import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware to verify API key for ticket creation routes
 * This ensures that only authorized external systems can create tickets
 * Now uses the unified API key
 */
export async function verifyTicketApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Get API key from request header (both old and new header formats supported)
    const apiKey = req.header('X-API-Key') || req.header('X-Ticket-API-Key');
    
    // Skip auth check if in development mode and SKIP_API_AUTH is true
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_API_AUTH === 'true') {
      return next();
    }
    
    // If no API key provided
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized - API key required',
        message: 'Please provide a valid API key in the X-API-Key header'
      });
    }
    
    // Check for serverDbConnection (should be populated by preceding middleware)
    if (!req.serverDbConnection) {
      console.error('[Unified API Auth] Error: serverDbConnection not found on request. Ensure subdomainDbMiddleware runs before this.');
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database connection not configured for authentication.'
      });
    }

    const Settings = req.serverDbConnection.model('Settings');
    // Get settings document to check for the unified API key
    const settingsDoc = await Settings.findOne({});
    
    // Check if settings exists and has the right structure
    if (!settingsDoc || !settingsDoc.settings) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key authentication is not properly configured. No settings document found or settings map is missing.`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key authentication is not properly configured for this server'
      });
    }
    
    // Get unified API key from settings (check new unified key first, then fallback to legacy keys)
    let configuredApiKey: string | undefined;
    
    // settingsDoc.settings is expected to be a Map
    if (settingsDoc.settings instanceof Map) {
      configuredApiKey = settingsDoc.settings.get('api_key') || 
                         settingsDoc.settings.get('ticket_api_key') || 
                         settingsDoc.settings.get('minecraft_api_key');
    } else {
      // This case should ideally not happen if schema is enforced
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] settingsDoc.settings is not a Map. Attempting to access as object.`);
      configuredApiKey = (settingsDoc.settings as any).api_key || 
                         (settingsDoc.settings as any).ticket_api_key || 
                         (settingsDoc.settings as any).minecraft_api_key;
    }
    
    if (configuredApiKey === undefined) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] API key not configured in settings.`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key not configured in server settings'
      });
    }
    
    // Verify the provided API key
    if (configuredApiKey !== apiKey) {
      console.warn(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Invalid API key provided.`);
      return res.status(401).json({
        error: 'Unauthorized', 
        message: 'Invalid API key'
      });
    }
    
    // API key is valid, proceed
    next();
  } catch (error) {
    console.error(`[Unified API Auth - ${req.serverName || 'Unknown Server'}] Error verifying API key:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Internal server error during authentication'
    });
  }
}

/**
 * Generate a secure API key for tickets
 */
export function generateTicketApiKey(): string {
  // Generate a random 32-byte key and encode it as base64url
  const randomBytes = crypto.randomBytes(32);
  return randomBytes.toString('base64url'); // base64url is URL-safe
}
