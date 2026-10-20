import type { MarketplaceEntry } from "./registry.js";

/** Snippet to merge into the `mcpServers` object of a better-mcp (or any MCP client) config. */
export function mcpServersSnippet(e: MarketplaceEntry): string {
  return JSON.stringify({ mcpServers: { [e.id]: e.config } }, null, 2);
}

export function cursorDeeplink(e: MarketplaceEntry): string {
  const config = Buffer.from(JSON.stringify(e.config)).toString("base64");
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(e.id)}&config=${encodeURIComponent(config)}`;
}

export function vscodeDeeplink(e: MarketplaceEntry): string {
  const payload = { name: e.id, ...(e.config.url ? { type: "http" } : {}), ...e.config };
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(payload))}`;
}

export function claudeCodeCommand(e: MarketplaceEntry): string {
  const json = JSON.stringify(e.config).replace(/'/g, `'\\''`);
  return `claude mcp add-json ${e.id} '${json}'`;
}

export interface InstallOptions {
  mcpServers: string;
  cursor: string;
  vscode: string;
  claudeCode: string;
}

export function installOptions(e: MarketplaceEntry): InstallOptions {
  return {
    mcpServers: mcpServersSnippet(e),
    cursor: cursorDeeplink(e),
    vscode: vscodeDeeplink(e),
    claudeCode: claudeCodeCommand(e),
  };
}
