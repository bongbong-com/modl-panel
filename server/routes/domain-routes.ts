import express from 'express';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkRole } from '../middleware/role-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';
import { IncomingMessage } from 'http';

const router = express.Router();
const resolveCname = promisify(dns.resolveCname);

// Middleware to ensure user is authenticated and has proper role
router.use(isAuthenticated);
router.use(checkRole(['Super Admin', 'Admin']));

interface DomainStatus {
  domain: string;
  status: 'pending' | 'active' | 'error' | 'verifying';
  cnameConfigured: boolean;
  sslStatus: 'pending' | 'active' | 'error';
  lastChecked: string;
  error?: string;
}

// Get current domain configuration
router.get('/', async (req, res) => {
  try {
    const server = req.modlServer;
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }

    // Check if custom domain is configured
    const customDomain = server.customDomain_override || null;
    
    if (customDomain) {
      // Check current status
      const status = await checkDomainStatus(customDomain, server.customDomain);
      
      res.json({
        customDomain,
        status,
        originalDomain: `${server.customDomain}.modl.gg`
      });
    } else {
      res.json({
        customDomain: null,
        originalDomain: `${server.customDomain}.modl.gg`
      });
    }
  } catch (error) {
    console.error('Error getting domain configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configure custom domain
router.post('/', async (req, res) => {
  try {
    const { customDomain } = req.body;
    const server = req.modlServer;
    
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }

    if (!customDomain || !isValidDomain(customDomain)) {
      return res.status(400).json({ error: 'Invalid domain name' });
    }

    // Check if domain is already in use by another server
    const globalDb = await connectToGlobalModlDb();
    const ServerModel = globalDb.model('ModlServer', ModlServerSchema);
    
    const existingServer = await ServerModel.findOne({ 
      customDomain_override: customDomain,
      _id: { $ne: server._id }
    });
    
    if (existingServer) {
      return res.status(409).json({ error: 'Domain is already in use by another server' });
    }

    // Update server configuration
    await ServerModel.findByIdAndUpdate(server._id, {
      customDomain_override: customDomain,
      customDomain_status: 'pending',
      customDomain_lastChecked: new Date()
    });

    // Generate Caddy configuration
    await generateCaddyConfig(customDomain, server.customDomain);

    const status: DomainStatus = {
      domain: customDomain,
      status: 'pending',
      cnameConfigured: false,
      sslStatus: 'pending',
      lastChecked: new Date().toISOString()
    };

    res.json({
      message: 'Domain configured successfully',
      status
    });
  } catch (error) {
    console.error('Error configuring domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify domain configuration
router.post('/verify', async (req, res) => {
  try {
    const { domain } = req.body;
    const server = req.modlServer;
    
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }

    const status = await checkDomainStatus(domain, server.customDomain);
    
    // Update server status in database
    const globalDb = await connectToGlobalModlDb();
    const ServerModel = globalDb.model('ModlServer', ModlServerSchema);
    
    await ServerModel.findByIdAndUpdate(server._id, {
      customDomain_status: status.status,
      customDomain_lastChecked: new Date(),
      customDomain_error: status.error || null
    });

    if (status.cnameConfigured && status.status !== 'active') {
      // Trigger SSL certificate generation
      await triggerSSLGeneration(domain);
      status.status = 'verifying';
    }

    res.json({ status });
  } catch (error) {
    console.error('Error verifying domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove custom domain
router.delete('/', async (req, res) => {
  try {
    const server = req.modlServer;
    
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }

    const customDomain = server.customDomain_override;
    
    if (customDomain) {
      // Remove Caddy configuration
      await removeCaddyConfig(customDomain);
      
      // Update server configuration
      const globalDb = await connectToGlobalModlDb();
      const ServerModel = globalDb.model('ModlServer', ModlServerSchema);
      
      await ServerModel.findByIdAndUpdate(server._id, {
        $unset: {
          customDomain_override: 1,
          customDomain_status: 1,
          customDomain_lastChecked: 1,
          customDomain_error: 1
        }
      });
    }

    res.json({ message: 'Custom domain removed successfully' });
  } catch (error) {
    console.error('Error removing domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to validate domain
function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

// Helper function to check domain status
async function checkDomainStatus(customDomain: string, originalSubdomain: string): Promise<DomainStatus> {
  const status: DomainStatus = {
    domain: customDomain,
    status: 'pending',
    cnameConfigured: false,
    sslStatus: 'pending',
    lastChecked: new Date().toISOString()
  };

  try {
    // Check CNAME record
    const cnameRecords = await resolveCname(customDomain);
    const expectedTarget = `${originalSubdomain}.modl.gg`;
    
    status.cnameConfigured = cnameRecords.some(record => 
      record.toLowerCase() === expectedTarget.toLowerCase()
    );

    if (!status.cnameConfigured) {
      status.status = 'error';
      status.error = `CNAME record not found or incorrect. Expected: ${expectedTarget}`;
      return status;
    }

    // Check if domain is accessible (basic HTTP check)
    const isAccessible = await checkDomainAccessibility(customDomain);
    
    if (isAccessible) {
      status.status = 'active';
      status.sslStatus = 'active';
    } else {
      status.status = 'verifying';
      status.sslStatus = 'pending';
    }

  } catch (error: any) {
    status.status = 'error';
    status.error = `DNS resolution failed: ${error?.message || 'Unknown error'}`;
  }

  return status;
}

// Helper function to check domain accessibility
async function checkDomainAccessibility(domain: string): Promise<boolean> {
  try {
    // Use the built-in fetch if available (Node 18+) or implement a basic HTTP check
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve) => {
      const options = {
        hostname: domain,
        port: 443,
        path: '/',
        method: 'HEAD',
        timeout: 5000,
        rejectUnauthorized: false // Allow self-signed certificates during setup
      };
      
      const req = https.request(options, (res: IncomingMessage) => {
        resolve((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  } catch (error) {
    return false;
  }
}

// Helper function to generate Caddy configuration
async function generateCaddyConfig(customDomain: string, originalSubdomain: string): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const caddyConfigDir = process.env.CADDY_CONFIG_DIR || '/etc/caddy/conf.d';
    const configFile = path.join(caddyConfigDir, `${customDomain}.conf`);
    
    const config = `
${customDomain} {
    reverse_proxy localhost:5173 {
        header_up Host {http.request.host}
        header_up X-Real-IP {http.request.remote}
        header_up X-Forwarded-For {http.request.remote}
        header_up X-Forwarded-Proto {http.request.scheme}
    }
    
    # Enable automatic HTTPS
    tls {
        issuer acme {
            email admin@modl.gg
        }
    }
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # Enable compression
    encode gzip
    
    # Logging
    log {
        output file /var/log/caddy/${customDomain}.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
    }
}
`;

    await fs.mkdir(caddyConfigDir, { recursive: true });
    await fs.writeFile(configFile, config);
    
    // Reload Caddy configuration
    await reloadCaddyConfig();
    
    console.log(`Generated Caddy configuration for ${customDomain}`);
  } catch (error: any) {
    console.error('Error generating Caddy configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to remove Caddy configuration
async function removeCaddyConfig(customDomain: string): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const caddyConfigDir = process.env.CADDY_CONFIG_DIR || '/etc/caddy/conf.d';
    const configFile = path.join(caddyConfigDir, `${customDomain}.conf`);
    
    try {
      await fs.unlink(configFile);
      console.log(`Removed Caddy configuration for ${customDomain}`);
    } catch (error) {
      // File might not exist, which is fine
      if ((error as any)?.code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Reload Caddy configuration
    await reloadCaddyConfig();
  } catch (error: any) {
    console.error('Error removing Caddy configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to reload Caddy configuration
async function reloadCaddyConfig(): Promise<void> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('caddy reload --config /etc/caddy/Caddyfile');
    console.log('Caddy configuration reloaded successfully');
  } catch (error: any) {
    console.error('Error reloading Caddy configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to trigger SSL certificate generation
async function triggerSSLGeneration(domain: string): Promise<void> {
  // This is handled automatically by Caddy when the configuration is loaded
  // and the domain is accessible. We might add additional logic here if needed.
  console.log(`SSL certificate generation triggered for ${domain}`);
}

export default router;
