/**
 * Health checking and auto-restart functionality for moltbot VMs.
 *
 * Monitors VM health by checking both the Fly.io machine state and
 * the OpenClaw gateway health endpoint. Automatically restarts
 * unhealthy VMs when configured.
 */

import type { Logger } from "./logger.js";
import { createLogger } from "./logger.js";
import type { FlyProvisioner } from "./fly-provisioner.js";
import type { MoltbotInstance } from "./types.js";

export interface HealthCheckConfig {
  /** Interval between health checks in milliseconds (default: 30000) */
  intervalMs?: number;
  /** Timeout for health check requests in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Number of consecutive failures before marking unhealthy (default: 3) */
  failureThreshold?: number;
  /** Automatically restart unhealthy VMs (default: true) */
  autoRestart?: boolean;
  /** Maximum restart attempts before giving up (default: 3) */
  maxRestartAttempts?: number;
  /** Custom logger instance */
  logger?: Logger;
}

export interface HealthStatus {
  vmId: string;
  vmName: string;
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  restartAttempts: number;
  details: {
    machineState: string;
    gatewayReachable: boolean;
    gatewayResponse?: unknown;
    error?: string;
  };
}

export interface HealthCheckResult {
  healthy: boolean;
  machineState: string;
  gatewayReachable: boolean;
  gatewayResponse?: unknown;
  error?: string;
}

type HealthCallback = (status: HealthStatus) => void | Promise<void>;

/**
 * Health checker for moltbot VMs.
 *
 * Monitors VMs and optionally auto-restarts them when unhealthy.
 *
 * @example
 * ```typescript
 * const healthChecker = new HealthChecker(provisioner, {
 *   intervalMs: 30000,
 *   autoRestart: true,
 * });
 *
 * healthChecker.onUnhealthy((status) => {
 *   console.log(`VM ${status.vmName} is unhealthy!`);
 * });
 *
 * await healthChecker.startMonitoring(["vm-id-1", "vm-id-2"]);
 * ```
 */
export class HealthChecker {
  private provisioner: FlyProvisioner;
  private config: Required<HealthCheckConfig>;
  private logger: Logger;
  private statuses: Map<string, HealthStatus> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private unhealthyCallbacks: HealthCallback[] = [];
  private healthyCallbacks: HealthCallback[] = [];

  constructor(provisioner: FlyProvisioner, config?: HealthCheckConfig) {
    this.provisioner = provisioner;
    this.config = {
      intervalMs: config?.intervalMs ?? 30000,
      timeoutMs: config?.timeoutMs ?? 5000,
      failureThreshold: config?.failureThreshold ?? 3,
      autoRestart: config?.autoRestart ?? true,
      maxRestartAttempts: config?.maxRestartAttempts ?? 3,
      logger: config?.logger ?? createLogger({ prefix: "health-checker" }),
    };
    this.logger = this.config.logger;
  }

