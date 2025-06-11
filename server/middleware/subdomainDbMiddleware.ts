import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import { connectToServerDb } from '../db/connectionManager';

const DOMAIN = process.env.DOMAIN || 'modl.gg';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export async function subdomainDbMiddleware(req: Request, res: Response, next: NextFunction) {
  const hostname = req.hostname;
  let serverName: string | undefined = undefined;

  // Detailed debugging logs
  // console.log(`[SUBDOMAIN_DEBUG] Request received: ${req.method} ${req.originalUrl}, Hostname: ${hostname}`);

  if (IS_DEVELOPMENT && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    // Reverted to simpler logic without query param override
    serverName = 'testlocal'; 
    // console.log(`Subdomain middleware (DEV LOCALHOST): Simulating serverName: ${serverName} for hostname: ${hostname}.`);
  } else if (hostname.endsWith(`.${DOMAIN}`)) {
    const parts = hostname.split('.');
    const baseDomainParts = DOMAIN.split('.').length;

    if (parts.length > baseDomainParts) {
      serverName = parts.slice(0, parts.length - baseDomainParts).join('.');
      // console.log(`Subdomain middleware: Extracted serverName: ${serverName} from hostname: ${hostname}`);
    } else {
      // console.log(`Subdomain middleware: No serverName extracted for hostname: ${hostname}. Using default or no tenant.`);
    }
  } else {
    // console.log(`Subdomain middleware: Hostname ${hostname} does not match development or DOMAIN. No serverName set.`);
  }

  if (!serverName) {
    // If it's not a recognized subdomain (e.g., direct IP, or the main domain like modl.gg itself in prod without specific handling)
    // or if the subdomain parsing logic didn't lead to a server-specific connection attempt,
    // we don't attach a server-specific DB. 
    // The request proceeds, and routes that require req.serverDbConnection must check for its existence.
    // console.log(`Subdomain middleware: No server-specific DB for hostname: ${hostname}. Allowing request to proceed for global or non-tenant routes.`);
    return next();
  }

  // console.log(`[SUBDOMAIN_DEBUG] Attempting to connect to DB for serverName: "${serverName}"`);
  try {
    const dbConnection = await connectToServerDb(serverName);
    req.serverDbConnection = dbConnection;
    req.serverName = serverName; 
    // console.log(`[SUBDOMAIN_DEBUG] Successfully connected to DB: ${dbConnection.name} for server: ${serverName}`);
    next();
  } catch (error) {
    console.error(`Subdomain middleware: Failed to connect to DB for server ${serverName}:`, error);
    res.status(503).json({ error: `Service unavailable. Database connection failed for server ${serverName}.` });
  }
}
