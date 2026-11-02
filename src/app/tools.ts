import { loadConfig } from "../config/index.js";
import { describeTool, listToolNames, parseCallArgs, resolveCallTool } from "../lib/call-args.js";
import { silenceStderr } from "../lib/quiet.js";
import { describeProblems, type ToolsBackend } from "../lib/tools-backend.js";
import { runTool } from "../services/run-tool.service.js";
import { createCore } from "./core.js";
import { connectDaemon } from "./daemon.js";

export interface ToolsOptions {
  entryDir: string;
  sub: "call" | "describe" | "list";
  tool?: string;
  /** list: keep tools whose name or description contains any of these. */
  filters?: string[];
  /** call: JSON object text, or "-" / undefined to read it from stdin when piped. */
  args?: string;
  /** call: print the upstream's own response instead of what better-mcp delivers. */
  raw?: boolean;
  /** Show connection logs on stderr (hidden by default so they never mix into the output). */
  verbose?: boolean;
  /** Use the shared background helper (default). False connects in this process. */
  daemon?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const print = (value: unknown) =>
  process.stdout.write(JSON.stringify(value, null, process.stdout.isTTY ? 2 : undefined) + "\n");

/** Connect in this process, like the proxy does. */
async function localBackend(entryDir: string): Promise<ToolsBackend> {
  const { manager, runtime } = await createCore({ entryDir });
  const connected = () => manager.upstreams.filter((u) => manager.connectedServer(u.name));
  return {
    servers: async () => connected().map((u) => ({ name: u.name, tools: u.tools })),
    namespace: async () => runtime.namespace,
    detail: async (server, tool) => manager.connectedServer(server)!.tools.find((t) => t.name === tool)!,
    call: (server, tool, args) => runTool({ pipeline: runtime.pipeline, server: manager.connectedServer(server)! }, tool, args),
    problems: async () => describeProblems(manager.list()),
    close: () => manager.close(),
  };
}

/** Run one `tools` command against a backend. Returns the exit code. */
export async function executeTools(
  backend: ToolsBackend,
  opts: Pick<ToolsOptions, "sub" | "tool" | "filters" | "raw">,
  args: Record<string, unknown>,
  io: { print: (v: unknown) => void; err: (text: string) => void },
): Promise<number> {
  const [servers, namespace] = await Promise.all([backend.servers(), backend.namespace()]);
  if (opts.sub === "list") {
    io.print(listToolNames(servers, namespace, opts.filters));
    return 0;
  }
  let target;
  try {
    target = resolveCallTool(servers, namespace, opts.tool!);
  } catch (e) {
    const problems = await backend.problems();
    const hint = problems.length ? ` (not connected: ${problems.join("; ")})` : "";
    throw new Error((e instanceof Error ? e.message : String(e)) + hint);
  }
  const { server, tool } = target;
  if (opts.sub === "describe") {
    io.print(describeTool(server.name, await backend.detail(server.name, tool), namespace));
    return 0;
  }
  const res = await backend.call(server.name, tool, args);
  if (res.error) {
    io.err(`[better-mcp] ${res.error}\n`);
    return 1;
  }
  const out = opts.raw ? res.raw : res.processed;
  io.print(out);
  return (out as { isError?: boolean } | undefined)?.isError === true ? 1 : 0;
}

/**
 * `better-mcp tools list|describe|call`: act on one tool through a running better-mcp for this
 * config (started in the background on first use) and print JSON on stdout. Diagnostics are
 * hidden unless `verbose`. Returns the process exit code.
 */
export async function runTools(opts: ToolsOptions): Promise<number> {
  const quiet = opts.verbose ? undefined : silenceStderr();
  const err = (text: string) => (quiet ? quiet.write(text) : void process.stderr.write(text));
  try {
    let args: Record<string, unknown> = {};
    if (opts.sub === "call") {
      const stdinWanted = opts.args === "-" || (opts.args === undefined && !process.stdin.isTTY);
      args = parseCallArgs(stdinWanted ? await readStdin() : opts.args);
    }
    let backend: ToolsBackend | undefined;
    if (opts.daemon !== false) {
      const { configPath } = await loadConfig({ entryDir: opts.entryDir });
      if (configPath) backend = await connectDaemon(configPath);
    }
    backend ??= await localBackend(opts.entryDir);
    try {
      return await executeTools(backend, opts, args, { print, err });
    } finally {
      await backend.close();
    }
  } catch (e) {
    err(`[better-mcp] ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  } finally {
    quiet?.restore();
  }
}
