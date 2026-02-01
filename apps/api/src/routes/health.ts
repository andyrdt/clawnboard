import { Hono } from "hono";

export const healthRouter = new Hono();

/**
 * Health check endpoint
 * GET /health
 */
healthRouter.get("/", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  });
});

/**
 * Readiness check endpoint
 * GET /health/ready
 */
healthRouter.get("/ready", async (c) => {
  const checks = {
    flyio: !!process.env.FLY_API_TOKEN, // FLY_APP_NAME no longer required
  };

  const isReady = Object.values(checks).every(Boolean);

  return c.json(
    {
      ready: isReady,
      checks,
      timestamp: new Date().toISOString(),
    },
    isReady ? 200 : 503
  );
});

/**
 * Available AI providers endpoint
 * GET /health/providers
 * Returns which AI provider API keys are configured
 */
healthRouter.get("/providers", (c) => {
  // Check if keys are set and look real (not placeholder values)
  const isRealKey = (key: string | undefined) => {
    if (!key) return false;
    // Filter out common placeholder patterns
    if (key.includes("your-") || key.includes("xxx") || key.includes("paste")) return false;
    if (key.length < 20) return false;
    return true;
  };

  return c.json({
    providers: {
      anthropic: isRealKey(process.env.ANTHROPIC_API_KEY),
      openai: isRealKey(process.env.OPENAI_API_KEY),
      openrouter: isRealKey(process.env.OPENROUTER_API_KEY),
    },
  });
});
