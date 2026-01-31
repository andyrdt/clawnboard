import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "../app.js";

describe("Health API", () => {
  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await app.request("/health");

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("healthy");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("version");
    });
  });

  describe("GET /health/ready", () => {
    const originalToken = process.env.FLY_API_TOKEN;

    afterEach(() => {
      if (originalToken) {
        process.env.FLY_API_TOKEN = originalToken;
      } else {
        delete process.env.FLY_API_TOKEN;
      }
    });

    it("should return ready when Fly.io is configured", async () => {
      process.env.FLY_API_TOKEN = "test-token";
      const res = await app.request("/health/ready");

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ready).toBe(true);
      expect(body.checks.flyio).toBe(true);
      expect(body).toHaveProperty("timestamp");
    });

    it("should return not ready when Fly.io is not configured", async () => {
      delete process.env.FLY_API_TOKEN;
      const res = await app.request("/health/ready");

      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.ready).toBe(false);
      expect(body.checks.flyio).toBe(false);
    });
  });
});
