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

/** One tool with what is needed to call it. */
export interface ToolDetail {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}

/** Outcome of running a tool from the management app. */
export interface RunToolResult {
  /** The tool's own response, exactly as the upstream server returned it. */
  raw?: unknown;
  /** What an MCP client would receive after the middleware pipeline. */
  processed?: unknown;
  durationMs: number;
  /** The call itself failed (transport or protocol error), as opposed to a tool-reported `isError`. */
  error?: string;
  /** True when the pipeline changed the response. */
  changed: boolean;
}
