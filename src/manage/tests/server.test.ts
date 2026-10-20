import { test } from "node:test";
import assert from "node:assert/strict";
import { UpstreamManager } from "../../services/manager.service.js";
import type { UpstreamServer } from "../../services/upstream.service.js";
import { ManageServer, isLocalHost } from "../server.js";

function fake(name: string): UpstreamServer {
  return { name, tools: [], resources: [], prompts: [], close: async () => {} } as unknown as UpstreamServer;
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
