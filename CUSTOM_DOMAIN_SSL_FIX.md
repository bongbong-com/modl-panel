# Custom Domain SSL Fix Guide

## Problem Identified
Caddy is running on custom ports (8080/8443) instead of standard web ports (80/443), causing SSL errors for custom domains.

**Current Caddy Status:**
- HTTP Port: 8080 (should be 80)
- HTTPS Port: 8443 (should be 443)
- Custom domains expect standard ports for SSL to work

## Quick Diagnosis
```bash
# Check current Caddy configuration
curl localhost:2019/config/ | jq

# Verify what's listening on standard ports
sudo lsof -i :80
sudo lsof -i :443
```

## Solution 1: Fix Caddy Ports (Recommended)

### Step 1: Stop services and fix port conflict
```bash
# Stop Caddy
sudo systemctl stop caddy

# Find what's using port 80
sudo lsof -i :80

# If Apache is running (most common):
sudo systemctl stop apache2
sudo systemctl disable apache2
sudo systemctl mask apache2

# If Nginx is running:
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl mask nginx
```

### Step 2: Fix Caddyfile configuration
```bash
# Edit main Caddyfile
sudo nano /etc/caddy/Caddyfile

# Remove or comment out these lines:
# {
#     http_port 8080
#     https_port 8443
# }

# Your Caddyfile should look like:
```

### Step 3: Correct Caddyfile example
```caddy
# Import custom domain configurations
import /etc/caddy/conf.d/*

# Global options
{
    email admin@modl.gg
    admin localhost:2019
}

# Default configuration for modl.gg subdomains
*.modl.gg {
    @subdomain host_regexp subdomain ^([^.]+)\.modl\.gg$
    reverse_proxy localhost:5000 {
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
    
    encode gzip
    
    log {
        output file /var/log/caddy/modl-subdomains.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
    }
}
```

### Step 4: Start Caddy on correct ports
```bash
# Start Caddy
sudo systemctl start caddy
sudo systemctl status caddy

# Verify correct ports
sudo lsof -i :80
sudo lsof -i :443

# Test admin API
curl localhost:2019/config/ | jq
```

### Step 5: Test your setup
```bash
# Check that Caddy is on standard ports
curl -I http://yoursubdomain.modl.gg
curl -I https://yoursubdomain.modl.gg

# Test custom domain configuration in your panel
# SSL should now work properly
```

## Solution 2: Port Forwarding (if you must keep custom ports)

If you cannot change Caddy's ports:

```bash
# Forward standard ports to Caddy's custom ports
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8443

# Save rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4
sudo systemctl enable netfilter-persistent
```

## Solution 3: Update Application Configuration

If keeping custom ports, update your domain routes to handle the port difference:

### Update domain-routes.ts
Add port awareness to the SSL verification:

```typescript
// In checkDomainAccessibility function, try both standard and custom ports
const ports = [443, 8443]; // Try both HTTPS ports
for (const port of ports) {
  // ... check accessibility on each port
}
```

## Verification Steps

After implementing Solution 1 (recommended):

### 1. Verify Caddy is on correct ports
```bash
curl localhost:2019/config/ | jq '.apps.http'
# Should show http_port: 80, https_port: 443 (or not specified = defaults)
```

### 2. Test SSL with a custom domain
```bash
# Replace with your actual custom domain
curl -I https://yourcustomdomain.com
openssl s_client -connect yourcustomdomain.com:443 -servername yourcustomdomain.com
```

### 3. Check application functionality
- Configure a custom domain in your admin panel
- Verify DNS instructions show correct target (yoursubdomain.modl.gg)
- Test SSL certificate generation
- Confirm domain verification works

## Expected Results

After fixing:
- Custom domains should get SSL certificates automatically
- No more SSL connection errors
- Domain verification should work properly
- Your *.modl.gg wildcard should continue working

## Troubleshooting

If still having issues:

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Verify DNS resolution
dig CNAME yourcustomdomain.com
nslookup yourcustomdomain.com

# Test SSL certificate status
echo | openssl s_client -connect yourcustomdomain.com:443 -servername yourcustomdomain.com 2>/dev/null | openssl x509 -noout -text
```

**Recommendation: Use Solution 1** - it's the cleanest approach and will resolve all SSL issues for custom domains.