  /**
   * Performs a single health check on a VM.
   */
  async checkHealth(vmId: string): Promise<HealthCheckResult> {
    const context = { vmId, operation: "health-check" };

    try {
      // Check Fly.io machine state
      const vm = await this.provisioner.getMoltbot(vmId);

      if (!vm) {
        return {
          healthy: false,
          machineState: "not_found",
          gatewayReachable: false,
          error: "VM not found",
        };
      }

      if (vm.status !== "started") {
        return {
          healthy: false,
          machineState: vm.status,
          gatewayReachable: false,
          error: `VM is in state: ${vm.status}`,
        };
      }

      // Check OpenClaw gateway health
      const gatewayResult = await this.checkGateway(vm);

      return {
        healthy: gatewayResult.reachable,
        machineState: vm.status,
        gatewayReachable: gatewayResult.reachable,
        gatewayResponse: gatewayResult.response,
        error: gatewayResult.error,
      };
    } catch (error) {
      this.logger.error(
        "Health check failed",
        error instanceof Error ? error : new Error(String(error)),
        context
      );

      return {
        healthy: false,
        machineState: "unknown",
        gatewayReachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Checks if the OpenClaw gateway is responding on a VM.
   */
  private async checkGateway(
    vm: MoltbotInstance
  ): Promise<{ reachable: boolean; response?: unknown; error?: string }> {
    if (!vm.privateIp) {
      return { reachable: false, error: "No private IP assigned" };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs
      );

      const response = await fetch(`http://${vm.privateIp}:8080/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return { reachable: true, response: data };
      }

      return {
        reachable: false,
        error: `Gateway returned ${response.status}`,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { reachable: false, error: "Gateway health check timed out" };
      }
      return {
        reachable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Starts continuous health monitoring for the specified VMs.
   */
  async startMonitoring(vmIds: string[]): Promise<void> {
    this.logger.info(`Starting health monitoring for ${vmIds.length} VMs`, {
      operation: "start-monitoring",
    });

    for (const vmId of vmIds) {
      await this.monitorVM(vmId);
    }
  }

  /**
   * Adds a VM to the monitoring list.
   */
  async monitorVM(vmId: string): Promise<void> {
    if (this.intervals.has(vmId)) {
      this.logger.warn(`VM ${vmId} is already being monitored`, { vmId });
      return;
    }

    // Get initial VM info
    const vm = await this.provisioner.getMoltbot(vmId);
    const vmName = vm?.name || vmId;

    // Initialize status
    this.statuses.set(vmId, {
      vmId,
      vmName,
      healthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      restartAttempts: 0,
      details: {
        machineState: vm?.status || "unknown",
        gatewayReachable: false,
      },
    });

    // Do initial check
    await this.performHealthCheck(vmId);

    // Start interval
    const interval = setInterval(async () => {
      await this.performHealthCheck(vmId);
    }, this.config.intervalMs);

    this.intervals.set(vmId, interval);
    this.logger.info(`Now monitoring VM: ${vmName}`, { vmId, vmName });
  }

  /**
   * Stops monitoring a specific VM.
   */
  stopMonitoringVM(vmId: string): void {
    const interval = this.intervals.get(vmId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(vmId);
      this.statuses.delete(vmId);
      this.logger.info(`Stopped monitoring VM`, { vmId });
    }
  }

  /**
   * Stops all health monitoring.
   */
  stopMonitoring(): void {
    for (const [vmId, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug(`Stopped monitoring VM`, { vmId });
    }
    this.intervals.clear();
    this.statuses.clear();
    this.logger.info("Stopped all health monitoring");
  }

  /**
   * Performs a health check and handles the result.
   */
  private async performHealthCheck(vmId: string): Promise<void> {
    const result = await this.checkHealth(vmId);
    const status = this.statuses.get(vmId);

    if (!status) return;

    const wasHealthy = status.healthy;

    status.lastCheck = new Date();
    status.details = {
      machineState: result.machineState,
      gatewayReachable: result.gatewayReachable,
      gatewayResponse: result.gatewayResponse,
      error: result.error,
    };

    if (result.healthy) {
      status.healthy = true;
      status.consecutiveFailures = 0;
      status.restartAttempts = 0;

      if (!wasHealthy) {
        this.logger.info(`VM recovered and is now healthy`, {
          vmId,
          vmName: status.vmName,
        });
        await this.notifyHealthy(status);
      }
    } else {
      status.consecutiveFailures++;

      this.logger.warn(
        `Health check failed (${status.consecutiveFailures}/${this.config.failureThreshold})`,
        {
          vmId,
          vmName: status.vmName,
          error: result.error,
        }
      );

      if (status.consecutiveFailures >= this.config.failureThreshold) {
        status.healthy = false;
        await this.notifyUnhealthy(status);

        if (this.config.autoRestart) {
          await this.attemptRestart(vmId, status);
        }
      }
    }
  }

  /**
   * Attempts to restart an unhealthy VM.
   */
  private async attemptRestart(
    vmId: string,
    status: HealthStatus
  ): Promise<void> {
    if (status.restartAttempts >= this.config.maxRestartAttempts) {
      this.logger.error(
        `Max restart attempts reached for VM`,
        new Error("Max restart attempts exceeded"),
        { vmId, vmName: status.vmName, attempts: status.restartAttempts }
      );
      return;
    }

    status.restartAttempts++;
    this.logger.info(
      `Attempting restart (${status.restartAttempts}/${this.config.maxRestartAttempts})`,
      { vmId, vmName: status.vmName }
    );

    try {
      await this.provisioner.restartMoltbot(vmId);
      this.logger.info(`Restart initiated successfully`, {
        vmId,
        vmName: status.vmName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to restart VM`,
        error instanceof Error ? error : new Error(String(error)),
        { vmId, vmName: status.vmName }
      );
    }
  }

  /**
   * Registers a callback for when a VM becomes unhealthy.
   */
  onUnhealthy(callback: HealthCallback): void {
    this.unhealthyCallbacks.push(callback);
  }

  /**
   * Registers a callback for when a VM recovers.
   */
  onHealthy(callback: HealthCallback): void {
    this.healthyCallbacks.push(callback);
  }

  private async notifyUnhealthy(status: HealthStatus): Promise<void> {
    for (const callback of this.unhealthyCallbacks) {
      try {
        await callback(status);
      } catch (error) {
        this.logger.error(
          "Unhealthy callback error",
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  private async notifyHealthy(status: HealthStatus): Promise<void> {
    for (const callback of this.healthyCallbacks) {
      try {
        await callback(status);
      } catch (error) {
        this.logger.error(
          "Healthy callback error",
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  /**
   * Gets the current health status of all monitored VMs.
   */
  getAllStatuses(): HealthStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Gets the health status of a specific VM.
   */
  getStatus(vmId: string): HealthStatus | undefined {
    return this.statuses.get(vmId);
  }
}
