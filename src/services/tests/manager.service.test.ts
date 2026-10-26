import { test } from "node:test";
import assert from "node:assert/strict";
import type { McpServerConfig } from "../../types/index.js";
import { UpstreamManager, describeError } from "../manager.service.js";
import { NeedsAuthError, type UpstreamServer } from "../upstream.service.js";

function fakeServer(name: string, tools = 2): UpstreamServer & { closed: boolean } {
  const s = {
    name,
    closed: false,
    tools: Array.from({ length: tools }, (_, i) => ({ server: name, name: `t${i}`, inputSchema: {} })),
    resources: [],
    prompts: [],
    async close() {
      s.closed = true;
    },
  };
  return s as unknown as UpstreamServer & { closed: boolean };
}

interface Harness {
  manager: UpstreamManager;
  saved: Record<string, McpServerConfig>[];
  calls: { name: string; interactive: boolean }[];
  made: Map<string, ReturnType<typeof fakeServer>>;
}

/** `auth` servers throw NeedsAuthError until connected interactively. */
function harness(servers: Record<string, McpServerConfig>, opts: { failSave?: boolean; broken?: string[] } = {}): Harness {
  const saved: Harness["saved"] = [];
  const calls: Harness["calls"] = [];
  const made: Harness["made"] = new Map();
  const manager = new UpstreamManager(servers, {
    expand: (c) => JSON.parse(JSON.stringify(c).replaceAll("${TOKEN}", "secret")),
    async connect(name, cfg, o) {
      const interactive = o.interactive === true;
      calls.push({ name, interactive });
      if (opts.broken?.includes(name)) throw new Error("boom");
      if (cfg.url && name.startsWith("auth") && !interactive) throw new NeedsAuthError(name);
      const s = fakeServer(name);
      made.set(name, s);
      return s;
    },
    async save(s) {
      if (opts.failSave) throw new Error("disk full");
      saved.push(structuredClone(s));
    },
  });
  return { manager, saved, calls, made };
}

const stdio = { command: "x" };
const remote = { url: "https://a/mcp" };

test("start: connects enabled servers non-interactively and classifies failures", async () => {
  const h = harness({ a: stdio, authy: remote, bad: stdio, off: { ...stdio, enabled: false } }, { broken: ["bad"] });
  await h.manager.start();
  const byName = Object.fromEntries(h.manager.list().map((v) => [v.name, v]));
  assert.equal(byName.a.status, "connected");
  assert.equal(byName.a.tools, 2);
  assert.equal(byName.authy.status, "needs_auth");
  assert.equal(byName.bad.status, "error");
  assert.equal(byName.bad.error, "boom");
  assert.equal(byName.off.status, "disabled");
  assert.ok(h.calls.every((c) => !c.interactive));
  assert.ok(!h.calls.some((c) => c.name === "off"));
  assert.deepEqual(h.manager.needingLogin(), ["authy"]);
  assert.deepEqual(h.manager.upstreams.map((u) => u.name), ["a"]);
});

test("login: flips to authenticating synchronously, then connected; upstreams updated in place", async () => {
  const h = harness({ authy: remote });
  await h.manager.start();
  const live = h.manager.upstreams;
  assert.equal(live.length, 0);
  const p = h.manager.login("authy");
  assert.equal(h.manager.list()[0].status, "authenticating");
  await p;
  assert.equal(h.manager.list()[0].status, "connected");
  assert.equal(h.manager.upstreams, live, "same array instance");
  assert.deepEqual(live.map((u) => u.name), ["authy"]);
  assert.ok(h.calls.at(-1)!.interactive);
});

test("login: rejects for stdio and unknown servers", async () => {
  const h = harness({ a: stdio });
  await assert.rejects(h.manager.login("a"), /no login/);
  await assert.rejects(h.manager.login("zzz"), /unknown server/);
});

test("onChange fires on status changes; unsubscribe stops it", async () => {
  const h = harness({ a: stdio });
  let n = 0;
  const off = h.manager.onChange(() => n++);
  await h.manager.start();
  assert.ok(n > 0);
  const seen = n;
  off();
  await h.manager.reconnect("a");
  assert.equal(n, seen);
});

test("a throwing listener does not break the manager", async () => {
  const h = harness({ a: stdio });
  h.manager.onChange(() => {
    throw new Error("bad listener");
  });
  await h.manager.start();
  assert.equal(h.manager.list()[0].status, "connected");
});

