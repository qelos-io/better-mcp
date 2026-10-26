import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTIONS,
  applySettingsPatch,
  buildSectionValue,
  readAllSettings,
  readSection,
  setAt,
  validateSectionValue,
  type Section,
} from "../settings-schema.js";

const sec = (id: string) => SECTIONS.find((s) => s.id === id) as Section;

test("readSection: defaults apply when the key is absent; objects count as enabled", () => {
  assert.deepEqual(readSection({}, sec("slim")), { enabled: true, values: {} });
  assert.deepEqual(readSection({}, sec("dedup")), { enabled: false, values: {} });
  assert.deepEqual(readSection({ middleware: { dedup: true } }, sec("dedup")), { enabled: true, values: {} });
  assert.deepEqual(readSection({ middleware: { slim: false } }, sec("slim")), { enabled: false, values: {} });
  assert.deepEqual(readSection({ middleware: { dedup: { ttlSeconds: 9 } } }, sec("dedup")), { enabled: true, values: { ttlSeconds: 9 } });
  assert.deepEqual(readSection({ middleware: { redact: ["token"] } }, sec("redact")), { enabled: true, values: { list: ["token"] } });
  assert.deepEqual(readSection({ namespace: false }, sec("namespace")), { enabled: false, values: {} });
});

test("buildSectionValue: omits values that equal the default state", () => {
  assert.equal(buildSectionValue(sec("namespace"), { enabled: true, values: {} }, undefined), undefined);
  assert.equal(buildSectionValue(sec("namespace"), { enabled: false, values: {} }, undefined), false);
  assert.equal(buildSectionValue(sec("slim"), { enabled: true, values: {} }, undefined), undefined);
  assert.equal(buildSectionValue(sec("slim"), { enabled: false, values: {} }, undefined), false);
  assert.equal(buildSectionValue(sec("dedup"), { enabled: false, values: {} }, undefined), undefined);
  assert.equal(buildSectionValue(sec("dedup"), { enabled: true, values: {} }, undefined), true);
});

test("buildSectionValue: stores set fields, drops blanks, keeps keys the schema does not know", () => {
  const out = buildSectionValue(
    sec("offload"),
    { enabled: true, values: { thresholdBytes: 4000, dir: "", previewRows: Number.NaN, chapterMarkdown: false } },
    { thresholdBytes: 1, dir: "/old", perTool: { fs: false } },
  );
  assert.deepEqual(out, { thresholdBytes: 4000, chapterMarkdown: false, perTool: { fs: false } });
});

test("buildSectionValue: lists are trimmed, and an empty list removes the key", () => {
  assert.deepEqual(buildSectionValue(sec("redact"), { enabled: true, values: { list: [" token ", "", "key"] } }, undefined), ["token", "key"]);
  assert.equal(buildSectionValue(sec("redact"), { enabled: true, values: { list: [] } }, ["x"]), undefined);
  assert.equal(buildSectionValue(sec("redact"), { enabled: false, values: { list: ["x"] } }, ["x"]), undefined);
});

test("validateSectionValue: rejects wrong types and out-of-range numbers", () => {
  assert.doesNotThrow(() => validateSectionValue(sec("dedup"), { ttlSeconds: 10, exclude: ["a"] }));
  assert.throws(() => validateSectionValue(sec("dedup"), { ttlSeconds: "10" }), /ttlSeconds/);
  assert.throws(() => validateSectionValue(sec("dedup"), { ttlSeconds: 0 }), /ttlSeconds/);
  assert.throws(() => validateSectionValue(sec("log"), { level: "loud" }), /level/);
  assert.throws(() => validateSectionValue(sec("namespace"), "yes"), /namespace/);
  assert.throws(() => validateSectionValue(sec("redact"), "token"), /redact/);
  assert.throws(() => validateSectionValue(sec("slim"), [1]), /slim/);
});

test("setAt: creates parents, removes keys, and prunes an emptied middleware object", () => {
  const raw: Record<string, unknown> = {};
  setAt(raw, ["middleware", "slim"], false);
  assert.deepEqual(raw, { middleware: { slim: false } });
  setAt(raw, ["middleware", "slim"], undefined);
  assert.deepEqual(raw, {});
  setAt(raw, ["middleware", "dedup"], undefined);
  assert.deepEqual(raw, {});
  assert.throws(() => setAt({ middleware: [] }, ["middleware", "slim"], true), /not an object/);
});

test("applySettingsPatch: applies atomically; unknown ids and bad values change nothing", () => {
  const raw: Record<string, unknown> = { mcpServers: {}, middleware: { slim: false } };
  applySettingsPatch(raw, { namespace: false, slim: null, dedup: { ttlSeconds: 60 } });
  assert.deepEqual(raw, { mcpServers: {}, namespace: false, middleware: { dedup: { ttlSeconds: 60 } } });
  const before = JSON.stringify(raw);
  assert.throws(() => applySettingsPatch(raw, { namespace: true, nope: 1 }), /unknown setting/);
  assert.throws(() => applySettingsPatch(raw, { namespace: true, dedup: { ttlSeconds: -1 } }), /ttlSeconds/);
  assert.equal(JSON.stringify(raw), before);
});

test("readAllSettings: returns only the keys present in the config", () => {
  assert.deepEqual(readAllSettings({ namespace: false, middleware: { redact: ["t"], hooks: "x.js" } }), { namespace: false, redact: ["t"] });
});
