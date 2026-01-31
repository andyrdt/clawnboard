/**
 * Moltbot Gateway Server
 *
 * This server runs inside each moltbot VM and provides:
 * 1. WebSocket connection to ClawnBoard for receiving messages
 * 2. HTTP health check endpoint
 * 3. Message forwarding to OpenClaw
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Load configuration
const configPath = join(homedir(), ".config/openclaw/config.json");
let config;

try {
  config = JSON.parse(readFileSync(configPath, "utf-8"));
  console.log("Configuration loaded successfully");
} catch (err) {
  console.error("Failed to load configuration:", err.message);
  process.exit(1);
}

const PORT = config.server?.port || 8080;
const HOST = config.server?.host || "0.0.0.0";

// Create HTTP server for health checks
const httpServer = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        moltbotId: config.moltbotId,
        model: config.model,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  if (req.url === "/config" && req.method === "GET") {
    // Return non-sensitive config info
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        moltbotId: config.moltbotId,
        model: config.model,
        personality: config.personality,
      })
    );
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Track connected clients
const clients = new Set();

wss.on("connection", (ws, req) => {
  console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
  clients.add(ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      moltbotId: config.moltbotId,
      timestamp: Date.now(),
    })
  );

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Received message:", message.type);

      switch (message.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;

        case "chat":
          // Process chat message through OpenClaw
          const response = await processMessage(message.payload);
          ws.send(
            JSON.stringify({
              type: "response",
              messageId: message.messageId,
              payload: response,
              timestamp: Date.now(),
            })
          );
          break;

        case "config_update":
          // Handle configuration updates
          console.log("Configuration update received");
          // TODO: Apply configuration changes
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (err) {
      console.error("Error processing message:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          error: err.message,
          timestamp: Date.now(),
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    clients.delete(ws);
  });
});

/**
 * Process a chat message through the AI model
 */
async function processMessage(payload) {
  const { content, userId, userName, context } = payload;

  // Build the prompt with personality
  const systemPrompt = config.personality || "You are a helpful AI assistant.";

  // Determine which API to use based on model
  const isAnthropic = config.model.startsWith("claude");

  if (isAnthropic && config.apiKeys.anthropic) {
    return await callAnthropicAPI(systemPrompt, content, context);
  } else if (config.apiKeys.openai) {
    return await callOpenAIAPI(systemPrompt, content, context);
  } else {
    throw new Error("No API key available for the configured model");
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropicAPI(systemPrompt, userMessage, context) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKeys.anthropic,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model === "claude-opus" ? "claude-3-opus-20240229" : "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content[0]?.text || "",
    model: data.model,
    usage: data.usage,
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(systemPrompt, userMessage, context) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKeys.openai}`,
    },
    body: JSON.stringify({
      model: config.model === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    model: data.model,
    usage: data.usage,
  };
}

// Start the server
httpServer.listen(PORT, HOST, () => {
  console.log(`Moltbot Gateway Server listening on ${HOST}:${PORT}`);
  console.log(`Moltbot ID: ${config.moltbotId}`);
  console.log(`Model: ${config.model}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");

  // Close all WebSocket connections
  for (const client of clients) {
    client.close(1000, "Server shutting down");
  }

  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
