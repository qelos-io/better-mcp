import { resolve } from "node:path";
import { loadConfig } from "../config/index.js";
import type { LoadResult } from "../config/loader.js";
import { saveServers } from "../config/writer.js";
import { ConfigCredentialStore } from "../lib/credential-store.js";
import { credentialsKey } from "../lib/oauth.js";
import { enableEnvProxy } from "../lib/proxy-env.js";
import { startupBanner } from "../lib/version.js";
import { loadCatalog } from "../manage/catalog.js";
import { resolveManageOptions } from "../manage/options.js";
import { ManageServer } from "../manage/server.js";
import { fileSettingsStore, readOnlySettingsStore } from "../manage/settings-store.js";
import { RuntimeSettings } from "../services/runtime.service.js";
import { UpstreamManager } from "../services/manager.service.js";
import { runTool } from "../services/run-tool.service.js";

export interface Core extends LoadResult {
  manager: UpstreamManager;
  runtime: RuntimeSettings;
  /** Null when the config sets `manage.enabled: false` and the caller didn't force it on. */
  manageServer: ManageServer | null;
}

/**
 * Everything both modes share: load the config, connect the upstream servers,
 * and build the live settings and the management server (not yet listening).
 */
export async function createCore(opts: { entryDir: string; forceManage?: boolean }): Promise<Core> {
  process.stderr.write(`[better-mcp] ${startupBanner()}\n`);
  if (enableEnvProxy()) process.stderr.write("[better-mcp] using proxy from environment\n");
  const loaded = await loadConfig({ entryDir: opts.entryDir });
  const { config, baseDir, source, configPath, rawServers } = loaded;
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

  const runtime = await RuntimeSettings.create(config, baseDir);
  const manageCfg = config.manage ?? {};
  const manageServer =
    manageCfg.enabled === false && !opts.forceManage
      ? null
      : new ManageServer({
          manager,
          persistent: configPath !== undefined,
          uiDir: resolve(opts.entryDir, "ui"),
          settings: configPath
            ? fileSettingsStore(configPath)
            : readOnlySettingsStore(config as unknown as Record<string, unknown>),
          applySettings: async () => {
            const fresh = await loadConfig({ entryDir: opts.entryDir });
            await runtime.apply(fresh.config, fresh.baseDir);
          },
          runTool: (server, tool, args) => {
            const upstream = manager.connectedServer(server);
            if (!upstream) throw new Error(`"${server}" is not connected`);
            return runTool({ pipeline: runtime.pipeline, server: upstream }, tool, args);
          },
          ...resolveManageOptions(manageCfg),
          catalog: () =>
            loadCatalog({
              url: manageCfg.catalogUrl,
              bundledPath: resolve(opts.entryDir, "..", "docs", "marketplace", "servers.json"),
            }),
        });
  return { ...loaded, manager, runtime, manageServer };
}
