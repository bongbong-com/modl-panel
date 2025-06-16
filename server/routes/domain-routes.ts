import express from 'express';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkRole } from '../middleware/role-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';
import { IncomingMessage } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

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
        originalDomain: `${server.customDomain}.cobl.gg`
      });
    } else {
      res.json({
        customDomain: null,
        originalDomain: `${server.customDomain}.cobl.gg`
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

    // Generate Nginx configuration and request SSL certificate
    await generateNginxConfig(customDomain, server.customDomain);
    await requestSSLCertificate(customDomain);

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
      // Request SSL certificate with Certbot
      await requestSSLCertificate(domain);
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
      // Remove Nginx configuration and SSL certificate
      await removeNginxConfig(customDomain);
      await revokeSSLCertificate(customDomain);
      
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
    const expectedTarget = `${originalSubdomain}.cobl.gg`;
    
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

// Helper function to generate Nginx configuration
async function generateNginxConfig(customDomain: string, originalSubdomain: string): Promise<void> {
  try {
    // Try multiple possible config directories in order of preference
    const possibleDirs = [
      process.env.NGINX_CONFIG_DIR,
      '/etc/nginx/sites-available',
      '/etc/nginx/conf.d',
      path.join(process.cwd(), 'nginx-configs'),
      '/tmp/nginx-configs'
    ].filter(Boolean);

    let nginxConfigDir: string | null = null;
    let configFile: string | null = null;

    // Try each directory until we find one we can write to
    for (const dir of possibleDirs) {
      try {
        await fs.mkdir(dir!, { recursive: true });
        nginxConfigDir = dir!;
        configFile = path.join(dir!, `${customDomain}.conf`);
        break;
      } catch (error: any) {
        console.warn(`Cannot access directory ${dir}: ${error.message}`);
        continue;
      }
    }

    if (!nginxConfigDir || !configFile) {
      throw new Error('No writable directory found for Nginx configuration. Please check permissions or set NGINX_CONFIG_DIR environment variable.');
    }
    
    const appPort = process.env.PORT || '5000';
    const config = `# Custom domain configuration for ${customDomain}
# SSL certificate will be managed by Certbot

server {
    listen 80;
    server_name ${customDomain};
    
    # Let's Encrypt challenge handling
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${customDomain};
    
    # SSL certificate paths (will be set by Certbot)
    ssl_certificate /etc/letsencrypt/live/${customDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${customDomain}/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Logging
    access_log /var/log/nginx/${customDomain}-access.log;
    error_log /var/log/nginx/${customDomain}-error.log;
}
`;

    await fs.mkdir(nginxConfigDir, { recursive: true });
    await fs.writeFile(configFile, config);
    
    // Create symlink in sites-enabled if using sites-available
    if (nginxConfigDir === '/etc/nginx/sites-available') {
      const enabledFile = `/etc/nginx/sites-enabled/${customDomain}.conf`;
      try {
        await fs.symlink(configFile, enabledFile);
        console.log(`Created symlink for ${customDomain} in sites-enabled`);
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          console.warn(`Could not create symlink: ${error.message}`);
        }
      }
    }
    
    // Test and reload Nginx configuration
    await reloadNginxConfig();
    
    console.log(`Generated Nginx configuration for ${customDomain} in ${nginxConfigDir}`);
  } catch (error: any) {
    console.error('Error generating Nginx configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to remove Nginx configuration
async function removeNginxConfig(customDomain: string): Promise<void> {
  try {
    // Try the same directories as generation
    const possibleDirs = [
      process.env.NGINX_CONFIG_DIR,
      '/etc/nginx/sites-available',
      '/etc/nginx/conf.d',
      path.join(process.cwd(), 'nginx-configs'),
      '/tmp/nginx-configs'
    ].filter(Boolean);

    let found = false;
    for (const dir of possibleDirs) {
      const configFile = path.join(dir!, `${customDomain}.conf`);
      try {
        await fs.unlink(configFile);
        console.log(`Removed Nginx configuration for ${customDomain} from ${dir}`);
        found = true;
        
        // Also remove symlink if it exists
        if (dir === '/etc/nginx/sites-available') {
          const enabledFile = `/etc/nginx/sites-enabled/${customDomain}.conf`;
          try {
            await fs.unlink(enabledFile);
            console.log(`Removed symlink for ${customDomain} from sites-enabled`);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              console.warn(`Error removing symlink: ${error.message}`);
            }
          }
        }
        break;
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          console.warn(`Error removing config from ${dir}: ${error.message}`);
        }
        continue;
      }
    }

    if (!found) {
      console.warn(`Configuration file for ${customDomain} not found in any directory`);
    }
    
    // Reload Nginx configuration
    await reloadNginxConfig();
  } catch (error: any) {
    console.error('Error removing Nginx configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to reload Nginx configuration
async function reloadNginxConfig(): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    // Test Nginx configuration first
    try {
      await execAsync('nginx -t');
      console.log('Nginx configuration test passed');
    } catch (error: any) {
      console.error('Nginx configuration test failed:', error?.message || error);
      throw new Error('Invalid Nginx configuration');
    }

    // Reload Nginx
    await execAsync('systemctl reload nginx');
    console.log('Nginx configuration reloaded successfully');
  } catch (error: any) {
    // Check if it's a systemctl not found error (non-systemd systems)
    if (error?.message?.includes('systemctl: command not found')) {
      try {
        await execAsync('service nginx reload');
        console.log('Nginx reloaded successfully (using service command)');
      } catch (serviceError: any) {
        console.warn('Could not reload Nginx. Please reload manually.');
      }
    } else {
      console.error('Error reloading Nginx configuration:', error?.message || error);
      throw error;
    }
  }
}

// Helper function to request SSL certificate with Certbot
async function requestSSLCertificate(domain: string): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    console.log(`Requesting SSL certificate for ${domain} using Certbot...`);
    
    // Use webroot method for certificate generation
    const certbotCommand = `certbot certonly --webroot -w /var/www/html -d ${domain} --non-interactive --agree-tos --email admin@cobl.gg --quiet`;
    
    await execAsync(certbotCommand);
    console.log(`SSL certificate requested successfully for ${domain}`);
    
    // Reload Nginx to use the new certificate
    await reloadNginxConfig();
  } catch (error: any) {
    console.error('Error requesting SSL certificate:', error?.message || error);
    throw new Error(`Failed to request SSL certificate for ${domain}: ${error?.message || error}`);
  }
}

// Helper function to revoke SSL certificate
async function revokeSSLCertificate(domain: string): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    console.log(`Revoking SSL certificate for ${domain}...`);
    
    // Revoke and delete the certificate
    await execAsync(`certbot delete --cert-name ${domain} --non-interactive`);
    console.log(`SSL certificate revoked for ${domain}`);
  } catch (error: any) {
    // Don't throw error if certificate doesn't exist
    if (error?.message?.includes('No certificate found')) {
      console.log(`No SSL certificate found for ${domain} to revoke`);
    } else {
      console.warn('Error revoking SSL certificate:', error?.message || error);
    }
  }
}

export default router;
