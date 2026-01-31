import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlyProvisioner } from "./fly-provisioner.js";
import type { ProvisionerConfig, FlyMachine } from "./types.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("FlyProvisioner", () => {
  const config: ProvisionerConfig = {
    apiToken: "test-token",
    appName: "test-app",
    region: "iad",
  };

  let provisioner: FlyProvisioner;

  beforeEach(() => {
    provisioner = new FlyProvisioner(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createMoltbot", () => {
    it("should create a moltbot with OpenClaw image", async () => {
      const mockMachine: FlyMachine = {
        id: "machine-123",
        name: "test-moltbot",
        state: "created",
        region: "iad",
        instance_id: "instance-456",
        private_ip: "10.0.0.1",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        config: {
          image: "ghcr.io/openclaw/openclaw:latest",
          env: {},
          guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      });

      const moltbot = await provisioner.createMoltbot({
        name: "test-moltbot",
        size: "small",
      });

      expect(moltbot.id).toBe("machine-123");
      expect(moltbot.name).toBe("test-moltbot");
      expect(moltbot.status).toBe("created");
      expect(moltbot.hostname).toBe("test-moltbot.test-app.fly.dev");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.machines.dev/v1/apps/test-app/machines",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should use medium size specs for medium moltbots", async () => {
      const mockMachine: FlyMachine = {
        id: "machine-123",
        name: "medium-moltbot",
        state: "created",
        region: "iad",
        instance_id: "instance-456",
        private_ip: "10.0.0.2",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        config: {
          image: "ghcr.io/openclaw/openclaw:latest",
          env: {},
          guest: { cpu_kind: "shared", cpus: 2, memory_mb: 2048 },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      });

      await provisioner.createMoltbot({
        name: "medium-moltbot",
        size: "medium",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.config.guest.memory_mb).toBe(2048);
    });

    it("should throw an error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      await expect(
        provisioner.createMoltbot({
          name: "failing-moltbot",
          size: "small",
        })
      ).rejects.toThrow("Fly.io API error");
    });
  });

  describe("getMoltbot", () => {
    it("should return moltbot details", async () => {
      const mockMachine: FlyMachine = {
        id: "machine-123",
        name: "test-moltbot",
        state: "started",
        region: "iad",
        instance_id: "instance-456",
        private_ip: "10.0.0.1",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        config: {
          image: "ghcr.io/openclaw/openclaw:latest",
          env: {},
          guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      });

      const moltbot = await provisioner.getMoltbot("machine-123");

      expect(moltbot).not.toBeNull();
      expect(moltbot!.id).toBe("machine-123");
      expect(moltbot!.status).toBe("started");
    });

    it("should return null for non-existent moltbot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Machine not found"),
      });

      const moltbot = await provisioner.getMoltbot("non-existent");
      expect(moltbot).toBeNull();
    });
  });

  describe("listMoltbots", () => {
    it("should return list of moltbots", async () => {
      const mockMachines: FlyMachine[] = [
        {
          id: "machine-1",
          name: "moltbot-1",
          state: "started",
          region: "iad",
          instance_id: "instance-1",
          private_ip: "10.0.0.1",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
          config: {
            image: "ghcr.io/openclaw/openclaw:latest",
            env: {},
            guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
          },
        },
        {
          id: "machine-2",
          name: "moltbot-2",
          state: "stopped",
          region: "iad",
          instance_id: "instance-2",
          private_ip: "10.0.0.2",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
          config: {
            image: "ghcr.io/openclaw/openclaw:latest",
            env: {},
            guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachines),
      });

      const moltbots = await provisioner.listMoltbots();

      expect(moltbots).toHaveLength(2);
      expect(moltbots[0].id).toBe("machine-1");
      expect(moltbots[1].id).toBe("machine-2");
    });
  });

  describe("startMoltbot", () => {
    it("should start a stopped moltbot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "machine-123",
            name: "test-moltbot",
            state: "started",
            region: "iad",
            instance_id: "instance-456",
            private_ip: "10.0.0.1",
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T10:00:00Z",
            config: {
              image: "ghcr.io/openclaw/openclaw:latest",
              env: {},
              guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
            },
          }),
      });

      const moltbot = await provisioner.startMoltbot("machine-123");

      expect(moltbot.status).toBe("started");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.machines.dev/v1/apps/test-app/machines/machine-123/start",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("stopMoltbot", () => {
    it("should stop a running moltbot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "machine-123",
            name: "test-moltbot",
            state: "stopped",
            region: "iad",
            instance_id: "instance-456",
            private_ip: "10.0.0.1",
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T10:00:00Z",
            config: {
              image: "ghcr.io/openclaw/openclaw:latest",
              env: {},
              guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
            },
          }),
      });

      const moltbot = await provisioner.stopMoltbot("machine-123");

      expect(moltbot.status).toBe("stopped");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.machines.dev/v1/apps/test-app/machines/machine-123/stop",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("destroyMoltbot", () => {
    it("should destroy a moltbot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "machine-123",
            name: "test-moltbot",
            state: "stopped",
            region: "iad",
            instance_id: "instance-456",
            private_ip: "10.0.0.1",
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T10:00:00Z",
            config: {
              image: "ghcr.io/openclaw/openclaw:latest",
              env: {},
              guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
            },
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      });

      await provisioner.destroyMoltbot("machine-123");

      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://api.machines.dev/v1/apps/test-app/machines/machine-123?force=true",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getMoltbotUrl", () => {
    it("should return the correct URL", () => {
      const moltbot = {
        id: "machine-123",
        name: "my-assistant",
        status: "started" as const,
        region: "iad",
        createdAt: "2024-01-15T10:00:00Z",
        hostname: "my-assistant.test-app.fly.dev",
        privateIp: "10.0.0.1",
      };

      const url = provisioner.getMoltbotUrl(moltbot);
      expect(url).toBe("https://my-assistant.test-app.fly.dev");
    });
  });
});
