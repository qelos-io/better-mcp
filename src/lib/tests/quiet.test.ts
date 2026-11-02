import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuiet, silenceStderr } from "../quiet.js";

test("silenceStderr swallows writes, keeps a real writer, and restores", () => {
  const seen: string[] = [];
  const stream = { write: (s: string) => (seen.push(s), true) };
  const q = silenceStderr(stream);
  assert.equal(isQuiet(), true);
  stream.write("noise");
  q.write("real");
  assert.deepEqual(seen, ["real"]);
  q.restore();
  assert.equal(isQuiet(), false);
  stream.write("back");
  assert.deepEqual(seen, ["real", "back"]);
});
