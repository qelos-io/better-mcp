import { test } from "node:test";
import assert from "node:assert/strict";
import { renderManagePage } from "../page.js";

function script(html: string): string {
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  assert.ok(m, "page has an inline script");
  return m[1];
}

test("renderManagePage: inline script is syntactically valid", () => {
  assert.doesNotThrow(() => new Function(script(renderManagePage())));
});

test("renderManagePage: login link, summary and confirm-remove hooks are present", () => {
  const html = renderManagePage();
  assert.match(html, /Open login page/);
  assert.match(html, /function summarize/);
  assert.match(html, /Confirm remove/);
  assert.doesNotMatch(html, /alert\(/);
});
