import type { ManageConfig } from "../types/index.js";

export interface ManageListenOptions {
  host: string;
  port?: number;
}

function parsePort(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`BETTER_MCP_MANAGE_PORT must be a port number, got "${raw}"`);
  }
  return n;
}

/** Config wins over env; env (`BETTER_MCP_MANAGE_HOST/PORT`) is how the Docker image binds 0.0.0.0. */
export function resolveManageOptions(
  cfg: ManageConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): ManageListenOptions {
  return {
    host: cfg.host ?? (env.BETTER_MCP_MANAGE_HOST || "127.0.0.1"),
    port: cfg.port ?? parsePort(env.BETTER_MCP_MANAGE_PORT),
  };
}
