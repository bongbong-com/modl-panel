import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { registerRoutes } from "./routes"; // This should point to the updated routes.ts
import { setupVite, serveStatic, log } from "./vite";
import { subdomainDbMiddleware } from "./middleware/subdomainDbMiddleware"; // Import the middleware

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware setup
const MONGODB_URI = process.env.GLOBAL_MODL_DB_URI;
const isProduction = process.env.NODE_ENV === 'production';

// Apply the subdomain DB middleware early in the stack.
// It needs to run before any routes that depend on req.serverDbConnection.
app.use(subdomainDbMiddleware);

// Dynamically configure session middleware based on serverDbConnection
app.use((req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  if (req.serverDbConnection && req.serverDbConnection.getClient) {
    const serverSpecificSession = session({
      secret: process.env.SESSION_SECRET || "your-very-secure-secret-here",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        // @ts-ignore
        mongooseConnection: req.serverDbConnection, // Use the Mongoose connection directly
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native', // Default
        // collectionName: 'sessions' // Default collection name is 'sessions'
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'lax', // Or 'strict' depending on your needs
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
      }
    });
    serverSpecificSession(req, res, next); // Apply the session middleware for this request
  } else {
    // If no serverDbConnection is available (e.g., for global routes or errors),
    // proceed without session capabilities for this request.
    // Alternatively, a default in-memory session could be used here if necessary for some paths.
    log(`[Session] No serverDbConnection for path ${req.path}, skipping session initialization.`);
    next();
  }
});

/* // Commenting out the API request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});
*/

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
