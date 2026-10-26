import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { McpServerConfig, OAuthConfig } from "../types/index.js";

export const DEFAULT_CALLBACK_PORT = 33418;
export const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Whether a remote upstream should use the interactive OAuth flow. Explicit
 * `oauth` config wins; otherwise it's on unless the user already supplies an
 * Authorization header.
 */
export function shouldUseOAuth(cfg: McpServerConfig): boolean {
  if (cfg.oauth === false) return false;
  if (cfg.oauth) return true;
  const hasAuthHeader = Object.keys(cfg.headers ?? {}).some(
    (h) => h.toLowerCase() === "authorization",
  );
  return !hasAuthHeader;
}

export function resolveOAuthConfig(cfg: McpServerConfig): OAuthConfig {
  return typeof cfg.oauth === "object" ? cfg.oauth : {};
}

/** Token cache location. `BETTER_MCP_HOME` (set in the Docker image) relocates `~/.better-mcp`. */
export function defaultAuthDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.BETTER_MCP_HOME || join(homedir(), ".better-mcp"), "auth");
}

/** Stable, filesystem-safe key for one (server name, url) pair. */
export function credentialsKey(name: string, url: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 8);
  return `${safe}-${hash}`;
}

export function credentialsFileName(name: string, url: string): string {
  return `${credentialsKey(name, url)}.json`;
}

export function callbackUrl(port: number): string {
  return `http://localhost:${port}/callback`;
}

export interface StoredCredentials {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}

/** Where OAuth state lives. `update` with an `undefined` value removes that field. */
export interface CredentialStore {
  read(): Promise<StoredCredentials>;
  update(patch: Partial<StoredCredentials>): Promise<void>;
  clear(scope: "all" | "client" | "tokens" | "verifier"): Promise<void>;
}

/** JSON file (mode 0600) holding client registration, tokens and PKCE verifier. */
export class FileCredentialStore implements CredentialStore {
  constructor(private readonly path: string) {}

