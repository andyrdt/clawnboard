# ClawnBoard

A local dashboard for deploying and managing [OpenClaw](https://github.com/openclaw/openclaw) AI agents ("moltbots") on Fly.io.

```
┌─────────────────────────────────────────────────────────────┐
│  ClawnBoard (localhost:3000)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ my-bot      │  │ helper      │  │ + Create    │         │
│  │ ● Running   │  │ ○ Stopped   │  │   Moltbot   │         │
│  │ [Open]      │  │ [Start]     │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Fly.io Cloud                                               │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ moltbot-my-bot    │  │ moltbot-helper    │   ...        │
│  │ OpenClaw instance │  │ OpenClaw instance │              │
│  │ fly.dev URL       │  │ fly.dev URL       │              │
│  └───────────────────┘  └───────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## What's a Moltbot?

A moltbot is your own personal AI assistant running in the cloud. Each moltbot is a full [OpenClaw](https://openclaw.ai) instance with:

- **AI Chat** — Talk directly via web UI
- **Discord/Slack Integration** — Connect to your channels
- **Persistent Memory** — Remembers conversations
- **24/7 Availability** — Runs even when your laptop is off

ClawnBoard handles deployment. OpenClaw handles the AI.

---

## Quick Start

### Prerequisites

| Requirement | Where to get it |
|-------------|-----------------|
| Node.js 22+ | [nodejs.org](https://nodejs.org/) |
| Fly.io account | [fly.io](https://fly.io) (credit card required) |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com/settings/keys) |

### 1. Install Fly.io CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

### 2. Authenticate with Fly.io

```bash
fly auth login
```

### 3. Create an org token

```bash
fly tokens create org -x 999999h
```

Save this token — you'll need it below.

> **Why org token?** ClawnBoard creates a new Fly.io app for each moltbot. Org tokens have permission to create apps; deploy tokens don't.

### 4. Clone and install

```bash
git clone https://github.com/andyrdt/clawnboard.git
cd clawnboard
npm install -g pnpm
pnpm install
```

### 5. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```bash
# Fly.io (required)
FLY_API_TOKEN=FlyV1 paste-your-org-token-here
FLY_REGION=iad

# AI Provider Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Server
PORT=3001
```

### 6. Start ClawnBoard

```bash
pnpm dev
```

Open **http://localhost:3000**

---

## Usage

### Creating a Moltbot

1. Click **"Create Moltbot"**
2. Enter a name (lowercase, hyphens only): `my-assistant`
3. Choose a size (2GB RAM recommended)
4. Click **Create**

ClawnBoard will:
- Create a Fly.io app: `moltbot-my-assistant`
- Allocate a public IP
- Create persistent storage (1GB)
- Start the OpenClaw instance

This takes ~60 seconds on first deploy.

### Managing Moltbots

| Action | How |
|--------|-----|
| **Open Dashboard** | Click moltbot card → "Open Dashboard" |
| **Stop Server** | Click "Stop" → Pauses the moltbot (saves money) |
| **Start Server** | Click "Start" → Resumes a stopped moltbot |
| **Restart Server** | Click "Restart" → Reboots the moltbot |
| **Update OpenClaw** | Click "Update OpenClaw" → Pulls latest image |
| **Delete** | Click "Delete" → Permanently deletes moltbot |

The dashboard auto-refreshes every 5 seconds to show current status.

### Configuring Your Moltbot

Click **"Open Dashboard"** to access the OpenClaw Control UI at `https://moltbot-<name>.fly.dev`

From there you can:
- **Chat** — Talk to your bot directly
- **Channels** — Connect Discord, Slack, Telegram
- **Settings** — Configure AI model, personality, tools
- **Instances** — Manage multiple AI profiles

See [OpenClaw docs](https://docs.openclaw.ai) for detailed configuration.

### SSH Access

For advanced configuration, copy the SSH command from the moltbot detail page:

```bash
fly ssh console -a moltbot-<name>
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FLY_API_TOKEN` | Yes | Fly.io org token (`fly tokens create org`) |
| `FLY_REGION` | No | Deploy region (default: `iad`) |
| `ANTHROPIC_API_KEY` | One of these | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | One of these | OpenAI API key for GPT models |
| `PORT` | No | API server port (default: `3001`) |

### Moltbot Sizes

All sizes use 2 shared CPUs (sufficient since LLM computation happens on Anthropic/OpenAI servers).

| Size | RAM | Monthly Cost (24/7) |
|------|-----|---------------------|
| 1GB  | 1GB | ~$6/mo |
| 2GB (Recommended) | 2GB | ~$11/mo |
| 4GB  | 4GB | ~$21/mo |

Stopped moltbots cost ~$0.15/GB/month (storage only).

> **Note:** OpenClaw recommends 2GB RAM minimum for optimal performance.

### Fly.io Regions

Common regions: `iad` (Virginia), `lax` (Los Angeles), `lhr` (London), `nrt` (Tokyo)

See [Fly.io regions](https://fly.io/docs/reference/regions/) for full list.

---

## Project Structure

```
clawnboard/
├── apps/
│   ├── web/                 # Next.js dashboard (localhost:3000)
│   └── api/                 # Hono API server (localhost:3001)
├── packages/
│   ├── shared/              # Shared types and constants
│   └── vm-provisioner/      # Fly.io provisioning logic
└── docker/
    └── Dockerfile.moltbot   # OpenClaw container image
```

---

## Troubleshooting

### "Not authorized" or "Fly.io API error"

1. Make sure you're using an **org token**, not a deploy token:
   ```bash
   fly tokens create org -x 999999h
   ```
2. Check that `FLY_API_TOKEN` is set correctly in `apps/api/.env`
3. Verify billing is set up at [fly.io/dashboard](https://fly.io/dashboard) → Billing

### "At least one AI provider API key must be set"

Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `apps/api/.env`

### Moltbot stuck on "Starting" or "Booting"

- First deploy downloads the OpenClaw Docker image (~60 seconds)
- Server initialization can take 1-2 minutes
- Check logs: `fly logs -a moltbot-<name>`
- If it keeps restarting, check for missing environment variables

### Can't access OpenClaw Control UI

1. Make sure status shows **"Ready"** (not just "Running")
2. URL format: `https://moltbot-<name>.fly.dev`
3. DNS can take 1-2 minutes to propagate after creation
4. Try refreshing the page

### OpenClaw shows "Schema unavailable"

This usually means the config file is missing or corrupted. Delete and recreate the moltbot — ClawnBoard will generate a fresh config with proper agent and gateway settings.

### "Pairing required" error

This can happen if the gateway doesn't trust the connection. ClawnBoard's config includes:
- `gateway.trustedProxies` — Trust Fly.io's internal network
- `gateway.controlUi.allowInsecureAuth` — Allow token-only auth

If you still see this error, delete and recreate the moltbot.

### Customizing your moltbot

After creation, use the OpenClaw Control UI to customize:
- **Config** tab → Edit settings, change AI model, add channels
- **Chat** tab → Talk to your assistant directly
- **Channels** tab → Connect Discord, Telegram, Slack, etc.

For advanced configuration, SSH into the machine: `fly ssh console -a moltbot-<name>`

---

## Architecture

### How It Works

1. **ClawnBoard** runs locally on your machine
2. When you create a moltbot, ClawnBoard calls the **Fly.io API** to:
   - Create a new app: `moltbot-<name>`
   - Allocate a shared IPv4 address
   - Create a 1GB persistent volume
   - Launch a machine running OpenClaw
3. Each moltbot gets a public URL: `https://moltbot-<name>.fly.dev`
4. Your AI API keys are passed as environment variables to the moltbot

### Why Per-App Architecture?

Each moltbot is its own Fly.io app (not just a machine in a shared app) because:
- **DNS**: Each app gets automatic `*.fly.dev` DNS
- **Isolation**: Moltbots can't interfere with each other
- **Management**: Easy to start/stop/delete individually

### Moltbot Configuration

ClawnBoard follows the [official OpenClaw Fly.io deployment pattern](https://docs.openclaw.ai/platforms/fly). On first boot, it creates a config file at `/data/openclaw.json` with:

| Setting | Value | Purpose |
|---------|-------|---------|
| `agents.list[0]` | `{ id: "main", default: true }` | Default agent for conversations |
| `agents.defaults.model.primary` | `anthropic/claude-opus-4-5` | Default AI model |
| `gateway.mode` | `local` | Standard local gateway mode |
| `gateway.trustedProxies` | Fly.io internal ranges | Trust reverse proxy connections |
| `gateway.controlUi.allowInsecureAuth` | `true` | Allow token-only authentication |

Environment variables passed to each moltbot:

| Variable | Value | Purpose |
|----------|-------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | `clawnboard` | Fixed token for dashboard access |
| `ANTHROPIC_API_KEY` | From your .env | AI model authentication |
| `OPENAI_API_KEY` | From your .env | AI model authentication (if set) |

The dashboard URL always includes `?token=clawnboard` automatically.

---

## Coming Back Later

Your moltbots run 24/7 on Fly.io, even when your laptop is off.

To manage them again:

```bash
cd clawnboard
pnpm dev
```

Open http://localhost:3000 — your moltbots are fetched from Fly.io.

---

## Costs

| Item | Cost |
|------|------|
| ClawnBoard | Free (runs locally) |
| Fly.io (per moltbot) | ~$6-21/mo running, ~$0.15/mo stopped |
| Anthropic API | ~$3/million input tokens, $15/million output |
| OpenAI API | Varies by model |

**Tip**: Stop moltbots you're not using to save money.

---

## License

MIT
