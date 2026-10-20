import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListedTools } from "../proxy.service.js";
import { resolveSlimConfig } from "../../lib/slim.js";

const noisyInputSchema = {
  type: "object",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "list_issues args",
  additionalProperties: false,
  required: [],
  properties: {
    state: { type: "string", title: "State", enum: ["open", "closed"], default: "open" },
    cursor: { type: "string", description: "Opaque pagination token." },
  },
};

function upstream(name: string, tools: { name: string; description?: string; inputSchema: unknown }[]) {
  return { name, tools };
}

test("namespace=true prefixes every public name with <server>__", () => {
  const out = buildListedTools(
    [upstream("github", [{ name: "list_issues", inputSchema: { type: "object" } }])],
    true,
    null,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "github__list_issues");
});

test("namespace=false keeps the original tool name", () => {
  const out = buildListedTools(
    [upstream("github", [{ name: "list_issues", inputSchema: { type: "object" } }])],
    false,
    null,
  );
  assert.equal(out[0].name, "list_issues");
});

test("slim=null is a pass-through (inputSchema unchanged)", () => {
  const out = buildListedTools(
    [upstream("gh", [{ name: "x", inputSchema: noisyInputSchema, description: "hi" }])],
    true,
    null,
  );
  assert.deepEqual(out[0].inputSchema, noisyInputSchema);
  assert.equal(out[0].description, "hi");
});

test("slim with defaults strips schema noise from inputSchema", () => {
  const out = buildListedTools(
    [upstream("gh", [{ name: "x", inputSchema: noisyInputSchema }])],
    true,
    resolveSlimConfig(true),
  );
  const s = out[0].inputSchema as Record<string, unknown>;
  assert.equal(s.$schema, undefined);
  assert.equal(s.title, undefined);
  assert.equal(s.required, undefined); // dropped because empty
  const props = s.properties as Record<string, Record<string, unknown>>;
  assert.equal(props.state.title, undefined);
  assert.equal(props.state.default, undefined);
  // additionalProperties and non-empty enum stay
  assert.equal(s.additionalProperties, false);
  assert.deepEqual(props.state.enum, ["open", "closed"]);
});

test("maxDescriptionLength flows through to tool descriptions", () => {
  const out = buildListedTools(
    [
      upstream("gh", [
        { name: "x", inputSchema: { type: "object" }, description: "a description that is definitely too long" },
        { name: "y", inputSchema: { type: "object" }, description: "short" },
      ]),
    ],
    true,
    resolveSlimConfig({ maxDescriptionLength: 12 }),
  );
  assert.equal(out[0].description!.length, 12);
  assert.ok(out[0].description!.endsWith("…"));
  assert.equal(out[1].description, "short"); // under cap
});

test("multiple upstreams are listed in order, each prefixed by its server", () => {
  const out = buildListedTools(
    [
      upstream("a", [{ name: "t1", inputSchema: { type: "object" } }]),
      upstream("b", [
        { name: "t2", inputSchema: { type: "object" } },
        { name: "t3", inputSchema: { type: "object" } },
      ]),
    ],
    true,
    null,
  );
  assert.deepEqual(out.map((t) => t.name), ["a__t1", "b__t2", "b__t3"]);
});

test("empty upstream list returns []", () => {
  assert.deepEqual(buildListedTools([], true, null), []);
  assert.deepEqual(buildListedTools([], true, resolveSlimConfig(true)), []);
});

test("upstream with no tools is skipped silently", () => {
  const out = buildListedTools(
    [
      upstream("empty", []),
      upstream("real", [{ name: "t", inputSchema: { type: "object" } }]),
    ],
    true,
    null,
  );
  assert.deepEqual(out.map((t) => t.name), ["real__t"]);
});

test("buildListedTools does not mutate upstream tool definitions", () => {
  const original = JSON.parse(JSON.stringify(noisyInputSchema));
  const tools = [{ name: "x", inputSchema: noisyInputSchema, description: "d" }];
  buildListedTools([upstream("gh", tools)], true, resolveSlimConfig(true));
  assert.deepEqual(noisyInputSchema, original);
});

// ============================================================================
// builtin tools + live upstream changes
// ============================================================================

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { MiddlewarePipeline } from "../../middleware/pipeline.js";
import { buildProxyServer, type BuiltinTool } from "../proxy.service.js";
import type { UpstreamServer } from "../upstream.service.js";

async function connectProxy(opts: { upstreams: UpstreamServer[]; builtins?: BuiltinTool[]; onUpstreamsChange?: (fn: () => void) => () => void }) {
  const pipeline = await MiddlewarePipeline.build(undefined, "/tmp");
  const mcp = buildProxyServer({ pipeline, namespace: true, slim: null, ...opts });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" }, { capabilities: {} });
  await Promise.all([mcp.connect(a), client.connect(b)]);
  return { client, mcp };
}

const upstreamWithTool = (name: string, tool: string, text: string) =>
  ({
    name,
    tools: [{ server: name, name: tool, inputSchema: { type: "object" } }],
    resources: [],
    prompts: [],
    client: { callTool: async () => ({ content: [{ type: "text", text }] }) },
  }) as unknown as UpstreamServer;

test("builtins are listed first, evaluated lazily, and callable without an upstream", async () => {
  let desc = "v1";
  const builtin: BuiltinTool = {
    name: "manage_mcps",
    description: () => desc,
    inputSchema: { type: "object" },
    call: async (args) => ({ text: `hi ${JSON.stringify(args)}` }),
  };
  const { client } = await connectProxy({ upstreams: [upstreamWithTool("s", "t", "x")], builtins: [builtin] });
  const first = await client.listTools();
  assert.deepEqual(first.tools.map((t) => t.name), ["manage_mcps", "s__t"]);
  desc = "v2";
  assert.equal((await client.listTools()).tools[0].description, "v2");
  const out = (await client.callTool({ name: "manage_mcps", arguments: { a: 1 } })) as { content: { text: string }[]; isError?: boolean };
  assert.equal(out.content[0].text, 'hi {"a":1}');
  assert.equal(out.isError, false);
});

test("builtin errors surface as isError results", async () => {
  const builtin: BuiltinTool = { name: "b", description: () => "", inputSchema: { type: "object" }, call: async () => ({ text: "nope", isError: true }) };
  const { client } = await connectProxy({ upstreams: [], builtins: [builtin] });
  const out = (await client.callTool({ name: "b", arguments: {} })) as { isError?: boolean };
  assert.equal(out.isError, true);
});

test("live upstream changes: routes rebuilt, list_changed sent, unsubscribed on close", async () => {
  const upstreams: UpstreamServer[] = [];
  const listeners = new Set<() => void>();
  let unsubscribed = false;
  const { client, mcp } = await connectProxy({
    upstreams,
    onUpstreamsChange: (fn) => {
      listeners.add(fn);
      return () => {
        unsubscribed = true;
        listeners.delete(fn);
      };
    },
  });
  await assert.rejects(client.callTool({ name: "s__t", arguments: {} }), /Unknown tool/);

  const notified = new Promise<void>((resolve) => client.setNotificationHandler(ToolListChangedNotificationSchema, () => resolve()));
  upstreams.push(upstreamWithTool("s", "t", "fresh"));
  for (const fn of listeners) fn();
  await notified;

  assert.deepEqual((await client.listTools()).tools.map((t) => t.name), ["s__t"]);
  const out = (await client.callTool({ name: "s__t", arguments: {} })) as { content: { text: string }[] };
  assert.equal(out.content[0].text, "fresh");

  await mcp.close();
  assert.equal(unsubscribed, true);
});
