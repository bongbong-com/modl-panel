import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import { connectToServerDb } from '../db/connectionManager';

const MODL_GG_DOMAIN = process.env.MODL_GG_DOMAIN || 'modl.gg';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export async function subdomainDbMiddleware(req: Request, res: Response, next: NextFunction) {
  const hostname = req.hostname;
  let serverName: string | undefined = undefined;

  // Detailed debugging logs
  console.log(`[SUBDOMAIN_DEBUG] Request received: ${req.method} ${req.originalUrl}, Hostname: ${hostname}`);

  if (IS_DEVELOPMENT && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    // Reverted to simpler logic without query param override
    serverName = 'testlocal'; 
    console.log(`Subdomain middleware (DEV LOCALHOST): Simulating serverName: ${serverName} for hostname: ${hostname}.`);
  } else if (hostname.endsWith(`.${MODL_GG_DOMAIN}`)) {
    const parts = hostname.split('.');
    const baseDomainParts = MODL_GG_DOMAIN.split('.').length;

    if (parts.length > baseDomainParts) {
      serverName = parts[0]; // Assuming the first part is the serverName/subdomain
    }
  }

  if (serverName) {
    req.serverName = serverName;
    try {
      const dbConnection: Connection = await connectToServerDb(serverName);
      req.serverDbConnection = dbConnection;
      console.log(`Subdomain middleware: Attached DB connection for server: ${serverName} (DB: ${dbConnection.name})`);
      return next();
    } catch (error) {
      console.error(`Subdomain middleware: Failed to connect to DB for server ${serverName}:`, error);
      res.status(503).json({ error: `Service unavailable. Database connection failed for server ${serverName}.` });
      return; // IMPORTANT: Stop processing
    }
  }
  
  // If it's not a recognized subdomain (e.g., direct IP, or the main domain like modl.gg itself in prod without specific handling)
  // or if the subdomain parsing logic didn't lead to a server-specific connection attempt,
  // we don't attach a server-specific DB. 
  // The request proceeds, and routes that require req.serverDbConnection must check for its existence.
  // console.log(`Subdomain middleware: No server-specific DB for hostname: ${hostname}. Allowing request to proceed for global or non-tenant routes.`);
  // Commented out the above log to reduce noise if serverName is not found, will rely on the new debug logs.
  next();
}
