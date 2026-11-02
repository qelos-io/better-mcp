import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS_COMMANDS, toolsHelpText } from "../tools-docs.js";

test("toolsHelpText: documents every command with its usage and examples", () => {
  const text = toolsHelpText();
  for (const c of TOOLS_COMMANDS) {
    assert.ok(text.includes(c.usage), c.usage);
    for (const e of c.examples) assert.ok(text.includes(e.cmd), e.cmd);
  }
});

test("TOOLS_COMMANDS: every example starts with the better-mcp binary or a pipe into it", () => {
  for (const e of TOOLS_COMMANDS.flatMap((c) => c.examples)) assert.match(e.cmd, /(^|\| )better-mcp /);
});
