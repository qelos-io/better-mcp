import { test } from "node:test";
import assert from "node:assert/strict";
import { enableEnvProxy } from "../proxy-env.js";

test("enableEnvProxy: no-op without proxy vars", () => {
  let called = false;
  assert.equal(enableEnvProxy({}, { setGlobalProxyFromEnv: () => void (called = true) }), false);
  assert.equal(called, false);
});

test("enableEnvProxy: applies when a proxy var is set", () => {
  const seen: unknown[] = [];
  const env = { HTTPS_PROXY: "http://127.0.0.1:9" };
  assert.equal(enableEnvProxy(env, { setGlobalProxyFromEnv: (e) => void seen.push(e) }), true);
  assert.deepEqual(seen, [env]);
});

test("enableEnvProxy: tolerates older Node without the API", () => {
  assert.equal(enableEnvProxy({ HTTP_PROXY: "x" }, {}), false);
});
