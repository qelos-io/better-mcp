import { test } from "node:test";
import assert from "node:assert/strict";
import { isOnPath } from "../global-install.js";

test("finds the binary in a PATH directory", () => {
  const seen = (f: string) => f === "/b/better-mcp";
  assert.equal(isOnPath("better-mcp", { PATH: "/a:/b" }, seen, "linux"), true);
});

test("false when absent or PATH is empty", () => {
  assert.equal(isOnPath("better-mcp", { PATH: "/a:/b" }, () => false, "linux"), false);
  assert.equal(isOnPath("better-mcp", {}, () => true, "linux"), false);
});

test("tries Windows extensions", () => {
  assert.equal(isOnPath("better-mcp", { PATH: "C:\\n" }, (f) => f.endsWith(".cmd"), "win32"), true);
});
