import { startListenServer } from "../controllers/listen.controller.js";
import { createBuiltinTools } from "../services/builtin.service.js";
import { buildProxyServer, startProxy } from "../services/proxy.service.js";
import { createCore } from "./core.js";

/** The default mode: serve the merged servers to an MCP client over stdio (and optionally HTTP). */
export async function bootstrap(opts: { entryDir: string }): Promise<void> {
  const { config, manager, runtime, manageServer } = await createCore(opts);

  const builtins = manageServer
    ? createBuiltinTools({ manager, manageUrl: () => manageServer.ensureStarted() })
    : [];

  const shared = {
    upstreams: manager.upstreams,
    runtime,
    builtins,
    onUpstreamsChange: (fn: () => void) => manager.onChange(fn),
  };
  const stdioServer = buildProxyServer(shared);

  const listenServer = config.listen
    ? await startListenServer({ listen: config.listen, ...shared })
    : null;

  const shutdown = async () => {
    if (listenServer) await listenServer.close();
    await manageServer?.close();
    await manager.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await startProxy(stdioServer);
}
