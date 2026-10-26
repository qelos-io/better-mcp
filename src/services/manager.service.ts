import type { ServerStatus, ServerView, ToolView } from "../manage/api-types.js";
import { interpolateEnvVars } from "../lib/env.js";
import { validateServer } from "../config/loader.js";
import type { McpServerConfig } from "../types/index.js";
import {
  NeedsAuthError,
  connectServer,
  type ConnectOptions,
  type UpstreamServer,
} from "./upstream.service.js";

export type { ServerStatus, ServerView, ToolView };

interface Entry {
  /** As written in the config file (may contain `${VAR}`); what gets persisted. */
  raw: McpServerConfig;
  /** Env-expanded; what gets connected. */
  config: McpServerConfig;
  status: ServerStatus;
  error?: string;
  loginUrl?: string;
  finishing?: boolean;
  server?: UpstreamServer;
}

export interface ManagerDeps {
  /** Where OAuth state is stored; forwarded to every connect. */
  createStore?: ConnectOptions["createStore"];
  connect?: (name: string, cfg: McpServerConfig, opts: ConnectOptions) => Promise<UpstreamServer>;
  /** Persist the full server map (e.g. back to mcp.json). Omit for read-only. */
  save?: (servers: Record<string, McpServerConfig>) => Promise<void>;
  /** Expand `${VAR}` in a raw config. Defaults to env interpolation. */
  expand?: (cfg: McpServerConfig) => McpServerConfig;
}

/**
 * Owns the set of upstream servers and their lifecycle. `upstreams` is a live
 * array (mutated in place) so proxy servers always see the current set;
 * `onChange` tells them when to re-announce their tool lists.
 */
export class UpstreamManager {
  readonly upstreams: UpstreamServer[] = [];
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private readonly connect: NonNullable<ManagerDeps["connect"]>;
  private readonly save?: ManagerDeps["save"];
  private readonly createStore?: ConnectOptions["createStore"];
  private readonly expand: NonNullable<ManagerDeps["expand"]>;

  /** `servers` are the raw (unexpanded) configs from the file. */
  constructor(servers: Record<string, McpServerConfig>, deps: ManagerDeps = {}) {
    this.connect = deps.connect ?? connectServer;
    this.save = deps.save;
    this.createStore = deps.createStore;
    this.expand = deps.expand ?? interpolateEnvVars;
    for (const [name, raw] of Object.entries(servers)) this.entries.set(name, this.newEntry(raw));
  }

  private newEntry(raw: McpServerConfig): Entry {
    return { raw, config: this.expand(raw), status: raw.enabled === false ? "disabled" : "connecting" };
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Connect every enabled server without opening any browser. */
  async start(): Promise<void> {
    await Promise.all(
      [...this.entries.keys()]
        .filter((n) => this.entries.get(n)!.status !== "disabled")
        .map((n) => this.attempt(n, false)),
    );
  }

  list(): ServerView[] {
    return [...this.entries.entries()].map(([name, e]) => ({
      name,
      status: e.status,
      error: e.error,
      loginUrl: e.status === "authenticating" && !e.finishing ? e.loginUrl : undefined,
      finishing: e.status === "authenticating" && e.finishing ? true : undefined,
      transport: e.config.url ? "http" : "stdio",
      target: e.config.url ?? [e.config.command, ...(e.config.args ?? [])].join(" "),
      tools: e.server?.tools.length ?? 0,
      toolsTotal: e.server?.allTools.length ?? 0,
      resources: e.server?.resources.length ?? 0,
      prompts: e.server?.prompts.length ?? 0,
    }));
  }

  /** Every tool a connected server reports, with its enabled flag. */
  listTools(name: string): ToolView[] {
    const e = this.require(name);
    const off = new Set(e.raw.disabledTools ?? []);
    return (e.server?.allTools ?? []).map((t) => ({ name: t.name, description: t.description, enabled: !off.has(t.name) }));
  }

  /** Enable or disable tools by their original names; persisted, applied live. */
  async setToolsEnabled(name: string, tools: string[], enabled: boolean): Promise<void> {
    const e = this.require(name);
    const known = new Set((e.server?.allTools ?? []).map((t) => t.name));
    const unknown = tools.filter((t) => !known.has(t));
    if (unknown.length) throw new Error(`unknown tool(s) on "${name}": ${unknown.join(", ")}`);
    const off = new Set(e.raw.disabledTools ?? []);
    for (const t of tools) enabled ? off.delete(t) : off.add(t);
    const prev = { raw: e.raw, config: e.config };
    const disabledTools = off.size ? [...off].sort() : undefined;
    e.raw = { ...e.raw, disabledTools };
    e.config = { ...e.config, disabledTools };
    if (!disabledTools) {
      delete e.raw.disabledTools;
      delete e.config.disabledTools;
    }
    try {
      await this.persist();
    } catch (err) {
      Object.assign(e, prev);
      throw err;
    }
    if (e.server) e.server.disabledTools = off;
    this.sync();
  }

  needingLogin(): string[] {
    return this.list().filter((s) => s.status === "needs_auth").map((s) => s.name);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** Reconnect without a browser. */
  async reconnect(name: string): Promise<void> {
    this.require(name);
    await this.attempt(name, false);
  }

  /**
   * Run the interactive browser login. Status flips to `authenticating`
   * synchronously; the returned promise settles when the login finishes.
   */
  login(name: string): Promise<void> {
    const e = this.entries.get(name);
    if (!e) return Promise.reject(new Error(`unknown server "${name}"`));
    if (!e.config.url) return Promise.reject(new Error(`${name} is a local server and has no login`));
    if (e.status === "authenticating") return Promise.resolve();
    return this.attempt(name, true);
  }

  async add(name: string, config: unknown): Promise<void> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
      throw new Error("name must start with a letter or digit and use only letters, digits, '-' and '_'");
    }
    if (name.includes("__")) throw new Error("name must not contain '__'");
    if (this.entries.has(name)) throw new Error(`server "${name}" already exists`);
    const cfg = validateServer(name, config);
    this.entries.set(name, this.newEntry(cfg));
    try {
      await this.persist();
    } catch (err) {
      this.entries.delete(name);
      throw err;
    }
    if (cfg.enabled !== false) await this.attempt(name, false);
    else this.emit();
  }

