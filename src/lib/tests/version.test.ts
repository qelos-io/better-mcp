import { test } from "node:test";
import assert from "node:assert/strict";
import { VERSION, startupBanner } from "../version.js";

test("VERSION is the semver from package.json", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+/);
});

test("startupBanner names the package, version, node and platform", () => {
  assert.equal(startupBanner("v22.1.0", "darwin", "arm64"), `@qelos/better-mcp v${VERSION} (node v22.1.0, darwin-arm64)`);
});
