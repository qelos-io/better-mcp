import { openBrowser } from "../lib/oauth.js";
import { registerProcess } from "./daemon.js";
import { createCore } from "./core.js";

/**
 * `better-mcp app`: only the management UI for a config file. No stdio server
 * and no HTTP listener, so it can run next to (or without) an agent client.
 * Runs until interrupted.
 */
export async function runApp(opts: { entryDir: string; open?: (url: string) => Promise<boolean> }): Promise<void> {
  const core = await createCore({ ...opts, forceManage: true });
  const { manager, manageServer } = core;
  const server = manageServer!;
  const url = await server.ensureStarted();
  const unregister = await registerProcess(core, url, "app");
  process.stdout.write(`better-mcp app: ${url}\nPress Ctrl+C to stop.\n`);
  if (!(await (opts.open ?? openBrowser)(url))) {
    process.stderr.write("[better-mcp] could not open a browser; open the URL above.\n");
  }

  const shutdown = async () => {
    await unregister();
    await server.close();
    await manager.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
