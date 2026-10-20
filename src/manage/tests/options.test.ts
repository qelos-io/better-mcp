import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveManageOptions } from "../options.js";

test("defaults: loopback host, free port", () => {
  assert.deepEqual(resolveManageOptions({}, {}), { host: "127.0.0.1", port: undefined });
  assert.deepEqual(resolveManageOptions(undefined, {}), { host: "127.0.0.1", port: undefined });
});

test("env supplies host and port", () => {
  assert.deepEqual(
    resolveManageOptions({}, { BETTER_MCP_MANAGE_HOST: "0.0.0.0", BETTER_MCP_MANAGE_PORT: "33419" }),
    { host: "0.0.0.0", port: 33419 },
  );
});

test("config wins over env", () => {
  assert.deepEqual(
    resolveManageOptions({ host: "127.0.0.1", port: 1234 }, { BETTER_MCP_MANAGE_HOST: "0.0.0.0", BETTER_MCP_MANAGE_PORT: "33419" }),
    { host: "127.0.0.1", port: 1234 },
  );
});

test("invalid env port throws", () => {
  assert.throws(() => resolveManageOptions({}, { BETTER_MCP_MANAGE_PORT: "abc" }), /BETTER_MCP_MANAGE_PORT/);
  assert.throws(() => resolveManageOptions({}, { BETTER_MCP_MANAGE_PORT: "70000" }), /BETTER_MCP_MANAGE_PORT/);
});
