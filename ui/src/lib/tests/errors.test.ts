import { test } from "node:test";
import assert from "node:assert/strict";
import { explainError } from "../errors.js";

test("explainError: maps common failures to a hint and the action that fixes them", () => {
  assert.equal(explainError("fetch failed (ENOTFOUND app.example.com)", "http")?.action, "reconnect");
  assert.match(explainError("fetch failed (ECONNREFUSED)", "http")!.hint, /Nothing is listening/);
  assert.match(explainError("spawn nope ENOENT", "stdio")!.hint, /command was not found/);
  assert.match(explainError("Streamable HTTP error: Error POSTing to endpoint: ", "http")!.hint, /API key/);
  assert.equal(explainError("HTTP 401: unauthorized", "http")?.action, "login");
  assert.equal(explainError("HTTP 401: unauthorized", "stdio")?.action, undefined);
});

test("explainError: the registration refusal wins over the generic 403 hint", () => {
  const msg = "HTTP 403 from the server's OAuth endpoint: it refused to register better-mcp as a client.";
  assert.match(explainError(msg, "http")!.hint, /approved OAuth clients/);
  assert.match(explainError("HTTP 403: Forbidden", "http")!.hint, /refused access/);
});

test("explainError: unknown errors get no hint", () => {
  assert.equal(explainError("something odd", "http"), null);
});
