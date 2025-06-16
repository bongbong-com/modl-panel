# Caddy to Nginx + Certbot Migration Summary

## Migration Overview

The custom domain system has been completely migrated from Caddy to Nginx + Certbot for better compatibility and easier certificate management.

## Changes Made

### 1. Backend Changes

**File: `server/routes/domain-routes.ts`**
- Replaced all Caddy-related functions with Nginx + Certbot equivalents
- `generateCaddyConfig()` → `generateNginxConfig()`
- `removeCaddyConfig()` → `removeNginxConfig()`
- `reloadCaddyConfig()` → `reloadNginxConfig()`
- Added `requestSSLCertificate()` and `revokeSSLCertificate()` functions
- Updated to use Certbot for SSL certificate management
- Changed email from `admin@modl.gg` to `admin@cobl.gg`

**File: `server/config/nginx-template.conf`**
- Created new Nginx configuration template
- Configured for *.cobl.gg subdomains with wildcard SSL
- Includes proper proxy headers and security settings
- Added HTTP to HTTPS redirect configuration

### 2. Frontend Changes

**File: `client/src/components/settings/DomainSettings.tsx`**
- Updated SSL certificate setup instructions
- Changed from Caddy to Nginx + Certbot information
- Updated domain references from modl.gg to cobl.gg
- Added clearer explanations of automatic certificate management

### 3. Configuration Files

**File: `migrate-to-nginx.sh`**
- Complete migration script from Caddy to Nginx
- Handles service stopping, package installation, and configuration
- Updates all domain references to cobl.gg
- Sets up proper permissions and cron jobs

**File: `NGINX_CERTBOT_SETUP.md`**
- Comprehensive documentation for the new system
- Updated all domain references to cobl.gg
- Includes troubleshooting and maintenance instructions

## Key Features

### Nginx Configuration
- **Reverse Proxy**: Forwards requests to Node.js app on port 5000
- **SSL Termination**: Handles HTTPS and certificate management
- **Security Headers**: HSTS, XSS protection, content type options
- **Compression**: Gzip compression for better performance
- **Logging**: Separate logs for access and errors

### Certbot Integration
- **Automatic Certificates**: Individual Let's Encrypt certificates for custom domains
- **Auto-Renewal**: Cron job for automatic certificate renewal
- **Webroot Method**: Uses `/var/www/html` for domain validation
- **Graceful Handling**: Proper error handling and logging

### Security & Permissions
- **Service User**: Dedicated `modl-panel` user with limited sudo access
- **Directory Permissions**: Proper ownership and access controls
- **Rate Limiting**: Respects Let's Encrypt rate limits
- **Secure Headers**: Comprehensive security header configuration

## Architecture Flow

### Custom Domain Setup
1. **User Action**: Admin configures custom domain in panel
2. **Nginx Config**: System generates domain-specific Nginx configuration
3. **DNS Setup**: User creates CNAME record pointing to subdomain.cobl.gg
4. **Verification**: System verifies DNS propagation
5. **SSL Request**: Certbot requests Let's Encrypt certificate
6. **Activation**: Domain becomes active with automatic HTTPS

### Certificate Management
1. **Initial Request**: Certbot requests certificate during domain setup
2. **Auto-Renewal**: Cron job renews certificates before expiration
3. **Nginx Reload**: Automatic reload after certificate renewal
4. **Monitoring**: Proper logging and error handling

## Deployment Instructions

### 1. Run Migration Script
```bash
# Copy migration script to server
scp migrate-to-nginx.sh user@server:/tmp/

# Run migration (as root)
sudo bash /tmp/migrate-to-nginx.sh
```

### 2. Update Application
```bash
# Deploy new application code
git pull origin main
npm install
npm run build

# Restart application
pm2 restart modl-panel
```

### 3. Update Wildcard Certificate Paths
```bash
# Update paths in /etc/nginx/sites-available/cobl-subdomains
# Change these lines to match your actual certificate locations:
ssl_certificate /path/to/your/cobl.gg/fullchain.pem;
ssl_certificate_key /path/to/your/cobl.gg/privkey.pem;

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Verify Setup
```bash
# Check Nginx status
sudo systemctl status nginx

# Check certificate auto-renewal
sudo certbot renew --dry-run

# Test custom domain functionality
# Use admin panel to configure a test domain
```

## Environment Variables

Add these to your application environment:

```bash
# Optional: Custom Nginx config directory
NGINX_CONFIG_DIR=/etc/nginx/sites-available

# Application port
PORT=5000
```

## Monitoring

### Important Log Files
- **Nginx Access**: `/var/log/nginx/cobl-subdomains-access.log`
- **Nginx Error**: `/var/log/nginx/cobl-subdomains-error.log`
- **Certbot**: `/var/log/letsencrypt/letsencrypt.log`
- **Application**: PM2 logs or system journal

### Health Checks
```bash
# Check Nginx configuration
sudo nginx -t

# Check certificate status
sudo certbot certificates

# Check application connectivity
curl -I http://127.0.0.1:5000

# Test SSL for custom domain
openssl s_client -connect yourdomain.com:443
```

## Rollback Plan

If issues occur, you can rollback to Caddy:

```bash
# Stop Nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# Restore Caddy from backup (if available)
# Check backup location from migration script output

# Enable and start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy

# Deploy previous application version
git checkout previous-commit
npm install
npm run build
pm2 restart modl-panel
```

## Benefits of Migration

1. **Simpler Certificate Management**: Direct Certbot integration
2. **Better Documentation**: Extensive Nginx documentation available
3. **Easier Troubleshooting**: More familiar tooling for most administrators
4. **Flexible Configuration**: Easier to customize Nginx configurations
5. **Stability**: Proven stability of Nginx + Certbot combination

## Post-Migration Testing

1. **Test Subdomain Access**: Verify existing subdomains still work
2. **Test Custom Domain Setup**: Configure a test custom domain
3. **Verify SSL Certificates**: Check certificate installation and renewal
4. **Monitor Logs**: Watch for any errors in the first 24 hours
5. **Performance Testing**: Ensure no performance degradation

## Support

For issues or questions:
1. Check the logs mentioned above
2. Review `NGINX_CERTBOT_SETUP.md` for detailed configuration
3. Test Nginx configuration with `sudo nginx -t`
4. Check Certbot status with `sudo certbot certificates`

The migration maintains all existing functionality while providing a more maintainable and well-documented SSL certificate management system.
