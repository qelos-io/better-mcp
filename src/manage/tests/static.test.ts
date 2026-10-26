import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { resolveStaticPath } from "../static.js";

test("resolveStaticPath: index by default, files inside the root", () => {
  assert.equal(resolveStaticPath("/r", ""), join("/r", "index.html"));
  assert.equal(resolveStaticPath("/r", "assets/a.js"), join("/r", "assets", "a.js"));
});

test("resolveStaticPath: rejects traversal and absolute paths", () => {
  assert.equal(resolveStaticPath("/r", "../etc/passwd"), null);
  assert.equal(resolveStaticPath("/r", "a/../../x"), null);
  assert.equal(resolveStaticPath("/r", "%2e%2e/x"), null);
  assert.equal(resolveStaticPath("/r", "/etc/passwd"), null);
});
