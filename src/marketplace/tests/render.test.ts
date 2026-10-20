import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, jsonForScript, renderPage, toCatalog } from "../render.js";
import type { MarketplaceEntry } from "../registry.js";

const entry: MarketplaceEntry = {
  id: "demo",
  name: "Demo </script>",
  description: "d",
  category: "Dev <b>",
  homepage: "https://e.com",
  config: { command: "x" },
};

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&#60;a href=&#34;x&#34;&#62;&#38;&#39;");
});

test("jsonForScript neutralises </script> breakouts", () => {
  assert.ok(!jsonForScript({ a: "</script><script>x" }).includes("<"));
});

test("toCatalog fills defaults and install payloads", () => {
  const [c] = toCatalog([entry]);
  assert.equal(c.logo, null);
  assert.deepEqual(c.tags, []);
  assert.deepEqual(c.config, { command: "x" });
  assert.ok(c.install.claudeCode.startsWith("claude mcp add-json demo"));
});

test("renderPage embeds catalog and escapes category chips", () => {
  const html = renderPage([entry]);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("const CATALOG = ["));
  assert.ok(html.includes("Dev &#60;b&#62;"));
  assert.equal(html.split("</script>").length, 2);
});
