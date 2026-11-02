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
