#!/bin/bash
# Moltbot Entrypoint Script
# This script initializes and runs OpenClaw with user configuration

set -e

echo "=== Moltbot Starting ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Validate required environment variables
if [ -z "$MOLTBOT_ID" ]; then
    echo "ERROR: MOLTBOT_ID is required"
    exit 1
fi

if [ -z "$CLAWNBOARD_API_URL" ]; then
    echo "ERROR: CLAWNBOARD_API_URL is required"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: At least one of ANTHROPIC_API_KEY or OPENAI_API_KEY is required"
    exit 1
fi

echo "Moltbot ID: $MOLTBOT_ID"
echo "Model: ${AI_MODEL:-claude-sonnet}"
echo "API URL: $CLAWNBOARD_API_URL"

# Create OpenClaw configuration directory
mkdir -p ~/.config/openclaw

# Generate OpenClaw configuration
cat > ~/.config/openclaw/config.json << EOF
{
  "moltbotId": "$MOLTBOT_ID",
  "model": "${AI_MODEL:-claude-sonnet}",
  "personality": "${PERSONALITY:-You are a helpful AI assistant.}",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY:-}",
    "openai": "${OPENAI_API_KEY:-}"
  },
  "clawnboard": {
    "apiUrl": "$CLAWNBOARD_API_URL",
    "authToken": "${CLAWNBOARD_AUTH_TOKEN:-}"
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  }
}
EOF

echo "Configuration written to ~/.config/openclaw/config.json"

# Start the moltbot gateway server
# This provides a WebSocket interface for ClawnBoard to send/receive messages
echo "Starting Moltbot Gateway Server on port 8080..."

# Run the gateway server (Node.js script)
exec node /home/moltbot/gateway-server.js
