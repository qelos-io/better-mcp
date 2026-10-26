import { test } from "node:test";
import assert from "node:assert/strict";
import { RuntimeSettings, staticRuntime } from "../runtime.service.js";
import { MiddlewarePipeline } from "../../middleware/pipeline.js";

test("RuntimeSettings.create: reads namespace and slim defaults from the config", async () => {
  const rt = await RuntimeSettings.create({}, "/tmp");
  assert.equal(rt.namespace, true);
  assert.notEqual(rt.slim, null);
  const off = await RuntimeSettings.create({ namespace: false, middleware: { slim: false } }, "/tmp");
  assert.equal(off.namespace, false);
  assert.equal(off.slim, null);
});

test("RuntimeSettings.apply: swaps the settings, builds a fresh pipeline and notifies listeners", async () => {
  const rt = await RuntimeSettings.create({}, "/tmp");
  const before = rt.pipeline;
  let notified = 0;
  const off = rt.onChange(() => notified++);
  await rt.apply({ namespace: false, middleware: { slim: false } }, "/tmp");
  assert.equal(rt.namespace, false);
  assert.equal(rt.slim, null);
  assert.notEqual(rt.pipeline, before);
  assert.equal(notified, 1);
  off();
  await rt.apply({}, "/tmp");
  assert.equal(notified, 1);
});

test("RuntimeSettings.apply: a config that fails to build leaves the current settings in place", async () => {
  const rt = await RuntimeSettings.create({ namespace: false }, "/tmp");
  const before = rt.pipeline;
  let notified = 0;
  rt.onChange(() => notified++);
  await assert.rejects(rt.apply({ namespace: true, middleware: { hooks: "/definitely/missing/hooks.mjs" } }, "/tmp"));
  assert.equal(rt.namespace, false);
  assert.equal(rt.pipeline, before);
  assert.equal(notified, 0);
});

test("staticRuntime: fixed values and no change events", async () => {
  const pipeline = await MiddlewarePipeline.build(undefined, "/tmp");
  const rt = staticRuntime(pipeline);
  assert.equal(rt.namespace, true);
  assert.equal(rt.slim, null);
  assert.equal(rt.onChange, undefined);
});
