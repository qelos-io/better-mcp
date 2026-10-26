import { test } from "node:test";
import assert from "node:assert/strict";
import { diffPatch, initDrafts, listToText, parseNumber, textToList } from "../settings-draft.js";

test("initDrafts + diffPatch: an untouched form produces no patch", () => {
  const values = { namespace: false, slim: { maxDescriptionLength: 80 }, redact: ["token"], dedup: true };
  assert.deepEqual(diffPatch(values, initDrafts(values)), {});
  assert.deepEqual(diffPatch({}, initDrafts({})), {});
});

test("diffPatch: reports only the changed sections; defaults become removals", () => {
  const values = { namespace: false, dedup: { ttlSeconds: 60 } };
  const drafts = initDrafts(values);
  drafts.namespace = { enabled: true, values: {} };
  drafts.dedup = { enabled: true, values: { ttlSeconds: 120 } };
  drafts.slim = { enabled: false, values: {} };
  assert.deepEqual(diffPatch(values, drafts), { namespace: null, dedup: { ttlSeconds: 120 }, slim: false });
});

test("diffPatch: turning a section off removes or falsifies it depending on its default", () => {
  const values = { dedup: { ttlSeconds: 60 }, redact: ["a"] };
  const drafts = initDrafts(values);
  drafts.dedup = { enabled: false, values: {} };
  drafts.redact = { enabled: false, values: { list: ["a"] } };
  assert.deepEqual(diffPatch(values, drafts), { dedup: null, redact: null });
});

test("text helpers: lines to list and back, numbers parse or stay unset", () => {
  assert.deepEqual(textToList(" a \n\nb\n"), ["a", "b"]);
  assert.equal(listToText(["a", "b"]), "a\nb");
  assert.equal(listToText(undefined), "");
  assert.equal(parseNumber(""), undefined);
  assert.equal(parseNumber("12"), 12);
  assert.equal(parseNumber("x"), undefined);
});
