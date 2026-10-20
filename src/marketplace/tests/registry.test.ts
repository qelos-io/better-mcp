import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRegistry, validateEntry } from "../registry.js";

const good = {
  id: "demo",
  name: "Demo",
  description: "d",
  category: "c",
  homepage: "https://example.com",
  config: { command: "npx", args: ["-y", "demo"] },
};

test("validateEntry: accepts a minimal stdio entry and a url entry", () => {
  assert.deepEqual(validateEntry(good), []);
  assert.deepEqual(validateEntry({ ...good, config: { url: "https://x/mcp", headers: { A: "b" } } }), []);
});

test("validateEntry: rejects bad id, http homepage, bad logo", () => {
  const errs = validateEntry({ ...good, id: "Bad Id", homepage: "http://x", logo: "nope" });
  assert.ok(errs.some((e) => e.startsWith("id")));
  assert.ok(errs.some((e) => e.startsWith("homepage")));
  assert.ok(errs.some((e) => e.startsWith("logo")));
});

test("validateEntry: config needs exactly one of command/url", () => {
  assert.ok(validateEntry({ ...good, config: {} }).some((e) => /exactly one/.test(e)));
  assert.ok(validateEntry({ ...good, config: { command: "x", url: "https://y" } }).some((e) => /exactly one/.test(e)));
  assert.ok(validateEntry({ ...good, config: { url: "http://y" } }).some((e) => /https/.test(e)));
});

test("validateEntry: env/args/tags type checks", () => {
  const errs = validateEntry({ ...good, tags: [1], config: { command: "x", args: [1], env: { A: 1 } } });
  assert.ok(errs.some((e) => e.startsWith("tags")));
  assert.ok(errs.some((e) => e.startsWith("config.args")));
  assert.ok(errs.some((e) => e.startsWith("config.env")));
});

test("parseRegistry: sorts by name and reports duplicates with all problems", () => {
  const yaml = (ids: string[]) =>
    "servers:\n" +
    ids
      .map((i) => `  - {id: ${i}, name: ${i.toUpperCase()}, description: d, category: c, homepage: "https://e.com", config: {command: x}}`)
      .join("\n");
  assert.deepEqual(parseRegistry(yaml(["b", "a"])).map((e) => e.id), ["a", "b"]);
  assert.throws(() => parseRegistry(yaml(["a", "a"])), /a: duplicate id/);
  assert.throws(() => parseRegistry("nope: 1"), /servers:/);
});

test("marketplace/servers.yaml is valid", async () => {
  const text = await readFile(new URL("../../../marketplace/servers.yaml", import.meta.url), "utf8");
  assert.ok(parseRegistry(text).length > 0);
});
