import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthChecker } from "./health-checker.js";
import { FlyProvisioner } from "./fly-provisioner.js";
import type { MoltbotInstance } from "./types.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a mock provisioner
function createMockProvisioner(): FlyProvisioner {
  return {
    getMoltbot: vi.fn(),
    restartMoltbot: vi.fn(),
  } as unknown as FlyProvisioner;
}

describe("HealthChecker", () => {
  let provisioner: ReturnType<typeof createMockProvisioner>;
  let healthChecker: HealthChecker;

  beforeEach(() => {
    vi.useFakeTimers();
    provisioner = createMockProvisioner();
    healthChecker = new HealthChecker(provisioner, {
      intervalMs: 1000,
      timeoutMs: 500,
      failureThreshold: 2,
      autoRestart: true,
      maxRestartAttempts: 3,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    healthChecker.stopMonitoring();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("checkHealth", () => {
    it("should return unhealthy when VM not found", async () => {
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(null);

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(false);
      expect(result.machineState).toBe("not_found");
      expect(result.error).toBe("VM not found");
    });

    it("should return unhealthy when VM is stopped", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "stopped",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(false);
      expect(result.machineState).toBe("stopped");
    });

    it("should return unhealthy when gateway is unreachable", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(false);
      expect(result.machineState).toBe("started");
      expect(result.gatewayReachable).toBe(false);
    });

    it("should return healthy when VM and gateway are up", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(true);
      expect(result.machineState).toBe("started");
      expect(result.gatewayReachable).toBe(true);
      expect(result.gatewayResponse).toEqual({ status: "healthy" });
    });

    it("should return unhealthy when gateway returns non-200", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("503");
    });

    it("should return unhealthy when no private IP assigned", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: null,
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);

      const result = await healthChecker.checkHealth("vm-123");

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("No private IP assigned");
    });
  });

  describe("monitoring", () => {
    it("should track consecutive failures", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await healthChecker.monitorVM("vm-123");

      const status = healthChecker.getStatus("vm-123");
      expect(status?.consecutiveFailures).toBe(1);

      // Advance timer to trigger another check
      await vi.advanceTimersByTimeAsync(1000);

      const status2 = healthChecker.getStatus("vm-123");
      expect(status2?.consecutiveFailures).toBe(2);
    });

    it("should call unhealthy callback when threshold reached", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const unhealthyCallback = vi.fn();
      healthChecker.onUnhealthy(unhealthyCallback);

      await healthChecker.monitorVM("vm-123");

      // First failure
      expect(unhealthyCallback).not.toHaveBeenCalled();

      // Advance to second failure (threshold is 2)
      await vi.advanceTimersByTimeAsync(1000);

      expect(unhealthyCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          vmId: "vm-123",
          healthy: false,
        })
      );
    });

    it("should attempt restart when unhealthy and autoRestart is true", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      vi.mocked(provisioner.restartMoltbot).mockResolvedValue(vm);
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await healthChecker.monitorVM("vm-123");

      // Advance past threshold
      await vi.advanceTimersByTimeAsync(1000);

      expect(provisioner.restartMoltbot).toHaveBeenCalledWith("vm-123");
    });

    it("should call healthy callback when VM recovers", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);

      // Start unhealthy
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const healthyCallback = vi.fn();
      healthChecker.onHealthy(healthyCallback);

      await healthChecker.monitorVM("vm-123");

      // Mark as unhealthy (2 failures)
      await vi.advanceTimersByTimeAsync(1000);

      // Now recover
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await vi.advanceTimersByTimeAsync(1000);

      expect(healthyCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          vmId: "vm-123",
          healthy: true,
        })
      );
    });

    it("should reset failures when VM becomes healthy", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);

      // Start unhealthy
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await healthChecker.monitorVM("vm-123");

      expect(healthChecker.getStatus("vm-123")?.consecutiveFailures).toBe(1);

      // Recover
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await vi.advanceTimersByTimeAsync(1000);

      expect(healthChecker.getStatus("vm-123")?.consecutiveFailures).toBe(0);
    });

    it("should stop after max restart attempts", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      vi.mocked(provisioner.restartMoltbot).mockResolvedValue(vm);
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await healthChecker.monitorVM("vm-123");

      // Trigger multiple restart attempts
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      // Should have stopped at 3 attempts
      expect(provisioner.restartMoltbot).toHaveBeenCalledTimes(3);
    });
  });

  describe("getAllStatuses", () => {
    it("should return all monitored VM statuses", async () => {
      const vm1: MoltbotInstance = {
        id: "vm-1",
        name: "vm-one",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "vm-one.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      const vm2: MoltbotInstance = {
        id: "vm-2",
        name: "vm-two",
        status: "started",
        privateIp: "10.0.0.2",
        hostname: "vm-two.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };

      vi.mocked(provisioner.getMoltbot)
        .mockResolvedValueOnce(vm1)
        .mockResolvedValueOnce(vm2);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await healthChecker.startMonitoring(["vm-1", "vm-2"]);

      const statuses = healthChecker.getAllStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.map((s) => s.vmId)).toContain("vm-1");
      expect(statuses.map((s) => s.vmId)).toContain("vm-2");
    });
  });

  describe("stopMonitoring", () => {
    it("should stop all monitoring", async () => {
      const vm: MoltbotInstance = {
        id: "vm-123",
        name: "test-vm",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "test-vm.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      vi.mocked(provisioner.getMoltbot).mockResolvedValue(vm);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await healthChecker.monitorVM("vm-123");

      healthChecker.stopMonitoring();

      expect(healthChecker.getAllStatuses()).toHaveLength(0);
    });

    it("should stop monitoring specific VM", async () => {
      const vm1: MoltbotInstance = {
        id: "vm-1",
        name: "vm-one",
        status: "started",
        privateIp: "10.0.0.1",
        hostname: "vm-one.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };
      const vm2: MoltbotInstance = {
        id: "vm-2",
        name: "vm-two",
        status: "started",
        privateIp: "10.0.0.2",
        hostname: "vm-two.my-app.fly.dev",
        region: "iad",
        createdAt: new Date().toISOString(),
      };

      vi.mocked(provisioner.getMoltbot)
        .mockResolvedValueOnce(vm1)
        .mockResolvedValueOnce(vm2);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await healthChecker.startMonitoring(["vm-1", "vm-2"]);

      healthChecker.stopMonitoringVM("vm-1");

      const statuses = healthChecker.getAllStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].vmId).toBe("vm-2");
    });
  });
});
