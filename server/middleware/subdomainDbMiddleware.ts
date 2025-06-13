import { Request, Response, NextFunction } from 'express';
import { Connection as MongooseConnection } from 'mongoose';
import { connectToGlobalModlDb, connectToServerDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

const DOMAIN = process.env.DOMAIN || 'modl.gg';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export async function subdomainDbMiddleware(req: Request, res: Response, next: NextFunction) {
  // Bypass for common asset types or paths used by Vite/client-side apps
  // This should be the very first check.
  const assetPattern = /\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)$/i;
  if (
    req.path.startsWith('/src/') || // Vite dev path for source modules (like /src/main.tsx)
    req.path.startsWith('/@vite/') || // Vite internal client
    req.path.startsWith('/@fs/') || // Vite file system access prefix
    req.path.startsWith('/node_modules/') || // Vite might serve optimized deps from here
    req.path.startsWith('/assets/') || // Project's static assets folder if served from root
    assetPattern.test(req.path) // General asset extensions
  ) {
    return next();
  }

  // Bypass this middleware for globally accessible API routes
  if (req.path.startsWith('/api/global/')) {
    return next();
  }

  // Allow /verify-email to bypass the main subdomain checks,
  // as it operates using a token and has its own server lookup logic.
  if (req.path === '/verify-email') {
    return next();
  }

  const hostname = req.hostname;
  let serverName: string | undefined = undefined; // This will hold the derived subdomain

  if (IS_DEVELOPMENT && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    serverName = 'testlocal';
    // @ts-ignore
    req.serverName = serverName;

    try {
      // @ts-ignore
      req.serverDbConnection = await connectToServerDb(serverName);
      // @ts-ignore
      console.log(`[DEBUG] SubdomainMiddleware: DEV MODE (localhost) - Connected to DB for ${serverName}. DB Connection valid: ${!!req.serverDbConnection}`);
      // For local development, bypass ModlServer lookup and assume email is verified.
      // @ts-ignore
      req.serverConfig = {
        customDomain: serverName,
        emailVerified: true,
        // Add any other essential serverConfig properties that might be accessed downstream,
        // with default/mock values suitable for local development.
        // For example, if provisioningStatus is checked:
        // provisioningStatus: 'completed'
      };
      return next(); // Bypass the rest of the middleware for localhost
    } catch (dbConnectError: any) {
      // @ts-ignore
      console.error(`[DEBUG] SubdomainMiddleware: DEV MODE (localhost) - Failed to connect to DB for ${serverName}. Error:`, dbConnectError.message);
      // @ts-ignore
      return res.status(503).json({ error: `Service unavailable. Could not connect to database for ${serverName} (localhost development).` });
    }
  } else if (hostname.endsWith(`.${DOMAIN}`)) {
    const parts = hostname.split('.');
    const baseDomainParts = DOMAIN.split('.').length;
    if (parts.length > baseDomainParts) {
      serverName = parts.slice(0, parts.length - baseDomainParts).join('.');
    } else {
      // Accessing base domain (e.g., modl.gg) or www.modl.gg
      return next(); // Not a panel subdomain, could be landing page etc.
    }
  } else {
    // Hostname doesn't end with .${DOMAIN} and isn't localhost.
    // Could be a custom domain not yet handled by this logic for panel resolution, or direct IP access.
    return next(); // Not a panel subdomain recognized by this middleware's primary logic
  }

  if (!serverName || serverName === "undefined") {
    if (serverName === "undefined") {
      console.warn(`[subdomainDbMiddleware] Blocked attempt to access panel with reserved name 'undefined' from hostname: ${hostname}`);
    }
    // Consider sending a specific error response if this path indicates a misconfiguration or bad request,
    // instead of just calling next(), which might lead to generic 404s downstream.
    // For now, maintaining existing behavior of calling next() if serverName is invalid.
    return next();
  }

  // @ts-ignore
  req.serverName = serverName; // Set serverName on the request now that it's determined

  // At this point, 'serverName' is a non-empty, non-"undefined" derived string (e.g., "mypanel", "testlocal").
  // This derived 'serverName' must exist as a 'customDomain' in the database.
  let globalConnection: MongooseConnection;
  try {
    globalConnection = await connectToGlobalModlDb();
    const ModlServerModel = globalConnection.model('ModlServer', ModlServerSchema);
    // @ts-ignore
    const serverConfig = await ModlServerModel.findOne({ customDomain: req.serverName });

    if (!serverConfig) {
      // @ts-ignore
      return res.status(404).send(`Panel for '${req.serverName}' is not configured or does not exist.`);
    }

    // @ts-ignore
    req.serverConfig = serverConfig;

    // Attempt to connect to the server-specific DB IF serverConfig was found
    // This needs to happen before email verification checks for routes that need DB but are public.
    try {
      // @ts-ignore
      req.serverDbConnection = await connectToServerDb(req.serverName);
    } catch (dbConnectError: any) {
      // @ts-ignore
      console.error(`[DEBUG] SubdomainMiddleware: connectToServerDb CATCH block for ${req.serverName}. Error:`, dbConnectError.message);
      // @ts-ignore
      console.error(`[SubdomainMiddleware] Failed to connect to DB for ${req.serverName}:`, dbConnectError.message);
      // @ts-ignore
      return res.status(503).json({ error: `Service unavailable. Could not connect to database for ${req.serverName}.` });
    }

    // @ts-ignore
    console.log(`[DEBUG] SubdomainMiddleware: Before final next() for ${req.serverName}. Path: ${req.path}. DB Connection valid: ${!!req.serverDbConnection}`);

    // Define paths accessible *before* email verification for this specific panel
    const allowedPreVerificationPagePaths = [
        '/pending-verification',      // Example page: "Check your email to verify"
        '/resend-verification',       // Example page or API endpoint to resend verification
        '/verify-email' // The actual verification link target (GET request)
    ];
    // API prefixes/paths related to authentication & verification that should always be accessible
    const alwaysAllowedApiPatterns = [
        '/api/auth/', // Covers all auth routes like /api/auth/login, /api/auth/register
        '/api/request-email-verification', // Specific endpoint to request a new verification token
        '/api/staff/check-email'      // This route needs DB but is pre-auth
    ];

    const isPathAllowedPreVerification =
        allowedPreVerificationPagePaths.includes(req.path) ||
        alwaysAllowedApiPatterns.some(pattern => req.path.startsWith(pattern));

    if (!serverConfig.emailVerified && !isPathAllowedPreVerification) {
      // User is trying to access a panel resource that requires email verification,
      // but their email for this panel is not verified, and the path is not exempt.
      if (req.path.startsWith('/api/')) {
        // For API requests, return JSON 403
        return res.status(403).json({ message: 'Panel access denied. Email verification required.' });
      } else {
        // For browser navigation, return a 403 page/message.
        return res.status(403).send('Panel not accessible. Please verify your email.');
      }
    }
    
    next();

  } catch (error: any) {
    // @ts-ignore
    const currentServerName = req.serverName || serverName; // Get the most available serverName for logging
    // @ts-ignore
    console.error(`[ERROR] Subdomain middleware for ${hostname} (derived subdomain ${currentServerName}): ${error.message}`);
    // Avoid exposing raw error details to the client for security.
    return res.status(500).send('An internal error occurred while processing your panel request.');
  }
}
