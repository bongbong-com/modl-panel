#!/bin/bash

# Nginx + Certbot Migration Script
# This script helps migrate from Caddy to Nginx + Certbot setup
200
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to backup existing configurations
backup_configs() {
    print_status "Creating backup of existing configurations..."
    
    BACKUP_DIR="/root/modl-panel-migration-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup Caddy configs if they exist
    if [ -d "/etc/caddy" ]; then
        print_status "Backing up Caddy configurations..."
        cp -r /etc/caddy "$BACKUP_DIR/caddy" 2>/dev/null || true
    fi
    
    # Backup Nginx configs if they exist
    if [ -d "/etc/nginx" ]; then
        print_status "Backing up existing Nginx configurations..."
        cp -r /etc/nginx "$BACKUP_DIR/nginx" 2>/dev/null || true
    fi
    
    # Backup Let's Encrypt certificates if they exist
    if [ -d "/etc/letsencrypt" ]; then
        print_status "Backing up Let's Encrypt certificates..."
        cp -r /etc/letsencrypt "$BACKUP_DIR/letsencrypt" 2>/dev/null || true
    fi
    
    print_status "Backup created at: $BACKUP_DIR"
    echo "$BACKUP_DIR" > /tmp/modl-backup-location
}

# Function to install required packages
install_packages() {
    print_status "Installing required packages..."
    
    # Update package list
    apt update
    
    # Install Nginx
    if ! command_exists nginx; then
        print_status "Installing Nginx..."
        apt install -y nginx
    else
        print_status "Nginx already installed"
    fi
    
    # Install Certbot
    if ! command_exists certbot; then
        print_status "Installing Certbot..."
        apt install -y certbot python3-certbot-nginx
    else
        print_status "Certbot already installed"
    fi
    
    # Ensure curl is available for testing
    if ! command_exists curl; then
        apt install -y curl
    fi
}

# Function to stop Caddy if running
stop_caddy() {
    if systemctl is-active --quiet caddy; then
        print_warning "Stopping Caddy service..."
        systemctl stop caddy
        systemctl disable caddy
        print_status "Caddy stopped and disabled"
    else
        print_status "Caddy is not running"
    fi
}

