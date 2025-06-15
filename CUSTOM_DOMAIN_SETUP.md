# Custom Domain Setup with Caddy

This guide explains how to set up custom domains for your modl panel instances using Caddy for automatic SSL/TLS certificate management.

## Prerequisites

- Ubuntu Server with Caddy installed
- DNS access to configure CNAME records
- Firewall configured to allow HTTP (80) and HTTPS (443) traffic

## Caddy Installation

### 1. Install Caddy on Ubuntu

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Configure Caddy

Create the main Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Add the following configuration:

```caddy
# Import custom domain configurations
import /etc/caddy/conf.d/*

# Default configuration for modl.gg subdomains
*.modl.gg {
    @subdomain host_regexp subdomain ^([^.]+)\.modl\.gg$
    reverse_proxy localhost:5173 {
        header_up Host {http.request.host}
        header_up X-Real-IP {http.request.remote}
        header_up X-Forwarded-For {http.request.remote}
        header_up X-Forwarded-Proto {http.request.scheme}
        header_up X-Subdomain {re.subdomain.1}
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
        output file /var/log/caddy/modl-subdomains.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
    }
}

# Global options
{
    # Email for Let's Encrypt certificates
    email admin@modl.gg
    
    # Enable the admin API for configuration reloading
    admin localhost:2019
}
```

### 3. Create configuration directory

```bash
sudo mkdir -p /etc/caddy/conf.d
sudo mkdir -p /var/log/caddy
sudo chown -R caddy:caddy /var/log/caddy
sudo chmod 755 /etc/caddy/conf.d
```

### 4. Set up systemd service

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

## Environment Variables

Set the following environment variable in your application:

```bash
# Optional: Custom path for Caddy configurations
export CADDY_CONFIG_DIR="/etc/caddy/conf.d"
```

## How It Works

### 1. Domain Configuration Process

1. **User Input**: Admin enters a custom domain in the panel settings
2. **Validation**: System validates the domain format
3. **Caddy Config**: System generates Caddy configuration file
4. **DNS Check**: System provides CNAME setup instructions
5. **Verification**: Admin verifies DNS configuration
6. **SSL Generation**: Caddy automatically obtains SSL certificate

### 2. Automatic SSL/TLS

Caddy handles all SSL/TLS certificate management:

- Automatically requests certificates from Let's Encrypt
- Renews certificates before expiration
- Enforces HTTPS for all traffic
- Redirects HTTP to HTTPS automatically

### 3. Security Features

- Strict Transport Security (HSTS)
- Content Security Policy headers
- XSS protection
- Clickjacking protection
- Secure referrer policy

## DNS Configuration

### Required CNAME Record

For each custom domain, users must create a CNAME record:

```
Type: CNAME
Name: [subdomain or @]
Value: [original-subdomain].modl.gg
TTL: 300 (or lowest available)
```

### Example

If your original panel is at `mypanel.modl.gg` and you want to use `panel.mydomain.com`:

```
Type: CNAME
Name: panel
Value: mypanel.modl.gg
TTL: 300
```

## File Structure

```
/etc/caddy/
├── Caddyfile                 # Main configuration
└── conf.d/                   # Custom domain configs
    ├── panel.example.com.conf
    └── admin.company.com.conf

/var/log/caddy/               # Log files
├── modl-subdomains.log       # Default subdomain logs
├── panel.example.com.log     # Custom domain logs
└── admin.company.com.log
```

## Troubleshooting

### 1. Check Caddy Status

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -f
```

### 2. Validate Configuration

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

### 3. Test Configuration Reload

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

### 4. Check DNS Resolution

```bash
dig CNAME yourdomain.com
nslookup yourdomain.com
```

### 5. Verify SSL Certificate

```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### 6. Check Logs

```bash
sudo tail -f /var/log/caddy/yourdomain.com.log
```

## Common Issues

### DNS Not Propagated
- Wait up to 48 hours for global DNS propagation
- Use different DNS servers to test: `dig @8.8.8.8 yourdomain.com`

### SSL Certificate Errors
- Ensure domain is accessible from internet
- Check firewall allows ports 80 and 443
- Verify CNAME points to correct target

### Permission Issues
- Ensure caddy user has read access to config files
- Check log directory permissions

### Configuration Errors
- Validate Caddyfile syntax before reloading
- Check for conflicting domain configurations

## Security Considerations

1. **Firewall Configuration**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Log Rotation**
   Caddy automatically handles log rotation, but monitor disk usage

3. **Certificate Monitoring**
   Caddy handles renewals, but monitor for failures

4. **Access Control**
   Restrict access to Caddy configuration files

## Backup and Recovery

### Backup Configuration
```bash
sudo tar -czf caddy-backup-$(date +%Y%m%d).tar.gz /etc/caddy
```

### Restore Configuration
```bash
sudo tar -xzf caddy-backup-YYYYMMDD.tar.gz -C /
sudo systemctl reload caddy
```

## Monitoring

### Health Check Endpoint
Monitor Caddy health via the admin API:
```bash
curl localhost:2019/config/
```

### Certificate Status
Check certificate expiration:
```bash
curl -s localhost:2019/certificates | jq
```

This setup provides a robust, automatic SSL/TLS solution for custom domains with minimal manual intervention required.
