import { test } from "node:test";
import assert from "node:assert/strict";
import type { ToolView } from "../../../../src/manage/api-types.js";
import { filterTools, toolCounts, withToolsSet } from "../tools.js";
import { parseTheme } from "../theme.js";

const tools: ToolView[] = [
  { name: "list_issues", description: "List issues", enabled: true },
  { name: "delete_repo", description: "Permanently delete", enabled: false },
  { name: "merge_pr", enabled: false },
];

test("filterTools: by enabled state and by text over name and description", () => {
  assert.deepEqual(filterTools(tools, "", "all").length, 3);
  assert.deepEqual(filterTools(tools, "", "enabled").map((t) => t.name), ["list_issues"]);
  assert.deepEqual(filterTools(tools, "", "disabled").map((t) => t.name), ["delete_repo", "merge_pr"]);
  assert.deepEqual(filterTools(tools, "DELETE", "all").map((t) => t.name), ["delete_repo"]);
  assert.deepEqual(filterTools(tools, "list", "disabled"), []);
});

test("toolCounts / withToolsSet", () => {
  assert.deepEqual(toolCounts(tools), { all: 3, enabled: 1, disabled: 2 });
  const next = withToolsSet(tools, ["merge_pr"], true);
  assert.equal(next[2].enabled, true);
  assert.equal(tools[2].enabled, false);
});

test("parseTheme: defaults to light and ignores unknown values", () => {
  assert.equal(parseTheme(null), "light");
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("system"), "system");
  assert.equal(parseTheme("neon"), "light");
});
