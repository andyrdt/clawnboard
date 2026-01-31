/**
 * Fly.io Machines provisioner for OpenClaw instances.
 *
 * Each moltbot gets its own Fly.io app with a dedicated URL.
 * This ensures proper DNS and avoids the shared-app DNS issues.
 */

import type {
  ProvisionerConfig,
  MoltbotConfig,
  MoltbotInstance,
  MoltbotStatus,
  FlyMachine,
  FlyMachineCreateRequest,
  FlyMachineConfig,
} from "./types.js";
import { createLogger, type Logger } from "./logger.js";

const FLY_API_BASE = "https://api.machines.dev/v1";
const FLY_API_GRAPHQL = "https://api.fly.io/graphql";

// OpenClaw VM sizes - all use shared 2 CPUs since LLM work is external
// See: https://docs.openclaw.ai/platforms/fly
// 2GB RAM is recommended
const SIZE_SPECS = {
  "1gb": { cpu_kind: "shared", cpus: 2, memory_mb: 1024 },
  "2gb": { cpu_kind: "shared", cpus: 2, memory_mb: 2048 },
  "4gb": { cpu_kind: "shared", cpus: 2, memory_mb: 4096 },
} as const;

// Prefix for moltbot app names to identify them
const MOLTBOT_APP_PREFIX = "moltbot-";

/**
 * Fly.io provisioner for OpenClaw moltbots.
 *
 * Each moltbot is deployed as its own Fly.io app, giving it a unique URL.
 */
export class FlyProvisioner {
  private config: ProvisionerConfig;
  private logger: Logger;

  constructor(config: ProvisionerConfig) {
    this.config = {
      region: "iad",
      ...config,
    };
    this.logger = config.logger || createLogger({ prefix: "fly-provisioner" });
  }

