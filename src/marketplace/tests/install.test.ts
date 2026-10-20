import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeCodeCommand, cursorDeeplink, mcpServersSnippet, vscodeDeeplink } from "../install.js";
import type { MarketplaceEntry } from "../registry.js";

const stdio: MarketplaceEntry = {
  id: "demo",
  name: "Demo",
  description: "d",
  category: "c",
  homepage: "https://e.com",
  config: { command: "npx", args: ["-y", "it's"], env: { K: "${K}" } },
};
const remote: MarketplaceEntry = { ...stdio, config: { url: "https://x/mcp" } };

test("mcpServersSnippet wraps config under the entry id", () => {
  assert.deepEqual(JSON.parse(mcpServersSnippet(stdio)), { mcpServers: { demo: stdio.config } });
});

test("cursorDeeplink: base64 config round-trips", () => {
  const u = new URL(cursorDeeplink(stdio));
  assert.equal(u.searchParams.get("name"), "demo");
  const cfg = JSON.parse(Buffer.from(u.searchParams.get("config")!, "base64").toString());
  assert.deepEqual(cfg, stdio.config);
});

test("vscodeDeeplink: encodes name + config, marks remote as http", () => {
  const parse = (l: string) => JSON.parse(decodeURIComponent(l.slice("vscode:mcp/install?".length)));
  assert.deepEqual(parse(vscodeDeeplink(stdio)), { name: "demo", ...stdio.config });
  assert.deepEqual(parse(vscodeDeeplink(remote)), { name: "demo", type: "http", url: "https://x/mcp" });
});

test("claudeCodeCommand: single quotes are shell-escaped", () => {
  assert.equal(
    claudeCodeCommand(stdio),
    `claude mcp add-json demo '{"command":"npx","args":["-y","it'\\''s"],"env":{"K":"\${K}"}}'`,
  );
});
