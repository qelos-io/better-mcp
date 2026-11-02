import { test } from "node:test";
import assert from "node:assert/strict";
import { withLaunch } from "../cli-page.js";

const launch = { command: "npx", args: ["-y", "@qelos/better-mcp@latest", "--config", "/my dir/mcp.json"] };

test("withLaunch: replaces the leading binary with the install's launch command", () => {
  assert.equal(
    withLaunch("better-mcp tools ls github", launch),
    "npx -y @qelos/better-mcp@latest --config '/my dir/mcp.json' tools ls github",
  );
});

test("withLaunch: also replaces the binary after a pipe, and leaves other text alone", () => {
  assert.equal(
    withLaunch("cat body.json | better-mcp tools call x", launch),
    "cat body.json | npx -y @qelos/better-mcp@latest --config '/my dir/mcp.json' tools call x",
  );
  assert.equal(withLaunch(`echo "better-mcp"`, launch), `echo "better-mcp"`);
});

import { cliLaunch, toolCallCommand } from "../cli-page.js";

const info = { ...launch, configArgs: ["--config", "/my dir/mcp.json"], globalInstalled: false, namespace: true };

test("cliLaunch: npx unless better-mcp is global", () => {
  assert.equal(cliLaunch(info), info);
  assert.deepEqual(cliLaunch({ ...info, globalInstalled: true }), { command: "better-mcp", args: ["--config", "/my dir/mcp.json"] });
});

test("toolCallCommand: namespaced name, quoted JSON args, global binary", () => {
  assert.equal(
    toolCallCommand({ ...info, globalInstalled: true }, "github", "get_issue", { number: 5 }),
    `better-mcp --config '/my dir/mcp.json' tools call github__get_issue '{"number":5}'`,
  );
  assert.equal(toolCallCommand({ ...info, namespace: false, globalInstalled: true, configArgs: [] }, "github", "ping", {}), "better-mcp tools call ping '{}'");
});
