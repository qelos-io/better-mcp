import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, emptyForm, formFromConfig, isValidUrl, mergeConfig, parsePairs, validateName } from "../server-form.js";

test("validateName: required, charset, no double underscore, unique", () => {
  assert.equal(validateName("github", ["a"]), null);
  assert.match(validateName("", [])!, /name/);
  assert.match(validateName("-x", [])!, /letters, digits/);
  assert.match(validateName("a b", [])!, /letters, digits/);
  assert.match(validateName("a__b", [])!, /__/);
  assert.match(validateName("github", ["github"])!, /already exists/);
});

test("parsePairs: KEY=value and Header: value lines; the first bad line is reported", () => {
  assert.deepEqual(parsePairs("A=1\n\n B = two=2 ", "=").values, { A: "1", B: "two=2" });
  assert.deepEqual(parsePairs("Authorization: Bearer x", ":").values, { Authorization: "Bearer x" });
  assert.match(parsePairs("ok=1\nnope", "=").error!, /Line 2/);
  assert.match(parsePairs("=x", "=").error!, /Line 1/);
});

test("buildConfig: local servers need a command; args one per line; env parsed", () => {
  assert.deepEqual(buildConfig({ ...emptyForm(), command: "npx" }).config, { command: "npx" });
  assert.deepEqual(buildConfig({ ...emptyForm(), command: " npx ", args: "-y\n@x/y\n", env: "K=v" }).config, { command: "npx", args: ["-y", "@x/y"], env: { K: "v" } });
  assert.match(buildConfig(emptyForm()).errors.command!, /command/);
  assert.match(buildConfig({ ...emptyForm(), command: "x", env: "bad" }).errors.env!, /Line 1/);
});

test("buildConfig: remote servers need an http(s) URL; headers parsed", () => {
  assert.deepEqual(buildConfig({ ...emptyForm("remote"), url: "https://a.example/mcp", headers: "X-Key: 1" }).config, { url: "https://a.example/mcp", headers: { "X-Key": "1" } });
  assert.match(buildConfig({ ...emptyForm("remote"), url: "example.com" }).errors.url!, /full http/);
  assert.match(buildConfig({ ...emptyForm("remote"), url: "ftp://x.y" }).errors.url!, /full http/);
});

test("formFromConfig: round-trips through buildConfig", () => {
  const local = { command: "npx", args: ["-y", "pkg"], env: { K: "v" } };
  assert.deepEqual(buildConfig(formFromConfig("n", local)).config, local);
  const remote = { url: "https://a.example/mcp", headers: { Authorization: "Bearer ${TOKEN}" } };
  assert.deepEqual(buildConfig(formFromConfig("n", remote)).config, remote);
  assert.equal(formFromConfig("n", remote).kind, "remote");
});

test("isValidUrl: http(s) addresses and ${VAR} placeholders are accepted", () => {
  assert.equal(isValidUrl("https://a.example/mcp"), true);
  assert.equal(isValidUrl("${COMPOSIO_MCP_URL}"), true);
  assert.equal(isValidUrl("https://${HOST}/mcp"), true);
  assert.equal(isValidUrl("example.com"), false);
  assert.equal(isValidUrl("ftp://a.b"), false);
  assert.equal(isValidUrl(""), false);
});

test("mergeConfig: keeps fields the form does not edit and replaces the ones it does", () => {
  const base = { url: "https://old/mcp", oauth: false as const, headers: { A: "1" }, cwd: "/x", disabledTools: ["t"] };
  assert.deepEqual(mergeConfig(base, { command: "npx" }), { oauth: false, cwd: "/x", disabledTools: ["t"], command: "npx" });
  assert.deepEqual(mergeConfig(base, { url: "https://new/mcp" }), { oauth: false, cwd: "/x", disabledTools: ["t"], url: "https://new/mcp" });
  assert.deepEqual(mergeConfig(null, { command: "x" }), { command: "x" });
});

test("marketplace round trip: every bundled catalog entry survives form edit unchanged", async () => {
  const { readFileSync } = await import("node:fs");
  const entries = JSON.parse(readFileSync(new URL("../../../../docs/marketplace/servers.json", import.meta.url), "utf8")) as { id: string; config: import("../../../../src/types/index.js").McpServerConfig }[];
  for (const e of entries) {
    const built = buildConfig(formFromConfig(e.id, e.config));
    assert.deepEqual(built.errors, {}, e.id);
    assert.deepEqual(mergeConfig(e.config, built.config!), e.config, e.id);
  }
});
