/** Single-file management UI. All dynamic content is inserted via textContent. */
export function renderManagePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>better-mcp</title>
<style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--accent:#4f46e5;--accent-fg:#fff;--ok:#16a34a;--warn:#d97706;--bad:#dc2626}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#f5f5f4;--muted:#a8a29e;--card:#1c1917;--line:#292524;--accent:#818cf8;--accent-fg:#0c0a09;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
h1{margin:0;font-size:24px}
.top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.tabs{display:flex;gap:8px}
.tab,.btn{font:inherit;font-size:14px;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:inherit;cursor:pointer}
.tab[aria-selected=true],.btn.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.btn.danger{color:var(--bad)}
.btn:disabled{opacity:.5;cursor:default}
.banner{background:var(--card);border:1px solid var(--warn);border-radius:8px;padding:8px 12px;margin-bottom:16px;font-size:14px}
.list{display:grid;gap:10px}
.row,.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.grow{flex:1;min-width:200px}
.name{font-weight:600}
.target{font:12px ui-monospace,monospace;color:var(--muted);overflow-wrap:anywhere}
.err{font-size:13px;color:var(--bad);overflow-wrap:anywhere}
.badge{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.connected{color:var(--ok)}.needs_auth,.authenticating,.connecting{color:var(--warn)}.error{color:var(--bad)}.disabled{color:var(--muted)}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.card{display:flex;flex-direction:column;gap:8px}
.head{display:flex;gap:10px;align-items:center}
.logo{width:36px;height:36px;border-radius:8px;object-fit:contain;display:grid;place-items:center;background:var(--bg);font-weight:700;color:var(--muted);flex:none}
.card p{margin:0;font-size:14px}.muted{color:var(--muted)}
input,textarea{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%}
textarea{font:13px ui-monospace,monospace;min-height:220px}
dialog{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:12px;width:min(560px,92vw)}
dialog::backdrop{background:#0008}
.field{display:grid;gap:4px;margin-bottom:12px;font-size:14px}
.toolbar{display:flex;gap:8px;margin-bottom:12px}
</style>
</head>
<body>
<main>
<div class="top">
  <h1>better-mcp</h1>
  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="servers" aria-selected="true">Servers</button>
    <button class="tab" role="tab" data-tab="market" aria-selected="false">Marketplace</button>
  </div>
</div>
<div id="banner" class="banner" hidden></div>
<section id="servers"><div class="toolbar"><button class="btn" id="custom">Add custom server…</button></div><div class="list" id="list"></div></section>
<section id="market" hidden>
  <div class="toolbar"><input type="search" id="q" placeholder="Search marketplace…" aria-label="Search marketplace"></div>
  <p class="muted" id="msrc"></p>
  <div class="grid" id="grid"></div>
</section>
</main>
<dialog id="dlg">
  <form method="dialog" id="form">
    <h2 id="dtitle" style="margin-top:0"></h2>
    <p class="muted" id="dsetup"></p>
    <div class="field"><label for="dname">Name</label><input id="dname" required pattern="[A-Za-z0-9][A-Za-z0-9_\\-]*" title="letters, digits, - and _"></div>
    <div class="field"><label for="dcfg">Config (JSON, same shape as an mcpServers entry)</label><textarea id="dcfg" spellcheck="false"></textarea></div>
    <p class="err" id="derr"></p>
    <div class="actions"><button class="btn primary" id="dsave" value="save">Install</button><button class="btn" value="cancel" formnovalidate>Cancel</button></div>
  </form>
</dialog>
<script>
const BASE = location.pathname.replace(/\\/$/, "");
const $ = (id) => document.getElementById(id);
let state = { servers: [], persistent: true }, catalog = { entries: [], source: "none" };

function el(tag, props, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
async function api(path, method = "GET", body) {
  const res = await fetch(BASE + "/api/" + path, {
    method,
    headers: { "x-better-mcp": "1", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
const LABEL = { connected: "connected", needs_auth: "needs login", authenticating: "logging in…", connecting: "connecting…", error: "error", disabled: "disabled" };

function serverRow(s) {
  const act = (label, fn, cls = "") => {
    const b = el("button", { className: "btn " + cls, textContent: label });
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { alert(e.message); } refresh(); };
    return b;
  };
  const p = encodeURIComponent(s.name);
  const actions = el("div", { className: "actions" });
  if (s.transport === "http" && s.status !== "connected" && s.status !== "disabled" && s.status !== "authenticating")
    actions.append(act("Log in", () => api("servers/" + p + "/login", "POST"), "primary"));
  if (s.status === "connected" || s.status === "error") actions.append(act("Reconnect", () => api("servers/" + p + "/reconnect", "POST")));
  actions.append(act(s.status === "disabled" ? "Enable" : "Disable", () => api("servers/" + p + "/" + (s.status === "disabled" ? "enable" : "disable"), "POST")));
  actions.append(act("Remove", () => confirm("Remove " + s.name + "?") ? api("servers/" + p, "DELETE") : null, "danger"));
  const info = el("div", { className: "grow" },
    el("div", { className: "name", textContent: s.name }),
    el("div", { className: "target", textContent: s.target }));
  if (s.loginUrl) info.append(el("a", { href: s.loginUrl, target: "_blank", rel: "noopener", textContent: "Open login page" }));
  if (s.error) info.append(el("div", { className: "err", textContent: s.error }));
  const counts = s.status === "connected" ? s.tools + " tools" + (s.resources ? ", " + s.resources + " resources" : "") + (s.prompts ? ", " + s.prompts + " prompts" : "") : "";
  return el("div", { className: "row" }, info, el("span", { className: "muted", textContent: counts }), el("span", { className: "badge " + s.status, textContent: LABEL[s.status] || s.status }), actions);
}

function renderServers() {
  $("list").replaceChildren(...(state.servers.length ? state.servers.map(serverRow) : [el("p", { className: "muted", textContent: "No servers yet. Install one from the Marketplace." })]));
  const banner = $("banner");
  banner.hidden = state.persistent;
  banner.textContent = "This config was supplied inline, so changes last only until better-mcp restarts.";
}

function openDialog(name, cfg, title, setup) {
  $("dtitle").textContent = title;
  $("dsetup").textContent = setup ? "Setup: " + setup : "";
  $("dname").value = name;
  $("dcfg").value = JSON.stringify(cfg, null, 2);
  $("derr").textContent = "";
  $("dlg").showModal();
}
$("form").onsubmit = async (ev) => {
  if (ev.submitter && ev.submitter.value !== "save") return;
  ev.preventDefault();
  try {
    await api("servers", "POST", { name: $("dname").value.trim(), config: JSON.parse($("dcfg").value) });
    $("dlg").close();
    refresh();
  } catch (e) { $("derr").textContent = e.message; }
};
$("custom").onclick = () => openDialog("", { command: "npx", args: ["-y", "some-mcp-server"] }, "Add custom server", "");

function marketCard(e) {
  const initial = el("div", { className: "logo", textContent: e.name[0].toUpperCase() });
  const logo = e.logo ? el("img", { className: "logo", src: e.logo, alt: "", referrerPolicy: "no-referrer" }) : initial;
  logo.onerror = () => logo.replaceWith(initial);
  const installed = state.servers.some((s) => s.name === e.id);
  const btn = el("button", { className: "btn primary", textContent: installed ? "Installed" : "Install", disabled: installed });
  btn.onclick = () => openDialog(e.id, e.config, "Install " + e.name, e.setup);
  return el("article", { className: "card" },
    el("div", { className: "head" }, logo, el("div", {}, el("div", { className: "name", textContent: e.name }), el("div", { className: "muted", textContent: e.category }))),
    el("p", { textContent: e.description }), btn);
}
function renderMarket() {
  const q = $("q").value.toLowerCase();
  const shown = catalog.entries.filter((e) => !q || [e.id, e.name, e.description, ...e.tags].join(" ").toLowerCase().includes(q));
  $("grid").replaceChildren(...shown.map(marketCard));
  $("msrc").textContent = catalog.source === "none" ? "Marketplace unavailable (offline and no bundled copy)." : catalog.source === "bundled" ? "Showing the bundled catalog (couldn't reach GitHub)." : "";
}
$("q").oninput = renderMarket;

document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
  $("servers").hidden = t.dataset.tab !== "servers";
  $("market").hidden = t.dataset.tab !== "market";
}));

async function refresh() {
  try { state = await api("state"); renderServers(); renderMarket(); } catch {}
}
api("catalog").then((c) => { catalog = c; renderMarket(); }).catch(() => {});
refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>
`;
}
