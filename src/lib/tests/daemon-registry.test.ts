import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daemonDir, entryFile, isAlive, parseEntry, readEntry, removeEntry, writeEntry, type DaemonEntry } from "../daemon-registry.js";

const entry: DaemonEntry = { pid: process.pid, url: "http://127.0.0.1:1/t/", configPath: "/c.json", configMtimeMs: 5, version: "1", kind: "daemon" };

test("entryFile is stable per config path and differs between configs", () => {
  assert.equal(entryFile("/d", "/a.json"), entryFile("/d", "/a.json"));
  assert.notEqual(entryFile("/d", "/a.json"), entryFile("/d", "/b.json"));
});

test("daemonDir honours BETTER_MCP_HOME", () => {
  assert.equal(daemonDir({ BETTER_MCP_HOME: "/h" }), join("/h", "daemons"));
});

test("parseEntry rejects malformed data", () => {
  assert.equal(parseEntry("nope"), undefined);
  assert.equal(parseEntry('{"pid":1}'), undefined);
  assert.deepEqual(parseEntry(JSON.stringify(entry)), entry);
});

test("write/read/remove round trip; removeEntry honours onlyPid", async () => {
  const file = entryFile(join(await mkdtemp(join(tmpdir(), "bm-reg-")), "daemons"), "/c.json");
  await writeEntry(file, entry);
  assert.deepEqual(await readEntry(file), entry);
  await removeEntry(file, process.pid + 1);
  assert.ok(await readEntry(file));
  await removeEntry(file, process.pid);
  assert.equal(await readEntry(file), undefined);
});

test("isAlive", () => {
  assert.equal(isAlive(process.pid), true);
  assert.equal(isAlive(2 ** 22 + 12345), false);
});
