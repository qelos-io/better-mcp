import { startupBanner } from "./version.js";

export type CliResult =
  | { action: "run" }
  | { action: "app" }
  | { action: "exit"; code: number; stdout?: string; stderr?: string };

/** Flags that take the next argument as their value, so that value is never read as a command. */
const VALUE_FLAGS = new Set(["--config", "-c", "--listen-host", "--listen-path", "--listen"]);

export function helpText(): string {
  return `${startupBanner()}

Usage
  better-mcp [options]        Start the proxy on stdio (what MCP clients run)
  better-mcp app [-c file]    Open only the management app for a config file (no stdio)
  better-mcp version          Print the version and exit
  better-mcp help             Show this help and exit

Options
  -c, --config <path>         Config file (default: ./mcp.json, then next to the package)
      --no-namespace          Don't prefix tool names with "<server>__"
      --offload-resources     Also offload large resource reads to disk
      --listen [port]         Also serve over HTTP (default port 3100)
      --listen-host <host>    Bind address for --listen (default 127.0.0.1)
      --listen-path <path>    URL path for --listen (default /mcp)
  -v, --version               Print the version and exit
  -h, --help                  Show this help and exit

Environment
  MCP_PROXY_CONFIG            Config file path, or the JSON itself
  BETTER_MCP_HOME             Where logins are stored when authStorage is "home"
  BETTER_MCP_MANAGE_PORT      Port of the management app
  BETTER_MCP_LISTEN_BEARER    Bearer token required by --listen on non-loopback hosts

Docs: https://github.com/qelos-io/better-mcp#readme
`;
}

/** Decide what the process should do for these args: print and exit, or start the proxy. */
export function resolveCli(argv: string[]): CliResult {
  const positional: string[] = [];
  let wantHelp = false;
  let wantVersion = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") wantHelp = true;
    else if (a === "--version" || a === "-v" || a === "-V") wantVersion = true;
    else if (VALUE_FLAGS.has(a)) i++;
    else if (!a.startsWith("-")) positional.push(a);
  }
  const command = positional[0]?.toLowerCase();
  if (wantHelp || command === "help") return { action: "exit", code: 0, stdout: helpText() };
  if (wantVersion || command === "version") return { action: "exit", code: 0, stdout: startupBanner() + "\n" };
  if (command === "app") return { action: "app" };
  if (command) {
    return { action: "exit", code: 2, stderr: `Unknown command "${positional[0]}".\n\n${helpText()}` };
  }
  return { action: "run" };
}
