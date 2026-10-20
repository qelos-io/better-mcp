import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveServers } from "../writer.js";

test("saveServers: replaces mcpServers, keeps other keys, leaves no temp file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: { old: { command: "x" } }, namespace: false, middleware: { log: true } }));
  await saveServers(path, { fresh: { url: "https://a/mcp" } });
  const got = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(got, { mcpServers: { fresh: { url: "https://a/mcp" } }, namespace: false, middleware: { log: true } });
  assert.deepEqual(await readdir(dir), ["mcp.json"]);
});

test("saveServers: rejects when the file is missing or not JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  await assert.rejects(saveServers(join(dir, "nope.json"), {}));
  await writeFile(join(dir, "bad.json"), "{");
  await assert.rejects(saveServers(join(dir, "bad.json"), {}));
});

test("saveServers: falls back to an in-place write when rename fails (bind-mounted file)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: {}, namespace: true }));
  const busy = (async () => {
    throw Object.assign(new Error("busy"), { code: "EBUSY" });
  }) as unknown as typeof import("node:fs/promises").rename;
  await saveServers(path, { a: { command: "x" } }, busy);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { mcpServers: { a: { command: "x" } }, namespace: true });
  assert.deepEqual(await readdir(dir), ["mcp.json"]);
});

import { updateConfigFile } from "../writer.js";

test("updateConfigFile: concurrent updates are serialized and none is lost", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: {} }));
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      updateConfigFile(path, (raw) => {
        const auth = ((raw.auth as Record<string, number>) ??= {});
        auth[`k${i}`] = i;
      }),
    ),
  );
  const got = JSON.parse(await readFile(path, "utf8"));
  assert.equal(Object.keys(got.auth).length, 20);
});

test("updateConfigFile: a failed update doesn't block later ones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, "{}");
  await assert.rejects(updateConfigFile(path, () => { throw new Error("nope"); }), /nope/);
  await updateConfigFile(path, (raw) => void (raw.ok = true));
  assert.equal(JSON.parse(await readFile(path, "utf8")).ok, true);
});

test("saveServers keeps the auth section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-writer-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: {}, auth: { s: { tokens: { access_token: "t" } } } }));
  await saveServers(path, { a: { command: "x" } });
  assert.equal(JSON.parse(await readFile(path, "utf8")).auth.s.tokens.access_token, "t");
});
