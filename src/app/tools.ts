import { describeTool, listToolNames, parseCallArgs, resolveCallTool } from "../lib/call-args.js";
import { runTool } from "../services/run-tool.service.js";
import { createCore } from "./core.js";

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
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const print = (value: unknown) =>
  process.stdout.write(JSON.stringify(value, null, process.stdout.isTTY ? 2 : undefined) + "\n");

/**
 * `better-mcp tools list|describe|call`: connect, act on one tool, print JSON
 * on stdout. Returns the process exit code.
 */
export async function runTools(opts: ToolsOptions): Promise<number> {
  let args: Record<string, unknown> = {};
  if (opts.sub === "call") {
    const stdinWanted = opts.args === "-" || (opts.args === undefined && !process.stdin.isTTY);
    args = parseCallArgs(stdinWanted ? await readStdin() : opts.args);
  }

  const { manager, runtime } = await createCore({ entryDir: opts.entryDir });
  try {
    const connected = manager.upstreams.filter((u) => manager.connectedServer(u.name));
    if (opts.sub === "list") {
      print(listToolNames(connected, runtime.namespace, opts.filters));
      return 0;
    }
    const { server, tool } = resolveCallTool(connected, runtime.namespace, opts.tool!);
    if (opts.sub === "describe") {
      print(describeTool(server.name, server.tools.find((t) => t.name === tool)!, runtime.namespace));
      return 0;
    }
    const res = await runTool({ pipeline: runtime.pipeline, server }, tool, args);
    if (res.error) {
      process.stderr.write(`[better-mcp] ${res.error}\n`);
      return 1;
    }
    const out = opts.raw ? res.raw : res.processed;
    print(out);
    return (out as { isError?: boolean } | undefined)?.isError === true ? 1 : 0;
  } finally {
    await manager.close();
  }
}
