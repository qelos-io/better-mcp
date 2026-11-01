import { test } from "node:test";
import assert from "node:assert/strict";
import { clientGuides, codexToml, cursorLink, mcpServersJson, opencodeJson, shellLine, shellQuote, vscodeLink } from "../install.js";

const l = { command: "npx", args: ["-y", "@qelos/better-mcp@latest", "--config", "/my dir/mcp.json"] };

test("shellQuote quotes only when needed", () => {
  assert.equal(shellQuote("/a/b.json"), "/a/b.json");
  assert.equal(shellQuote("/my dir/x"), "'/my dir/x'");
  assert.equal(shellQuote("it's"), `'it'\\''s'`);
});

test("shellLine joins command and args", () => {
  assert.equal(shellLine(l), "npx -y @qelos/better-mcp@latest --config '/my dir/mcp.json'");
});

test("mcpServersJson carries the args incl. --config", () => {
  const parsed = JSON.parse(mcpServersJson(l));
  assert.deepEqual(parsed.mcpServers["better-mcp"], l);
  assert.ok(JSON.parse(mcpServersJson(l, "servers")).servers["better-mcp"]);
});

test("codexToml and opencodeJson", () => {
  assert.match(codexToml(l), /\[mcp_servers\.better-mcp\]\ncommand = "npx"\nargs = \["-y", /);
  assert.deepEqual(JSON.parse(opencodeJson(l)).mcp["better-mcp"].command, ["npx", ...l.args]);
});

test("deep links round-trip the launch", () => {
  const cur = new URL(cursorLink(l));
  assert.equal(cur.protocol, "cursor:");
  const cfg = JSON.parse(atob(cur.searchParams.get("config")!));
  assert.deepEqual(cfg, l);
  const vs = vscodeLink(l);
  assert.deepEqual(JSON.parse(decodeURIComponent(vs.slice("vscode:mcp/install?".length))), { name: "better-mcp", ...l });
});

test("clientGuides lists the requested clients, with links where supported", () => {
  const g = clientGuides(l);
  for (const id of ["claude-code", "cursor", "devin", "antigravity", "codex", "opencode"]) assert.ok(g.some((x) => x.id === id), id);
  assert.ok(g.find((x) => x.id === "cursor")!.link);
  assert.ok(g.every((x) => x.snippet.includes("--config")));
});
