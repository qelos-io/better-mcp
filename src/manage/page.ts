/** Single-file management UI. All dynamic content is inserted via textContent. */
export function renderManagePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>better-mcp</title>
<style>
:root{color-scheme:light dark;--bg:#fafaf9;--fg:#1c1917;--muted:#6b645f;--card:#fff;--hover:#f5f5f4;--line:#e7e5e4;--accent:#4f46e5;--accent-fg:#fff;--ok:#15803d;--warn:#b45309;--bad:#b91c1c;--bad-bg:#fef2f2;--focus:#4f46e5;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#f5f5f4;--muted:#a8a29e;--card:#171412;--hover:#211d1a;--line:#2a2522;--accent:#818cf8;--accent-fg:#0c0a09;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;--bad-bg:#2a1514;--focus:#a5b4fc}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
::selection{background:var(--accent);color:var(--accent-fg)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:6px}
main{max-width:920px;margin:0 auto;padding:28px 20px 72px}
h1{margin:0;font-size:20px;font-weight:650;letter-spacing:-.01em}
.top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-bottom:12px;margin-bottom:20px;border-bottom:1px solid var(--line)}
.tabs{display:flex;gap:4px}
.tab{font:inherit;font-size:14px;font-weight:500;padding:6px 12px;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer;transition:background .15s,color .15s}
.tab:hover{background:var(--hover);color:var(--fg)}
.tab[aria-selected=true]{background:var(--hover);color:var(--fg)}
.btn{font:inherit;font-size:13px;font-weight:500;padding:6px 12px;min-height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap;transition:background .15s,border-color .15s}
.btn:hover{background:var(--hover);border-color:var(--muted)}
.btn.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.btn.primary:hover{filter:brightness(1.08)}
.btn.ghost{border-color:transparent;background:none;color:var(--muted)}
.btn.ghost:hover{background:var(--hover);color:var(--fg)}
.btn.danger:hover,.btn.danger.armed{color:var(--bad);border-color:var(--bad);background:none}
.btn:disabled{opacity:.5;cursor:default}
.banner{background:var(--card);border:1px solid var(--warn);border-radius:8px;padding:8px 12px;margin-bottom:16px;font-size:14px}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.summary{color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums}
.list{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
.row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:4px 14px;align-items:start;padding:14px 16px}
.row+.row{border-top:1px solid var(--line)}
.dot{width:8px;height:8px;border-radius:50%;background:currentColor;margin-top:8px}
.main{min-width:0}
.title{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.name{font-weight:600}
.state{font-size:13px;font-variant-numeric:tabular-nums}
.target{font:12px var(--mono);color:var(--muted);overflow-wrap:anywhere;margin-top:2px}
.actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.notice{grid-column:2/-1;margin-top:8px;font-size:13px;color:var(--muted);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.err{grid-column:2/-1;margin-top:8px;font-size:13px;color:var(--bad);background:var(--bad-bg);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere}
.err .msg{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.err.open .msg{display:block}
.err button{all:unset;cursor:pointer;text-decoration:underline;text-underline-offset:3px;margin-top:4px;font-size:12px}
.err button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.connected :is(.dot,.state){color:var(--ok)}.needs_auth :is(.dot,.state),.authenticating :is(.dot,.state),.connecting :is(.dot,.state){color:var(--warn)}.error :is(.dot,.state){color:var(--bad)}.disabled :is(.dot,.state){color:var(--muted)}
.authenticating .dot,.connecting .dot{animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.authenticating .dot,.connecting .dot{animation:none}}
.empty{padding:32px 16px;text-align:center;color:var(--muted);margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.card .btn{align-self:flex-start;margin-top:auto}
.head{display:flex;gap:10px;align-items:center}
.logo{width:36px;height:36px;border-radius:8px;object-fit:contain;display:grid;place-items:center;background:var(--bg);font-weight:700;color:var(--muted);flex:none}
.card p{margin:0;font-size:14px}.muted{color:var(--muted)}
input,textarea{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%;caret-color:var(--accent)}
textarea{font:13px var(--mono);min-height:220px}
dialog{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:12px;width:min(560px,92vw)}
dialog::backdrop{background:#0008}
.field{display:grid;gap:4px;margin-bottom:12px;font-size:14px}
.toolbar{display:flex;gap:8px;margin-bottom:12px}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);max-width:min(480px,92vw);background:var(--fg);color:var(--bg);padding:10px 14px;border-radius:10px;font-size:14px;box-shadow:0 8px 24px #0004}
@media (max-width:560px){.row{grid-template-columns:10px minmax(0,1fr)}.actions{grid-column:2/-1;justify-content:flex-start;margin-top:8px}}
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
<section id="servers">
  <div class="bar"><span class="summary" id="summary" aria-live="polite"></span><button class="btn" id="custom">Add custom server…</button></div>
  <div class="list" id="list"></div>
</section>
<section id="market" hidden>
  <div class="toolbar"><input type="search" id="q" placeholder="Search marketplace…" aria-label="Search marketplace"></div>
  <p class="muted" id="msrc"></p>
  <div class="grid" id="grid"></div>
</section>
</main>
<div class="toast" id="toast" role="status" hidden></div>
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
const LABEL = { connected: "Connected", needs_auth: "Needs login", authenticating: "Waiting for login…", connecting: "Connecting…", error: "Error", disabled: "Disabled" };
let toastTimer, armed = null, lastState = "";
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}
function summarize(servers) {
  if (!servers.length) return "";
  const n = (st) => servers.filter((s) => s.status === st).length;
  const parts = [[n("connected"), "connected"], [n("authenticating") + n("needs_auth"), "need login"], [n("error"), "failing"], [n("disabled"), "disabled"]]
    .filter(([c]) => c).map(([c, l]) => c + " " + l);
  return servers.length + (servers.length === 1 ? " server" : " servers") + (parts.length ? " · " + parts.join(" · ") : "");
}
function countsText(s) {
  if (s.status !== "connected") return "";
  const bits = [s.tools + (s.tools === 1 ? " tool" : " tools")];
  if (s.resources) bits.push(s.resources + " resources");
  if (s.prompts) bits.push(s.prompts + " prompts");
  return bits.join(", ");
}

function serverRow(s) {
  const act = (label, fn, cls = "") => {
    const b = el("button", { className: "btn " + cls, textContent: label });
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { toast(e.message); } refresh(true); };
    return b;
  };
  const p = encodeURIComponent(s.name);
  const actions = el("div", { className: "actions" });
  const canLogin = s.transport === "http" && s.status !== "connected" && s.status !== "disabled";
  if (s.status === "authenticating" && s.loginUrl)
    actions.append(el("a", { className: "btn primary", href: s.loginUrl, target: "_blank", rel: "noopener", textContent: "Open login page" }));
  else if (canLogin && s.status !== "authenticating")
    actions.append(act("Log in", () => api("servers/" + p + "/login", "POST"), "primary"));
  if (s.status === "connected" || s.status === "error") actions.append(act("Reconnect", () => api("servers/" + p + "/reconnect", "POST"), "ghost"));
  actions.append(act(s.status === "disabled" ? "Enable" : "Disable", () => api("servers/" + p + "/" + (s.status === "disabled" ? "enable" : "disable"), "POST"), "ghost"));
  const rm = el("button", { className: "btn ghost danger" + (armed === s.name ? " armed" : ""), textContent: armed === s.name ? "Confirm remove" : "Remove" });
  rm.onclick = async () => {
    if (armed !== s.name) { armed = s.name; renderServers(); setTimeout(() => { if (armed === s.name) { armed = null; renderServers(); } }, 4000); return; }
    armed = null; rm.disabled = true;
    try { await api("servers/" + p, "DELETE"); } catch (e) { toast(e.message); }
    refresh(true);
  };
  actions.append(rm);

  const label = s.finishing ? "Finishing sign-in…" : LABEL[s.status] || s.status;
  const counts = countsText(s);
  const main = el("div", { className: "main" },
    el("div", { className: "title" }, el("span", { className: "name", textContent: s.name }), el("span", { className: "state", textContent: counts ? label + " · " + counts : label })),
    el("div", { className: "target", textContent: s.target }));
  const row = el("div", { className: "row " + s.status }, el("span", { className: "dot", "aria-hidden": "true" }), main, actions);
  if (s.status === "authenticating")
    row.append(el("div", { className: "notice", textContent: s.finishing ? "Signed in. Connecting and loading tools, this can take a few seconds." : s.loginUrl ? "Finish signing in in your browser. If no window opened, use the login page link." : "Starting login…" }));
  if (s.error) {
    const box = el("div", { className: "err" }, el("div", { className: "msg", textContent: s.error }));
    if (s.error.length > 110) {
      const more = el("button", { type: "button", textContent: "Show details" });
      more.onclick = () => { box.classList.toggle("open"); more.textContent = box.classList.contains("open") ? "Hide details" : "Show details"; };
      box.append(more);
    }
    row.append(box);
  }
  return row;
}

function renderServers() {
  $("summary").textContent = summarize(state.servers);
  $("list").replaceChildren(...(state.servers.length ? state.servers.map(serverRow) : [el("p", { className: "empty", textContent: "No servers yet. Install one from the Marketplace." })]));
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

async function refresh(force) {
  try {
    const next = await api("state");
    const key = JSON.stringify(next);
    if (!force && key === lastState) return;
    lastState = key; state = next; renderServers(); renderMarket();
  } catch {}
}
api("catalog").then((c) => { catalog = c; renderMarket(); }).catch(() => {});
refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>
`;
}
