// Fixed gateway token for all moltbots
// This is intentionally simple - users don't need to manage tokens
export const GATEWAY_TOKEN = "clawnboard";

// VM size specs for Fly.io machines (shared-cpu-2x)
// All use shared 2 CPUs since LLM computation happens externally (Anthropic/OpenAI APIs)
// OpenClaw recommends 2GB RAM minimum
// See: https://docs.openclaw.ai/platforms/fly
// Pricing based on: https://fly.io/docs/about/pricing/ (iad region)
export const VM_SPECS = {
  "1gb": {
    cpus: 2,
    memoryMb: 1024,
    label: "1GB RAM",
    description: "2 CPU, 1GB RAM",
    pricePerMonth: "~$6/mo",
  },
  "2gb": {
    cpus: 2,
    memoryMb: 2048,
    label: "2GB RAM (Recommended)",
    description: "2 CPU, 2GB RAM",
    pricePerMonth: "~$11/mo",
  },
  "4gb": {
    cpus: 2,
    memoryMb: 4096,
    label: "4GB RAM",
    description: "2 CPU, 4GB RAM",
    pricePerMonth: "~$21/mo",
  },
} as const;

// Available AI models for moltbots
// Model IDs follow OpenClaw's provider/model format
export const AI_MODELS = {
  // Anthropic Claude 4.5 models
  "anthropic/claude-haiku-4-5": {
    provider: "anthropic",
    label: "Claude 4.5 Haiku",
  },
  "anthropic/claude-sonnet-4-5": {
    provider: "anthropic",
    label: "Claude 4.5 Sonnet (Recommended)",
  },
  "anthropic/claude-opus-4-5": {
    provider: "anthropic",
    label: "Claude 4.5 Opus",
  },
  // OpenAI GPT models
  "openai/gpt-4o-mini": {
    provider: "openai",
    label: "GPT-4o mini",
  },
  "openai/gpt-4o": {
    provider: "openai",
    label: "GPT-4o",
  },
} as const;

export type AIModelId = keyof typeof AI_MODELS;
export const DEFAULT_MODEL: AIModelId = "anthropic/claude-sonnet-4-5";
