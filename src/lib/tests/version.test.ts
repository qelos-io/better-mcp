import { test } from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "../version.js";

test("VERSION is the semver from package.json", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+/);
});
