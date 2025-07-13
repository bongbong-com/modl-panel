import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      hmr: { 
        server
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // If the request is for an API route, don't try to serve HTML
    if (url.startsWith('/api/')) {
      return next();
    }

    // Import subdomain middleware to validate the subdomain before serving frontend
    const { subdomainDbMiddleware } = await import('./middleware/subdomainDbMiddleware');
    
    // Apply subdomain validation first
    subdomainDbMiddleware(req, res, async (err) => {
      if (err || res.headersSent) {
        // If subdomain middleware rejected the request or already sent a response, don't serve frontend
        return next(err);
      }
      
      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist, but not for API routes
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
      // If it's an API route, it means no preceding API handler caught it.
      // This could be a 404 for an API endpoint.
      // Let Express default handling or a later error middleware deal with it.
      return next();
    }
    
    // Import subdomain middleware to validate the subdomain before serving frontend
    const { subdomainDbMiddleware } = await import('./middleware/subdomainDbMiddleware');
    
    // Apply subdomain validation first
    subdomainDbMiddleware(req, res, (err) => {
      if (err || res.headersSent) {
        // If subdomain middleware rejected the request or already sent a response, don't serve frontend
        return next(err);
      }
      // For valid subdomains, serve the index.html
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  });
}
