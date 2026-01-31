// Moltbot status matches Fly.io machine states
export type MoltbotStatus =
  | "created"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "destroying"
  | "destroyed"
  | "error";

export type MoltbotSize = "1gb" | "2gb" | "4gb";

export interface Moltbot {
  id: string;
  name: string;
  status: MoltbotStatus;
  hostname: string;
  region: string;
  size: MoltbotSize;
  createdAt: string;
  /** Gateway token for accessing OpenClaw dashboard (only returned on creation) */
  gatewayToken?: string;
}

export interface CreateMoltbotInput {
  name: string;
  size?: MoltbotSize;
}