  async remove(name: string): Promise<void> {
    const e = this.require(name);
    this.entries.delete(name);
    try {
      await this.persist();
    } catch (err) {
      this.entries.set(name, e);
      throw err;
    }
    await this.detach(e);
    this.sync();
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    const e = this.require(name);
    const prev = { raw: e.raw, config: e.config };
    e.raw = { ...e.raw, enabled };
    e.config = { ...e.config, enabled };
    try {
      await this.persist();
    } catch (err) {
      Object.assign(e, prev);
      throw err;
    }
    if (enabled) {
      e.status = "connecting";
      await this.attempt(name, false);
    } else {
      await this.detach(e);
      e.status = "disabled";
      e.error = undefined;
      this.sync();
    }
  }

  async close(): Promise<void> {
    await Promise.all([...this.entries.values()].map((e) => this.detach(e)));
    this.upstreams.length = 0;
  }

  private require(name: string): Entry {
    const e = this.entries.get(name);
    if (!e) throw new Error(`unknown server "${name}"`);
    return e;
  }

  private async persist(): Promise<void> {
    if (!this.save) return;
    const out: Record<string, McpServerConfig> = {};
    for (const [n, e] of this.entries) out[n] = e.raw;
    await this.save(out);
  }

  private async detach(e: Entry): Promise<void> {
    const s = e.server;
    e.server = undefined;
    if (s) await s.close();
  }

  private async attempt(name: string, interactive: boolean): Promise<void> {
    const e = this.require(name);
    e.status = interactive ? "authenticating" : "connecting";
    e.error = undefined;
    e.loginUrl = undefined;
    e.finishing = false;
    await this.detach(e);
    this.sync();
    try {
      const server = await this.connect(name, e.config, {
        interactive,
        createStore: this.createStore,
        onLoginUrl: (url) => {
          e.loginUrl = url;
          this.emit();
        },
        onLoginCode: () => {
          e.finishing = true;
          this.emit();
        },
      });
      if (this.entries.get(name) !== e) {
        await server.close();
        return;
      }
      server.disabledTools = new Set(e.config.disabledTools ?? []);
      e.server = server;
      e.status = "connected";
    } catch (err) {
      if (this.entries.get(name) !== e) return;
      if (err instanceof NeedsAuthError) {
        e.status = "needs_auth";
      } else {
        e.status = "error";
        e.error = describeError(err);
        process.stderr.write(`[better-mcp] ${name}: failed to connect: ${e.error}\n`);
      }
    }
    this.sync();
  }

  /** Rebuild the live upstream array (config order) and notify listeners. */
  private sync(): void {
    const connected: UpstreamServer[] = [];
    for (const e of this.entries.values()) if (e.server) connected.push(e.server);
    this.upstreams.splice(0, this.upstreams.length, ...connected);
    this.emit();
  }

  private emit(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
        /* a bad listener must not break the manager */
      }
    }
  }
}

/** Node's fetch reports every network failure as "fetch failed"; the real reason is in `cause`. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string; hostname?: string } | undefined;
  const detail = cause?.code ? (cause.hostname ? `${cause.code} ${cause.hostname}` : cause.code) : cause?.message;
  return detail && !err.message.includes(detail) ? `${err.message} (${detail})` : err.message;
}
