/**
 * Moltbot API Routes
 *
 * Endpoints for managing moltbots (OpenClaw instances on Fly.io):
 *   GET    /api/moltbots          - List all moltbots
 *   GET    /api/moltbots/:id      - Get a specific moltbot
 *   POST   /api/moltbots          - Create a new moltbot
 *   DELETE /api/moltbots/:id      - Delete a moltbot
 *   POST   /api/moltbots/:id/start   - Start a stopped moltbot
 *   POST   /api/moltbots/:id/stop    - Stop a running moltbot
 *   POST   /api/moltbots/:id/restart - Restart a moltbot
 *   POST   /api/moltbots/:id/update  - Update to latest OpenClaw version
 */

import { Hono } from "hono";
import { z } from "zod";
import { FlyProvisioner } from "@clawnboard/vm-provisioner";
import type { Moltbot, MoltbotSize, VolumeSnapshot } from "@clawnboard/shared";

export const moltbotsRouter = new Hono();

// Initialize provisioner from environment
function getProvisioner(): FlyProvisioner {
  const apiToken = process.env.FLY_API_TOKEN;
  const region = process.env.FLY_REGION || "iad";

  if (!apiToken) {
    throw new Error("FLY_API_TOKEN environment variable is required");
  }

  return new FlyProvisioner({ apiToken, region });
}

const createMoltbotSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Name must contain only lowercase letters, numbers, and hyphens"),
  size: z.enum(["1gb", "2gb", "4gb"]).default("2gb"),
  model: z.string().optional().default("anthropic/claude-sonnet-4-5"),
});

// Get AI provider keys from environment
function getAIProviderEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY) {
    env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  }
  return env;
}

/**
 * List all moltbots
 * GET /api/moltbots
 */
moltbotsRouter.get("/", async (c) => {
  try {
    const provisioner = getProvisioner();
    const instances = await provisioner.listMoltbots();

    const moltbots: Moltbot[] = instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      status: instance.status,
      hostname: instance.hostname,
      region: instance.region,
      size: "2gb" as MoltbotSize, // Fly.io doesn't return size, default to 2GB
      createdAt: instance.createdAt,
      gatewayToken: instance.gatewayToken,
    }));

    return c.json({
      success: true,
      data: moltbots,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to list moltbots",
        },
      },
      500
    );
  }
});

/**
 * Get a moltbot by ID
 * GET /api/moltbots/:id
 */
moltbotsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const instance = await provisioner.getMoltbot(id);

    if (!instance) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Moltbot not found" },
        },
        404
      );
    }

    const moltbot: Moltbot = {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      hostname: instance.hostname,
      region: instance.region,
      size: "2gb" as MoltbotSize,
      createdAt: instance.createdAt,
      gatewayToken: instance.gatewayToken,
    };

    return c.json({
      success: true,
      data: moltbot,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to get moltbot",
        },
      },
      500
    );
  }
});

/**
 * Create a new moltbot
 * POST /api/moltbots
 */
moltbotsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const data = createMoltbotSchema.parse(body);

  try {
    const aiEnv = getAIProviderEnv();
    if (Object.keys(aiEnv).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_API_KEY",
            message: "At least one AI provider API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) must be set in .env",
          },
        },
        400
      );
    }

    const provisioner = getProvisioner();
    const instance = await provisioner.createMoltbot({
      name: data.name,
      size: data.size,
      model: data.model,
      env: aiEnv,
    });

    const moltbot: Moltbot = {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      hostname: instance.hostname,
      region: instance.region,
      size: data.size as MoltbotSize,
      createdAt: instance.createdAt,
      gatewayToken: instance.gatewayToken,
    };

    return c.json(
      {
        success: true,
        data: moltbot,
      },
      201
    );
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to create moltbot",
        },
      },
      500
    );
  }
});

/**
 * Delete a moltbot
 * DELETE /api/moltbots/:id
 */
moltbotsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    await provisioner.destroyMoltbot(id);

    return c.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete moltbot",
        },
      },
      500
    );
  }
});

/**
 * Start a moltbot
 * POST /api/moltbots/:id/start
 */
moltbotsRouter.post("/:id/start", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const instance = await provisioner.startMoltbot(id);

    return c.json({
      success: true,
      data: { id: instance.id, status: instance.status },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to start moltbot",
        },
      },
      500
    );
  }
});

/**
 * Stop a moltbot
 * POST /api/moltbots/:id/stop
 */
moltbotsRouter.post("/:id/stop", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const instance = await provisioner.stopMoltbot(id);

    return c.json({
      success: true,
      data: { id: instance.id, status: instance.status },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to stop moltbot",
        },
      },
      500
    );
  }
});

/**
 * Restart a moltbot
 * POST /api/moltbots/:id/restart
 */
moltbotsRouter.post("/:id/restart", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const instance = await provisioner.restartMoltbot(id);

    return c.json({
      success: true,
      data: { id: instance.id, status: instance.status },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to restart moltbot",
        },
      },
      500
    );
  }
});

/**
 * Update a moltbot to the latest OpenClaw version
 * POST /api/moltbots/:id/update
 *
 * This pulls the latest OpenClaw Docker image and restarts the machine.
 * All user data (config, workspace files) is preserved on the persistent volume.
 */
