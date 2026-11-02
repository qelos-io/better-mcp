import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, statSync } from "node:fs";
import { VERSION } from "../lib/version.js";
import { daemonDir, entryFile, isAlive, readEntry, removeEntry, writeEntry, type DaemonEntry } from "../lib/daemon-registry.js";
import { httpBackend, ping, type ToolsBackend } from "../lib/tools-backend.js";
import { createCore, type Core } from "./core.js";

const DEFAULT_IDLE_MS = 10 * 60_000;
const START_TIMEOUT_MS = 120_000;

/** Publish a running management server so `tools` commands can reuse this process. Returns the cleanup. */
export async function registerProcess(core: Core, url: string, kind: DaemonEntry["kind"]): Promise<() => Promise<void>> {
  const { configPath } = core;
  if (!configPath) return async () => {};
  const file = entryFile(daemonDir(), configPath);
  await writeEntry(file, { pid: process.pid, url, configPath, configMtimeMs: statSync(configPath).mtimeMs, version: VERSION, kind });
  return () => removeEntry(file, process.pid);
}

/**
 * The background helper behind `tools`: stays connected to the servers, serves the management API on
 * loopback for later commands, and exits after `BETTER_MCP_DAEMON_IDLE_MS` (default 10 min) without requests.
 */
export async function runDaemon(opts: { entryDir: string }): Promise<void> {
  let last = Date.now();
  const core = await createCore({ ...opts, forceManage: true, onRequest: () => void (last = Date.now()) });
  const server = core.manageServer!;
  const url = await server.ensureStarted();
  if (!core.configPath) throw new Error("the background helper needs a config file");
  const existing = await readEntry(entryFile(daemonDir(), core.configPath));
  if (existing && existing.pid !== process.pid && isAlive(existing.pid) && (await ping(existing.url))) {
    await server.close();
    await core.manager.close();
    return;
  }
  const unregister = await registerProcess(core, url, "daemon");
  const idleMs = Number(process.env.BETTER_MCP_DAEMON_IDLE_MS) || DEFAULT_IDLE_MS;
  const shutdown = async () => {
    await unregister();
    await server.close();
    await core.manager.close();
    process.exit(0);
  };
  setInterval(() => {
    if (Date.now() - last > idleMs) void shutdown();
  }, Math.min(15_000, Math.max(50, idleMs / 4)));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * A backend served by an already-running better-mcp for this config, starting the background helper
 * when none is running. Undefined when it can't be had; the caller then connects in-process.
 */
export async function connectDaemon(configPath: string, env: NodeJS.ProcessEnv = process.env): Promise<ToolsBackend | undefined> {
  const dir = daemonDir(env);
  const file = entryFile(dir, configPath);
  const mtime = statSync(configPath).mtimeMs;
  const usable = async (e: DaemonEntry | undefined): Promise<boolean> =>
    !!e && isAlive(e.pid) && (e.kind === "app" || e.configMtimeMs === mtime) && (await ping(e.url));

  const found = await readEntry(file);
  if (await usable(found)) return httpBackend(found!.url);
  if (found) {
    if (isAlive(found.pid) && found.kind === "daemon") {
      try {
        process.kill(found.pid, "SIGTERM");
      } catch {}
    }
    await removeEntry(file);
  }

  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const log = openSync(file.replace(/\.json$/, ".log"), "w", 0o600);
  let exited = false;
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], "__daemon", "--config", configPath], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...env, BETTER_MCP_MANAGE_PORT: "0" },
  });
  closeSync(log);
  child.once("exit", () => (exited = true));
  child.once("error", () => (exited = true));
  child.unref();

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!exited && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    const e = await readEntry(file);
    if (e && (await usable(e))) return httpBackend(e.url);
  }
  return undefined;
}
