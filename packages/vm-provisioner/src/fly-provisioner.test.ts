import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlyProvisioner } from "./fly-provisioner.js";
import type { ProvisionerConfig, FlyMachine } from "./types.js";

// Mock crypto.randomUUID
vi.mock("node:crypto", () => ({
  default: {
    randomUUID: () => "test-uuid-token-12345",
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("FlyProvisioner", () => {
  const config: ProvisionerConfig = {
    apiToken: "test-token",
    region: "iad",
  };

  let provisioner: FlyProvisioner;

  // Helper to create a mock machine response
  const createMockMachine = (overrides: Partial<FlyMachine> = {}): FlyMachine => ({
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
      guest: { cpu_kind: "shared", cpus: 2, memory_mb: 2048 },
    },
    ...overrides,
  });

  // Helper to mock a GraphQL response
  const mockGraphQLResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  });

  // Helper to mock a REST response
  const mockRestResponse = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 204 ? "No Content" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });

  beforeEach(() => {
    provisioner = new FlyProvisioner(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createMoltbot", () => {
    it("should create a moltbot with unique gateway token", async () => {
      const mockMachine = createMockMachine({ state: "created" });

      // Mock org query
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({
          viewer: { organizations: { nodes: [{ id: "org-123", slug: "personal" }] } },
        })
      );
      // Mock create app
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({ createApp: { app: { id: "app-123", name: "moltbot-test-moltbot" } } })
      );
      // Mock allocate IP
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({ allocateIpAddress: { ipAddress: { id: "ip-123" } } })
      );
      // Mock create volume
      mockFetch.mockResolvedValueOnce(mockRestResponse({ id: "vol-123", name: "openclaw_data" }));
      // Mock create machine
      mockFetch.mockResolvedValueOnce(mockRestResponse(mockMachine));
      // Mock set metadata
      mockFetch.mockResolvedValueOnce(mockRestResponse({}, 204));

      const moltbot = await provisioner.createMoltbot({
        name: "test-moltbot",
        size: "2gb",
      });

      expect(moltbot.id).toBe("machine-123");
      expect(moltbot.name).toBe("test-moltbot");
      expect(moltbot.status).toBe("created");
      expect(moltbot.hostname).toBe("moltbot-test-moltbot.fly.dev");
      expect(moltbot.gatewayToken).toBe("test-uuid-token-12345");

      // Verify metadata was set
      const metadataCall = mockFetch.mock.calls.find((call) =>
        call[0].includes("/metadata/gateway_token")
      );
      expect(metadataCall).toBeDefined();
      expect(metadataCall[1].method).toBe("POST");
    });

    it("should pass environment variables to the machine", async () => {
      const mockMachine = createMockMachine({ state: "created" });

      // Mock all required API calls
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({
          viewer: { organizations: { nodes: [{ id: "org-123", slug: "personal" }] } },
        })
      );
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({ createApp: { app: { id: "app-123" } } })
      );
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({ allocateIpAddress: { ipAddress: { id: "ip-123" } } })
      );
      mockFetch.mockResolvedValueOnce(mockRestResponse({ id: "vol-123" }));
      mockFetch.mockResolvedValueOnce(mockRestResponse(mockMachine));
      mockFetch.mockResolvedValueOnce(mockRestResponse({}, 204));

      await provisioner.createMoltbot({
        name: "test-moltbot",
        env: { ANTHROPIC_API_KEY: "sk-ant-test" },
      });

      // Find the machine creation call
      const machineCall = mockFetch.mock.calls.find(
        (call) => call[0].includes("/machines") && call[1].method === "POST" && !call[0].includes("/metadata")
      );
      expect(machineCall).toBeDefined();
      const body = JSON.parse(machineCall[1].body);
      expect(body.config.env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
      expect(body.config.env.OPENCLAW_GATEWAY_TOKEN).toBe("test-uuid-token-12345");
    });
  });

  describe("getMoltbot", () => {
    it("should return moltbot details with gateway token", async () => {
      const mockMachine = createMockMachine();

      // Mock get machines
      mockFetch.mockResolvedValueOnce(mockRestResponse([mockMachine]));
      // Mock get metadata
      mockFetch.mockResolvedValueOnce(
        mockRestResponse({ gateway_token: "stored-token-xyz" })
      );

      const moltbot = await provisioner.getMoltbot("test-moltbot");

      expect(moltbot).not.toBeNull();
      expect(moltbot!.id).toBe("machine-123");
      expect(moltbot!.status).toBe("started");
      expect(moltbot!.gatewayToken).toBe("stored-token-xyz");
    });

    it("should return null for non-existent moltbot", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("not found"),
      });

      const moltbot = await provisioner.getMoltbot("non-existent");
      expect(moltbot).toBeNull();
    });
  });

  describe("listMoltbots", () => {
    it("should return list of moltbots with gateway tokens", async () => {
      // Mock list apps query
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({
          apps: {
            nodes: [
              { name: "moltbot-bot1", status: "running" },
              { name: "moltbot-bot2", status: "running" },
              { name: "other-app", status: "running" }, // Should be filtered out
            ],
          },
        })
      );

      // Mock get machines for bot1
      mockFetch.mockResolvedValueOnce(
        mockRestResponse([createMockMachine({ id: "machine-1", name: "bot1" })])
      );
      // Mock get metadata for bot1
      mockFetch.mockResolvedValueOnce(mockRestResponse({ gateway_token: "token-1" }));

      // Mock get machines for bot2
      mockFetch.mockResolvedValueOnce(
        mockRestResponse([createMockMachine({ id: "machine-2", name: "bot2" })])
      );
      // Mock get metadata for bot2
      mockFetch.mockResolvedValueOnce(mockRestResponse({ gateway_token: "token-2" }));

      const moltbots = await provisioner.listMoltbots();

      expect(moltbots).toHaveLength(2);
      expect(moltbots[0].name).toBe("bot1");
      expect(moltbots[0].gatewayToken).toBe("token-1");
      expect(moltbots[1].name).toBe("bot2");
      expect(moltbots[1].gatewayToken).toBe("token-2");
    });
  });

  describe("startMoltbot", () => {
    it("should start a stopped moltbot", async () => {
      const stoppedMachine = createMockMachine({ state: "stopped" });
      const startedMachine = createMockMachine({ state: "started" });

      // Mock get machines (to find machine ID)
      mockFetch.mockResolvedValueOnce(mockRestResponse([stoppedMachine]));
      // Mock start machine
      mockFetch.mockResolvedValueOnce(mockRestResponse({}, 204));
      // Mock get machines (for waitForState)
      mockFetch.mockResolvedValueOnce(mockRestResponse([startedMachine]));

      const moltbot = await provisioner.startMoltbot("test-moltbot");

      expect(moltbot.status).toBe("started");

      // Verify start was called
      const startCall = mockFetch.mock.calls.find((call) => call[0].includes("/start"));
      expect(startCall).toBeDefined();
      expect(startCall[1].method).toBe("POST");
    });
  });

  describe("stopMoltbot", () => {
    it("should stop a running moltbot", async () => {
      const runningMachine = createMockMachine({ state: "started" });
      const stoppedMachine = createMockMachine({ state: "stopped" });

      // Mock get machines (to find machine ID)
      mockFetch.mockResolvedValueOnce(mockRestResponse([runningMachine]));
      // Mock stop machine
      mockFetch.mockResolvedValueOnce(mockRestResponse({}, 204));
      // Mock get machines (for waitForState)
      mockFetch.mockResolvedValueOnce(mockRestResponse([stoppedMachine]));

      const moltbot = await provisioner.stopMoltbot("test-moltbot");

      expect(moltbot.status).toBe("stopped");

      // Verify stop was called
      const stopCall = mockFetch.mock.calls.find((call) => call[0].includes("/stop"));
      expect(stopCall).toBeDefined();
      expect(stopCall[1].method).toBe("POST");
    });
  });

  describe("destroyMoltbot", () => {
    it("should destroy a moltbot via app deletion", async () => {
      // Mock delete app GraphQL mutation
      mockFetch.mockResolvedValueOnce(
        mockGraphQLResponse({ deleteApp: { organization: { id: "org-123" } } })
      );

      await provisioner.destroyMoltbot("test-moltbot");

      // Verify GraphQL delete was called
      const deleteCall = mockFetch.mock.calls.find(
        (call) => call[0].includes("graphql") && call[1].body.includes("deleteApp")
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall[1].body).toContain("moltbot-test-moltbot");
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
        hostname: "moltbot-my-assistant.fly.dev",
        privateIp: "10.0.0.1",
      };

      const url = provisioner.getMoltbotUrl(moltbot);
      expect(url).toBe("https://moltbot-my-assistant.fly.dev");
    });
  });
});
