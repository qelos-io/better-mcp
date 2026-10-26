import { test } from "node:test";
import assert from "node:assert/strict";
import { validateServer } from "../loader.js";

test("validateServer: disabledTools must be an array of strings", () => {
  assert.deepEqual(validateServer("a", { command: "x", disabledTools: ["t"] }).disabledTools, ["t"]);
  assert.throws(() => validateServer("a", { command: "x", disabledTools: "t" }), /disabledTools/);
  assert.throws(() => validateServer("a", { command: "x", disabledTools: [1] }), /disabledTools/);
});
