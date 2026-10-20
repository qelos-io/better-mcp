import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCatalog, parseCatalog } from "../catalog.js";

const good = { id: "a", name: "A", description: "d", category: "c", homepage: "https://e.com", config: { command: "x" } };

test("parseCatalog: drops malformed entries and fills defaults", () => {
  const out = parseCatalog([good, { id: "b" }, null, { ...good, id: "c", config: {} }, "x"]);
  assert.deepEqual(out.map((e) => e.id), ["a"]);
  assert.deepEqual([out[0].logo, out[0].tags, out[0].setup], [null, [], null]);
  assert.deepEqual(parseCatalog({ not: "array" }), []);
});

test("loadCatalog: uses the remote when it answers", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify([good]))) as typeof fetch;
  assert.deepEqual((await loadCatalog({ url: "https://x", fetchImpl })).source, "remote");
});

test("loadCatalog: falls back to the bundled file on network or HTTP failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-cat-"));
  const bundledPath = join(dir, "servers.json");
  await writeFile(bundledPath, JSON.stringify([good]));
  const boom = (async () => { throw new Error("offline"); }) as typeof fetch;
  const notFound = (async () => new Response("no", { status: 404 })) as typeof fetch;
  for (const fetchImpl of [boom, notFound]) {
    const c = await loadCatalog({ url: "https://x", fetchImpl, bundledPath });
    assert.equal(c.source, "bundled");
    assert.equal(c.entries.length, 1);
  }
});

test("loadCatalog: url=false never fetches; nothing available → none", async () => {
  const fetchImpl = (async () => { throw new Error("must not fetch"); }) as typeof fetch;
  assert.deepEqual(await loadCatalog({ url: false, fetchImpl }), { entries: [], source: "none" });
});
