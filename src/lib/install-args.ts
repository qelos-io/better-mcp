import { resolve } from "node:path";

const CONFIG_FLAGS = new Set(["--config", "-c"]);

/**
 * The args an MCP client should launch better-mcp with, derived from how this process was started:
 * the `app` command is dropped (clients need the stdio proxy), and the config is always an absolute
 * `--config <path>` so it works from any working directory.
 */
export function buildInstallArgs(argv: string[], configPath: string | undefined, cwd = process.cwd()): string[] {
  const out: string[] = [];
  let hasConfig = false;
  let sawCommand = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (CONFIG_FLAGS.has(a)) {
      const value = argv[++i];
      if (value === undefined) continue;
      out.push("--config", resolve(cwd, value));
      hasConfig = true;
    } else if (a.startsWith("--config=") || a.startsWith("-c=")) {
      out.push("--config", resolve(cwd, a.slice(a.indexOf("=") + 1)));
      hasConfig = true;
    } else if (a === "--listen-host" || a === "--listen-path") {
      out.push(a, argv[++i] ?? "");
    } else if (!a.startsWith("-") && !sawCommand && a.toLowerCase() === "app") {
      sawCommand = true;
    } else {
      out.push(a);
    }
  }
  if (!hasConfig && configPath) out.push("--config", configPath);
  return out;
}
