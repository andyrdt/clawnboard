import type { Logger } from "./logger.js";

/**
 * Configuration for the Fly.io provisioner.
 */
export interface ProvisionerConfig {
  /** Fly.io API token */
  apiToken: string;
  /** Region for new machines (default: "iad") */
  region?: string;
  /** Custom logger instance */
  logger?: Logger;
}

/**
 * Configuration for creating a new moltbot (OpenClaw instance).
 */
export interface MoltbotConfig {
  /** Unique name for the moltbot (used as machine name) */
  name: string;
  /** VM size (affects memory): 1gb, 2gb (recommended), or 4gb */
  size?: "1gb" | "2gb" | "4gb";
  /** Default AI model (e.g., "anthropic/claude-sonnet-4-5") */
  model?: string;
  /** Custom Docker image (default: ghcr.io/openclaw/openclaw:latest) */
  image?: string;
  /** Environment variables to pass to OpenClaw */
  env?: Record<string, string>;
}

/**
 * A running or stopped moltbot instance.
 */
export interface MoltbotInstance {
  /** Fly.io machine ID */
  id: string;
  /** Moltbot name */
  name: string;
  /** Current status */
  status: MoltbotStatus;
  /** Fly.io region */
  region: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** Public hostname for accessing the OpenClaw Control UI */
  hostname: string;
  /** Private IP (for internal communication) */
  privateIp: string | null;
  /** Gateway token for accessing the dashboard (only present on creation) */
  gatewayToken?: string;
}

export type MoltbotStatus =
  | "created"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "destroying"
  | "destroyed";

// Legacy aliases for backwards compatibility
export type VMConfig = MoltbotConfig;
export type VMInstance = MoltbotInstance;
export type VMStatus = MoltbotStatus;

// Fly.io API types
export interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id: string;
  private_ip: string;
  created_at: string;
  updated_at: string;
  config: FlyMachineConfig;
}

export interface FlyMachineConfig {
  image: string;
  env?: Record<string, string>;
  guest: {
    cpu_kind: string;
    cpus: number;
    memory_mb: number;
  };
  services?: FlyService[];
  mounts?: FlyMount[];
  processes?: FlyProcess[];
  restart?: {
    policy: "always" | "never" | "on-failure";
  };
  checks?: Record<string, FlyCheck>;
}

export interface FlyCheck {
  type: "http" | "tcp";
  port: number;
  path?: string;
  interval: string;
  timeout: string;
  grace_period?: string;
}

export interface FlyService {
  ports: FlyPort[];
  protocol: string;
  internal_port: number;
}

export interface FlyPort {
  port: number;
  handlers: string[];
}

export interface FlyMount {
  volume: string;
  path: string;
}

export interface FlyProcess {
  cmd: string[];
}

export interface FlyMachineCreateRequest {
  name?: string;
  region?: string;
  config: FlyMachineConfig;
  skip_launch?: boolean;
}
