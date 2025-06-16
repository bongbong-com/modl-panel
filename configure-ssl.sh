#!/bin/bash

# SSL Certificate Configuration Helper for cobl.gg
# This script helps locate and configure SSL certificates for Nginx

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to search for certificates
find_certificates() {
    print_status "Searching for *.cobl.gg SSL certificates..."
    
    # Common locations where SSL certificates might be stored
    CERT_LOCATIONS=(
        "/etc/letsencrypt/live/cobl.gg"
        "/etc/letsencrypt/live"
        "/etc/ssl/certs/cobl.gg"
        "/etc/pki/tls/certs/cobl.gg"
        "/opt/caddy/certs"
        "/home/caddy/certs"
        "/etc/caddy/certificates"
        "/var/lib/caddy/.local/share/caddy/certificates"
    )
    
    echo "Checking common certificate locations:"
    
    for location in "${CERT_LOCATIONS[@]}"; do
        if [ -d "$location" ]; then
            echo "  ✓ Found directory: $location"
            
            # List certificate files in this directory
            find "$location" -name "*.pem" -o -name "*.crt" -o -name "*.key" 2>/dev/null | while read -r file; do
                echo "    - $file"
            done
            
            # Check for cobl.gg specific certificates
            find "$location" -path "*cobl.gg*" -name "*.pem" 2>/dev/null | while read -r file; do
                echo "    🎯 cobl.gg certificate: $file"
            done
        else
            echo "  ✗ Not found: $location"
        fi
    done
    
    echo
    print_status "Manual search complete. Look for certificates above."
}

# Function to configure SSL with user-provided paths
configure_ssl_manual() {
    echo
    print_status "Manual SSL Certificate Configuration"
    echo
    
    read -p "Enter the full path to your SSL certificate file (fullchain.pem or cert.pem): " CERT_PATH
    read -p "Enter the full path to your SSL private key file (privkey.pem or key.pem): " KEY_PATH
    
    # Validate paths
    if [ ! -f "$CERT_PATH" ]; then
        print_error "Certificate file not found: $CERT_PATH"
        exit 1
    fi
    
    if [ ! -f "$KEY_PATH" ]; then
        print_error "Private key file not found: $KEY_PATH"
        exit 1
    fi
    
    print_status "Certificate file: $CERT_PATH"
    print_status "Private key file: $KEY_PATH"
    
    # Test certificate validity
    print_status "Testing certificate validity..."
    if openssl x509 -in "$CERT_PATH" -text -noout >/dev/null 2>&1; then
        print_status "Certificate file is valid"
    else
        print_error "Certificate file appears to be invalid"
        exit 1
    fi
    
    # Create the Nginx configuration with SSL
    print_status "Creating Nginx configuration with SSL..."
    
    cat > /etc/nginx/sites-available/cobl-subdomains << EOF
# Configuration for cobl.gg subdomains with SSL
server {
    listen 443 ssl http2;
    server_name *.cobl.gg;
    
    # SSL certificate configuration
    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    
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
        set \$subdomain "";
        if (\$host ~ ^([^.]+)\.cobl\.gg$) {
            set \$subdomain \$1;
        }
        
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain \$subdomain;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
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
    
    # Let's Encrypt challenge handling
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
    
    print_status "Configuration created successfully!"
}

# Function to test and reload Nginx
test_and_reload() {
    print_status "Testing Nginx configuration..."
    
    if nginx -t; then
        print_status "✓ Nginx configuration is valid"
        print_status "Reloading Nginx..."
        systemctl reload nginx
        print_status "✓ Nginx reloaded successfully"
        
        echo
        print_status "🎉 SSL configuration completed successfully!"
        echo "Your *.cobl.gg subdomains should now work with HTTPS."
    else
        print_error "✗ Nginx configuration test failed"
        print_error "Please check the configuration and try again."
        exit 1
    fi
}

# Main execution
main() {
    echo "=== SSL Certificate Configuration Helper for cobl.gg ==="
    echo
    
    check_root
    
    echo "This script will help you configure SSL certificates for *.cobl.gg domains in Nginx."
    echo
    
    # First, try to find certificates automatically
    find_certificates
    
    echo
    read -p "Would you like to manually specify certificate paths? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_ssl_manual
        test_and_reload
    else
        echo
        print_status "SSL configuration cancelled."
        echo "To configure SSL later:"
        echo "1. Run this script again"
        echo "2. Or manually edit /etc/nginx/sites-available/cobl-subdomains"
        echo "3. Then run: sudo nginx -t && sudo systemctl reload nginx"
    fi
}

# Run main function
main "$@"
