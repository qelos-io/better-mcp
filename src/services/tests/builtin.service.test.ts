import { test } from "node:test";
import assert from "node:assert/strict";
import { createBuiltinTools, formatStatus } from "../builtin.service.js";
import type { ServerView } from "../manager.service.js";

const view = (o: Partial<ServerView> & { name: string }): ServerView => ({
  status: "connected", transport: "http", target: "t", tools: 3, resources: 0, prompts: 0, ...o,
});

test("formatStatus: summarises each status", () => {
  assert.equal(formatStatus([]), "No MCP servers configured.");
  const out = formatStatus([
    view({ name: "a" }),
    view({ name: "b", status: "needs_auth" }),
    view({ name: "c", status: "error", error: "boom" }),
  ]);
  assert.equal(out, "- a: connected (3 tools)\n- b: needs auth\n- c: error (boom)");
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
  const tools = createBuiltinTools({ manager, manageUrl: async () => "http://127.0.0.1:1/tok/", open: (u) => void opened.push(u) });
  return { tools: Object.fromEntries(tools.map((t) => [t.name, t])), opened, logins };
}

test("manage_mcps: opens the URL and returns it with status; description lists pending logins", async () => {
  const { tools, opened } = setup([view({ name: "a" }), view({ name: "b", status: "needs_auth" })]);
  const out = await tools.manage_mcps.call({});
  assert.deepEqual(opened, ["http://127.0.0.1:1/tok/"]);
  assert.match(out.text, /http:\/\/127\.0\.0\.1:1\/tok\//);
  assert.match(out.text, /- b: needs auth/);
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
