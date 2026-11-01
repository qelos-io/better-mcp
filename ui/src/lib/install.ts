export const SERVER_NAME = "better-mcp";

export interface Launch {
  command: string;
  args: string[];
}

export interface ClientGuide {
  id: string;
  label: string;
  /** What to do with the snippet. */
  steps: string;
  /** Snippet shown to copy. */
  snippet: string;
  language: "json" | "toml" | "shell";
  /** One-click link that opens the client and adds the server. */
  link?: string;
}

export function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

export const shellLine = (l: Launch): string => [l.command, ...l.args].map(shellQuote).join(" ");

export const mcpServersJson = (l: Launch, key = "mcpServers"): string =>
  JSON.stringify({ [key]: { [SERVER_NAME]: { command: l.command, args: l.args } } }, null, 2);

const tomlStr = (s: string): string => JSON.stringify(s);

export function codexToml(l: Launch): string {
  return `[mcp_servers.${SERVER_NAME}]\ncommand = ${tomlStr(l.command)}\nargs = [${l.args.map(tomlStr).join(", ")}]\n`;
}

export function opencodeJson(l: Launch): string {
  return JSON.stringify(
    { $schema: "https://opencode.ai/config.json", mcp: { [SERVER_NAME]: { type: "local", command: [l.command, ...l.args], enabled: true } } },
    null,
    2,
  );
}

const b64 = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

export function cursorLink(l: Launch): string {
  const config = b64(JSON.stringify({ command: l.command, args: l.args }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(SERVER_NAME)}&config=${encodeURIComponent(config)}`;
}

export function vscodeLink(l: Launch): string {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: SERVER_NAME, command: l.command, args: l.args }))}`;
}

export function clientGuides(l: Launch): ClientGuide[] {
  const json = mcpServersJson(l);
  return [
    { id: "claude-code", label: "Claude Code", language: "shell", steps: "Run in your terminal:", snippet: `claude mcp add ${SERVER_NAME} -- ${shellLine(l)}` },
    { id: "claude-desktop", label: "Claude Desktop", language: "json", steps: "Add to claude_desktop_config.json (Settings → Developer → Edit Config), then restart:", snippet: json },
    { id: "cursor", label: "Cursor", language: "json", steps: "Click install, or add to ~/.cursor/mcp.json:", snippet: json, link: cursorLink(l) },
    { id: "vscode", label: "VS Code", language: "json", steps: "Click install, or add to .vscode/mcp.json (uses \"servers\"):", snippet: mcpServersJson(l, "servers"), link: vscodeLink(l) },
    { id: "codex", label: "Codex", language: "toml", steps: "Add to ~/.codex/config.toml, or run `codex mcp add`:", snippet: codexToml(l) },
    { id: "opencode", label: "OpenCode", language: "json", steps: "Add to opencode.json (project) or ~/.config/opencode/opencode.json:", snippet: opencodeJson(l) },
    { id: "windsurf", label: "Windsurf", language: "json", steps: "Add to ~/.codeium/windsurf/mcp_config.json:", snippet: json },
    { id: "antigravity", label: "Antigravity", language: "json", steps: "Open the agent's MCP servers menu → Manage → View raw config, and add:", snippet: json },
    { id: "devin", label: "Devin", language: "json", steps: "In Devin's MCP settings choose a custom server and use this config:", snippet: json },
    { id: "gemini", label: "Gemini CLI", language: "json", steps: "Add to ~/.gemini/settings.json:", snippet: json },
    { id: "other", label: "Other", language: "json", steps: "Any client that reads an mcpServers config:", snippet: json },
  ];
}
