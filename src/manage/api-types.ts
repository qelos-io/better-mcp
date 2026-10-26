/** Shapes exchanged between the management API and its web UI. Type-only; no runtime imports. */
import type { McpServerConfig } from "../types/index.js";

export type ServerStatus =
  | "connecting"
  | "connected"
  | "needs_auth"
  | "authenticating"
  | "error"
  | "disabled";

export interface ServerView {
  name: string;
  status: ServerStatus;
  error?: string;
  /** While `authenticating`: the provider's login page, for when no browser could be opened (Docker). */
  loginUrl?: string;
  /** While `authenticating`: the browser has returned and better-mcp is finishing the login. */
  finishing?: boolean;
  transport: "http" | "stdio";
  target: string;
  /** Tools exposed to clients (enabled ones). */
  tools: number;
  /** Tools the server reports, including disabled ones. */
  toolsTotal: number;
  resources: number;
  prompts: number;
}

export interface ToolView {
  name: string;
  description?: string;
  enabled: boolean;
}

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  homepage: string;
  logo: string | null;
  tags: string[];
  setup: string | null;
  config: McpServerConfig;
}

export interface Catalog {
  entries: CatalogEntry[];
  source: "remote" | "bundled" | "none";
}
