import { toolsHelpText } from "./tools-docs.js";
import { startupBanner } from "./version.js";

export type CliResult =
  | { action: "run" }
  | { action: "app" }
  | { action: "tools"; sub: "call" | "describe" | "list"; tool?: string; filters?: string[]; args?: string; raw: boolean; verbose: boolean; daemon: boolean }
  | { action: "daemon" }
  | { action: "exit"; code: number; stdout?: string; stderr?: string };

/** Flags that take the next argument as their value, so that value is never read as a command. */
const VALUE_FLAGS = new Set(["--config", "-c", "--listen-host", "--listen-path", "--listen"]);

export function helpText(): string {
  return `${startupBanner()}

Usage
  better-mcp [options]        Start the proxy on stdio (what MCP clients run)
  better-mcp app [-c file]    Open only the management app for a config file (no stdio)
  better-mcp tools ls [filters...]
                              List the tools you can call (public names); filters are
                              case-insensitive substrings of the name or description,
                              a tool is kept when it matches any (alias: list)
  better-mcp tools describe <tool>
                              Print a tool's description and input schema as JSON
  better-mcp tools call <tool> [json]
                              Run one tool and print its result as JSON. Arguments are a
                              JSON object, or piped on stdin (or "-"). <tool> is the public
                              name (server__tool) or a bare name unique to one server.
                              --raw prints the upstream's response, skipping the middleware
                              --verbose shows connection logs on stderr (hidden by default)
                              --no-daemon connects in this process instead of the shared
                              background helper (see "help tools")
  better-mcp version          Print the version and exit
  better-mcp help [tools]     Show this help (or the tools commands in detail) and exit

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
  let raw = false;
  let verbose = false;
  let daemon = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") wantHelp = true;
    else if (a === "--version" || a === "-v" || a === "-V") wantVersion = true;
    else if (a === "--raw") raw = true;
    else if (a === "--verbose") verbose = true;
    else if (a === "--no-daemon") daemon = false;
    else if (VALUE_FLAGS.has(a)) i++;
    else if (a === "-" || !a.startsWith("-")) positional.push(a);
  }
  const command = positional[0]?.toLowerCase();
  const topic = command === "help" ? positional[1]?.toLowerCase() : command;
  if (wantHelp || command === "help") {
    return { action: "exit", code: 0, stdout: topic === "tools" ? toolsHelpText() : helpText() };
  }
  if (wantVersion || command === "version") return { action: "exit", code: 0, stdout: startupBanner() + "\n" };
  if (command === "app") return { action: "app" };
  if (command === "__daemon") return { action: "daemon" };
  if (command === "tools") {
    const sub = positional[1]?.toLowerCase();
    const usage = (msg: string): CliResult => ({ action: "exit", code: 2, stderr: `${msg}\n` });
    if (sub === "list" || sub === "ls") {
      return { action: "tools", sub: "list", filters: positional.slice(2), raw, verbose, daemon };
    }
    if (sub === "describe") {
      return positional.length !== 3
        ? usage("Usage: better-mcp tools describe <tool>")
        : { action: "tools", sub, tool: positional[2], raw, verbose, daemon };
    }
    if (sub === "call") {
      return !positional[2] || positional.length > 4
        ? usage("Usage: better-mcp tools call <tool> [json]")
        : { action: "tools", sub, tool: positional[2], args: positional[3], raw, verbose, daemon };
    }
    return { action: "exit", code: 2, stderr: `Missing or unknown tools command.\n\n${toolsHelpText()}` };
  }
  if (command) {
    return { action: "exit", code: 2, stderr: `Unknown command "${positional[0]}".\n\n${helpText()}` };
  }
  return { action: "run" };
}
