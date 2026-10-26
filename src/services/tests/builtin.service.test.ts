import { test } from "node:test";
import assert from "node:assert/strict";
import { createBuiltinTools, formatStatus, loginLinks } from "../builtin.service.js";
import type { ServerView } from "../manager.service.js";

const view = (o: Partial<ServerView> & { name: string }): ServerView => ({
  status: "connected", transport: "http", target: "t", tools: 3, toolsTotal: 3, resources: 0, prompts: 0, ...o,
});

test("formatStatus: summarises each status", () => {
  assert.equal(formatStatus([]), "No MCP servers configured.");
  const out = formatStatus([
    view({ name: "a" }),
    view({ name: "b", status: "needs_auth" }),
    view({ name: "c", status: "error", error: "boom" }),
  ]);
  assert.equal(out, "- a: connected (3 tools) — t\n- b: needs auth — t\n- c: error (boom) — t");
});

function setup(servers: ServerView[]) {
  const opened: string[] = [];
  const logins: string[] = [];
  const manager = {
    list: () => servers,
    needingLogin: () => servers.filter((s) => s.status === "needs_auth").map((s) => s.name),
    has: (n: string) => servers.some((s) => s.name === n),
    login: async (n: string) => void logins.push(n),
  };
  const tools = createBuiltinTools({ manager, manageUrl: async () => "http://127.0.0.1:1/tok/", loginUrlWaitMs: 0, open: (u) => void opened.push(u) });
  return { tools: Object.fromEntries(tools.map((t) => [t.name, t])), opened, logins };
}

test("formatStatus: shows enabled of total when tools are disabled", () => {
  assert.match(formatStatus([view({ name: "a", tools: 2, toolsTotal: 5 })]), /connected \(2 of 5 tools\)/);
});

test("manage_mcps: opens the URL and returns it with status; description lists pending logins", async () => {
  const { tools, opened } = setup([view({ name: "a" }), view({ name: "b", status: "needs_auth" })]);
  const out = await tools.manage_mcps.call({});
  assert.deepEqual(opened, ["http://127.0.0.1:1/tok/"]);
  assert.match(out.text, /http:\/\/127\.0\.0\.1:1\/tok\//);
  assert.match(out.text, /- b: needs auth — t/);
  assert.match(tools.manage_mcps.description(), /needing login: b/);
});

test("authenticate: no arg logs in to every server needing it", async () => {
  const { tools, logins } = setup([view({ name: "a" }), view({ name: "b", status: "needs_auth" }), view({ name: "c", status: "needs_auth" })]);
  const out = await tools.authenticate.call({});
  assert.deepEqual(logins, ["b", "c"]);
  assert.match(out.text, /Started login for: b, c/);
});

test("authenticate: named server, unknown server, local server, nothing to do", async () => {
  const { tools, logins } = setup([view({ name: "a", status: "error" }), view({ name: "loc", transport: "stdio" })]);
  assert.match((await tools.authenticate.call({ server: "a" })).text, /Started login for: a/);
  assert.deepEqual(logins, ["a"]);
  const unknown = await tools.authenticate.call({ server: "zzz" });
  assert.equal(unknown.isError, true);
  const local = await tools.authenticate.call({ server: "loc" });
  assert.equal(local.isError, true);
  assert.equal((await tools.authenticate.call({})).text, "No servers need login.");
});

test("loginLinks: lists only servers that expose a login URL", () => {
  const servers = [view({ name: "a", loginUrl: "https://x/auth" }), view({ name: "b" })];
  assert.equal(loginLinks(servers, ["a", "b"]), "- a: https://x/auth");
  assert.equal(loginLinks(servers, ["b"]), "");
});

test("manage_mcps: tells the agent to open the URL itself when no browser could be launched", async () => {
  const manager = { list: () => [], needingLogin: () => [], has: () => false, login: async () => {} };
  const [manage] = createBuiltinTools({ manager, manageUrl: async () => "http://127.0.0.1:1/tok/", open: () => false });
  const out = await manage.call({});
  assert.match(out.text, /Could not open a browser/);
  assert.match(out.text, /http:\/\/127\.0\.0\.1:1\/tok\//);
});

test("authenticate: includes the login URL once the provider exposes it", async () => {
  const servers = [view({ name: "r", status: "needs_auth" })];
  const manager = {
    list: () => servers,
    needingLogin: () => ["r"],
    has: () => true,
    login: async () => {
      servers[0] = view({ name: "r", status: "authenticating", loginUrl: "https://idp/authorize?x=1" });
    },
  };
  const tools = createBuiltinTools({ manager, manageUrl: async () => "u", loginUrlWaitMs: 500 });
  const out = await tools[1].call({});
  assert.match(out.text, /- r: https:\/\/idp\/authorize\?x=1/);
});
