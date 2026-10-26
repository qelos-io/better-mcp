import { test } from "node:test";
import assert from "node:assert/strict";
import { callbackPage } from "../callback-page.js";

test("callbackPage success: confirms sign-in and closes itself", () => {
  const html = callbackPage("success");
  assert.match(html, /You're signed in/);
  assert.match(html, /window\.close\(\)/);
  assert.match(html, /You can close this tab now/);
});

test("callbackPage error: shows the escaped reason and never auto-closes", () => {
  const html = callbackPage("error", "<script>x</script> denied");
  assert.match(html, /Sign-in failed/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt; denied/);
  assert.doesNotMatch(html, /window\.close/);
});
