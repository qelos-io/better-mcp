import { test } from "node:test";
import assert from "node:assert/strict";
import { MiddlewarePipeline } from "../../middleware/pipeline.js";
import { runTool, type RunnableServer } from "../run-tool.service.js";

const server = (call: (req: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>): RunnableServer => ({
  name: "s",
  allTools: [{ name: "echo" }],
  client: { callTool: call },
});

test("runTool: returns the raw upstream response and the pipeline-processed one", async () => {
  const pipeline = await MiddlewarePipeline.build({ cleantext: true, compact: true }, "/tmp");
  const calls: unknown[] = [];
  const res = await runTool(
    {
      pipeline,
      server: server(async (req) => {
        calls.push(req);
        return { content: [{ type: "text", text: JSON.stringify({ a: 1, b: null }, null, 2) }] };
      }),
    },
    "echo",
    { q: "x" },
  );
  assert.deepEqual(calls, [{ name: "echo", arguments: { q: "x" } }]);
  assert.equal((res.raw as { content: { text: string }[] }).content[0].text, '{\n  "a": 1,\n  "b": null\n}');
  assert.equal((res.processed as { content: { text: string }[] }).content[0].text, '{"a":1}');
  assert.equal(res.changed, true);
  assert.equal(res.error, undefined);
});

test("runTool: an unchanged response reports changed=false", async () => {
  const pipeline = await MiddlewarePipeline.build({ slim: false, compact: false, cleantext: false }, "/tmp");
  const res = await runTool({ pipeline, server: server(async () => ({ content: [{ type: "text", text: "hi" }] })) }, "echo", {});
  assert.equal(res.changed, false);
  assert.deepEqual(res.raw, res.processed);
});

test("runTool: a failing call returns the error instead of throwing; unknown tools throw", async () => {
  const pipeline = await MiddlewarePipeline.build(undefined, "/tmp");
  const res = await runTool({ pipeline, server: server(async () => { throw new Error("upstream down"); }) }, "echo", {});
  assert.equal(res.error, "upstream down");
  assert.equal(res.raw, undefined);
  await assert.rejects(runTool({ pipeline, server: server(async () => ({})) }, "nope", {}), /unknown tool/);
});
