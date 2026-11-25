// Admin pages: sign-in and the single-page work log editor (Work, Companies, Import, Settings).
import {esc} from '../util.js';
import {client} from './admin.client.js';
import {vpxBar} from '../vpxbar.js';
import {vpxCss, vpxJs} from '../vpxstyle.js';
import {dashCss} from './dash.js';

const css = `:root{color-scheme:dark;--ink:#f4f4f5;--muted:#a1a1aa;--faint:#71717a;--line:#322f34;--card:#1c1b1e;--card2:#232126;--bg:#131315;--accent:#14c3be;--accent2:#0aa8a4;--red:#fca5a5;--amber:#fcd34d;--green:#6ee7b7;--grad:linear-gradient(135deg,#14c3be,#0aa8a4)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;color:var(--ink);font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(circle at 12% 0%,rgba(10,168,164,.13),transparent 40%),radial-gradient(circle at 95% 100%,rgba(20,195,190,.08),transparent 40%),var(--bg);background-attachment:fixed;padding-bottom:env(safe-area-inset-bottom)}
a{color:var(--accent)}button,input,select,textarea{font:inherit;color:inherit}
button{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:9px 15px;font-weight:650;min-height:42px;cursor:pointer;-webkit-tap-highlight-color:transparent}
button:hover{border-color:#71717a}button:disabled{opacity:.5;cursor:wait}
.primary{background:var(--grad)!important;border-color:transparent!important;color:#fff!important;box-shadow:rgba(10,168,164,.25) 0 8px 20px}.primary:hover{filter:brightness(1.08)}
.danger{color:var(--red);border-color:rgba(248,113,113,.3)}.small{min-height:34px;padding:5px 11px;font-size:12.5px;border-radius:8px}.quiet{background:transparent}
input,select,textarea{background:var(--bg);border:1px solid #46424a;border-radius:9px;padding:9px 11px;min-height:42px;width:100%;min-width:0}
textarea{min-height:140px;resize:vertical;line-height:1.5}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(10,168,164,.16)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
select option{background:var(--card)}
.topbar{position:sticky;top:calc(53px + env(safe-area-inset-top, 0px));z-index:20;background:rgba(19,19,21,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07)}
.topbar .in{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:8px 16px;flex-wrap:wrap}
.vpx-slot .signout{font-size:13px}
.wordmark{font-weight:780;letter-spacing:-.3px;font-size:16px;white-space:nowrap}.wordmark span{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.tabs{display:flex;gap:4px;background:#242226;padding:4px;border-radius:11px;overflow-x:auto;scrollbar-width:none}
.tabs button{border:0;background:transparent;min-height:34px;padding:6px 13px;font-size:13.5px;border-radius:8px;white-space:nowrap;color:var(--muted)}
.tabs button[aria-selected=true]{background:var(--card);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.28)}
.tabs button:focus-visible{outline-offset:-2px}
.spacer{flex:1}.signout{font-size:13px;color:var(--muted);text-decoration:none}
main{max-width:1100px;margin:0 auto;padding:18px 16px 70px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px}
.filters{display:grid;grid-template-columns:1.3fr 1fr 1.4fr;gap:10px;padding:12px;margin-bottom:14px}
.filters .custom{display:none;grid-column:1/-1;gap:10px;grid-template-columns:1fr 1fr}.filters.custom-on .custom{display:grid}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px}
.stat{padding:14px 16px}.stat .k{font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted);font-weight:700}
.stat .v{font-size:28px;font-weight:780;letter-spacing:-.6px;font-variant-numeric:tabular-nums}.stat .v small{font-size:13px;color:var(--muted);font-weight:600;letter-spacing:0}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 14px}.chip{font-size:12px;background:#242226;color:var(--muted);border-radius:999px;padding:3px 10px;border:0;min-height:0;font-weight:600}
.chip b{color:var(--ink);font-weight:700}
.bar{display:flex;align-items:center;gap:8px;margin:0 0 12px;flex-wrap:wrap}.bar h2{margin:0;font-size:15px}.bar .spacer{flex:1}
.list{overflow:hidden}.mhead{display:flex;justify-content:space-between;padding:10px 16px;background:#1f1e21;border-top:1px solid #29272c;font-size:12.5px;font-weight:700;color:var(--muted)}.mhead:first-child{border-top:0}.mhead b{color:var(--ink)}
.entry{display:grid;grid-template-columns:1fr auto;gap:14px;padding:13px 16px;border-top:1px solid #29272c;cursor:pointer;align-items:start}
.entry:first-child{border-top:0}.entry:hover{background:#201f23}.entry .d{color:var(--muted);font-size:13px;white-space:nowrap}
.entry .c{font-size:12px;font-weight:700;color:var(--accent)}.entry .t strong{font-weight:650}.entry .t{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.entry .h{font-weight:780;font-variant-numeric:tabular-nums;white-space:nowrap;font-size:15px}
.tag{display:inline-block;font-size:11px;font-weight:650;background:#242226;color:var(--muted);border-radius:5px;padding:1px 7px;margin:5px 6px 0 0}
.tag.claude{color:#c4b5fd;background:rgba(167,139,250,.13)}.tag.import{color:var(--amber);background:rgba(251,191,36,.12)}
.empty{padding:36px 16px;text-align:center;color:var(--muted)}
.company{padding:14px 16px;border-top:1px solid #29272c;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.company:first-child{border-top:0}
.company .n{font-weight:700}.company .s{font-size:12.5px;color:var(--muted)}.company .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.company.archived{opacity:.55}
dialog{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:16px;padding:0;width:min(620px,calc(100vw - 24px));max-height:calc(100vh - 24px);box-shadow:0 30px 80px rgba(0,0,0,.45)}
dialog::backdrop{background:rgba(0,0,0,.6)}dialog form{display:flex;flex-direction:column;max-height:calc(100vh - 26px)}
.dh{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}.dh h3{margin:0;font-size:16px}
.db{padding:16px 18px;overflow:auto;display:grid;gap:12px}.df{padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.df .left{margin-right:auto}label.f{display:grid;gap:5px;font-size:12.5px;color:var(--muted);font-weight:600}.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hint{font-size:12.5px;color:var(--muted);margin:0}.msg{font-size:13px;margin:0}.msg.bad{color:var(--red)}.msg.ok{color:var(--green)}
.section{padding:16px 18px;margin-bottom:14px}.section h3{margin:0 0 6px;font-size:15px}.section p{margin:0 0 10px;color:var(--muted);font-size:13.5px}
.copy{display:flex;gap:8px}.copy input{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
pre{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;white-space:pre-wrap;font-size:12.5px;overflow:auto;margin:0 0 10px}
.map{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
.preview{overflow:auto;max-height:420px}.preview table{width:100%;border-collapse:collapse;font-size:12.5px}.preview th{position:sticky;top:0;background:#1f1e21;text-align:left;padding:8px 10px;color:var(--muted);font-size:10.5px;letter-spacing:1px;text-transform:uppercase}
.preview td{padding:7px 10px;border-top:1px solid #29272c;vertical-align:top}.preview tr.bad td{background:rgba(248,113,113,.1)}.preview td.err{color:var(--red)}
.preview td.desc{max-width:420px;white-space:pre-wrap}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#2a282d;border:1px solid var(--line);padding:10px 16px;border-radius:10px;font-size:13.5px;z-index:99;box-shadow:0 10px 30px rgba(0,0,0,.4);display:none}
.login{max-width:380px;margin:12vh auto 0;padding:26px}.login h1{font-size:20px;margin:0 0 4px}.login p{color:var(--muted);margin:0 0 18px;font-size:14px}.login input{margin-bottom:12px}.login button{width:100%}
@media(max-width:720px){.filters{grid-template-columns:1fr}.entry{gap:4px 12px}
 .company{grid-template-columns:1fr}.company .acts{justify-content:flex-start}.row2{grid-template-columns:1fr}.tabs{width:100%}}`;

