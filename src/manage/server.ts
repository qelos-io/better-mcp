import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { UpstreamManager } from "../services/manager.service.js";
import type { RunToolResult } from "./api-types.js";
import type { Catalog } from "./catalog.js";
import { readAllSettings } from "./settings-schema.js";
import type { SettingsStore } from "./settings-store.js";
import { UI_MISSING_HTML, readStatic } from "./static.js";

export interface ManageDeps {
  manager: Pick<
    UpstreamManager,
    "list" | "add" | "remove" | "setEnabled" | "listTools" | "toolDetail" | "setToolsEnabled" | "reconnect" | "login" | "has"
  >;
  catalog: () => Promise<Catalog>;
  /** False when the config can't be written back (inline JSON). */
  persistent: boolean;
  /** 0 = pick a free port. */
  port?: number;
  /** Bind address. Default 127.0.0.1. */
  host?: string;
  /** Directory holding the built web UI (index.html + assets). */
  uiDir: string;
  /** Where the editable settings live. */
  settings: SettingsStore;
  /** Re-reads the saved settings into the running proxy. Omit when changes need a restart. */
  applySettings?: () => Promise<void>;
  /** Run a tool through the middleware pipeline; absent when running tools isn't available. */
  runTool?: (server: string, tool: string, args: Record<string, unknown>) => Promise<RunToolResult>;
}

const MAX_BODY = 1_000_000;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new Error("request body too large");
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export function isLocalHost(hostHeader: string | undefined, port: number): boolean {
  return hostHeader === `127.0.0.1:${port}` || hostHeader === `localhost:${port}`;
}

