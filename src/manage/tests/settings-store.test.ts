import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileSettingsStore, readOnlySettingsStore } from "../settings-store.js";

test("fileSettingsStore: writes only the patched keys and leaves servers and auth alone", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-settings-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: { a: { command: "x" } }, auth: { k: { tokens: 1 } } }));
  const store = fileSettingsStore(path);
  await store.write!({ namespace: false, redact: ["token"] });
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(saved, { mcpServers: { a: { command: "x" } }, auth: { k: { tokens: 1 } }, namespace: false, middleware: { redact: ["token"] } });
  assert.deepEqual((await store.read()).namespace, false);
});

test("fileSettingsStore: an invalid patch leaves the file untouched", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-settings-"));
  const path = join(dir, "mcp.json");
  const text = JSON.stringify({ mcpServers: {} });
  await writeFile(path, text);
  await assert.rejects(fileSettingsStore(path).write!({ dedup: { ttlSeconds: "x" } }), /ttlSeconds/);
  assert.equal(await readFile(path, "utf8"), text);
});

test("readOnlySettingsStore: reads the given config and cannot write", async () => {
  const store = readOnlySettingsStore({ namespace: false });
  assert.deepEqual(await store.read(), { namespace: false });
  assert.equal(store.write, undefined);
});
