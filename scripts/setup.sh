#!/bin/bash
# ClawnBoard Setup Script

set -e

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║         ClawnBoard Setup              ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Node.js
echo -e "${BLUE}Checking prerequisites...${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "  Install Node.js 22+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${YELLOW}⚠ Node.js version is $NODE_VERSION (22+ recommended)${NC}"
else
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
fi

# Check Fly CLI
if command -v fly &> /dev/null; then
    echo -e "${GREEN}✓ Fly CLI installed${NC}"
else
    echo -e "${YELLOW}⚠ Fly CLI not found${NC}"
    echo "  Install: brew install flyctl (macOS) or curl -L https://fly.io/install.sh | sh"
fi

echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
echo ""
npx pnpm install

echo ""

# Create .env file
echo -e "${BLUE}Setting up environment...${NC}"
echo ""

if [ ! -f apps/api/.env ]; then
    cat > apps/api/.env << 'EOF'
# ============================================
# ClawnBoard Configuration
# ============================================

# Fly.io (required)
# Get an org token: fly tokens create org -x 999999h
FLY_API_TOKEN=
FLY_REGION=iad

# AI Provider Keys (at least one required)
# Anthropic: https://console.anthropic.com/settings/keys
# OpenAI: https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Server
PORT=3001
EOF
    echo -e "${GREEN}✓ Created apps/api/.env${NC}"
else
    echo -e "${YELLOW}⚠ apps/api/.env already exists (skipped)${NC}"
fi

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║         Setup Complete!               ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "  1. Get your Fly.io token:"
echo -e "     ${YELLOW}fly auth login${NC}"
echo -e "     ${YELLOW}fly tokens create org -x 999999h${NC}"
echo ""
echo "  2. Get your Anthropic API key:"
echo -e "     ${YELLOW}https://console.anthropic.com/settings/keys${NC}"
echo ""
echo "  3. Add both to apps/api/.env:"
echo -e "     ${YELLOW}FLY_API_TOKEN=FlyV1 your-token${NC}"
echo -e "     ${YELLOW}ANTHROPIC_API_KEY=sk-ant-...${NC}"
echo ""
echo "  4. Start ClawnBoard:"
echo -e "     ${YELLOW}pnpm dev${NC}"
echo ""
echo "  5. Open in browser:"
echo -e "     ${YELLOW}http://localhost:3000${NC}"
echo ""