test("add: validates, persists RAW config (placeholders kept), connects with expanded config", async () => {
  const h = harness({});
  await h.manager.add("gh", { command: "npx", env: { TOKEN: "${TOKEN}" } });
  assert.deepEqual(h.saved.at(-1), { gh: { command: "npx", env: { TOKEN: "${TOKEN}" } } });
  assert.equal(h.manager.list()[0].status, "connected");
  await assert.rejects(h.manager.add("gh", stdio), /already exists/);
  await assert.rejects(h.manager.add("bad name", stdio), /name must/);
  await assert.rejects(h.manager.add("a__b", stdio), /'__'/);
  await assert.rejects(h.manager.add("nocfg", {}), /exactly one/);
});

test("add: rolls back when saving fails", async () => {
  const h = harness({}, { failSave: true });
  await assert.rejects(h.manager.add("x", stdio), /disk full/);
  assert.equal(h.manager.has("x"), false);
});

test("remove: closes the server, persists, drops it from upstreams", async () => {
  const h = harness({ a: stdio, b: stdio });
  await h.manager.start();
  await h.manager.remove("a");
  assert.equal(h.made.get("a")!.closed, true);
  assert.deepEqual(h.saved.at(-1), { b: stdio });
  assert.deepEqual(h.manager.upstreams.map((u) => u.name), ["b"]);
  await assert.rejects(h.manager.remove("a"), /unknown server/);
});

test("remove: restores the entry when saving fails", async () => {
  const h = harness({ a: stdio }, { failSave: true });
  await h.manager.start();
  await assert.rejects(h.manager.remove("a"), /disk full/);
  assert.equal(h.manager.has("a"), true);
  assert.equal(h.manager.list()[0].status, "connected");
});

test("setEnabled: disable closes + persists enabled:false; enable reconnects", async () => {
  const h = harness({ a: stdio });
  await h.manager.start();
  await h.manager.setEnabled("a", false);
  assert.equal(h.manager.list()[0].status, "disabled");
  assert.equal(h.made.get("a")!.closed, true);
  assert.deepEqual(h.saved.at(-1), { a: { command: "x", enabled: false } });
  assert.equal(h.manager.upstreams.length, 0);
  await h.manager.setEnabled("a", true);
  assert.equal(h.manager.list()[0].status, "connected");
  assert.equal(h.manager.upstreams.length, 1);
});

test("reconnect: closes the old connection before replacing it", async () => {
  const h = harness({ a: stdio });
  await h.manager.start();
  const first = h.made.get("a")!;
  await h.manager.reconnect("a");
  assert.equal(first.closed, true);
  assert.notEqual(h.made.get("a"), first);
});

test("close: closes everything and empties upstreams", async () => {
  const h = harness({ a: stdio, b: stdio });
  await h.manager.start();
  await h.manager.close();
  assert.ok([...h.made.values()].every((s) => s.closed));
  assert.equal(h.manager.upstreams.length, 0);
});

test("login: loginUrl is exposed while authenticating and cleared afterwards", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const manager = new UpstreamManager(
    { authy: { url: "https://a/mcp" } },
    {
      async connect(name, _cfg, o) {
        o.onLoginUrl?.("https://auth.example/authorize?x=1");
        await gate;
        return fakeServer(name);
      },
    },
  );
  const p = manager.login("authy");
  await new Promise((r) => setImmediate(r));
  assert.equal(manager.list()[0].loginUrl, "https://auth.example/authorize?x=1");
  release();
  await p;
  assert.equal(manager.list()[0].status, "connected");
  assert.equal(manager.list()[0].loginUrl, undefined);
});

test("describeError surfaces the network cause behind 'fetch failed'", () => {
  const err = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
  assert.equal(describeError(err), "fetch failed (ECONNREFUSED)");
  const dns = new TypeError("fetch failed", { cause: { code: "ENOTFOUND", hostname: "x.example" } });
  assert.equal(describeError(dns), "fetch failed (ENOTFOUND x.example)");
  assert.equal(describeError(new Error("boom")), "boom");
  assert.equal(describeError("x"), "x");
});

test("login: finishing is exposed after the browser returns, and hides the login link", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const manager = new UpstreamManager(
    { authy: { url: "https://a/mcp" } },
    {
      async connect(name, _cfg, o) {
        o.onLoginUrl?.("https://auth.example/authorize");
        o.onLoginCode?.();
        await gate;
        return fakeServer(name);
      },
    },
  );
  const p = manager.login("authy");
  await new Promise((r) => setImmediate(r));
  const view = manager.list()[0];
  assert.equal(view.status, "authenticating");
  assert.equal(view.finishing, true);
  assert.equal(view.loginUrl, undefined);
  release();
  await p;
  assert.equal(manager.list()[0].finishing, undefined);
});
