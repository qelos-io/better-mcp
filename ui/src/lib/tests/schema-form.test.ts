import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArgs, fieldsFromSchema, initialValues } from "../schema-form.js";
import { byteSize, formatBytes, prettyText, reduction, viewResult } from "../result.js";

const schema = {
  type: "object",
  required: ["query"],
  properties: {
    limit: { type: "integer", default: 10 },
    query: { type: "string", description: "What to find" },
    mode: { enum: ["fast", "deep"] },
    exact: { type: "boolean" },
    filters: { type: "object" },
    note: { type: ["string", "null"] },
  },
};

test("fieldsFromSchema: kinds, required first, nothing for schemas without properties", () => {
  const fields = fieldsFromSchema(schema)!;
  assert.deepEqual(fields.map((f) => f.name), ["query", "limit", "mode", "exact", "filters", "note"]);
  assert.deepEqual(fields.map((f) => f.kind), ["string", "integer", "enum", "boolean", "json", "string"]);
  assert.equal(fields[0].required, true);
  assert.deepEqual(fields[2].options, ["fast", "deep"]);
  assert.equal(fieldsFromSchema({ type: "object", properties: {} }), null);
  assert.equal(fieldsFromSchema({}), null);
  assert.equal(fieldsFromSchema(null), null);
});

test("buildArgs: coerces types, omits empty optionals, reports required and malformed values", () => {
  const fields = fieldsFromSchema(schema)!;
  const values = { ...initialValues(fields), query: " cats ", mode: "deep", filters: '{"a":1}' };
  assert.deepEqual(buildArgs(fields, values), { args: { query: " cats ", limit: 10, mode: "deep", filters: { a: 1 } }, errors: {} });

  const bad = buildArgs(fields, { ...initialValues(fields), limit: "1.5", filters: "{oops" });
  assert.deepEqual(bad.errors, { query: "Required.", limit: "Enter a whole number.", filters: "Enter valid JSON." });
  assert.equal(buildArgs(fields, { ...initialValues(fields), query: "q", limit: "abc" }).errors.limit, "Enter a number.");
});

test("buildArgs: booleans are sent when checked or required", () => {
  const optional = fieldsFromSchema({ properties: { a: { type: "boolean" } } })!;
  assert.deepEqual(buildArgs(optional, { a: false }).args, {});
  assert.deepEqual(buildArgs(optional, { a: true }).args, { a: true });
  const required = fieldsFromSchema({ required: ["a"], properties: { a: { type: "boolean" } } })!;
  assert.deepEqual(buildArgs(required, { a: false }).args, { a: false });
});

test("result helpers: sizes, reduction label, pretty text and MCP content views", () => {
  assert.equal(byteSize({ a: "é" }), 10);
  assert.equal(byteSize(undefined), 0);
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
  assert.equal(reduction(1000, 280), "−72%");
  assert.equal(reduction(100, 130), "+30%");
  assert.equal(reduction(100, 100), "same size");
  assert.equal(reduction(0, 5), "same size");
  assert.equal(prettyText('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(prettyText("plain text"), "plain text");
  assert.equal(prettyText("{not json"), "{not json");
  const v = viewResult({ isError: true, content: [{ type: "text", text: '{"x":1}' }, { type: "image", mimeType: "image/png" }, { type: "resource", resource: { uri: "file:///a" } }] });
  assert.equal(v.isError, true);
  assert.deepEqual(v.blocks, [
    { kind: "text", text: '{\n  "x": 1\n}' },
    { kind: "other", label: "Image (image/png)" },
    { kind: "other", label: "Resource file:///a" },
  ]);
  assert.deepEqual(viewResult(undefined), { isError: false, blocks: [] });
});
