import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTools } from "../tools.js";
import type { ToolsBackend } from "../../lib/tools-backend.js";

function backend(over: Partial<ToolsBackend> = {}): ToolsBackend {
  return {
    servers: async () => [{ name: "gmail", tools: [{ name: "search", description: "Find mail" }] }],
    namespace: async () => true,
    detail: async (_s, t) => ({ name: t, inputSchema: { type: "object" } }),
    call: async () => ({ raw: { r: 1 }, processed: { p: 1 }, durationMs: 1, changed: true }),
    problems: async () => ["coralogix: boom"],
    close: async () => {},
    ...over,
  };
}
const io = () => {
  const out: unknown[] = [];
  const errs: string[] = [];
  return { out, errs, io: { print: (v: unknown) => void out.push(v), err: (t: string) => void errs.push(t) } };
};

test("list prints public names", async () => {
  const c = io();
  assert.equal(await executeTools(backend(), { sub: "list", filters: ["mail"] }, {}, c.io), 0);
  assert.deepEqual(c.out, [["gmail__search"]]);
});

test("call prints the processed result, or raw with --raw; tool errors exit 1", async () => {
  let c = io();
  assert.equal(await executeTools(backend(), { sub: "call", tool: "gmail__search" }, {}, c.io), 0);
  assert.deepEqual(c.out, [{ p: 1 }]);
  c = io();
  await executeTools(backend(), { sub: "call", tool: "search", raw: true }, {}, c.io);
  assert.deepEqual(c.out, [{ r: 1 }]);
  c = io();
  const code = await executeTools(backend({ call: async () => ({ durationMs: 1, changed: false, error: "bad" }) }), { sub: "call", tool: "search" }, {}, c.io);
  assert.equal(code, 1);
  assert.match(c.errs[0], /bad/);
  c = io();
  assert.equal(await executeTools(backend({ call: async () => ({ processed: { isError: true }, durationMs: 1, changed: false }) }), { sub: "call", tool: "search" }, {}, c.io), 1);
});

test("an unknown tool explains which servers are not connected", async () => {
  await assert.rejects(executeTools(backend(), { sub: "call", tool: "nope" }, {}, io().io), /unknown tool "nope" \(not connected: coralogix: boom\)/);
});
