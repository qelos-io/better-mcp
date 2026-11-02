import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTool, listToolNames, parseCallArgs, resolveCallTool } from "../call-args.js";

test("parseCallArgs: empty input means no arguments", () => {
  assert.deepEqual(parseCallArgs(undefined), {});
  assert.deepEqual(parseCallArgs("  \n"), {});
});

test("parseCallArgs: parses an object, tolerating surrounding whitespace", () => {
  assert.deepEqual(parseCallArgs('\n{"argA": 5}\n'), { argA: 5 });
});

test("parseCallArgs: rejects invalid JSON and non-objects", () => {
  assert.throws(() => parseCallArgs("{nope"), /not valid JSON/);
  assert.throws(() => parseCallArgs("[1]"), /JSON object/);
  assert.throws(() => parseCallArgs("5"), /JSON object/);
  assert.throws(() => parseCallArgs("null"), /JSON object/);
});

const servers = [
  { name: "a", tools: [{ name: "get" }, { name: "only_a" }] },
  { name: "b", tools: [{ name: "get" }] },
];

test("resolveCallTool: public namespaced name", () => {
  const r = resolveCallTool(servers, true, "b__get");
  assert.equal(r.server.name, "b");
  assert.equal(r.tool, "get");
});

test("resolveCallTool: bare name works when unique, errors when ambiguous", () => {
  assert.equal(resolveCallTool(servers, true, "only_a").server.name, "a");
  assert.throws(() => resolveCallTool(servers, true, "get"), /ambiguous.*a__get, b__get/);
});

test("resolveCallTool: without namespacing the bare name is the public name", () => {
  assert.equal(resolveCallTool([servers[0]], false, "only_a").tool, "only_a");
});

test("resolveCallTool: unknown tool", () => {
  assert.throws(() => resolveCallTool(servers, true, "nope"), /unknown tool "nope"/);
});

test("describeTool: public name, description and schema", () => {
  const t = { name: "get", description: "Gets", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } };
  assert.deepEqual(describeTool("a", t, true), {
    name: "a__get",
    server: "a",
    description: "Gets",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  });
  const bare = describeTool("a", { name: "get", inputSchema: {} }, false);
  assert.equal(bare.name, "get");
  assert.equal(bare.description, "");
  assert.ok(!("annotations" in bare));
});

test("listToolNames: public names, sorted", () => {
  assert.deepEqual(listToolNames(servers, true), ["a__get", "a__only_a", "b__get"]);
  assert.deepEqual(listToolNames([servers[0]], false), ["get", "only_a"]);
});

test("listToolNames: filters match name or description, case-insensitively, any-of", () => {
  const svs = [
    { name: "gh", tools: [{ name: "get_issue", description: "Read an Issue" }, { name: "merge", description: "Merge a PR" }] },
    { name: "jira", tools: [{ name: "search", description: "Find tickets" }] },
  ];
  assert.deepEqual(listToolNames(svs, true, ["ISSUE"]), ["gh__get_issue"]);
  assert.deepEqual(listToolNames(svs, true, ["tickets"]), ["jira__search"]);
  assert.deepEqual(listToolNames(svs, true, ["jira", "merge"]), ["gh__merge", "jira__search"]);
  assert.deepEqual(listToolNames(svs, true, ["zzz"]), []);
  assert.equal(listToolNames(svs, true).length, 3);
});
