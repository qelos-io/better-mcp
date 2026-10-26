const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type CallbackPageKind = "success" | "error";

export function callbackPage(kind: CallbackPageKind, detail = ""): string {
  const ok = kind === "success";
  const title = ok ? "You're signed in" : "Sign-in failed";
  const body = ok
    ? 'Finishing up in better-mcp. <span id="hint">This tab will close on its own.</span>'
    : `${escapeText(detail) || "The login could not be completed."}<br>Close this tab and start the login again from better-mcp.`;
  const script = ok
    ? `<script>setTimeout(function(){window.close();setTimeout(function(){document.getElementById("hint").textContent="You can close this tab now."},400)},1500)</script>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark;--bg:#fafaf9;--fg:#1c1917;--muted:#6b645f;--card:#fff;--line:#e7e5e4;--tone:${ok ? "#15803d" : "#b91c1c"}}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#f5f5f4;--muted:#a8a29e;--card:#171412;--line:#2a2522;--tone:${ok ? "#4ade80" : "#f87171"}}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,sans-serif}
main{width:min(420px,calc(100vw - 32px));background:var(--card);border:1px solid var(--line);border-radius:12px;padding:28px 24px;text-align:center}
.mark{width:44px;height:44px;margin:0 auto 14px;border-radius:50%;border:2px solid var(--tone);color:var(--tone);display:grid;place-items:center}
h1{margin:0 0 6px;font-size:20px;font-weight:650;letter-spacing:-.01em}
p{margin:0;color:var(--muted);font-size:14px;overflow-wrap:anywhere}
</style></head>
<body><main role="status"><div class="mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ok ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<path d="M6 6l12 12M18 6L6 18"/>'}</svg></div>
<h1>${title}</h1><p>${body}</p></main>${script}</body></html>`;
}
