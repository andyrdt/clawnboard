import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../app.js";

// Mock the FlyProvisioner
vi.mock("@clawnboard/vm-provisioner", () => ({
  FlyProvisioner: vi.fn().mockImplementation(() => ({
    listMoltbots: vi.fn().mockResolvedValue([
      {
        id: "machine-1",
        name: "test-bot",
        status: "started",
        hostname: "test-bot.my-app.fly.dev",
        region: "iad",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ]),
    getMoltbot: vi.fn().mockImplementation((id: string) => {
      if (id === "non-existent-id") {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id,
        name: "test-bot",
        status: "started",
        hostname: "test-bot.my-app.fly.dev",
        region: "iad",
        createdAt: "2024-01-01T00:00:00Z",
      });
    }),
    createMoltbot: vi.fn().mockImplementation((config: { name: string; size?: string }) => {
      return Promise.resolve({
        id: "new-machine-id",
        name: config.name,
        status: "created",
        hostname: `${config.name}.my-app.fly.dev`,
        region: "iad",
        createdAt: new Date().toISOString(),
      });
    }),
    destroyMoltbot: vi.fn().mockResolvedValue(undefined),
    startMoltbot: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        name: "test-bot",
        status: "starting",
        hostname: "test-bot.my-app.fly.dev",
        region: "iad",
        createdAt: "2024-01-01T00:00:00Z",
      });
    }),
    stopMoltbot: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        name: "test-bot",
        status: "stopping",
        hostname: "test-bot.my-app.fly.dev",
        region: "iad",
        createdAt: "2024-01-01T00:00:00Z",
      });
    }),
    restartMoltbot: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        name: "test-bot",
        status: "starting",
        hostname: "test-bot.my-app.fly.dev",
        region: "iad",
        createdAt: "2024-01-01T00:00:00Z",
      });
    }),
  })),
}));

// Set required env vars for tests
beforeEach(() => {
  process.env.FLY_API_TOKEN = "test-token";
  process.env.FLY_APP_NAME = "my-app";
  process.env.FLY_REGION = "iad";
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
});

describe("Moltbots API", () => {
  describe("GET /api/moltbots", () => {
    it("should return a list of moltbots", async () => {
      const res = await app.request("/api/moltbots", {
        method: "GET",
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("GET /api/moltbots/:id", () => {
    it("should return 404 for non-existent moltbot", async () => {
      const res = await app.request("/api/moltbots/non-existent-id", {
        method: "GET",
      });

      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/moltbots", () => {
    it("should create a new moltbot", async () => {
      const res = await app.request("/api/moltbots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "test-bot",
          size: "2gb",
        }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("test-bot");
      expect(body.data.size).toBe("2gb");
      expect(body.data.status).toBe("created");
    });

    it("should use default size if not specified", async () => {
      const res = await app.request("/api/moltbots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "test-bot",
        }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data.size).toBe("2gb");
    });

    it("should validate required fields", async () => {
      const res = await app.request("/api/moltbots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it("should validate name format", async () => {
      const res = await app.request("/api/moltbots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Invalid Name With Spaces",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/moltbots/:id", () => {
    it("should delete a moltbot", async () => {
      const res = await app.request("/api/moltbots/test-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);
    });
  });

  describe("POST /api/moltbots/:id/start", () => {
    it("should start a moltbot", async () => {
      const res = await app.request("/api/moltbots/test-id/start", {
        method: "POST",
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("starting");
    });
  });

  describe("POST /api/moltbots/:id/stop", () => {
    it("should stop a moltbot", async () => {
      const res = await app.request("/api/moltbots/test-id/stop", {
        method: "POST",
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("stopping");
    });
  });

  describe("POST /api/moltbots/:id/restart", () => {
    it("should restart a moltbot", async () => {
      const res = await app.request("/api/moltbots/test-id/restart", {
        method: "POST",
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("starting");
    });
  });
});
