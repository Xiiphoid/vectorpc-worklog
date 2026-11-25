// Client report page: /r/<link>  (read only, optional password).
import {esc, fmtHours, prettyDate, presetRange, isMonth, monthName, monthLabel, currentMonth, today, csvCell} from '../util.js';
import {listEntries} from '../db.js';

const PRESETS = [['this-month', 'This month'], ['last-month', 'Last month'], ['last-3', 'Last 3 months'], ['this-year', 'This year'], ['last-year', 'Last year'], ['all', 'All time']];

export const reportCss = `:root{color-scheme:light;--ink:#14202e;--muted:#64748b;--line:#e3e8ef;--bg:#f5f7fa;--card:#fff;--accent:#0a9f9b;--accent-ink:#06716e}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent-ink)}.wrap{max-width:900px;margin:0 auto;padding:28px 18px 60px}
header.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.kicker{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0 0 4px}
h1{font-size:26px;line-height:1.2;margin:0;letter-spacing:-.4px}.by{font-size:13px;color:var(--muted);text-align:right}.by strong{color:var(--ink);font-weight:650}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px}
.filters{padding:14px;display:grid;gap:12px;margin-bottom:16px}.presets{display:flex;gap:6px;flex-wrap:wrap}
.presets a{padding:7px 12px;border-radius:999px;border:1px solid var(--line);text-decoration:none;color:var(--ink);font-size:13px;font-weight:600;background:#fff}
.presets a.on{background:var(--ink);border-color:var(--ink);color:#fff}
form.custom{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
input[type=month],input[type=password]{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);min-height:40px}
button,.btn{font:inherit;font-size:13px;font-weight:650;padding:9px 14px;border-radius:9px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;min-height:40px}
.btn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.stat{padding:16px 18px}.stat .k{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);font-weight:700}
.stat .v{font-size:30px;font-weight:780;letter-spacing:-.6px;font-variant-numeric:tabular-nums;margin-top:2px}.stat .v small{font-size:14px;color:var(--muted);font-weight:600;letter-spacing:0}
.stat .s{font-size:13px;color:var(--muted)}
.actions{display:flex;gap:8px;justify-content:flex-end;margin:0 0 10px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);padding:10px 14px;border-bottom:1px solid var(--line);background:#fafbfc}
td{padding:12px 14px;border-bottom:1px solid #edf1f5;vertical-align:top}tr:last-child td{border-bottom:0}
td.d{white-space:nowrap;color:var(--muted);width:1%}td.h{text-align:right;white-space:nowrap;font-weight:700;font-variant-numeric:tabular-nums;width:1%}
.desc{white-space:pre-wrap;overflow-wrap:anywhere}.desc strong{font-weight:650}.proj{display:inline-block;margin-top:5px;font-size:11px;font-weight:650;color:var(--muted);background:#eef2f6;border-radius:5px;padding:1px 7px}
tr.month td{background:#f6f8fb;font-weight:700;font-size:12px;letter-spacing:.4px;color:var(--ink);padding:8px 14px}tr.month td.h{color:var(--muted)}
tr.total td{border-top:2px solid var(--ink);font-weight:780;font-size:15px}.empty{padding:40px 18px;text-align:center;color:var(--muted)}
.table{overflow:hidden}.note{margin:0;font-size:12px;color:var(--muted)}footer{margin-top:22px;font-size:12px;color:var(--muted);text-align:center}
.login{max-width:380px;margin:12vh auto;padding:26px}.login h1{font-size:20px;margin-bottom:6px}.login p{color:var(--muted);font-size:14px;margin:0 0 16px}
.login input{width:100%;margin-bottom:12px}.login button{width:100%;justify-content:center}.err{color:#b42335;font-size:13px;margin:0 0 10px}
@media(max-width:600px){h1{font-size:22px}.by{text-align:left}td,th{padding:10px}td.d{font-size:12px}}
@media print{body{background:#fff;font-size:12px}.filters,.actions,.noprint{display:none!important}.card{border:0}.wrap{padding:0;max-width:none}
 .stat{border:1px solid var(--line)}th{background:#fff}tr{break-inside:avoid}}`;