const head = title => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#131315"><link rel="icon" type="image/png" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><title>${esc(title)}</title><style>${css}${vpxCss}${dashCss}</style></head>`;

export function loginPage({error = '', notConfigured = false} = {}) {
  return `${head('Sign in · VectorPC Work Log')}<body><form class="panel login" method="post" action="/login">
<div class="wordmark" style="display:flex;align-items:center;gap:10px"><img src="/mark.svg" alt="" width="32" height="32" style="border-radius:9px">VectorPC <span>Work Log</span></div><p>Sign in to log and manage work.</p>
${notConfigured ? `<p class="msg bad">No password is set yet. In Cloudflare, open this Worker, Settings, Variables and Secrets, and add a secret called ADMIN_PASSWORD (at least 8 characters).</p>` : ''}
${error ? `<p class="msg bad">${esc(error)}</p>` : ''}
<input name="username" autocomplete="username" placeholder="Username" required autofocus autocapitalize="none">
<input name="password" type="password" autocomplete="current-password" placeholder="Password" required>
<button class="primary" type="submit">Sign in</button></form></body></html>`;
}

export function adminPage() {
  return `${head('VectorPC Work Log')}<body>
${vpxBar({app: 'Work Log', appHref: '/', mark: '/mark.svg', slot: '<a class="signout" href="/logout">Sign out</a>'})}
<header class="topbar"><div class="in"><nav class="tabs" role="tablist"><button role="tab" data-tab="work" aria-selected="true">Work</button><button role="tab" data-tab="companies">Companies</button><button role="tab" data-tab="import">Import</button><button role="tab" data-tab="settings">Settings</button></nav>
</div></header>
<main>
<section data-view="work">
  <div class="panel filters" id="filters">
    <select id="f-company" aria-label="Company"><option value="">All companies</option></select>
    <select id="f-range" aria-label="Date range"><option value="this-month">This month</option><option value="last-month">Last month</option><option value="last-3">Last 3 months</option><option value="this-year">This year</option><option value="last-year">Last year</option><option value="all">All time</option><option value="custom">Choose months</option></select>
    <input id="f-q" class="q" type="search" placeholder="Search descriptions" aria-label="Search">
    <div class="custom"><label class="f">From month<input id="f-from" type="month" placeholder="2026-10"></label><label class="f">To month<input id="f-to" type="month" placeholder="2026-11"></label></div>
  </div>
  <div class="stats"><div class="panel stat"><div class="k">Total hours</div><div class="v" id="s-hours">0</div></div><div class="panel stat"><div class="k">Items</div><div class="v" id="s-count">0</div></div><div class="panel stat"><div class="k">Avg per item</div><div class="v" id="s-avg">0</div></div></div>
  <div id="dash"></div>
  <div class="bar"><h2 id="list-title">All work</h2><span class="spacer"></span><a id="csv" class="small" href="#" style="font-size:13px">Download CSV</a><button class="primary" id="add-entry">+ Log work</button></div>
  <div class="panel list" id="entries"><div class="empty">Loading…</div></div>
</section>
<section data-view="companies" hidden>
  <div class="panel section"><h3>Client link (every company)</h3><p>One page for the client with all the companies: the dashboard, totals per company and every item. Each company below also has its own link.</p>
  <div class="copy"><input id="cl-url" readonly aria-label="Client link"><button class="small" data-copy="cl-url">Copy</button><a class="small" id="cl-open" target="_blank" rel="noopener" style="align-self:center;font-size:12.5px">Open</a></div>
  <p class="hint" id="cl-state" style="margin:10px 0 6px"></p>
  <div class="copy"><input id="cl-pw" type="text" autocomplete="off" placeholder="New client password (optional)"><button class="small" id="cl-save">Set</button></div>
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="small" id="cl-clear" hidden>Remove password</button><button class="small danger" id="cl-new">New link</button></div></div>
  <div class="bar"><h2>Companies</h2><span class="spacer"></span><button class="primary" id="add-company">+ Add company</button></div>
  <p class="hint" style="margin:-4px 0 12px">Work is logged per billing month (26th to 25th), without days. Each company has its own private report link for the client. Aliases are other names it goes by (so "log this for RSB" finds it).</p>
  <div class="panel list" id="companies"></div>
</section>
<section data-view="import" hidden>
  <div class="panel section"><h3>Import from Excel or CSV</h3>
  <p>Choose an .xlsx, .xls or .csv file. Columns are matched automatically (Month or Date, Company or Client, Description, Hours, Project). A date is put in its billing month (26th to 25th) and you can change them below. Rows that are already in the log are skipped, so importing the same file twice is safe.</p>
  <input type="file" id="imp-file" accept=".xlsx,.xls,.xlsm,.csv,text/csv"><p class="msg" id="imp-msg"></p>
  <div id="imp-setup" hidden><div class="map" id="imp-map"></div>
  <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:12px"><input type="checkbox" id="imp-create" style="width:auto;min-height:0"> Create companies that do not exist yet</label>
  <div class="bar"><span id="imp-summary" class="hint"></span><span class="spacer"></span><button class="primary" id="imp-go">Import</button></div>
  <div class="panel preview" id="imp-preview"></div></div></div>
</section>
<section data-view="settings" hidden>
  <div class="panel section"><h3>Fill the instructions in for</h3><p>Pick the company and type the project or repo name: the instructions below fill themselves in.</p>
  <div class="row2"><label class="f">Company<select id="ins-company"></select></label><label class="f">Project or repo<input id="ins-project" placeholder="e.g. bulldogerp"></label></div></div>
  <div class="panel section"><h3>Instruction for Claude Code, with your key</h3>
  <p>Works on its own in Claude Code (VS Code or terminal), no connector needed. Change the first two lines per project. It contains your key: anyone who sees it can log work, so do not put it in a repo other people can see. Not for claude.ai chats (they cannot send data to a URL); use the connector there.</p>
  <pre id="snippet-api"></pre><button class="small" data-copy="snippet-api">Copy</button></div>
  <div class="panel section"><h3>API for scripts</h3><p>Same token, as a Bearer header.</p><pre id="curl"></pre></div>
  <details class="panel section"><summary style="cursor:pointer;font-weight:700">Claude chats on claude.ai (connector, optional)</summary><div style="margin-top:12px">
  <div class="section" style="padding:0;margin-bottom:14px"><h3>Connector for claude.ai chats</h3>
  <p>Add this once as a custom connector in Claude (Settings, Connectors, Add custom connector; name it "VectorPC Work Log"). It then works in every chat and project: just say "log the work".</p>
  <div class="copy"><input id="mcp-url" readonly aria-label="Connector URL"><button class="small" data-copy="mcp-url">Copy</button></div></div>
  <div class="section" style="padding:0;margin-bottom:14px"><h3>Instruction for claude.ai projects (uses the connector, no key)</h3>
  <p>Paste into a project's instructions (or a repo's CLAUDE.md) so work is logged automatically after code is pushed.</p>
  <pre id="snippet"></pre><button class="small" data-copy="snippet">Copy</button></div>
  </div></details>
  <div class="panel section"><h3>Security</h3><p>A new token stops the old key working: copy the instruction again into your projects. Signing out everywhere ends every signed-in browser.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="danger" id="new-token">New token</button><button id="sign-out-all">Sign out everywhere</button></div></div>
</section>
</main>

<dialog id="entry-dlg"><form method="dialog" id="entry-form"><div class="dh"><h3 id="entry-title">Log work</h3><button class="small quiet" value="cancel" formnovalidate>Close</button></div>
<div class="db"><label class="f">Company<select name="company_id" required></select></label>
<div class="row2"><label class="f">Billing month<input type="month" name="month" required placeholder="2026-11"></label><label class="f">Hours<input name="hours" inputmode="decimal" placeholder="e.g. 1.5 or 1:30" required></label></div>
<label class="f">Description of work done<textarea name="description" required placeholder="What was done, in words the client understands"></textarea></label>
<label class="f">Project (optional)<input name="project" placeholder="Repo or project name"></label><p class="msg" id="entry-msg"></p></div>
<div class="df"><button type="button" class="danger left" id="entry-del" hidden>Delete</button><button value="cancel" formnovalidate>Cancel</button><button class="primary" id="entry-save" value="save">Save</button></div></form></dialog>

<dialog id="company-dlg"><form method="dialog" id="company-form"><div class="dh"><h3 id="company-title">Company</h3><button class="small quiet" value="cancel" formnovalidate>Close</button></div>
<div class="db"><label class="f">Name<input name="name" required maxlength="120"></label>
<label class="f">Aliases (comma separated)<input name="aliases" placeholder="e.g. Bulldog, Keegan"></label>
<div id="company-extra"><label class="f">Client page password<input name="client_password" type="text" autocomplete="off" placeholder="Leave empty to keep as is"></label>
<p class="hint" id="pw-state"></p>
<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-top:10px"><input type="checkbox" name="archived" style="width:auto;min-height:0"> Archived (hidden from Claude and new entries)</label></div>
<p class="msg" id="company-msg"></p></div>
<div class="df"><span class="left" style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="small" id="pw-clear" hidden>Remove password</button><button type="button" class="small" id="new-link" hidden>New client link</button><button type="button" class="small danger" id="company-del" hidden>Delete</button></span>
<button value="cancel" formnovalidate>Cancel</button><button class="primary" value="save">Save</button></div></form></dialog>
<div class="toast" id="toast"></div>
<script>(${client.toString()})();</script><script>${vpxJs}</script></body></html>`;
}
