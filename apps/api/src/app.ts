import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { moltbotsRouter } from "./routes/moltbots.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Error handling
app.onError(errorHandler);

// Routes
app.route("/health", healthRouter);
app.route("/api/moltbots", moltbotsRouter);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    },
    404
  );
});