const page = (title, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${reportCss}</style></head><body>${inner}</body></html>`;

// first line as a title, the rest as details
const descHtml = d => { const i = d.indexOf('\n'); return i < 0 ? esc(d) : `<strong>${esc(d.slice(0, i))}</strong>\n${esc(d.slice(i + 1))}`; };

export function reportLogin(company, error = '') {
  return page(`${company.name} work log`, `<form class="card login" method="post">
<p class="kicker">Work log</p><h1>${esc(company.name)}</h1><p>Enter the password VectorPC gave you.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}<input type="password" name="password" autocomplete="current-password" placeholder="Password" required autofocus>
<button type="submit">View work log</button></form>`);
}

export function reportRange(url) {
  const sp = url.searchParams;
  let preset = sp.get('range') || '', from = sp.get('from') || '', to = sp.get('to') || '';
  if (from || to) { preset = 'custom'; if (!isMonth(from)) from = ''; if (!isMonth(to)) to = ''; if (from && to && from > to) [from, to] = [to, from]; }
  else { if (!presetRange(preset)) preset = 'this-month'; ({from, to} = presetRange(preset)); }
  return {preset, from, to};
}

export async function reportData(env, company, range) {
  return listEntries(env.DB, {companyId: company.id, from: range.from, to: range.to, limit: 5000});
}

export function reportCsv(company, range, r) {
  const lines = [['Month', 'Description', 'Project', 'Hours'].join(',')]
    .concat(r.entries.map(e => [monthName(e.month), e.description, e.project, e.hours].map(csvCell).join(',')));
  lines.push(['Total', '', '', r.total_hours].map(csvCell).join(','));
  const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return new Response('﻿' + lines.join('\r\n'), {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${slug}-work-log-${range.from || 'start'}-${range.to || currentMonth()}.csv"`}});
}

export function reportPage(company, range, r, base) {
  const label = range.preset === 'all' ? 'All time'
    : range.from && range.from === range.to ? monthLabel(range.from)
    : `${range.from ? monthName(range.from) : 'Start'} to ${range.to ? monthName(range.to) : 'now'}`;
  const qs = range.preset === 'custom' ? `from=${range.from}&to=${range.to}` : `range=${range.preset}`;
  // grouped by billing month (26th to 25th), newest first
  const byMonth = {};
  for (const e of r.entries) byMonth[e.month] = (byMonth[e.month] || 0) + e.hours;
  const months = Object.keys(byMonth);
  let rows = '', cur = '';
  for (const e of r.entries) {
    if (e.month !== cur) { cur = e.month; rows += `<tr class="month"><td>${esc(monthLabel(e.month))}</td><td class="h">${fmtHours(byMonth[e.month])}</td></tr>`; }
    rows += `<tr><td><div class="desc">${descHtml(e.description)}</div>${e.project ? `<span class="proj">${esc(e.project)}</span>` : ''}</td><td class="h">${fmtHours(e.hours)}</td></tr>`;
  }
  return page(`${company.name} work log`, `<div class="wrap">
<header class="top"><div><p class="kicker">Work log</p><h1>${esc(company.name)}</h1></div>
<div class="by">Prepared by <strong>VectorPC</strong><br>${esc(label)}</div></header>
<section class="card filters noprint"><nav class="presets">${PRESETS.map(([k, v]) => `<a href="${base}?range=${k}"${range.preset === k ? ' class="on"' : ''}>${v}</a>`).join('')}</nav>
<form class="custom" method="get" action="${base}"><span>From</span><input type="month" name="from" value="${esc(range.from)}" aria-label="From month" placeholder="2026-10"><span>to</span><input type="month" name="to" value="${esc(range.to)}" aria-label="To month" placeholder="2026-11"><button type="submit">Apply</button></form>
<p class="note">Months run from the 26th to the 25th.</p></section>
<section class="summary"><div class="card stat"><div class="k">Total hours</div><div class="v">${fmtHours(r.total_hours)} <small>h</small></div><div class="s">${esc(label)}</div></div>
<div class="card stat"><div class="k">Items of work</div><div class="v">${r.count}</div><div class="s">${months.length > 1 ? `across ${months.length} months` : '&nbsp;'}</div></div></section>
<div class="actions"><a class="btn ghost" href="${base}/csv?${qs}">Download CSV</a><button type="button" class="btn ghost" onclick="print()">Print or save PDF</button></div>
<section class="card table">${r.entries.length ? `<table><thead><tr><th>Work done</th><th style="text-align:right">Hours</th></tr></thead><tbody>${rows}
<tr class="total"><td>Total</td><td class="h">${fmtHours(r.total_hours)}</td></tr></tbody></table>` : `<div class="empty">No work logged for ${esc(label)}.</div>`}</section>
<footer>Generated ${esc(prettyDate(today()))} &middot; VectorPC &middot; vectorpc.co.za</footer></div>`);
}
