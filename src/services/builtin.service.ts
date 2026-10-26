import { openBrowser } from "../lib/oauth.js";
import type { ServerView, UpstreamManager } from "./manager.service.js";
import type { BuiltinTool } from "./proxy.service.js";

type ManagerApi = Pick<UpstreamManager, "list" | "needingLogin" | "has" | "login">;

export interface BuiltinDeps {
  manager: ManagerApi;
  /** Starts the management UI if needed and returns its URL. */
  manageUrl: () => Promise<string>;
  open?: (url: string) => void | boolean | Promise<boolean | void>;
  /** How long `authenticate` waits for a login URL to appear before replying. */
  loginUrlWaitMs?: number;
}

export function formatStatus(servers: ServerView[]): string {
  if (servers.length === 0) return "No MCP servers configured.";
  return servers
    .map((s) => {
      const label = s.status.replace("_", " ");
      if (s.status === "connected") return `- ${s.name}: connected (${s.tools} tools) — ${s.target}`;
      if (s.status === "error") return `- ${s.name}: error (${s.error ?? "unknown"}) — ${s.target}`;
      return `- ${s.name}: ${label} — ${s.target}`;
    })
    .join("\n");
}

export function loginLinks(servers: ServerView[], names: string[]): string {
  return names
    .map((n) => servers.find((s) => s.name === n))
    .filter((s): s is ServerView => !!s?.loginUrl)
    .map((s) => `- ${s.name}: ${s.loginUrl}`)
    .join("\n");
}

export function createBuiltinTools(deps: BuiltinDeps): BuiltinTool[] {
  const { manager } = deps;
  const open = deps.open ?? openBrowser;
  const waitMs = deps.loginUrlWaitMs ?? 3000;

  async function waitForLoginUrls(names: string[]): Promise<void> {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const list = manager.list();
      const pending = names.filter((n) => {
        const v = list.find((s) => s.name === n);
        return v?.status === "authenticating" && !v.loginUrl;
      });
      if (pending.length === 0) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const manage: BuiltinTool = {
    name: "manage_mcps",
    description: () => {
      const pending = manager.needingLogin();
      return (
        "Open the better-mcp management app in the user's browser: see every connected MCP server, " +
        "log in to servers that need it, and install, remove or disable servers from the marketplace " +
        "(changes apply immediately, no restart). Returns the app URL and current server status." +
        (pending.length ? ` Servers currently needing login: ${pending.join(", ")}.` : "")
      );
    },
    inputSchema: { type: "object", properties: {} },
    async call() {
      const url = await deps.manageUrl();
      const opened = (await open(url)) !== false;
      const head = opened
        ? `Opened the better-mcp management app: ${url}`
        : `Could not open a browser from here. Open this URL for the user (or give it to them): ${url}`;
      return { text: `${head}\n\nServers:\n${formatStatus(manager.list())}` };
    },
  };

  const authenticate: BuiltinTool = {
    name: "authenticate",
    description: () =>
      "Start the browser login (OAuth) for a remote MCP server managed by better-mcp. " +
      "Omit `server` to log in to every server that needs it. The user finishes the login in their browser; " +
      "the server's tools appear automatically afterwards." +
      (manager.needingLogin().length ? ` Needs login: ${manager.needingLogin().join(", ")}.` : ""),
    inputSchema: {
      type: "object",
      properties: { server: { type: "string", description: "Server name, as shown by manage_mcps" } },
    },
    async call(args) {
      const requested = typeof args.server === "string" && args.server ? args.server : undefined;
      if (requested && !manager.has(requested)) {
        return { text: `Unknown server "${requested}".\n${formatStatus(manager.list())}`, isError: true };
      }
      const targets = requested ? [requested] : manager.needingLogin();
      if (targets.length === 0) return { text: "No servers need login." };
      for (const t of targets) {
        const v = manager.list().find((s) => s.name === t);
        if (v?.transport !== "http") {
          return { text: `${t} is a local server and has no login.`, isError: true };
        }
      }
      for (const t of targets) manager.login(t).catch(() => {});
      await waitForLoginUrls(targets);
      const links = loginLinks(manager.list(), targets);
      return {
        text:
          `Started login for: ${targets.join(", ")}. A browser window should open; ` +
          "ask the user to complete it, then their tools will appear automatically. " +
          "Call manage_mcps to check status." +
          (links
            ? `\n\nIf no browser opened, open these login URLs for the user (or give them to them):\n${links}`
            : ""),
      };
    },
  };

  return [manage, authenticate];
}
