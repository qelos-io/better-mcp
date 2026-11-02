import { test } from "node:test";
import assert from "node:assert/strict";
import { describeProblems, httpBackend, ping } from "../tools-backend.js";

function fakeFetch(routes: Record<string, unknown>, seen: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    const path = url.replace("http://h/t/api/", "");
    if (!(path in routes)) return new Response(JSON.stringify({ error: "nope" }), { status: 400 });
    return new Response(JSON.stringify(routes[path]), { status: 200 });
  }) as typeof fetch;
}

const views = [
  { name: "a", status: "connected" },
  { name: "b", status: "error", error: "boom" },
  { name: "c", status: "disabled" },
  { name: "d", status: "needs_auth" },
];

test("describeProblems lists unconnected, enabled servers with reasons", () => {
  assert.deepEqual(describeProblems(views as never), ["b: boom", "d: needs login (open the app)"]);
});

test("httpBackend.servers keeps connected servers and enabled tools only", async () => {
  const b = httpBackend("http://h/t", fakeFetch({
    state: { servers: views },
    "servers/a/tools": { tools: [{ name: "x", enabled: true }, { name: "y", enabled: false }] },
  }));
  assert.deepEqual(await b.servers(), [{ name: "a", tools: [{ name: "x", enabled: true }] }]);
});

test("httpBackend.call posts arguments with the CSRF header; errors surface", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const b = httpBackend("http://h/t/", fakeFetch({ "servers/s/tools/t%20x/call": { durationMs: 1, changed: false } }, seen));
  await b.call("s", "t x", { a: 1 });
  assert.equal(seen[0].init?.method, "POST");
  assert.equal((seen[0].init?.headers as Record<string, string>)["x-better-mcp"], "1");
  assert.equal(seen[0].init?.body, '{"arguments":{"a":1}}');
  await assert.rejects(b.detail("s", "missing"), /nope/);
});

test("ping is false on failure", async () => {
  assert.equal(await ping("http://h/t/", fakeFetch({ state: {} })), true);
  assert.equal(await ping("http://h/t/", (async () => { throw new Error("x"); }) as never), false);
});