  /**
   * Make a request to the Fly.io Machines API for a specific app.
   */
  private async machinesRequest<T>(
    appName: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${FLY_API_BASE}/apps/${appName}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Fly.io API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a request to the Fly.io GraphQL API.
   */
  private async graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(FLY_API_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fly.io GraphQL error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { data: T; errors?: Array<{ message: string }> };
    if (result.errors?.length) {
      throw new Error(`Fly.io GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  /**
   * Creates a new Fly.io app for the moltbot.
   */
  private async createApp(name: string): Promise<void> {
    const query = `
      mutation($input: CreateAppInput!) {
        createApp(input: $input) {
          app { id name }
        }
      }
    `;

    await this.graphqlRequest(query, {
      input: {
        name,
        organizationId: await this.getOrgId(),
      },
    });
  }

  /**
   * Gets the user's organization ID.
   */
  private async getOrgId(): Promise<string> {
    const query = `
      query {
        viewer {
          organizations {
            nodes { id slug }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      viewer: { organizations: { nodes: Array<{ id: string; slug: string }> } };
    }>(query);

    // Use personal org or first available
    const orgs = data.viewer.organizations.nodes;
    const personalOrg = orgs.find((o) => o.slug === "personal") || orgs[0];
    if (!personalOrg) {
      throw new Error("No Fly.io organization found");
    }
    return personalOrg.id;
  }

  /**
   * Allocates a shared IPv4 for an app.
   */
  private async allocateSharedIp(appName: string): Promise<void> {
    const query = `
      mutation($input: AllocateIPAddressInput!) {
        allocateIpAddress(input: $input) {
          ipAddress { id address type }
        }
      }
    `;

    await this.graphqlRequest(query, {
      input: {
        appId: appName,
        type: "shared_v4",
      },
    });
  }

  /**
   * Creates a volume for persistent storage.
   */
  private async createVolume(appName: string, volumeName: string, sizeGb: number = 1): Promise<string> {
    const response = await this.machinesRequest<{ id: string; name: string }>(
      appName,
      "POST",
      "/volumes",
      {
        name: volumeName,
        size_gb: sizeGb,
        region: this.config.region,
      }
    );
    return response.id;
  }

  /**
   * Deletes a Fly.io app and all its resources.
   */
  private async deleteApp(appName: string): Promise<void> {
    const query = `
      mutation($appId: ID!) {
        deleteApp(appId: $appId) {
          organization { id }
        }
      }
    `;

    await this.graphqlRequest(query, { appId: appName });
  }

  /**
   * Lists all moltbot apps.
   */
  private async listMoltbotApps(): Promise<Array<{ name: string; status: string }>> {
    const query = `
      query {
        apps {
          nodes {
            name
            status
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      apps: { nodes: Array<{ name: string; status: string }> };
    }>(query);

    // Filter to only moltbot apps
    return data.apps.nodes.filter((app) => app.name.startsWith(MOLTBOT_APP_PREFIX));
  }

  /**
   * Creates a new OpenClaw moltbot.
   * This creates a new Fly.io app dedicated to this moltbot.
   */
  async createMoltbot(config: MoltbotConfig): Promise<MoltbotInstance> {
    const appName = `${MOLTBOT_APP_PREFIX}${config.name}`;
    const context = { moltbotName: config.name, appName, operation: "create" };

    this.logger.info(`Creating moltbot app: ${appName}`, context);

    // 1. Create the app
    await this.createApp(appName);
    this.logger.info(`App created: ${appName}`, context);

    // 2. Allocate shared IPv4
    await this.allocateSharedIp(appName);
    this.logger.info(`IP allocated for: ${appName}`, context);

    // 3. Create volume for persistent storage
    const volumeName = "openclaw_data";
    await this.createVolume(appName, volumeName, 1);
    this.logger.info(`Volume created: ${volumeName}`, context);

    // 4. Create the machine with a fixed token for easy access
    // Using a simple known token so URLs are predictable
    const primaryModel = config.model || "anthropic/claude-sonnet-4-5";

    // Build OpenClaw config with selected model
    const openclawConfig = {
      agents: {
        defaults: {
          model: {
            primary: primaryModel,
            fallbacks: ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"],
          },
          maxConcurrent: 4,
        },
        list: [{ id: "main", default: true }],
      },
      auth: {
        profiles: {
          "anthropic:default": { mode: "token", provider: "anthropic" },
          "openai:default": { mode: "token", provider: "openai" },
        },
      },
      gateway: {
        mode: "local",
        bind: "lan",
        trustedProxies: ["172.16.0.0/12", "10.0.0.0/8"],
        controlUi: { allowInsecureAuth: true },
      },
      meta: { lastTouchedVersion: "2026.1.29" },
    };

    // Escape single quotes in JSON for shell
    const configJson = JSON.stringify(openclawConfig).replace(/'/g, "'\\''");

    const machineConfig: FlyMachineConfig = {
      image: config.image || "ghcr.io/openclaw/openclaw:latest",
      env: {
        NODE_ENV: "production",
        OPENCLAW_STATE_DIR: "/data",
        OPENCLAW_PREFER_PNPM: "1",
        NODE_OPTIONS: "--max-old-space-size=1536",
        // Gateway authentication - fixed token for dashboard access
        OPENCLAW_GATEWAY_TOKEN: "clawnboard",
        ...config.env,
      },
      guest: SIZE_SPECS[config.size || "2gb"],
      restart: {
        policy: "always",
      },
      services: [
        {
          ports: [
            { port: 443, handlers: ["tls", "http"] },
            { port: 80, handlers: ["http"] },
          ],
          protocol: "tcp",
          internal_port: 3000,
        },
      ],
      mounts: [
        {
          volume: volumeName,
          path: "/data",
        },
      ],
      processes: [
        {
          cmd: [
            "/bin/sh",
            "-c",
            // Create config file if it doesn't exist, then start gateway
            // Config structure matches: https://docs.openclaw.ai/platforms/fly
            `mkdir -p /data && [ -f /data/openclaw.json ] || printf '%s' '${configJson}' > /data/openclaw.json && exec node dist/index.js gateway --port 3000 --bind lan`,
          ],
        },
      ],
    };

    const createRequest: FlyMachineCreateRequest = {
      name: config.name,
      region: this.config.region,
      config: machineConfig,
      skip_launch: false,
    };

    try {
      const machine = await this.machinesRequest<FlyMachine>(
        appName,
        "POST",
        "/machines",
        createRequest
      );

      this.logger.info(`Moltbot created: ${machine.id}`, {
        ...context,
        machineId: machine.id,
        region: machine.region,
      });

      return this.mapMachineToInstance(machine, appName);
    } catch (error) {
      // Clean up the app if machine creation fails
      this.logger.error(`Failed to create machine, cleaning up app: ${appName}`,
        error instanceof Error ? error : new Error(String(error)), context);
      try {
        await this.deleteApp(appName);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Gets a moltbot by its name.
   */
  async getMoltbot(moltbotName: string): Promise<MoltbotInstance | null> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;

    try {
      const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
      if (machines.length === 0) {
        return null;
      }
      return this.mapMachineToInstance(machines[0], appName);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("404") || error.message.includes("not found"))) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lists all moltbots.
   */
  async listMoltbots(): Promise<MoltbotInstance[]> {
    const apps = await this.listMoltbotApps();
    const moltbots: MoltbotInstance[] = [];

    for (const app of apps) {
      try {
        const machines = await this.machinesRequest<FlyMachine[]>(app.name, "GET", "/machines");
        if (machines.length > 0) {
          moltbots.push(this.mapMachineToInstance(machines[0], app.name));
        }
      } catch {
        // Skip apps we can't access
      }
    }

    return moltbots;
  }

  /**
   * Starts a stopped moltbot.
   */
  async startMoltbot(moltbotName: string): Promise<MoltbotInstance> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;
    const context = { moltbotName, appName, operation: "start" };

    this.logger.info(`Starting moltbot: ${moltbotName}`, context);

    const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
    if (machines.length === 0) {
      throw new Error(`No machine found for moltbot: ${moltbotName}`);
    }

    const machineId = machines[0].id;
    await this.machinesRequest<void>(appName, "POST", `/machines/${machineId}/start`);

    const moltbot = await this.waitForState(appName, machineId, "started");
    this.logger.info(`Moltbot started: ${moltbotName}`, context);
    return moltbot;
  }

  /**
   * Stops a running moltbot.
   */
  async stopMoltbot(moltbotName: string): Promise<MoltbotInstance> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;
    const context = { moltbotName, appName, operation: "stop" };

    this.logger.info(`Stopping moltbot: ${moltbotName}`, context);

    const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
    if (machines.length === 0) {
      throw new Error(`No machine found for moltbot: ${moltbotName}`);
    }

    const machineId = machines[0].id;
    await this.machinesRequest<void>(appName, "POST", `/machines/${machineId}/stop`);

    const moltbot = await this.waitForState(appName, machineId, "stopped");
    this.logger.info(`Moltbot stopped: ${moltbotName}`, context);
    return moltbot;
  }

  /**
   * Destroys a moltbot and its app permanently.
   */
  async destroyMoltbot(moltbotName: string): Promise<void> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;
    const context = { moltbotName, appName, operation: "destroy" };

    this.logger.info(`Destroying moltbot: ${moltbotName}`, context);

    // Delete the entire app (this deletes machines, volumes, etc.)
    await this.deleteApp(appName);
    this.logger.info(`Moltbot destroyed: ${moltbotName}`, context);
  }

  /**
   * Updates a moltbot to the latest OpenClaw image.
   *
   * This pulls the latest image and restarts the machine.
   * User data in /data is preserved (it's on a persistent volume).
   */
  async updateMoltbot(moltbotName: string): Promise<MoltbotInstance> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;
    const context = { moltbotName, appName, operation: "update" };

    this.logger.info(`Updating moltbot to latest image: ${moltbotName}`, context);

    const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
    if (machines.length === 0) {
      throw new Error(`No machine found for moltbot: ${moltbotName}`);
    }

    const machine = machines[0];
    const machineId = machine.id;

    // Update the machine config with the latest image
    // The config is preserved except for the image
    const updatedConfig = {
      ...machine.config,
      image: "ghcr.io/openclaw/openclaw:latest",
    };

    await this.machinesRequest<FlyMachine>(
      appName,
      "POST",
      `/machines/${machineId}`,
      {
        config: updatedConfig,
        skip_launch: false,
      }
    );

    // Wait for the machine to be running again
    const moltbot = await this.waitForState(appName, machineId, "started");
    this.logger.info(`Moltbot updated: ${moltbotName}`, context);
    return moltbot;
  }

  /**
   * Restarts a moltbot.
   */
  async restartMoltbot(moltbotName: string): Promise<MoltbotInstance> {
    const appName = moltbotName.startsWith(MOLTBOT_APP_PREFIX)
      ? moltbotName
      : `${MOLTBOT_APP_PREFIX}${moltbotName}`;
    const context = { moltbotName, appName, operation: "restart" };

    this.logger.info(`Restarting moltbot: ${moltbotName}`, context);

    const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
    if (machines.length === 0) {
      throw new Error(`No machine found for moltbot: ${moltbotName}`);
    }

    const machineId = machines[0].id;
    await this.machinesRequest<void>(appName, "POST", `/machines/${machineId}/restart`);

    const moltbot = await this.waitForState(appName, machineId, "started");
    this.logger.info(`Moltbot restarted: ${moltbotName}`, context);
    return moltbot;
  }

  /**
   * Gets the public URL for a moltbot's OpenClaw Control UI.
   */
  getMoltbotUrl(moltbot: MoltbotInstance): string {
    return `https://${moltbot.hostname}`;
  }

  private async waitForState(
    appName: string,
    machineId: string,
    targetState: MoltbotStatus,
    timeoutMs = 60000
  ): Promise<MoltbotInstance> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const machines = await this.machinesRequest<FlyMachine[]>(appName, "GET", "/machines");
      const machine = machines.find((m) => m.id === machineId);

      if (!machine) {
        throw new Error(`Machine ${machineId} not found`);
      }

      if (this.mapFlyState(machine.state) === targetState) {
        return this.mapMachineToInstance(machine, appName);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Timeout waiting for machine ${machineId} to reach state ${targetState}`
    );
  }

  private mapMachineToInstance(machine: FlyMachine, appName: string): MoltbotInstance {
    // Remove the prefix to get the moltbot name
    const name = appName.startsWith(MOLTBOT_APP_PREFIX)
      ? appName.slice(MOLTBOT_APP_PREFIX.length)
      : machine.name;

    return {
      id: machine.id,
      name,
      status: this.mapFlyState(machine.state),
      region: machine.region,
      createdAt: machine.created_at,
      hostname: `${appName}.fly.dev`,
      privateIp: machine.private_ip || null,
    };
  }

  private mapFlyState(flyState: string): MoltbotStatus {
    const stateMap: Record<string, MoltbotStatus> = {
      created: "created",
      starting: "starting",
      started: "started",
      stopping: "stopping",
      stopped: "stopped",
      destroying: "destroying",
      destroyed: "destroyed",
    };
    return stateMap[flyState] || "stopped";
  }
}
