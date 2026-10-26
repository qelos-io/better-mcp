import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  BetterMcpOAuthProvider,
  CallbackHub,
  DEFAULT_CALLBACK_PORT,
  FileCredentialStore,
  type CredentialStore,
  credentialsFileName,
  defaultAuthDir,
  resolveOAuthConfig,
  shouldUseOAuth,
} from "../lib/oauth.js";
import { VERSION } from "../lib/version.js";
import type { McpServerConfig } from "../types/index.js";
import { join } from "node:path";

export interface UpstreamTool {
  server: string;
  /** Original (un-namespaced) name on the upstream server. */
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface UpstreamResource {
  server: string;
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface UpstreamPrompt {
  server: string;
  name: string;
  description?: string;
  arguments?: unknown;
}

const PROXY_CLIENT_INFO = { name: "@qelos/better-mcp", version: VERSION };

/**
 * One connected upstream MCP server, holding the SDK Client and the catalog
 * we discovered at connect time.
 */
export class UpstreamServer {
  client: Client;
  transport: Transport;
  name: string;
  tools: UpstreamTool[] = [];
  resources: UpstreamResource[] = [];
  prompts: UpstreamPrompt[] = [];

  constructor(name: string, client: Client, transport: Transport) {
    this.name = name;
    this.client = client;
    this.transport = transport;
  }

  /** Re-fetch the catalog. Called on connect; safe to call later. */
  async refresh(): Promise<void> {
    const caps = this.client.getServerCapabilities();

    if (caps?.tools) {
      try {
        const res = await this.client.listTools();
        this.tools = (res.tools ?? []).map((t) => ({
          server: this.name,
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
      } catch (err) {
        warn(this.name, "listTools failed", err);
        this.tools = [];
      }
    }

    if (caps?.resources) {
      try {
        const res = await this.client.listResources();
        this.resources = (res.resources ?? []).map((r) => ({
          server: this.name,
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        }));
      } catch (err) {
        warn(this.name, "listResources failed", err);
        this.resources = [];
      }
    }

    if (caps?.prompts) {
      try {
        const res = await this.client.listPrompts();
        this.prompts = (res.prompts ?? []).map((p) => ({
          server: this.name,
          name: p.name,
          description: p.description,
          arguments: p.arguments,
        }));
      } catch (err) {
        warn(this.name, "listPrompts failed", err);
        this.prompts = [];
      }
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      /* ignore */
    }
  }
}

/** Thrown by a non-interactive connect when the server wants a browser login. */
export class NeedsAuthError extends Error {
  constructor(server: string) {
    super(`${server} requires login`);
    this.name = "NeedsAuthError";
  }
}

export interface ConnectOptions {
  /** Open a browser for OAuth login when required. Default: false. */
  interactive?: boolean;
  /** Receives the login URL when an interactive login starts. */
  onLoginUrl?: (url: string) => void;
  /** Fires when the browser has returned and the login is being completed. */
  onLoginCode?: () => void;
  /** Choose where OAuth state is kept. Default: a file under `~/.better-mcp/auth`. */
  createStore?: (name: string, url: string) => CredentialStore;
}

/** Connect to one configured server. Throws `NeedsAuthError` if login is required but not allowed. */
export async function connectServer(
  name: string,
  cfg: McpServerConfig,
  opts: ConnectOptions = {},
): Promise<UpstreamServer> {
  if (cfg.url) return connectRemote(name, cfg, opts.interactive === true, opts.onLoginUrl, opts.createStore, opts.onLoginCode);
  return connectStdio(name, cfg);
}

async function connectStdio(name: string, cfg: McpServerConfig): Promise<UpstreamServer> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  if (cfg.env) Object.assign(env, cfg.env);

  const transport = new StdioClientTransport({
    command: cfg.command!,
    args: cfg.args ?? [],
    env,
    cwd: cfg.cwd,
  });

  const client = new Client(PROXY_CLIENT_INFO, { capabilities: {} });
  await client.connect(transport);
  const server = new UpstreamServer(name, client, transport);
  await server.refresh();
  return server;
}

const hubs = new Map<number, CallbackHub>();

function hubFor(port: number): CallbackHub {
  let hub = hubs.get(port);
  if (!hub) hubs.set(port, (hub = new CallbackHub(port, process.env.BETTER_MCP_CALLBACK_HOST || undefined)));
  return hub;
}

async function releaseHub(port: number): Promise<void> {
  const hub = hubs.get(port);
  if (hub && hub.pendingCount === 0) {
    hubs.delete(port);
    await hub.close();
  }
}

async function connectRemote(
  name: string,
  cfg: McpServerConfig,
  interactive: boolean,
  onLoginUrl?: (url: string) => void,
  createStore?: (name: string, url: string) => CredentialStore,
  onLoginCode?: () => void,
): Promise<UpstreamServer> {
  const url = new URL(cfg.url!);
  const requestInit = buildRequestInit(cfg.headers);

  if (!shouldUseOAuth(cfg)) {
    return connectWithTransport(name, new StreamableHTTPClientTransport(url, { requestInit }));
  }

  const config = resolveOAuthConfig(cfg);
  const port = config.callbackPort ?? DEFAULT_CALLBACK_PORT;
  const provider = new BetterMcpOAuthProvider({
    serverName: name,
    config,
    port,
    interactive,
    onAuthUrl: onLoginUrl,
    onCode: onLoginCode,
    hub: hubFor(port),
    store: createStore
      ? createStore(name, url.href)
      : new FileCredentialStore(join(defaultAuthDir(), credentialsFileName(name, url.href))),
  });
  const makeTransport = () =>
    new StreamableHTTPClientTransport(url, { requestInit, authProvider: provider });

  const transport = makeTransport();
  try {
    return await connectWithTransport(name, transport);
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
    if (!interactive) throw new NeedsAuthError(name);
    try {
      const code = await provider.waitForCode();
      const t0 = Date.now();
      await transport.finishAuth(code);
      process.stderr.write(`[better-mcp] ${name}: token exchange took ${Date.now() - t0}ms\n`);
    } finally {
      await releaseHub(port);
    }
    const t1 = Date.now();
    const server = await connectWithTransport(name, makeTransport());
    process.stderr.write(`[better-mcp] ${name}: connected after login in ${Date.now() - t1}ms\n`);
    return server;
  }
}

async function connectWithTransport(name: string, transport: Transport): Promise<UpstreamServer> {
  const client = new Client(PROXY_CLIENT_INFO, { capabilities: {} });
  await client.connect(transport);
  const server = new UpstreamServer(name, client, transport);
  await server.refresh();
  return server;
}

export function buildRequestInit(headers?: Record<string, string>): RequestInit {
  if (!headers || Object.keys(headers).length === 0) return {};
  return { headers: { ...headers } };
}

function warn(server: string, msg: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[better-mcp] ${server}: ${msg}: ${detail}\n`);
}
