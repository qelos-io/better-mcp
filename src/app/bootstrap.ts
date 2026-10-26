import { resolve } from "node:path";
import { loadConfig } from "../config/index.js";
import { saveServers } from "../config/writer.js";
import { startListenServer } from "../controllers/listen.controller.js";
import { ConfigCredentialStore } from "../lib/credential-store.js";
import { credentialsKey } from "../lib/oauth.js";
import { enableEnvProxy } from "../lib/proxy-env.js";
import { startupBanner } from "../lib/version.js";
import { resolveSlimConfig } from "../lib/slim.js";
import { loadCatalog } from "../manage/catalog.js";
import { resolveManageOptions } from "../manage/options.js";
import { ManageServer } from "../manage/server.js";
import { MiddlewarePipeline } from "../middleware/pipeline.js";
import { createBuiltinTools } from "../services/builtin.service.js";
import { UpstreamManager } from "../services/manager.service.js";
import { buildProxyServer, startProxy } from "../services/proxy.service.js";

export async function bootstrap(opts: { entryDir: string }): Promise<void> {
  process.stderr.write(`[better-mcp] ${startupBanner()}\n`);
  if (enableEnvProxy()) process.stderr.write("[better-mcp] using proxy from environment\n");
  const { config, baseDir, source, configPath, rawServers } = await loadConfig({
    entryDir: opts.entryDir,
  });
  process.stderr.write(`[better-mcp] using config: ${source}\n`);

  const useConfigAuth = configPath !== undefined && config.authStorage !== "home";
  const manager = new UpstreamManager(rawServers, {
    createStore: useConfigAuth
      ? (name, url) => new ConfigCredentialStore(configPath, credentialsKey(name, url))
      : undefined,
    save: configPath ? (servers) => saveServers(configPath, servers) : undefined,
  });
  await manager.start();
  const views = manager.list();
  const connected = views.filter((v) => v.status === "connected").map((v) => v.name);
  process.stderr.write(
    `[better-mcp] connected to ${connected.length}/${views.length} server(s)` +
      (connected.length ? `: ${connected.join(", ")}` : "") +
      "\n",
  );
  const pending = manager.needingLogin();
  if (pending.length) {
    process.stderr.write(
      `[better-mcp] login required for: ${pending.join(", ")} (use the authenticate or manage_mcps tool)\n`,
    );
  }

  const manageCfg = config.manage ?? {};
  const manageServer =
    manageCfg.enabled === false
      ? null
      : new ManageServer({
          manager,
          persistent: configPath !== undefined,
          ...resolveManageOptions(manageCfg),
          catalog: () =>
            loadCatalog({
              url: manageCfg.catalogUrl,
              bundledPath: resolve(opts.entryDir, "..", "docs", "marketplace", "servers.json"),
            }),
        });
  const builtins = manageServer
    ? createBuiltinTools({ manager, manageUrl: () => manageServer.ensureStarted() })
    : [];

  const pipeline = await MiddlewarePipeline.build(config.middleware, baseDir);
  const slim = resolveSlimConfig(config.middleware?.slim);
  const shared = {
    upstreams: manager.upstreams,
    pipeline,
    namespace: config.namespace ?? true,
    slim,
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