moltbotsRouter.post("/:id/update", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const instance = await provisioner.updateMoltbot(id);

    return c.json({
      success: true,
      data: { id: instance.id, status: instance.status },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to update moltbot",
        },
      },
      500
    );
  }
});

/**
 * List snapshots for a moltbot
 * GET /api/moltbots/:id/snapshots
 */
moltbotsRouter.get("/:id/snapshots", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const volumes = await provisioner.listVolumes(id);

    if (volumes.length === 0) {
      return c.json({
        success: true,
        data: [],
      });
    }

    // Get snapshots for the first volume (moltbots have one volume)
    const volume = volumes[0];
    const [rawSnapshots, hiddenIds] = await Promise.all([
      provisioner.listVolumeSnapshots(id, volume.id),
      provisioner.getHiddenSnapshots(id),
    ]);

    const snapshots: VolumeSnapshot[] = rawSnapshots
      .filter((snapshot) => !hiddenIds.includes(snapshot.id))
      .map((snapshot) => {
        const date = new Date(snapshot.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          id: snapshot.id,
          moltbotName: id,
          volumeId: volume.id,
          createdAt: snapshot.created_at,
          sizeGb: Math.ceil(snapshot.size / (1024 * 1024 * 1024)),
          label: `${id} - ${date}`,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({
      success: true,
      data: snapshots,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to list snapshots",
        },
      },
      500
    );
  }
});

/**
 * Create a snapshot for a moltbot
 * POST /api/moltbots/:id/snapshots
 */
moltbotsRouter.post("/:id/snapshots", async (c) => {
  const id = c.req.param("id");

  try {
    const provisioner = getProvisioner();
    const volumes = await provisioner.listVolumes(id);

    if (volumes.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "NO_VOLUME",
            message: "Moltbot has no volume to snapshot",
          },
        },
        400
      );
    }

    const volume = volumes[0];
    const snapshot = await provisioner.createVolumeSnapshot(id, volume.id);

    const date = new Date(snapshot.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const volumeSnapshot: VolumeSnapshot = {
      id: snapshot.id,
      moltbotName: id,
      volumeId: volume.id,
      createdAt: snapshot.created_at,
      sizeGb: Math.ceil(snapshot.size / (1024 * 1024 * 1024)),
      label: `${id} - ${date}`,
    };

    return c.json(
      {
        success: true,
        data: volumeSnapshot,
      },
      201
    );
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to create snapshot",
        },
      },
      500
    );
  }
});

/**
 * Hide a snapshot (soft delete)
 * DELETE /api/moltbots/:id/snapshots/:snapshotId
 *
 * Since Fly.io doesn't support deleting snapshots, we store hidden IDs
 * in machine metadata and filter them out when listing.
 */
moltbotsRouter.delete("/:id/snapshots/:snapshotId", async (c) => {
  const id = c.req.param("id");
  const snapshotId = c.req.param("snapshotId");

  try {
    const provisioner = getProvisioner();
    await provisioner.hideSnapshot(id, snapshotId);

    return c.json({
      success: true,
      data: { hidden: true, snapshotId },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to hide snapshot",
        },
      },
      500
    );
  }
});

// Snapshot routes (not nested under moltbots)
export const snapshotsRouter = new Hono();

/**
 * List ALL snapshots across all moltbots
 * GET /api/snapshots
 */
snapshotsRouter.get("/", async (c) => {
  try {
    const provisioner = getProvisioner();
    const snapshots = await provisioner.listAllSnapshots();

    return c.json({
      success: true,
      data: snapshots,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to list snapshots",
        },
      },
      500
    );
  }
});

const deployFromSnapshotSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Name must contain only lowercase letters, numbers, and hyphens"),
  size: z.enum(["1gb", "2gb", "4gb"]).default("2gb"),
  model: z.string().optional().default("anthropic/claude-sonnet-4-5"),
  sourceApp: z.string(),  // The app name where the snapshot exists
});

/**
 * Deploy a new moltbot from a snapshot
 * POST /api/snapshots/:id/deploy
 */
snapshotsRouter.post("/:id/deploy", async (c) => {
  const snapshotId = c.req.param("id");
  const body = await c.req.json();
  const data = deployFromSnapshotSchema.parse(body);

  try {
    const aiEnv = getAIProviderEnv();
    if (Object.keys(aiEnv).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_API_KEY",
            message: "At least one AI provider API key must be set",
          },
        },
        400
      );
    }

    const provisioner = getProvisioner();
    const instance = await provisioner.deployFromSnapshot({
      snapshotId,
      sourceAppName: data.sourceApp,
      newName: data.name,
      size: data.size,
      model: data.model,
      env: aiEnv,
    });

    const moltbot: Moltbot = {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      hostname: instance.hostname,
      region: instance.region,
      size: data.size as MoltbotSize,
      createdAt: instance.createdAt,
      gatewayToken: instance.gatewayToken,
    };

    return c.json(
      {
        success: true,
        data: moltbot,
      },
      201
    );
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "FLY_API_ERROR",
          message: error instanceof Error ? error.message : "Failed to deploy from snapshot",
        },
      },
      500
    );
  }
});
