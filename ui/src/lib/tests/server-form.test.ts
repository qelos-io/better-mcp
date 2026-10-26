import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfig, emptyForm, formFromConfig, parsePairs, validateName } from "../server-form.js";

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
