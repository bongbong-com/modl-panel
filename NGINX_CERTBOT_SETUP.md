# Nginx + Certbot Custom Domain Setup

This document describes the complete setup for custom domain management using Nginx as a reverse proxy and Certbot for SSL certificate management, replacing the previous Caddy implementation.

## Architecture Overview

- **Node.js Application**: Runs on port 5000, serves both API and static files
- **Nginx**: Acts as reverse proxy, handles SSL termination and HTTP->HTTPS redirects
- **Certbot**: Manages Let's Encrypt SSL certificates for custom domains
- **Wildcard Certificates**: *.cobl.gg domains use existing wildcard certificates

## Server Setup

### 1. Install Required Software

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Ensure Node.js application dependencies are installed
cd /path/to/modl-panel
npm install
```

### 2. Configure Nginx for cobl.gg Subdomains

Create the main Nginx configuration for *.cobl.gg domains:

```bash
sudo nano /etc/nginx/sites-available/cobl-subdomains
```

Add the following configuration:

```nginx
# Default configuration for cobl.gg subdomains (wildcard cert already configured)
server {
    listen 443 ssl http2;
    server_name *.cobl.gg;
    
    # Wildcard SSL certificate for *.cobl.gg
    ssl_certificate /etc/ssl/certs/cobl.gg/fullchain.pem;
    ssl_certificate_key /etc/ssl/private/cobl.gg/privkey.pem;
    
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
    
    # Extract subdomain and pass to backend
    location / {
        # Extract subdomain from server_name
        set $subdomain "";
        if ($host ~ ^([^.]+)\.cobl\.gg$) {
            set $subdomain $1;
        }
        
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Subdomain $subdomain;
        
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
    access_log /var/log/nginx/cobl-subdomains-access.log;
    error_log /var/log/nginx/cobl-subdomains-error.log;
}

# HTTP redirect to HTTPS for cobl.gg subdomains
server {
    listen 80;
    server_name *.cobl.gg;
    return 301 https://$host$request_uri;
}
```

Enable the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/cobl-subdomains /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Set Up Certbot Auto-Renewal

```bash
# Test Certbot installation
sudo certbot --version

# Set up automatic renewal (this creates a cron job)
sudo certbot renew --dry-run

# Add a cron job for automatic renewal (if not already created)
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Create Web Root Directory for Let's Encrypt

```bash
sudo mkdir -p /var/www/html
sudo chown -R www-data:www-data /var/www/html
```

## Application Integration

### 1. Environment Variables

Add these environment variables to your application:

```bash
# Optional: Custom Nginx config directory (defaults to /etc/nginx/sites-available)
NGINX_CONFIG_DIR=/etc/nginx/sites-available

# Application port (should match Nginx proxy_pass)
PORT=5000
```

### 2. Required Permissions

The Node.js application needs permissions to:

- Write to Nginx configuration directories
- Execute `nginx -t` and `systemctl reload nginx`
- Execute `certbot` commands

Set up a service user with appropriate permissions:

```bash
# Create service user
sudo useradd -r -s /bin/false modl-panel

# Add to nginx group
sudo usermod -a -G nginx modl-panel

# Set up sudo permissions for specific commands
sudo visudo
# Add these lines:
# modl-panel ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
# modl-panel ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
# modl-panel ALL=(ALL) NOPASSWD: /usr/bin/certbot certonly *
# modl-panel ALL=(ALL) NOPASSWD: /usr/bin/certbot delete *
```

### 3. Directory Permissions

```bash
# Ensure application can write to Nginx config directory
sudo chmod 755 /etc/nginx/sites-available
sudo chown root:nginx /etc/nginx/sites-available

# Create logs directory
sudo mkdir -p /var/log/nginx
sudo chown nginx:nginx /var/log/nginx
```

## Custom Domain Process

### 1. Domain Configuration

When a user configures a custom domain through the admin panel:

1. **Nginx Configuration Generated**: Creates `/etc/nginx/sites-available/{domain}.conf`
2. **Symlink Created**: Links to `/etc/nginx/sites-enabled/{domain}.conf`
3. **Nginx Reloaded**: Tests and reloads Nginx configuration
4. **User Informed**: Provides DNS setup instructions

### 2. DNS Setup (User Action)

User creates CNAME record:
```
Type: CNAME
Name: panel (or their subdomain)
Value: originalsubdomain.cobl.gg
TTL: 300 (or default)
```

### 3. Domain Verification

When user clicks "Verify":

1. **DNS Check**: Verifies CNAME record points to correct target
2. **SSL Certificate Request**: Runs `certbot certonly --webroot -w /var/www/html -d {domain}`
3. **Nginx Reload**: Reloads Nginx to use new certificate
4. **Status Update**: Updates domain status in database

### 4. Domain Removal

When user removes custom domain:

1. **Certificate Revocation**: Runs `certbot delete --cert-name {domain}`
2. **Config Removal**: Deletes Nginx configuration files
3. **Nginx Reload**: Reloads Nginx configuration
4. **Database Cleanup**: Removes domain from database

## Monitoring and Maintenance

### 1. Certificate Renewal

Certificates are automatically renewed by cron job:
```bash
# Check renewal status
sudo certbot renew --dry-run

# View certificate status
sudo certbot certificates

# Manual renewal (if needed)
sudo certbot renew
```

### 2. Nginx Status

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### 3. Application Logs

Monitor the Node.js application for domain-related errors:
```bash
# If using PM2
pm2 logs modl-panel

# Check for certificate errors
grep -i "ssl\|certificate\|certbot" /var/log/nginx/error.log
```

## Security Considerations

### 1. Rate Limiting
Let's Encrypt has rate limits:
- 50 certificates per registered domain per week
- 5 duplicate certificates per week

### 2. Directory Permissions
- Nginx configs: 644 permissions, root:nginx ownership
- SSL certificates: 600 permissions, root:root ownership
- Web root: 755 permissions, www-data:www-data ownership

### 3. Firewall Rules
Ensure ports 80 and 443 are open:
```bash
sudo ufw allow 80
sudo ufw allow 443
```

## Troubleshooting

### Common Issues

1. **Certificate Request Fails**
   - Check DNS propagation: `dig panel.yourdomain.com`
   - Verify web root permissions: `ls -la /var/www/html`
   - Check Certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

2. **Nginx Configuration Errors**
   - Test configuration: `sudo nginx -t`
   - Check error logs: `sudo tail -f /var/log/nginx/error.log`
   - Verify proxy pass: `curl -I http://127.0.0.1:5000`

3. **Domain Not Accessible**
   - Check DNS resolution: `nslookup panel.yourdomain.com`
   - Verify CNAME record: `dig CNAME panel.yourdomain.com`
   - Test SSL: `openssl s_client -connect panel.yourdomain.com:443`

### Log Locations

- **Nginx Error Log**: `/var/log/nginx/error.log`
- **Nginx Access Log**: `/var/log/nginx/access.log`
- **Certbot Log**: `/var/log/letsencrypt/letsencrypt.log`
- **Application Log**: PM2 logs or system journal

## Migration from Caddy

If migrating from an existing Caddy setup:

1. **Stop Caddy**: `sudo systemctl stop caddy`
2. **Install Nginx**: Follow installation steps above
3. **Migrate Certificates**: Copy existing certificates or request new ones
4. **Update Application**: Deploy new code version
5. **Test Configuration**: Verify all domains work correctly
6. **Remove Caddy**: `sudo systemctl disable caddy`

## Backup and Recovery

### Certificate Backup
```bash
# Backup Let's Encrypt directory
sudo tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# Backup Nginx configs
sudo tar -czf nginx-configs-backup-$(date +%Y%m%d).tar.gz /etc/nginx/sites-available/
```

### Recovery
```bash
# Restore certificates
sudo tar -xzf letsencrypt-backup-YYYYMMDD.tar.gz -C /

# Restore configs
sudo tar -xzf nginx-configs-backup-YYYYMMDD.tar.gz -C /

# Reload Nginx
sudo systemctl reload nginx
```

This setup provides a robust, scalable solution for custom domain management with automatic SSL certificate handling.
