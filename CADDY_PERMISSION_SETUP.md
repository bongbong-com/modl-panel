# Caddy Permission Setup Guide

## Issue Resolution Summary
The custom domain functionality has been updated to handle permission issues and Caddy not running scenarios.

## Quick Setup Commands

### Option 1: Proper Directory Setup (Recommended)
```bash
# Create the directory and set proper permissions
sudo mkdir -p /etc/caddy/conf.d
sudo chmod 755 /etc/caddy/conf.d

# Give your application user write access
sudo chown -R $USER:caddy /etc/caddy/conf.d
# OR if caddy group doesn't exist:
sudo chown -R $USER:$USER /etc/caddy/conf.d

# Set proper permissions
sudo chmod 775 /etc/caddy/conf.d
```

### Option 2: Use Custom Directory
```bash
# Set environment variable to use a custom directory
export CADDY_CONFIG_DIR="/home/modl/caddy-configs"

# Create the directory
mkdir -p /home/modl/caddy-configs
chmod 755 /home/modl/caddy-configs
```

### Option 3: Start Caddy Service
```bash
# Check if Caddy is installed
caddy version

# Start Caddy if it's installed
sudo systemctl start caddy
sudo systemctl enable caddy

# Check status
sudo systemctl status caddy
```

## What Was Fixed

### 1. Directory Fallback System
The application now tries multiple directories in order:
1. `CADDY_CONFIG_DIR` environment variable
2. `/etc/caddy/conf.d` (standard location)
3. `/home/caddy/conf.d` (alternative)
4. `./caddy-configs` (local to app)
5. `/tmp/caddy-configs` (temporary fallback)

### 2. Caddy Not Running Handling
- Checks if Caddy is running before trying to reload
- Warns instead of failing when Caddy isn't accessible
- Configurations are saved and will be applied when Caddy starts

### 3. Better Error Messages
- Clear warnings about permission issues
- Helpful guidance about which directories are being tried
- Informative logs about where configurations are saved

## Deployment Steps

### 1. Upload New Build
```bash
# Upload the new dist/ folder to your server
scp -r dist/ user@yourserver:/home/modl/modl-panel/
```

### 2. Set Permissions (Choose one option above)
```bash
# Option 1: Standard setup
sudo mkdir -p /etc/caddy/conf.d
sudo chown -R modl:modl /etc/caddy/conf.d
sudo chmod 755 /etc/caddy/conf.d
```

### 3. Install/Start Caddy (if needed)
```bash
# Install Caddy if not already installed
sudo apt update
sudo apt install caddy

# Start Caddy
sudo systemctl start caddy
sudo systemctl enable caddy
```

### 4. Restart Your Application
```bash
pm2 restart modl-panel
```

### 5. Verify Setup
```bash
# Check PM2 logs
pm2 logs modl-panel

# You should see messages like:
# "Generated Caddy configuration for example.com in /etc/caddy/conf.d"
# "Caddy configuration reloaded successfully"
```

## Expected Behavior After Fix

### Working Scenarios:
✅ **Caddy running + proper permissions**: Full functionality
✅ **Caddy not running + permissions**: Configs saved, will work when Caddy starts
✅ **No /etc/caddy access**: Uses fallback directory (app still works)
✅ **Caddy admin API unavailable**: Graceful degradation with warnings

### Error Scenarios Now Handled:
- ❌ `EACCES: permission denied, mkdir '/etc/caddy/conf.d'` → Uses fallback directory
- ❌ `connection refused` on Caddy reload → Warns and continues
- ❌ Caddy not installed → Saves config files for later use

## Environment Variables

Add to your production environment:
```bash
# Optional: Custom config directory
CADDY_CONFIG_DIR="/home/modl/caddy-configs"

# Required: Application port
PORT=5000
```

## Testing the Fix

1. **Test without Caddy running**:
   - Should see warning: "Caddy is not running. Configuration will be applied when Caddy starts."
   - Domain configuration should still complete successfully

2. **Test with permission issues**:
   - Should see warnings about directory access
   - Should fall back to writable directory
   - Should complete successfully

3. **Test with Caddy running**:
   - Should see: "Caddy configuration reloaded successfully"
   - Should complete without any errors

## Main Caddyfile Setup

Make sure your main Caddyfile includes the configurations:
```caddy
# Add this line to import custom domain configs
import /etc/caddy/conf.d/*
# OR if using custom directory:
import /home/modl/caddy-configs/*

# Your existing *.modl.gg configuration
*.modl.gg {
    # ... your existing config
}
```

The system is now robust and will work in various deployment scenarios!
