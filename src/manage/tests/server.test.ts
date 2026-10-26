import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { UpstreamManager } from "../../services/manager.service.js";
import type { UpstreamServer } from "../../services/upstream.service.js";
import { ManageServer, isLocalHost } from "../server.js";

function fake(name: string): UpstreamServer {
  const tools = [{ server: name, name: "t0", description: "d", inputSchema: {} }];
  const s = {
    name,
    allTools: tools,
    disabledTools: new Set<string>(),
    get tools() {
      return s.allTools.filter((t) => !s.disabledTools.has(t.name));
    },
    resources: [],
    prompts: [],
    close: async () => {},
  };
  return s as unknown as UpstreamServer;
}

async function uiDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "bm-ui-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>better-mcp</title>");
  await writeFile(join(dir, "assets", "app.js"), "console.log(1)");
  return dir;
}

async function start(persistent = true) {
  const manager = new UpstreamManager(
    { a: { command: "x" } },
    { connect: async (n) => fake(n), save: async () => {} },
  );
  await manager.start();
  const server = new ManageServer({
    manager,
    persistent,
    uiDir: await uiDir(),
    catalog: async () => ({ entries: [], source: "none" }),
  });
  const url = await server.ensureStarted();
  return { manager, server, url };
}

const H = { "x-better-mcp": "1", "content-type": "application/json" };

test("isLocalHost accepts only loopback host:port", () => {
  assert.equal(isLocalHost("127.0.0.1:5", 5), true);
  assert.equal(isLocalHost("localhost:5", 5), true);
  assert.equal(isLocalHost("evil.com:5", 5), false);
  assert.equal(isLocalHost("127.0.0.1:6", 5), false);
  assert.equal(isLocalHost(undefined, 5), false);
});

test("ensureStarted is idempotent and the page is served under the token", async () => {
  const { server, url } = await start();
  try {
    assert.equal(await server.ensureStarted(), url);
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<title>better-mcp<\/title>/);
  } finally {
    await server.close();
  }
});

test("wrong or missing token is 404; wrong Host header is 403", async () => {
  const { server, url } = await start();
  try {
    const base = new URL(url);
    assert.equal((await fetch(`${base.origin}/nope/api/state`)).status, 404);
    assert.equal((await fetch(`${base.origin}/`)).status, 404);
    const { statusCode } = await new Promise<{ statusCode?: number }>((resolve, reject) => {
      import("node:http").then(({ request }) => {
        const r = request({ host: "127.0.0.1", port: base.port, path: base.pathname + "api/state", headers: { host: "evil.com" } }, (res) => {
          res.resume();
          resolve({ statusCode: res.statusCode });
        });
        r.on("error", reject);
        r.end();
      });
    });
    assert.equal(statusCode, 403);
  } finally {
    await server.close();
  }
});

test("GET api/state lists servers; mutations require the custom header", async () => {
  const { server, url } = await start(false);
  try {
    const state = await (await fetch(url + "api/state")).json();
    assert.equal(state.persistent, false);
    assert.deepEqual(state.servers.map((s: { name: string }) => s.name), ["a"]);
    const noHeader = await fetch(url + "api/servers", { method: "POST", body: "{}" });
    assert.equal(noHeader.status, 403);
  } finally {
    await server.close();
  }
});

test("POST api/servers adds; bad input is a 400 with the message", async () => {
  const { server, url, manager } = await start();
  try {
    const ok = await fetch(url + "api/servers", { method: "POST", headers: H, body: JSON.stringify({ name: "b", config: { command: "y" } }) });
    assert.equal(ok.status, 201);
    assert.equal(manager.has("b"), true);
    const bad = await fetch(url + "api/servers", { method: "POST", headers: H, body: JSON.stringify({ name: "c", config: {} }) });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /exactly one/);
    assert.equal((await fetch(url + "api/servers", { method: "POST", headers: H, body: "{" })).status, 400);
  } finally {
    await server.close();
  }
});

test("disable / enable / reconnect / delete via the API", async () => {
  const { server, url, manager } = await start();
  try {
    const post = (p: string) => fetch(url + "api/servers/a/" + p, { method: "POST", headers: H });
    assert.equal((await post("disable")).status, 200);
    assert.equal(manager.list()[0].status, "disabled");
    assert.equal((await post("enable")).status, 200);
    assert.equal(manager.list()[0].status, "connected");
    assert.equal((await post("reconnect")).status, 200);
    assert.equal((await fetch(url + "api/servers/a", { method: "DELETE", headers: H })).status, 200);
    assert.equal(manager.has("a"), false);
    assert.equal((await fetch(url + "api/servers/a", { method: "DELETE", headers: H })).status, 400);
  } finally {
    await server.close();
  }
});

test("login: local servers are rejected; remote servers get 202", async () => {
  const manager = new UpstreamManager(
    { loc: { command: "x" }, rem: { url: "https://r/mcp" } },
    { connect: async (n) => fake(n) },
  );
  await manager.start();
  const server = new ManageServer({ manager, persistent: true, catalog: async () => ({ entries: [], source: "none" }) });
  const url = await server.ensureStarted();
  try {
    const login = (n: string) => fetch(url + `api/servers/${n}/login`, { method: "POST", headers: H });
    assert.equal((await login("loc")).status, 400);
    assert.equal((await login("rem")).status, 202);
  } finally {
    await server.close();
  }
});

test("GET api/catalog returns the catalog", async () => {
  const { server, url } = await start();
  try {
    assert.deepEqual(await (await fetch(url + "api/catalog")).json(), { entries: [], source: "none" });
  } finally {
    await server.close();
  }
});

test("tools API: list, disable and enable a server's tools; bad bodies are 400", async () => {
  const { server, url, manager } = await start();
  try {
    const get = async () => (await (await fetch(url + "api/servers/a/tools")).json()) as { tools: { name: string; enabled: boolean }[] };
    assert.deepEqual((await get()).tools.map((t) => [t.name, t.enabled]), [["t0", true]]);
    const post = (body: unknown) => fetch(url + "api/servers/a/tools", { method: "POST", headers: H, body: JSON.stringify(body) });
    assert.equal((await post({ tools: ["t0"], enabled: false })).status, 200);
    assert.equal(manager.list()[0].tools, 0);
    assert.equal((await get()).tools[0].enabled, false);
    assert.equal((await post({ tools: "t0", enabled: true })).status, 400);
    assert.equal((await post({ tools: ["zzz"], enabled: true })).status, 400);
    assert.equal((await post({ tools: ["t0"], enabled: true })).status, 200);
  } finally {
    await server.close();
  }
});

test("static: serves assets with a content type, refuses traversal, 503 when the UI is not built", async () => {
  const { server, url } = await start();
  try {
    const js = await fetch(url + "assets/app.js");
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type") ?? "", /javascript/);
    assert.equal((await fetch(url + "assets/missing.js")).status, 404);
    assert.equal((await fetch(url + "%2e%2e/%2e%2e/etc/passwd")).status, 404);
  } finally {
    await server.close();
  }
  const manager = new UpstreamManager({}, { save: async () => {} });
  const bare = new ManageServer({ manager, persistent: true, uiDir: "/nonexistent-ui-dir", catalog: async () => ({ entries: [], source: "none" }) });
  const bareUrl = await bare.ensureStarted();
  try {
    const res = await fetch(bareUrl);
    assert.equal(res.status, 503);
    assert.match(await res.text(), /not built/);
  } finally {
    await bare.close();
  }
});
