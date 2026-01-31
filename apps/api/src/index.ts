import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`Starting ClawnBoard API server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`ClawnBoard API server running at http://localhost:${port}`);
