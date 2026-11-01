import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInstallArgs } from "../install-args.js";

test("drops the app command and absolutizes --config", () => {
  assert.deepEqual(buildInstallArgs(["app", "--config", "mcp.json"], "/x/mcp.json", "/work"), ["--config", "/work/mcp.json"]);
});

test("handles -c and --config= forms", () => {
  assert.deepEqual(buildInstallArgs(["-c", "/a/b.json"], undefined, "/w"), ["--config", "/a/b.json"]);
  assert.deepEqual(buildInstallArgs(["--config=rel.json"], undefined, "/w"), ["--config", "/w/rel.json"]);
});

test("adds the resolved config path when none was passed", () => {
  assert.deepEqual(buildInstallArgs(["app"], "/home/mcp.json"), ["--config", "/home/mcp.json"]);
});

test("keeps other flags and their values", () => {
  assert.deepEqual(
    buildInstallArgs(["--no-namespace", "--listen", "3100", "--listen-host", "0.0.0.0"], "/c.json"),
    ["--no-namespace", "--listen", "3100", "--listen-host", "0.0.0.0", "--config", "/c.json"],
  );
});

test("no config at all (inline) leaves args alone", () => {
  assert.deepEqual(buildInstallArgs(["app"], undefined), []);
});
