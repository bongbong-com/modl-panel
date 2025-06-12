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
    serverName = 'testlocal'; // For local dev, 'testlocal' is the conventional subdomain
    return next();
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

  // At this point, 'serverName' is a non-empty, non-"undefined" derived string (e.g., "mypanel", "testlocal").
  // This derived 'serverName' must exist as a 'customDomain' in the database.
  let globalConnection: MongooseConnection;
  try {
    globalConnection = await connectToGlobalModlDb();
    const ModlServerModel = globalConnection.model('ModlServer', ModlServerSchema);
    
    const serverConfig = await ModlServerModel.findOne({ customDomain: serverName });

    if (!serverConfig) {
      return res.status(404).send(`Panel for '${serverName}' is not configured or does not exist.`);
    }

    // @ts-ignore
    req.serverConfig = serverConfig;
    // @ts-ignore // Consistently set serverName to the derived subdomain (customDomain) if serverConfig is found
    req.serverName = serverName;

    // Define paths accessible *before* email verification for this specific panel
    const allowedPreVerificationPagePaths = [
        '/pending-verification',      // Example page: "Check your email to verify"
        '/resend-verification',       // Example page or API endpoint to resend verification
        '/verify-email'               // The actual verification link target (GET request)
    ];
    // API prefixes/paths related to authentication & verification that should always be accessible
    const alwaysAllowedApiPatterns = [
        '/api/auth/',                 // Covers all auth routes like /api/auth/login, /api/auth/register
        '/api/request-email-verification' // Specific endpoint to request a new verification token
    ];

    const isPathAllowedPreVerification = 
        allowedPreVerificationPagePaths.includes(req.path) ||
        alwaysAllowedApiPatterns.some(pattern => req.path.startsWith(pattern));

    if (!serverConfig.emailVerified && !isPathAllowedPreVerification) {
      // User is trying to access a panel resource that requires email verification,
      // but their email for this panel is not verified, and the path is not exempt.
      if (req.path.startsWith('/api/')) {
        // For API requests, return JSON 404
        return res.status(404).json({ message: 'Panel access denied. Email verification required.' });
      } else {
        // For browser navigation, return a 404 page/message.
        // A redirect to a specific "please verify your email" page might offer better UX.
        // e.g., return res.redirect(`http://${serverConfig.customDomain}.${DOMAIN}/auth/verify-prompt`);
        return res.status(404).send('Panel not accessible. Please verify your email or check the URL.');
      }
    }
    
    // If email is verified, proceed to connect to server-specific DB
    if (serverConfig.emailVerified) {
      // @ts-ignore
      req.serverDbConnection = await connectToServerDb(serverName); // Ensure derived serverName is used here
      // req.serverName is already set
    }
    
    next();

  } catch (error: any) {
    console.error(`[ERROR] Subdomain middleware for ${hostname} (derived subdomain ${serverName}): ${error.message}`);
    // Avoid exposing raw error details to the client for security.
    return res.status(500).send('An internal error occurred while processing your panel request.');
  }
}
