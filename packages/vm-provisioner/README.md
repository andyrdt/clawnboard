# @clawnboard/vm-provisioner

Fly.io provisioner for deploying [OpenClaw](https://github.com/openclaw/openclaw) instances (moltbots).

## What It Does

This package handles deploying OpenClaw to Fly.io Machines:

- **Create** — Spins up a new Fly.io app and machine running OpenClaw
- **Start/Stop** — Control machine lifecycle
- **Restart** — Reboot a moltbot
- **Update** — Pull the latest OpenClaw image and restart
- **Destroy** — Permanently remove a moltbot and its app

Each moltbot is a full OpenClaw instance with all capabilities (chat, browser, shell, voice, etc.).

## Usage

```typescript
import { FlyProvisioner } from "@clawnboard/vm-provisioner";

const provisioner = new FlyProvisioner({
  apiToken: process.env.FLY_API_TOKEN!,
  region: "iad",
});

// Create a new moltbot
const moltbot = await provisioner.createMoltbot({
  name: "assistant",
  size: "2gb", // 1gb, 2gb (recommended), or 4gb
  env: {
    ANTHROPIC_API_KEY: "sk-ant-...",
  },
});

console.log(`Moltbot created: ${moltbot.id}`);
console.log(`Access OpenClaw at: https://${moltbot.hostname}`);

// Start/stop
await provisioner.stopMoltbot("assistant");
await provisioner.startMoltbot("assistant");

// Update to latest OpenClaw version
await provisioner.updateMoltbot("assistant");

// Restart
await provisioner.restartMoltbot("assistant");

// Destroy (deletes app and all data)
await provisioner.destroyMoltbot("assistant");
```

## API

### `FlyProvisioner`

#### Constructor

```typescript
new FlyProvisioner({
  apiToken: string,    // Fly.io API token (org token required)
  region?: string,     // Region (default: "iad")
  logger?: Logger,     // Custom logger
})
```

#### Methods

| Method | Description |
|--------|-------------|
| `createMoltbot(config)` | Create a new OpenClaw instance |
| `getMoltbot(name)` | Get moltbot by name |
| `listMoltbots()` | List all moltbots |
| `startMoltbot(name)` | Start a stopped moltbot |
| `stopMoltbot(name)` | Stop a running moltbot |
| `restartMoltbot(name)` | Restart a moltbot |
| `updateMoltbot(name)` | Update to latest OpenClaw image |
| `destroyMoltbot(name)` | Permanently delete a moltbot |
| `getMoltbotUrl(moltbot)` | Get the OpenClaw Control UI URL |

### `MoltbotConfig`

```typescript
interface MoltbotConfig {
  name: string;                         // Unique name (lowercase, hyphens)
  size?: "1gb" | "2gb" | "4gb";         // VM size (default: "2gb")
  image?: string;                       // Custom Docker image
  env?: Record<string, string>;         // Environment variables
}
```

### `MoltbotInstance`

```typescript
interface MoltbotInstance {
  id: string;          // Fly.io machine ID
  name: string;        // Moltbot name
  status: MoltbotStatus;
  region: string;
  createdAt: string;
  hostname: string;    // e.g., "moltbot-assistant.fly.dev"
  privateIp: string | null;
}
```

## VM Sizes

All sizes use 2 shared CPUs. LLM computation happens on Anthropic/OpenAI servers, so shared CPUs are sufficient.

| Size | RAM | Monthly Cost (24/7) |
|------|-----|---------------------|
| `1gb` | 1GB | ~$6/mo |
| `2gb` | 2GB | ~$11/mo |
| `4gb` | 4GB | ~$21/mo |

OpenClaw recommends 2GB RAM minimum for optimal performance.

Pricing based on [Fly.io pricing](https://fly.io/docs/about/pricing/) (iad region).

## Architecture

Each moltbot is deployed as its own Fly.io app:
- App name: `moltbot-<name>`
- Hostname: `moltbot-<name>.fly.dev`
- 5GB persistent volume at `/data`
- Auto-restart on failure

This per-app architecture ensures:
- Automatic DNS for each moltbot
- Complete isolation between moltbots
- Easy individual management

## OpenClaw Configuration

After creating a moltbot, configure it via the OpenClaw Control UI at `https://moltbot-<name>.fly.dev`.

See [OpenClaw documentation](https://docs.openclaw.ai) for configuration options.