# Function to configure Nginx for cobl.gg
configure_nginx() {
    print_status "Configuring Nginx for cobl.gg subdomains..."
    
    # Create web root for Let's Encrypt challenges
    mkdir -p /var/www/html
    chown -R www-data:www-data /var/www/html
    
    # First, create HTTP-only configuration to avoid SSL certificate errors
    print_status "Creating temporary HTTP-only configuration..."
    cat > /etc/nginx/sites-available/cobl-subdomains << 'EOF'
# Temporary HTTP-only configuration for cobl.gg subdomains
# This will be updated with SSL configuration after certificate paths are confirmed

server {
    listen 80;
    server_name *.cobl.gg;
    
    # Let's Encrypt challenge handling
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Proxy to Node.js application (temporary HTTP setup)
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
EOF

    # Enable the configuration
    ln -sf /etc/nginx/sites-available/cobl-subdomains /etc/nginx/sites-enabled/
    
    # Remove default Nginx site if it exists
    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm /etc/nginx/sites-enabled/default
        print_status "Removed default Nginx site"
    fi
    
    print_status "HTTP-only configuration created. You'll need to update SSL certificate paths manually."
}

# Function to find and configure SSL certificates
configure_ssl_certificates() {
    print_status "Searching for existing SSL certificates..."
    
    # Common locations where SSL certificates might be stored
    CERT_LOCATIONS=(
        "/etc/letsencrypt/live/cobl.gg"
        "/etc/letsencrypt/live/*.cobl.gg"
        "/etc/ssl/certs/cobl.gg"
        "/etc/pki/tls/certs/cobl.gg"
        "/opt/caddy/certs/cobl.gg"
        "/home/caddy/certs/cobl.gg"
    )
    
    FOUND_CERT=""
    FOUND_KEY=""
    
    for location in "${CERT_LOCATIONS[@]}"; do
        if [ -d "$location" ]; then
            print_status "Found certificate directory: $location"
            
            # Look for common certificate file names
            if [ -f "$location/fullchain.pem" ] && [ -f "$location/privkey.pem" ]; then
                FOUND_CERT="$location/fullchain.pem"
                FOUND_KEY="$location/privkey.pem"
                print_status "Found certificate files: $FOUND_CERT and $FOUND_KEY"
                break
            elif [ -f "$location/cert.pem" ] && [ -f "$location/key.pem" ]; then
                FOUND_CERT="$location/cert.pem"
                FOUND_KEY="$location/key.pem"
                print_status "Found certificate files: $FOUND_CERT and $FOUND_KEY"
                break
            fi
        fi
    done
    
    if [ -n "$FOUND_CERT" ] && [ -n "$FOUND_KEY" ]; then
        print_status "Updating Nginx configuration with SSL certificates..."
        
        # Create the full HTTPS configuration
        cat > /etc/nginx/sites-available/cobl-subdomains << EOF
# Configuration for cobl.gg subdomains with SSL
server {
    listen 443 ssl http2;
    server_name *.cobl.gg;
    
    # SSL certificate configuration
    ssl_certificate $FOUND_CERT;
    ssl_certificate_key $FOUND_KEY;
    
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
        
        print_status "SSL certificates configured successfully!"
    else
        print_warning "Could not find SSL certificates automatically."
        print_warning "You'll need to manually update /etc/nginx/sites-available/cobl-subdomains"
        print_warning "with the correct certificate paths."
        
        echo
        echo "=== Manual SSL Configuration Required ==="
        echo "1. Locate your *.cobl.gg SSL certificate files"
        echo "2. Edit /etc/nginx/sites-available/cobl-subdomains"
        echo "3. Update the ssl_certificate and ssl_certificate_key paths"
        echo "4. Test with: sudo nginx -t"
        echo "5. Reload with: sudo systemctl reload nginx"
        echo
    fi
}

# Function to set up service user and permissions
setup_permissions() {
    print_status "Setting up service user and permissions..."
    
    # Create service user if it doesn't exist
    if ! id "modl-panel" &>/dev/null; then
        useradd -r -s /bin/false modl-panel
        print_status "Created modl-panel service user"
    fi
    
    # Add to nginx group
    usermod -a -G nginx modl-panel
    
    # Set up directory permissions
    chmod 755 /etc/nginx/sites-available
    chown root:nginx /etc/nginx/sites-available
    
    # Create logs directory
    mkdir -p /var/log/nginx
    chown nginx:nginx /var/log/nginx
    
    # Set up sudo permissions for modl-panel user
    cat > /etc/sudoers.d/modl-panel << 'EOF'
# Allow modl-panel service to manage Nginx and Certbot
modl-panel ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
modl-panel ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
modl-panel ALL=(ALL) NOPASSWD: /usr/bin/certbot certonly *
modl-panel ALL=(ALL) NOPASSWD: /usr/bin/certbot delete *
EOF
    
    print_status "Permissions configured for modl-panel user"
}

# Function to configure Certbot auto-renewal
setup_certbot() {
    print_status "Setting up Certbot auto-renewal..."
    
    # Test Certbot installation
    certbot --version
    
    # Set up automatic renewal cron job
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        print_status "Added Certbot renewal cron job"
    else
        print_status "Certbot renewal cron job already exists"
    fi
    
    # Test renewal process
    print_status "Testing Certbot renewal..."
    certbot renew --dry-run
}

# Function to test and start services
start_services() {
    print_status "Testing and starting services..."
    
    # Test Nginx configuration
    print_status "Testing Nginx configuration..."
    if nginx -t; then
        print_status "Nginx configuration is valid"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
    
    # Start and enable Nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Check if Nginx is running
    if systemctl is-active --quiet nginx; then
        print_status "Nginx is running successfully"
    else
        print_error "Failed to start Nginx"
        exit 1
    fi
}

# Function to test the application
test_application() {
    print_status "Testing application connectivity..."
    
    # Test if Node.js app is responding on port 5000
    if curl -s http://127.0.0.1:5000 >/dev/null; then
        print_status "Node.js application is responding on port 5000"
    else
        print_warning "Node.js application is not responding on port 5000"
        print_warning "Make sure your modl-panel application is running"
    fi
}

# Function to display migration results
display_results() {
    print_status "Migration completed successfully!"
    echo
    echo "=== Migration Summary ==="
    echo "✓ Caddy stopped and disabled"
    echo "✓ Nginx installed and configured"
    echo "✓ Certbot installed and configured"
    echo "✓ Service user and permissions set up"
    echo "✓ Auto-renewal configured"
    echo
    echo "=== Next Steps ==="
    echo "1. Configure SSL certificates for *.cobl.gg:"
    echo "   - Run: sudo ./configure-ssl.sh"
    echo "   - Or manually update certificate paths in /etc/nginx/sites-available/cobl-subdomains"
    echo "2. Restart your Node.js application to use the new Nginx/Certbot integration"
    echo "3. Test custom domain functionality through the admin panel"
    echo "4. Monitor logs at /var/log/nginx/ for any issues"
    echo
    echo "=== Important Notes ==="
    echo "• Backup location: $(cat /tmp/modl-backup-location 2>/dev/null || echo 'Not created')"
    echo "• Custom domain configurations will be created in /etc/nginx/sites-available/"
    echo "• SSL certificates will be managed by Certbot in /etc/letsencrypt/"
    echo "• Check the NGINX_CERTBOT_SETUP.md file for detailed documentation"
    echo
    if [ -f /tmp/modl-backup-location ]; then
        echo "=== Rollback Instructions ==="
        echo "To rollback to Caddy if needed:"
        echo "1. sudo systemctl stop nginx"
        echo "2. sudo systemctl disable nginx"
        echo "3. Restore Caddy configs from $(cat /tmp/modl-backup-location)"
        echo "4. sudo systemctl enable caddy"
        echo "5. sudo systemctl start caddy"
    fi
}

# Main execution
main() {
    echo "=== Modl Panel: Caddy to Nginx + Certbot Migration ==="
    echo
    
    # Check if running as root
    check_root
    
    # Confirm migration
    read -p "This will migrate from Caddy to Nginx + Certbot. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Migration cancelled"
        exit 0
    fi
    
    # Execute migration steps
    backup_configs
    install_packages
    stop_caddy
    configure_nginx
    configure_ssl_certificates
    setup_permissions
    setup_certbot
    start_services
    test_application
    display_results
}

# Run main function
main "$@"
