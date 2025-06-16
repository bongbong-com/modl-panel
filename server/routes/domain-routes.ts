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

    // Step 1: Generate HTTP-only Nginx configuration (SSL will be added later during verification)
    console.log(`🔧 Step 1: Creating HTTP-only nginx configuration for ${customDomain}...`);
    try {
      await generateHttpOnlyNginxConfig(customDomain, server.customDomain);
      console.log(`✅ HTTP-only configuration created and enabled for ${customDomain}`);
    } catch (configError: any) {
      console.error(`❌ Failed to create nginx configuration: ${configError.message}`);
      return res.status(500).json({ 
        error: `Failed to create domain configuration: ${configError.message}` 
      });
    }

    const status: DomainStatus = {
      domain: customDomain,
      status: 'pending',
      cnameConfigured: false,
      sslStatus: 'pending',
      lastChecked: new Date().toISOString(),
      error: undefined
    };

    res.json({
      message: 'Domain configured successfully. HTTP access is now active. Please set up DNS CNAME record and then click Verify to enable SSL.',
      status,
      instructions: {
        step1: 'Create a CNAME record in your DNS settings',
        step2: `Point your domain (${customDomain}) to: ${server.customDomain}.cobl.gg`,
        step3: 'Wait for DNS propagation (5-30 minutes)',
        step4: 'Click "Verify Domain" to test DNS and enable SSL/HTTPS',
        note: `Your domain is already accessible via HTTP: http://${customDomain}`
      }
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

    if (status.cnameConfigured && status.status !== 'active') {
      console.log(`🔒 Domain ${domain} DNS is configured. Starting SSL certificate process...`);
      
      try {
        // Step 1: Ensure HTTP-only configuration is active
        console.log('📋 Step 1: Ensuring HTTP configuration is active...');
        await ensureHttpOnlyConfig(domain, server.customDomain);
        
        // Step 2: Request SSL certificate FIRST (before HTTPS config)
        console.log('🔐 Step 2: Requesting SSL certificate...');
        await requestSSLCertificate(domain);
        
        // Step 3: Configure HTTPS with redirect AFTER certificate exists
        console.log('⚙️  Step 3: Configuring HTTPS with redirect...');
        await generateHttpsConfig(domain, server.customDomain);
        
        status.status = 'active';
        status.sslStatus = 'active';
        console.log(`🎉 SSL certificate obtained and HTTPS configured for ${domain}`);
        
        // Update database status
        await ServerModel.findByIdAndUpdate(server._id, {
          customDomain_status: 'active',
          customDomain_lastChecked: new Date(),
          customDomain_error: null
        });
        
      } catch (sslError: any) {
        console.error(`❌ SSL certificate process failed for ${domain}:`, sslError.message);
        status.status = 'error';
        status.sslStatus = 'error';
        status.error = `SSL setup failed: ${sslError.message}`;
        
        // Update database with error
        await ServerModel.findByIdAndUpdate(server._id, {
          customDomain_status: 'error',
          customDomain_lastChecked: new Date(),
          customDomain_error: status.error
        });
        
        console.log(`ℹ️  Domain ${domain} is still accessible over HTTP, but HTTPS setup failed`);
      }
    } else if (!status.cnameConfigured) {
      console.log(`⏳ Domain ${domain} CNAME not properly configured yet`);
      status.status = 'pending';
      status.error = 'CNAME record not found or not pointing to the correct target. Please check your DNS settings.';
      
      // Update database status
      await ServerModel.findByIdAndUpdate(server._id, {
        customDomain_status: 'pending',
        customDomain_lastChecked: new Date(),
        customDomain_error: status.error
      });
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

// Helper function to generate HTTP-only Nginx configuration (Step 1)
async function generateHttpOnlyNginxConfig(customDomain: string, originalSubdomain: string): Promise<void> {
  try {
    const execAsync = promisify(exec);
    
    // Always try the user's home directory first as it's most likely to be writable
    const userHome = process.env.HOME || '/home/modl';
    const possibleDirs = [
      process.env.NGINX_CONFIG_DIR,
      path.join(userHome, 'nginx-configs'),
      path.join(process.cwd(), 'nginx-configs'),
      '/tmp/nginx-configs',
      '/etc/nginx/sites-available',
      '/etc/nginx/conf.d'
    ].filter(Boolean);

    let nginxConfigDir: string | null = null;
    let configFile: string | null = null;
    let usesSudo = false;
    let tempFile: string | null = null;

    // Try each directory until we find one we can work with
    for (const dir of possibleDirs) {
      try {
        console.log(`Trying directory: ${dir}`);
        
        // For user directories (not system directories), try normal access first
        if (!dir?.includes('/etc/') && !dir?.includes('/usr/') && !dir?.includes('/var/')) {
          try {
            await fs.mkdir(dir!, { recursive: true });
            await fs.access(dir!, fs.constants.W_OK);
            nginxConfigDir = dir!;
            configFile = path.join(dir!, `${customDomain}.conf`);
            usesSudo = false;
            console.log(`✓ Using writable user directory: ${dir}`);
            break;
          } catch (userDirError: any) {
            console.warn(`Cannot write to user directory ${dir}: ${userDirError.message}`);
            continue;
          }
        }
        
        // For system directories, we'll need sudo
        if (dir?.includes('/etc/nginx')) {
          try {
            // Test if we can use sudo to access the directory
            await execAsync(`sudo test -d "${dir}" || sudo mkdir -p "${dir}"`);
            nginxConfigDir = dir!;
            configFile = path.join(dir!, `${customDomain}.conf`);
            usesSudo = true;
            console.log(`✓ Using system directory with sudo: ${dir}`);
            break;
          } catch (sudoError: any) {
            console.warn(`Cannot access system directory ${dir} with sudo: ${sudoError.message}`);
            continue;
          }
        }
      } catch (error: any) {
        console.warn(`Error checking directory ${dir}: ${error.message}`);
        continue;
      }
    }

    // If no directory worked, create a temporary workaround
    if (!nginxConfigDir || !configFile) {
      console.warn('No nginx directory accessible. Using temporary file approach...');
      nginxConfigDir = '/tmp';
      tempFile = `/tmp/${customDomain}-nginx.conf`;
      configFile = tempFile;
      usesSudo = true; // We'll need to move it with sudo
    }
    
    const appPort = process.env.PORT || '5000';
    
    // Generate HTTP-only configuration (no SSL references)
    const config = `# HTTP-only configuration for ${customDomain}
# Generated: ${new Date().toISOString()}
# SSL will be added after certificate generation

server {
    listen 80;
    server_name ${customDomain};
    
    # Let's Encrypt challenge handling
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri $uri/ =404;
    }
    
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
}`;

    // Write the configuration using the same logic as the working fix script
    console.log(`Writing HTTP-only configuration to: ${configFile}`);
    
    if (usesSudo || tempFile) {
      // Write to temporary location first, then move with sudo
      let writeLocation = configFile;
      
      if (tempFile && !nginxConfigDir?.includes('/tmp')) {
        // Using temp file workaround
        writeLocation = tempFile;
      }
      
      await fs.writeFile(writeLocation, config);
      console.log(`Configuration written to temporary location: ${writeLocation}`);
      
      // If we wrote to a temp file, move it to the final location
      if (tempFile && writeLocation === tempFile) {
        try {
          await execAsync(`sudo mv "${tempFile}" "/etc/nginx/sites-available/${customDomain}.conf"`);
          console.log(`Configuration moved to /etc/nginx/sites-available/${customDomain}.conf`);
          
          // Create symlink for sites-enabled
          const enabledFile = `/etc/nginx/sites-enabled/${customDomain}.conf`;
          try {
            await execAsync(`sudo ln -sf "/etc/nginx/sites-available/${customDomain}.conf" "${enabledFile}"`);
            console.log(`Created symlink for ${customDomain} in sites-enabled`);
          } catch (linkError: any) {
            console.warn(`Could not create symlink: ${linkError.message}`);
          }
        } catch (moveError: any) {
          throw new Error(`Failed to move configuration to system directory: ${moveError.message}. Please ensure sudo permissions are configured correctly.`);
        }
      } else if (nginxConfigDir === '/etc/nginx/sites-available') {
        // Direct sudo write to sites-available
        try {
          const configContent = config.replace(/'/g, "'\"'\"'"); // Escape single quotes for shell
          await execAsync(`echo '${configContent}' | sudo tee "${configFile}" > /dev/null`);
          console.log(`Configuration written to ${configFile} using sudo tee`);
          
          // Create symlink in sites-enabled
          const enabledFile = `/etc/nginx/sites-enabled/${customDomain}.conf`;
          try {
            await execAsync(`sudo ln -sf "${configFile}" "${enabledFile}"`);
            console.log(`Created symlink for ${customDomain} in sites-enabled`);
          } catch (linkError: any) {
            console.warn(`Could not create symlink: ${linkError.message}`);
          }
        } catch (writeError: any) {
          throw new Error(`Failed to write configuration with sudo: ${writeError.message}. Please ensure sudo permissions are configured correctly.`);
        }
      }
    } else {
      // Direct write for writable user directories
      await fs.writeFile(configFile, config);
      console.log(`Configuration written to user directory: ${configFile}`);
    }

    // Test and reload Nginx configuration (safe for HTTP-only config)
    await testAndReloadNginx();
    
    console.log(`✅ HTTP-only Nginx configuration created and enabled for ${customDomain}`);
  } catch (error: any) {
    console.error('❌ Error generating HTTP-only Nginx configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to ensure HTTP-only config is active (used in verification)
async function ensureHttpOnlyConfig(customDomain: string, originalSubdomain: string): Promise<void> {
  // This just calls the HTTP-only config function to make sure it's active
  await generateHttpOnlyNginxConfig(customDomain, originalSubdomain);
}

// Helper function to request SSL certificate with Certbot (FIXED: No nginx reload before cert generation)
async function requestSSLCertificate(domain: string): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    console.log(`🔒 Requesting SSL certificate for ${domain}...`);
    
    // Step 1: Test basic domain connectivity (no nginx reload to avoid SSL cert issues)
    console.log('🌐 Step 1: Verifying domain accessibility...');
    try {
      // Test if we can reach the domain over HTTP (basic connectivity check)
      const testResult = await execAsync(`curl -s -I -m 10 http://${domain}/.well-known/acme-challenge/test || true`);
      console.log('Domain HTTP test completed');
    } catch (httpTestError) {
      console.warn('HTTP connectivity test failed, but continuing with certificate request...');
    }
    
    // Step 2: Request certificate using webroot method FIRST (before any HTTPS configs)
    console.log('🔐 Step 2: Requesting SSL certificate from Let\'s Encrypt...');
    const certbotCommand = `sudo certbot certonly --webroot -w /var/www/html -d ${domain} --non-interactive --agree-tos --email admin@cobl.gg --quiet --no-eff-email`;
    
    const certResult = await execAsync(certbotCommand);
    console.log(`✅ SSL certificate obtained successfully for ${domain}`);
    
    console.log(`🎉 SSL certificate configuration completed for ${domain}`);
    
    // Step 3: Verify the SSL certificate was installed correctly
    console.log('🔍 Step 3: Verifying SSL certificate installation...');
    try {
      const certCheck = await execAsync(`sudo certbot certificates | grep -A 5 "${domain}" || true`);
      if (certCheck.stdout.includes(domain)) {
        console.log(`✅ SSL certificate verification successful for ${domain}`);
      }
    } catch (verifyError) {
      console.warn('SSL certificate verification check failed, but certificate should be working');
    }
    
  } catch (error: any) {
    console.error('❌ SSL certificate request failed:', error?.message || error);
    
    // Provide more helpful error messages based on common issues
    let errorMessage = `Failed to obtain SSL certificate for ${domain}`;
    const errorOutput = error?.stderr || error?.message || '';
    
    if (errorOutput.includes('rate limit')) {
      errorMessage += ': ⏰ Rate limit exceeded. Let\'s Encrypt allows 50 certificates per week. Please wait before requesting more certificates.';
    } else if (errorOutput.includes('DNS') || errorOutput.includes('resolution')) {
      errorMessage += ': 🌐 DNS verification failed. Please ensure the domain points to this server and DNS has propagated (can take 5-30 minutes).';
    } else if (errorOutput.includes('connection refused') || errorOutput.includes('timeout')) {
      errorMessage += ': 🔌 Connection failed. Please ensure port 80 is accessible and not blocked by firewall.';
    } else if (errorOutput.includes('authorization') || errorOutput.includes('challenge')) {
      errorMessage += ': 🔐 Domain authorization failed. The domain must be accessible over HTTP for Let\'s Encrypt verification.';
    } else if (errorOutput.includes('already exists')) {
      errorMessage += ': 📋 Certificate already exists. You may need to renew or delete the existing certificate first.';
    } else {
      errorMessage += `: ${errorOutput}`;
    }
    
    // Add troubleshooting tips
    errorMessage += '\n\n🔧 Troubleshooting tips:';
    errorMessage += '\n• Ensure DNS CNAME record points to your server';
    errorMessage += '\n• Wait 5-30 minutes for DNS propagation';
    errorMessage += '\n• Check that port 80 is accessible from the internet';
    errorMessage += '\n• Verify the domain loads over HTTP first';
    
    throw new Error(errorMessage);
  }
}

// Helper function to generate HTTPS configuration with redirect (Step 3)
async function generateHttpsConfig(customDomain: string, originalSubdomain: string): Promise<void> {
  try {
    const execAsync = promisify(exec);
    const appPort = process.env.PORT || '5000';
    
    // Find the configuration file location
    const possibleFiles = [
      `/etc/nginx/sites-available/${customDomain}.conf`,
      `/etc/nginx/conf.d/${customDomain}.conf`,
      `/home/modl/nginx-configs/${customDomain}.conf`,
      `${process.cwd()}/nginx-configs/${customDomain}.conf`,
      `/tmp/nginx-configs/${customDomain}.conf`
    ];
    
    let configFile: string | null = null;
    let usesSudo = false;
    
    for (const file of possibleFiles) {
      try {
        await fs.access(file);
        configFile = file;
        usesSudo = file.includes('/etc/');
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!configFile) {
      configFile = `/etc/nginx/sites-available/${customDomain}.conf`;
      usesSudo = true;
    }
    
    // Generate HTTPS configuration with redirect
    const config = `# HTTPS configuration for ${customDomain}
# Generated: ${new Date().toISOString()}
# SSL certificate managed by Certbot

# HTTP - redirect to HTTPS
server {
    listen 80;
    server_name ${customDomain};
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri $uri/ =404;
    }
    
    # Redirect all other HTTP requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - main configuration
server {
    listen 443 ssl http2;
    server_name ${customDomain};
    
    # SSL certificate paths (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/${customDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${customDomain}/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # Reverse proxy to Node.js app
    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
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
}`;

    // Write the HTTPS configuration
    console.log(`Writing HTTPS configuration to: ${configFile}`);
    
    if (usesSudo) {
      const configContent = config.replace(/'/g, "'\"'\"'"); // Escape single quotes for shell
      await execAsync(`echo '${configContent}' | sudo tee "${configFile}" > /dev/null`);
      console.log(`HTTPS configuration written using sudo`);
      
      // Ensure symlink exists
      if (configFile.includes('/sites-available/')) {
        const enabledFile = configFile.replace('/sites-available/', '/sites-enabled/');
        try {
          await execAsync(`sudo ln -sf "${configFile}" "${enabledFile}"`);
        } catch (linkError) {
          console.warn(`Could not create/update symlink: ${linkError}`);
        }
      }
    } else {
      await fs.writeFile(configFile, config);
      console.log(`HTTPS configuration written to user directory`);
    }

    // Test and reload Nginx (NOW it's safe because SSL certificates exist)
    await testAndReloadNginx();
    
    console.log(`✅ HTTPS configuration created for ${customDomain}`);
  } catch (error: any) {
    console.error('❌ Error generating HTTPS configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to test and reload nginx (used by both config functions)
async function testAndReloadNginx(): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    // Test Nginx configuration first
    console.log('🧪 Testing Nginx configuration...');
    try {
      const testResult = await execAsync('sudo nginx -t');
      console.log('✅ Nginx configuration test passed');
    } catch (testError: any) {
      console.error('❌ Nginx configuration test failed:');
      console.error(testError.stderr || testError.message);
      
      // Provide helpful error context
      const errorOutput = testError.stderr || testError.message;
      if (errorOutput.includes('cannot load certificate')) {
        console.log('💡 Note: SSL certificate errors are expected before certificate generation');
      } else if (errorOutput.includes('protocol options redefined')) {
        console.log('💡 Note: May have conflicting SSL configurations');
      }
      
      throw new Error(`Nginx configuration test failed: ${errorOutput}`);
    }

    // Reload Nginx
    console.log('🔄 Reloading Nginx...');
    await execAsync('sudo systemctl reload nginx');
    console.log('✅ Nginx reloaded successfully');
  } catch (error: any) {
    // Check if it's a systemctl not found error (non-systemd systems)
    if (error?.message?.includes('systemctl: command not found')) {
      try {
        await execAsync('sudo service nginx reload');
        console.log('✅ Nginx reloaded successfully (using service command)');
      } catch (serviceError: any) {
        console.warn('⚠️  Could not reload Nginx. Please reload manually with: sudo nginx -s reload');
        throw serviceError;
      }
    } else {
      console.error('❌ Error reloading Nginx configuration:', error?.message || error);
      throw error;
    }
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
      '/home/modl/nginx-configs',
      path.join(process.cwd(), 'nginx-configs'),
      '/tmp/nginx-configs'
    ].filter(Boolean);

    let found = false;
    const execAsync = promisify(exec);
    
    for (const dir of possibleDirs) {
      const configFile = path.join(dir!, `${customDomain}.conf`);
      
      try {
        // First try direct removal
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
        if (error?.code === 'ENOENT') {
          // File doesn't exist, continue to next directory
          continue;
        } else if (error?.code === 'EACCES' && (dir?.includes('/etc/nginx') || dir?.includes('/etc/ssl'))) {
          // Permission denied, try with sudo
          try {
            await execAsync(`sudo rm -f "${configFile}"`);
            console.log(`Removed Nginx configuration for ${customDomain} from ${dir} (with sudo)`);
            found = true;
            
            // Also remove symlink if it exists
            if (dir === '/etc/nginx/sites-available') {
              const enabledFile = `/etc/nginx/sites-enabled/${customDomain}.conf`;
              try {
                await execAsync(`sudo rm -f "${enabledFile}"`);
                console.log(`Removed symlink for ${customDomain} from sites-enabled (with sudo)`);
              } catch (sudoError) {
                console.warn(`Error removing symlink with sudo: ${sudoError}`);
              }
            }
            break;
          } catch (sudoError: any) {
            console.warn(`Error removing config from ${dir} with sudo: ${sudoError.message}`);
            continue;
          }
        } else {
          console.warn(`Error removing config from ${dir}: ${error.message}`);
          continue;
        }
      }
    }

    if (!found) {
      console.warn(`Configuration file for ${customDomain} not found in any directory`);
    }
    
    // Reload Nginx configuration
    await testAndReloadNginx();
  } catch (error: any) {
    console.error('Error removing Nginx configuration:', error?.message || error);
    throw error;
  }
}

// Helper function to revoke SSL certificate
async function revokeSSLCertificate(domain: string): Promise<void> {
  const execAsync = promisify(exec);
  
  try {
    console.log(`Revoking SSL certificate for ${domain}...`);
    
    // Revoke and delete the certificate
    await execAsync(`sudo certbot delete --cert-name ${domain} --non-interactive`);
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
