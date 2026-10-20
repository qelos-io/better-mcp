import { installOptions } from "./install.js";
import type { MarketplaceEntry } from "./registry.js";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Entries plus precomputed install payloads, as shipped in servers.json and embedded in the page. */
export function toCatalog(entries: MarketplaceEntry[]) {
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    homepage: e.homepage,
    logo: e.logo ?? null,
    tags: e.tags ?? [],
    setup: e.setup ?? null,
    config: e.config,
    install: installOptions(e),
  }));
}

/** Safe to inline inside a <script> tag. */
export function jsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

export function renderPage(entries: MarketplaceEntry[]): string {
  const catalog = toCatalog(entries);
  const categories = [...new Set(entries.map((e) => e.category))].sort();
  const chips = ["All", ...categories]
    .map((c, i) => `<button class="chip" data-cat="${escapeHtml(c)}" aria-pressed="${i === 0}">${escapeHtml(c)}</button>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>better-mcp Marketplace</title>
<meta name="description" content="Community-curated MCP servers with one-click install for Cursor, VS Code, Claude Code and better-mcp.">
<style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--accent:#4f46e5;--accent-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#f5f5f4;--muted:#a8a29e;--card:#1c1917;--line:#292524;--accent:#818cf8;--accent-fg:#0c0a09}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 16px 64px}
h1{margin:0 0 4px;font-size:28px}
.sub{color:var(--muted);margin:0 0 20px}
.sub a{color:var(--accent)}
input[type=search]{width:100%;padding:10px 12px;font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 24px}
.chip{font:inherit;font-size:14px;padding:4px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:inherit;cursor:pointer}
.chip[aria-pressed=true]{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}
.head{display:flex;gap:12px;align-items:center}
.logo{width:40px;height:40px;border-radius:8px;object-fit:contain;flex:none;background:var(--bg);display:grid;place-items:center;font-weight:700;color:var(--muted)}
.card h2{margin:0;font-size:17px}
.card h2 a{color:inherit;text-decoration:none}
.cat{font-size:12px;color:var(--muted)}
.desc{margin:0;font-size:14px;flex:1}
.setup{margin:0;font-size:13px;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:6px}
.btn{font:inherit;font-size:13px;padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:inherit;cursor:pointer;text-decoration:none}
.btn.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.empty{color:var(--muted);text-align:center;padding:48px 0}
footer{margin-top:40px;color:var(--muted);font-size:14px}
footer a{color:var(--accent)}
</style>
</head>
<body>
<main>
<h1>better-mcp Marketplace</h1>
<p class="sub">Community-curated MCP servers. Install in one click, or copy a config for <a href="https://github.com/qelos-io/better-mcp">better-mcp</a>.</p>
<input type="search" id="q" placeholder="Search ${entries.length} servers…" aria-label="Search servers">
<div class="chips" id="chips">${chips}</div>
<div class="grid" id="grid"></div>
<p class="empty" id="empty" hidden>No servers match.</p>
<footer>Missing one? <a href="https://github.com/qelos-io/better-mcp/blob/main/marketplace/README.md">Add it to servers.yaml</a> — it's a pull request away.</footer>
</main>
<script>
const CATALOG = ${jsonForScript(catalog)};
const grid = document.getElementById("grid"), empty = document.getElementById("empty");
let cat = "All", query = "";

function el(tag, props, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

function copyBtn(label, text) {
  const b = el("button", { className: "btn", textContent: label });
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(text); b.textContent = "Copied!"; }
    catch { window.prompt("Copy:", text); }
    setTimeout(() => (b.textContent = label), 1500);
  };
  return b;
}

function card(s) {
  const logo = s.logo
    ? el("img", { className: "logo", src: s.logo, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })
    : el("div", { className: "logo", textContent: s.name[0].toUpperCase() });
  logo.onerror = () => logo.replaceWith(el("div", { className: "logo", textContent: s.name[0].toUpperCase() }));
  const title = el("div", {}, el("h2", {}, el("a", { href: s.homepage, target: "_blank", rel: "noopener", textContent: s.name })), el("div", { className: "cat", textContent: s.category }));
  const actions = el("div", { className: "actions" },
    el("a", { className: "btn primary", href: s.install.cursor, textContent: "Cursor" }),
    el("a", { className: "btn", href: s.install.vscode, textContent: "VS Code" }),
    copyBtn("Claude Code", s.install.claudeCode),
    copyBtn("mcp.json", s.install.mcpServers));
  return el("article", { className: "card" },
    el("div", { className: "head" }, logo, title),
    el("p", { className: "desc", textContent: s.description }),
    ...(s.setup ? [el("p", { className: "setup", textContent: "Setup: " + s.setup })] : []),
    actions);
}

function render() {
  const q = query.toLowerCase();
  const shown = CATALOG.filter((s) =>
    (cat === "All" || s.category === cat) &&
    (!q || [s.id, s.name, s.description, ...s.tags].join(" ").toLowerCase().includes(q)));
  grid.replaceChildren(...shown.map(card));
  empty.hidden = shown.length > 0;
}

document.getElementById("q").oninput = (e) => { query = e.target.value; render(); };
document.getElementById("chips").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  cat = b.dataset.cat;
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  render();
};
render();
</script>
</body>
</html>
`;
}
