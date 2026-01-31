#!/bin/bash
# VM Setup Script for Moltbot
#
# This script is executed when a new VM is provisioned.
# It sets up the environment and installs all required dependencies.

set -e

echo "=== Moltbot VM Setup ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Update system packages
echo "Updating system packages..."
apt-get update -qq

# Install Node.js 22
echo "Installing Node.js 22..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install required system packages
echo "Installing system dependencies..."
apt-get install -y \
    curl \
    git \
    ca-certificates

# Create moltbot user if it doesn't exist
if ! id -u moltbot &>/dev/null; then
    echo "Creating moltbot user..."
    useradd -m -s /bin/bash moltbot
fi

# Set up working directory
MOLTBOT_HOME="/home/moltbot"
mkdir -p "$MOLTBOT_HOME"

# Install gateway server dependencies
echo "Setting up gateway server..."
cd "$MOLTBOT_HOME"

# Create package.json for the gateway
cat > package.json << 'EOF'
{
  "name": "moltbot-gateway",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "ws": "^8.18.0"
  }
}
EOF

npm install --production

# Copy gateway server script
# In production, this would be fetched from the ClawnBoard API or container image
echo "Gateway server dependencies installed"

# Set ownership
chown -R moltbot:moltbot "$MOLTBOT_HOME"

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/moltbot.service << 'EOF'
[Unit]
Description=Moltbot Gateway Server
After=network.target

[Service]
Type=simple
User=moltbot
WorkingDirectory=/home/moltbot
ExecStart=/usr/bin/node /home/moltbot/gateway-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

echo "=== VM Setup Complete ==="
echo "Run 'systemctl start moltbot' to start the gateway server"
