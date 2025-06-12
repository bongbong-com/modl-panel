import { Request, Response, NextFunction } from 'express';
import { Connection as MongooseConnection } from 'mongoose';
import { connectToGlobalModlDb, connectToServerDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

const DOMAIN = process.env.DOMAIN || 'modl.gg';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export async function subdomainDbMiddleware(req: Request, res: Response, next: NextFunction) {
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

  if (!serverName) {
    // This means the hostname was not identified as a panel subdomain (e.g., it's the base domain, www.modl.gg, or a non-matching custom domain).
    // The preceding logic should have already called next() for these cases.
    // This check is a safeguard; if serverName is not set, it's not a panel request for this middleware to process further.
    return next();
  }

  // At this point, 'serverName' is the derived subdomain (e.g., "mypanel", "testlocal").
  // This derived 'serverName' must exist as a 'customDomain' in the database.
  let globalConnection: MongooseConnection;
  try {
    globalConnection = await connectToGlobalModlDb();
    const ModlServerModel = globalConnection.model('ModlServer', ModlServerSchema);
    
    // Query by 'customDomain' using the derived serverName (which is the subdomain)
    const serverConfig = await ModlServerModel.findOne({ customDomain: serverName });

    if (!serverConfig) {
      // A subdomain was parsed from the hostname, but it's not registered in the database.
      return res.status(404).send(`Panel for '${serverName}' is not configured or does not exist.`);
    }

    // Attach serverConfig to request for potential use in other routes or middleware
    // @ts-ignore
    req.serverConfig = serverConfig;

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
        req.serverDbConnection = await connectToServerDb(serverConfig.customDomain); // Use customDomain

        // Handle provisioning status
        // This redirects to an "in-progress" page if provisioning isn't complete.
        if ((serverConfig.provisioningStatus === 'pending' || serverConfig.provisioningStatus === 'in-progress') &&
            !req.path.startsWith('/api/provisioning/status') && // Allow checking status
            req.path !== '/provisioning-in-progress' &&      // Allow accessing the status page itself
            req.path !== '/verify-email'                     // Don't block verification if provisioning is pending
            ) {
            // If provisioning is not complete and the current path is not an allowed exception,
            // redirect to the provisioning in progress page, passing the serverName.
            return res.redirect(`/provisioning-in-progress?server=${serverName}`);
        }
    }
    
    next();

  } catch (error: any) {
    console.error(`[ERROR] Subdomain middleware for ${hostname} (derived subdomain ${serverName}): ${error.message}`);
    // Avoid exposing raw error details to the client for security.
    return res.status(500).send('An internal error occurred while processing your panel request.');
  }
}
