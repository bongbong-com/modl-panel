# Caddy Port 80 Conflict Resolution

## Issue
Caddy cannot start because port 80 is already in use by another service.

Error:
```
Error: loading initial config: loading new config: http app module: start: listening on :80: listen tcp :80: bind: address already in use
```

## Diagnosis Commands

### 1. Find what's using port 80
```bash
sudo lsof -i :80
# OR
sudo netstat -tulpn | grep :80
# OR
sudo ss -tulpn | grep :80
```

### 2. Check if it's Apache or Nginx
```bash
sudo systemctl status apache2
sudo systemctl status nginx
```

### 3. Check all running web servers
```bash
ps aux | grep -E "(apache|nginx|httpd)"
```

## Solutions

### Option 1: Stop the conflicting service (if it's Apache/Nginx)
```bash
# If Apache is running:
sudo systemctl stop apache2
sudo systemctl disable apache2

# If Nginx is running:
sudo systemctl stop nginx
sudo systemctl disable nginx

# Then start Caddy:
sudo systemctl start caddy
sudo systemctl enable caddy
```

### Option 2: Configure Caddy to use a different port (temporary)
```bash
# Edit Caddyfile to use port 8080 for HTTP
sudo nano /etc/caddy/Caddyfile

# Add this at the top:
{
    http_port 8080
    https_port 8443
}

# Then start Caddy:
sudo systemctl start caddy
```

### Option 3: Use Caddy in proxy mode (if you need to keep existing service)
```bash
# Keep existing service on port 80
# Configure Caddy to run on different ports
# Use iptables to redirect traffic (advanced)
```

## Recommended Solution Steps

### Step 1: Identify the conflicting service
```bash
sudo lsof -i :80
```

### Step 2: If it's Apache, stop and disable it
```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
sudo systemctl mask apache2  # Prevent accidental restart
```

### Step 3: If it's Nginx, stop and disable it
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl mask nginx  # Prevent accidental restart
```

### Step 4: Start Caddy
```bash
sudo systemctl start caddy
sudo systemctl enable caddy
sudo systemctl status caddy
```

### Step 5: Verify Caddy is running
```bash
# Check if ports are now bound to Caddy
sudo lsof -i :80
sudo lsof -i :443

# Test Caddy admin API
curl localhost:2019/config/
```

## Alternative: Quick Fix with Port Change

If you can't stop the existing service immediately:

### Edit Caddyfile
```bash
sudo nano /etc/caddy/Caddyfile
```

### Add port configuration at the top
```caddy
{
    http_port 8080
    https_port 8443
    admin localhost:2019
}

# Your existing configuration...
*.modl.gg:8443 {
    # ... rest of config
}
```

### Update your application
```bash
# Set environment variable to tell your app about the port change
export CADDY_HTTP_PORT=8080
export CADDY_HTTPS_PORT=8443
```

## After Fixing

### Test domain configuration
1. Start Caddy successfully
2. Test custom domain configuration in your panel
3. Verify SSL certificates are working
4. Check that configurations are being generated and loaded

### Expected working state
```bash
# These should show Caddy processes
sudo lsof -i :80
sudo lsof -i :443

# Caddy should be running
sudo systemctl status caddy

# Admin API should respond
curl localhost:2019/config/
```

Choose Option 1 (stopping Apache/Nginx) if they're not needed, or Option 2 (different ports) if you need to keep the existing web server running.