function tokenMatches(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Local web UI (loopback unless `host` says otherwise). Every URL is prefixed with a random token, the Host
 * header must be loopback (anti DNS-rebinding), and mutations need a custom
 * header (forces a CORS preflight that we never grant).
 */
export class ManageServer {
  readonly token = randomBytes(24).toString("hex");
  private server?: Server;
  private starting?: Promise<string>;
  private port = 0;
  /** Settings are read once at startup, so any saved change needs a restart. */
  private restartRequired = false;

  constructor(private readonly deps: ManageDeps) {}

  ensureStarted(): Promise<string> {
    this.starting ??= new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
        });
      });
      server.once("error", (err) => {
        this.starting = undefined;
        reject(err);
      });
      server.listen(this.deps.port ?? 0, this.deps.host ?? "127.0.0.1", () => {
        this.server = server;
        this.port = (server.address() as AddressInfo).port;
        resolve(this.url);
      });
    });
    return this.starting;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}/${this.token}/`;
  }

  async close(): Promise<void> {
    const s = this.server;
    this.server = undefined;
    this.starting = undefined;
    if (s) {
      s.closeAllConnections();
      await new Promise<void>((r) => s.close(() => r()));
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isLocalHost(req.headers.host, this.port)) return void sendJson(res, 403, { error: "forbidden host" });
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const [, token = "", ...rest] = path.split("/");
    if (!tokenMatches(token, this.token)) return void sendJson(res, 404, { error: "not found" });

    const method = req.method ?? "GET";
    const sub = rest.join("/");
    if (method === "GET" && !sub.startsWith("api/")) {
      const file = await readStatic(this.deps.uiDir, sub);
      if (file) {
        res.writeHead(200, { "content-type": file.type, "cache-control": "no-store" }).end(file.body);
      } else if (sub === "" || sub === "index.html") {
        res.writeHead(503, { "content-type": "text/html; charset=utf-8" }).end(UI_MISSING_HTML);
      } else {
        sendJson(res, 404, { error: "not found" });
      }
      return;
    }
    if (!sub.startsWith("api/")) return void sendJson(res, 404, { error: "not found" });
    if (method !== "GET" && req.headers["x-better-mcp"] !== "1") {
      return void sendJson(res, 403, { error: "missing x-better-mcp header" });
    }
    try {
      sendJson(res, ...(await this.route(method, sub.slice(4), req)));
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async route(method: string, api: string, req: IncomingMessage): Promise<[number, unknown]> {
    const { manager } = this.deps;
    if (method === "GET" && api === "state") {
      return [200, { servers: manager.list(), persistent: this.deps.persistent }];
    }
    if (api === "settings") {
      const { settings } = this.deps;
      if (method === "GET") {
        const values = readAllSettings(await settings.read());
        return [200, { values, writable: !!settings.write, restartRequired: this.restartRequired }];
      }
      if (method === "POST") {
        if (!settings.write) throw new Error("this config was supplied inline and can't be saved");
        const body = (await readJson(req)) as { patch?: unknown };
        if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) throw new Error("body must be { patch: object }");
        await settings.write(body.patch as Record<string, unknown>);
        try {
          await this.deps.applySettings?.();
          this.restartRequired = !this.deps.applySettings;
          return [200, { ok: true, applied: !this.restartRequired, restartRequired: this.restartRequired }];
        } catch (err) {
          this.restartRequired = true;
          return [200, { ok: true, applied: false, restartRequired: true, error: err instanceof Error ? err.message : String(err) }];
        }
      }
    }
    if (method === "GET" && api === "catalog") return [200, await this.deps.catalog()];
    if (method === "POST" && api === "servers") {
      const body = (await readJson(req)) as { name?: unknown; config?: unknown };
      if (typeof body.name !== "string") throw new Error("name is required");
      await manager.add(body.name, body.config);
      return [201, { ok: true }];
    }
    const one = /^servers\/([^/]+)\/tools\/([^/]+)(\/call)?$/.exec(api);
    if (one) {
      const name = decodeURIComponent(one[1]);
      const tool = decodeURIComponent(one[2]);
      if (!manager.has(name)) throw new Error(`unknown server "${name}"`);
      if (method === "GET" && !one[3]) return [200, manager.toolDetail(name, tool)];
      if (method === "POST" && one[3]) {
        if (!this.deps.runTool) throw new Error("running tools is not available");
        const body = (await readJson(req)) as { arguments?: unknown };
        const args = body.arguments ?? {};
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be an object");
        return [200, await this.deps.runTool(name, tool, args as Record<string, unknown>)];
      }
    }
    const t = /^servers\/([^/]+)\/tools$/.exec(api);
    if (t) {
      const name = decodeURIComponent(t[1]);
      if (!manager.has(name)) throw new Error(`unknown server "${name}"`);
      if (method === "GET") return [200, { tools: manager.listTools(name) }];
      if (method === "POST") {
        const body = (await readJson(req)) as { tools?: unknown; enabled?: unknown };
        if (!Array.isArray(body.tools) || body.tools.some((x) => typeof x !== "string") || typeof body.enabled !== "boolean") {
          throw new Error("body must be { tools: string[], enabled: boolean }");
        }
        await manager.setToolsEnabled(name, body.tools as string[], body.enabled);
        return [200, { ok: true }];
      }
    }
    const m = /^servers\/([^/]+)(?:\/(login|reconnect|enable|disable))?$/.exec(api);
    if (m) {
      const name = decodeURIComponent(m[1]);
      if (!manager.has(name)) throw new Error(`unknown server "${name}"`);
      if (method === "DELETE" && !m[2]) {
        await manager.remove(name);
        return [200, { ok: true }];
      }
      if (method === "POST" && m[2]) {
        if (m[2] === "login") {
          if (manager.list().find((v) => v.name === name)?.transport !== "http") {
            throw new Error(`${name} is a local server and has no login`);
          }
          const p = manager.login(name);
          p.catch(() => {});
          return [202, { ok: true }];
        }
        if (m[2] === "reconnect") await manager.reconnect(name);
        else await manager.setEnabled(name, m[2] === "enable");
        return [200, { ok: true }];
      }
    }
    throw new Error("not found");
  }
}