  async read(): Promise<StoredCredentials> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as StoredCredentials;
    } catch {
      return {};
    }
  }

  async update(patch: Partial<StoredCredentials>): Promise<void> {
    const next = { ...(await this.read()), ...patch };
    await mkdir(join(this.path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(this.path, JSON.stringify(next, null, 2), { mode: 0o600 });
    await chmod(this.path, 0o600);
  }

  async clear(scope: "all" | "client" | "tokens" | "verifier"): Promise<void> {
    if (scope === "all") return void (await this.update({ clientInformation: undefined, tokens: undefined, codeVerifier: undefined }));
    const key = scope === "client" ? "clientInformation" : scope === "tokens" ? "tokens" : "codeVerifier";
    await this.update({ [key]: undefined });
  }
}

/**
 * One loopback HTTP listener shared by every upstream that needs a login.
 * Callbacks are routed to the waiting login by their OAuth `state` value.
 */
export class CallbackHub {
  private server?: Server;
  private starting?: Promise<void>;
  private pending = new Map<string, { resolve: (code: string) => void; reject: (e: Error) => void }>();

  constructor(
    private readonly port: number,
    private readonly host = "127.0.0.1",
  ) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  start(): Promise<void> {
    this.starting ??= new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => this.handle(req.url ?? "/", res));
      server.once("error", (err: NodeJS.ErrnoException) => {
        this.starting = undefined;
        reject(
          err.code === "EADDRINUSE"
            ? new Error(`OAuth callback port ${this.port} is already in use (set oauth.callbackPort)`)
            : err,
        );
      });
      server.listen(this.port, this.host, () => {
        this.server = server;
        resolve();
      });
    });
    return this.starting;
  }

  /** Resolves with the authorization code once the browser hits the callback with this state. */
  expect(state: string, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(state);
        reject(new Error("timed out waiting for browser login"));
      }, timeoutMs);
      timer.unref();
      this.pending.set(state, {
        resolve: (code) => {
          clearTimeout(timer);
          resolve(code);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  private handle(rawUrl: string, res: import("node:http").ServerResponse): void {
    const url = new URL(rawUrl, "http://localhost");
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const state = url.searchParams.get("state") ?? "";
    const waiter = this.pending.get(state);
    if (!waiter) {
      res.writeHead(400, { "content-type": "text/plain" }).end("Unknown or expired login request.");
      return;
    }
    this.pending.delete(state);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    if (error || !code) {
      const detail = url.searchParams.get("error_description") ?? error ?? "no authorization code";
      waiter.reject(new Error(`authorization failed: ${detail}`));
      res.writeHead(400, { "content-type": "text/plain" }).end(`Login failed: ${detail}`);
      return;
    }
    waiter.resolve(code);
    res
      .writeHead(200, { "content-type": "text/html" })
      .end("<html><body style=\"font-family:sans-serif\"><h3>Logged in.</h3>You can close this tab and return to your MCP client.</body></html>");
  }

  async close(): Promise<void> {
    for (const w of this.pending.values()) w.reject(new Error("callback server closed"));
    this.pending.clear();
    const server = this.server;
    this.server = undefined;
    this.starting = undefined;
    if (server) await new Promise<void>((r) => server.close(() => r()));
  }
}

export function browserCommand(
  platform: NodeJS.Platform,
  url: string,
): { cmd: string; args: string[] } {
  if (platform === "darwin") return { cmd: "open", args: [url] };
  if (platform === "win32") return { cmd: "cmd", args: ["/c", "start", "", url.replace(/&/g, "^&")] };
  return { cmd: "xdg-open", args: [url] };
}

/** Resolves false when no browser could be launched (sandbox, Docker, headless). */
export function openBrowser(url: string): Promise<boolean> {
  const { cmd, args } = browserCommand(process.platform, url);
  return new Promise((resolve) => {
    execFile(cmd, args, (err) => {
      if (err) process.stderr.write(`[better-mcp] could not open a browser; open this URL manually:\n  ${url}\n`);
      resolve(!err);
    });
  });
}

export interface OAuthProviderOptions {
  serverName: string;
  config: OAuthConfig;
  store: CredentialStore;
  hub: CallbackHub;
  port: number;
  openUrl?: (url: string) => void;
  /** When false, a login request is recorded (`loginRequired`) instead of opening a browser. */
  interactive?: boolean;
  /** Called with the authorization URL before the browser is opened (lets a UI offer the link). */
  onAuthUrl?: (url: string) => void;
}

/**
 * OAuthClientProvider backed by a file store and the shared callback hub.
 * After the SDK calls `redirectToAuthorization`, `waitForCode()` yields the
 * code to hand to `transport.finishAuth()`.
 */
export class BetterMcpOAuthProvider implements OAuthClientProvider {
  private pendingCode?: Promise<string>;
  private currentState?: string;
  /** Set when the server asked for a login that was not started (non-interactive mode). */
  loginRequired = false;

  constructor(private readonly opts: OAuthProviderOptions) {}

  get redirectUrl(): string {
    return callbackUrl(this.opts.port);
  }

  get clientMetadata(): OAuthClientMetadata {
    const { config } = this.opts;
    return {
      client_name: "better-mcp",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: config.clientSecret ? "client_secret_post" : "none",
      ...(config.scopes?.length ? { scope: config.scopes.join(" ") } : {}),
    };
  }

  state(): string {
    this.currentState = randomBytes(16).toString("hex");
    return this.currentState;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const { config, store } = this.opts;
    if (config.clientId) {
      return { client_id: config.clientId, ...(config.clientSecret ? { client_secret: config.clientSecret } : {}) };
    }
    const info = (await store.read()).clientInformation;
    const uris = (info as { redirect_uris?: string[] } | undefined)?.redirect_uris;
    // A registration made for another callback port is unusable; force re-registration.
    if (uris && !uris.includes(this.redirectUrl)) return undefined;
    return info;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    await this.opts.store.update({ clientInformation: info });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await this.opts.store.read()).tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.opts.store.update({ tokens });
  }

  async saveCodeVerifier(v: string): Promise<void> {
    await this.opts.store.update({ codeVerifier: v });
  }

  async codeVerifier(): Promise<string> {
    const v = (await this.opts.store.read()).codeVerifier;
    if (!v) throw new Error("no PKCE code verifier saved");
    return v;
  }

  /** Accept the resource the server advertises even when its path differs from the configured URL (e.g. `/sse` vs `/mcp`). */
  async validateResourceURL(_serverUrl: string | URL, resource?: string): Promise<URL | undefined> {
    return resource ? new URL(resource) : undefined;
  }

  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    if (scope === "discovery") return;
    await this.opts.store.clear(scope);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.opts.interactive === false) {
      this.loginRequired = true;
      return;
    }
    await this.opts.hub.start();
    const state = authorizationUrl.searchParams.get("state") ?? this.currentState ?? "";
    this.pendingCode = this.opts.hub.expect(state);
    this.pendingCode.catch(() => {});
    process.stderr.write(
      `[better-mcp] ${this.opts.serverName}: login required — opening browser (callback ${this.redirectUrl})\n`,
    );
    this.opts.onAuthUrl?.(authorizationUrl.toString());
    (this.opts.openUrl ?? openBrowser)(authorizationUrl.toString());
  }

  /** Authorization code from the browser login started by the last redirect. */
  waitForCode(): Promise<string> {
    if (!this.pendingCode) return Promise.reject(new Error("no login in progress"));
    return this.pendingCode;
  }
}
