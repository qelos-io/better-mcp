import { test } from "node:test";
import assert from "node:assert/strict";
import type { ServerView } from "../../../../src/manage/api-types.js";
import { countsText, loginNotice, stateLabel, statusLabel, summarize } from "../format.js";

const v = (o: Partial<ServerView> = {}): ServerView => ({
  name: "a", status: "connected", transport: "http", target: "t", tools: 3, toolsTotal: 3, resources: 0, prompts: 0, ...o,
});

test("summarize: counts servers by state", () => {
  assert.equal(summarize([]), "");
  assert.equal(summarize([v()]), "1 server · 1 connected");
  assert.equal(
    summarize([v(), v({ status: "needs_auth" }), v({ status: "authenticating" }), v({ status: "error" }), v({ status: "error" })]),
    "5 servers · 1 connected · 2 need login · 2 failing",
  );
});

test("countsText: enabled of total, resources and prompts; empty unless connected", () => {
  assert.equal(countsText(v()), "3 tools");
  assert.equal(countsText(v({ tools: 1, toolsTotal: 1 })), "1 tool");
  assert.equal(countsText(v({ tools: 2, toolsTotal: 5, resources: 1, prompts: 4 })), "2 of 5 tools, 1 resources, 4 prompts");
  assert.equal(countsText(v({ status: "error" })), "");
});

test("stateLabel: finishing sign-in wins over the plain status", () => {
  assert.equal(stateLabel(v()), "Connected · 3 tools");
  assert.equal(stateLabel(v({ status: "authenticating", finishing: true })), "Finishing sign-in…");
  assert.equal(stateLabel(v({ status: "needs_auth" })), "Needs login");
});

test("loginNotice: distinguishes finishing, link available and starting", () => {
  assert.match(loginNotice(v({ finishing: true })), /Signed in/);
  assert.match(loginNotice(v({ loginUrl: "https://x" })), /Finish signing in/);
  assert.equal(loginNotice(v()), "Starting login…");
});

test("statusLabel: the state without counts; finishing sign-in wins", () => {
  assert.equal(statusLabel(v()), "Connected");
  assert.equal(statusLabel(v({ status: "authenticating", finishing: true })), "Finishing sign-in…");
  assert.equal(statusLabel(v({ status: "needs_auth" })), "Needs login");
});
