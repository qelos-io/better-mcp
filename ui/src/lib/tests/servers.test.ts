import { test } from "node:test";
import assert from "node:assert/strict";
import type { ServerView } from "../../../../src/manage/api-types.js";
import { categories, filterServers, needsAttention } from "../servers.js";

const v = (name: string, status: ServerView["status"], target = "t"): ServerView => ({ name, status, transport: "http", target, tools: 0, toolsTotal: 0, resources: 0, prompts: 0 });
const all = [v("github", "connected", "https://api.github.com/mcp"), v("figma", "error"), v("revenue", "needs_auth"), v("off", "disabled")];

test("needsAttention: errors and logins, not connected or disabled", () => {
  assert.deepEqual(all.filter(needsAttention).map((s) => s.name), ["figma", "revenue"]);
});

test("filterServers: matches name or target, optionally only those needing attention", () => {
  assert.deepEqual(filterServers(all, "GIT", false).map((s) => s.name), ["github"]);
  assert.deepEqual(filterServers(all, "api.github", false).map((s) => s.name), ["github"]);
  assert.deepEqual(filterServers(all, "", true).map((s) => s.name), ["figma", "revenue"]);
  assert.deepEqual(filterServers(all, "rev", true).map((s) => s.name), ["revenue"]);
});

test("categories: unique and sorted", () => {
  assert.deepEqual(categories([{ category: "b" }, { category: "a" }, { category: "b" }]), ["a", "b"]);
});
