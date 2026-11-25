// Client report page: /r/<link>  (read only, optional password).
import {esc, fmtHours, prettyDate, presetRange, isMonth, monthName, monthLabel, currentMonth, today, csvCell} from '../util.js';
import {listEntries} from '../db.js';
import {dashCss} from './dash.js';

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
<meta name="robots" content="noindex,nofollow"><link rel="icon" type="image/png" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><title>${esc(title)}</title><style>${reportCss}${dashCss}</style></head><body>${inner}</body></html>`;

// first line as a title, the rest as details
const descHtml = d => { const i = d.indexOf('\n'); return i < 0 ? esc(d) : `<strong>${esc(d.slice(0, i))}</strong>\n${esc(d.slice(i + 1))}`; };

export function reportLogin(company, error = '') {
  return page(`${company.name} work log`, `<form class="card login" method="post">
<p class="kicker">Work log</p><h1>${esc(company.name)}</h1><p>Enter the password VectorPC gave you.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}<input type="password" name="password" autocomplete="current-password" placeholder="Password" required autofocus>
<button type="submit">View work log</button></form>`);
}

export function reportRange(url, scope) {
  const sp = url.searchParams;
  let preset = sp.get('range') || '', from = sp.get('from') || '', to = sp.get('to') || '';
  if (from || to) { preset = 'custom'; if (!isMonth(from)) from = ''; if (!isMonth(to)) to = ''; if (from && to && from > to) [from, to] = [to, from]; }
  else { if (!presetRange(preset)) preset = 'this-month'; ({from, to} = presetRange(preset)); }
  // one company of a client link that shows several
  const company = scope.companies.length > 1 ? scope.companies.find(c => String(c.id) === sp.get('company')) || null : null;
  return {preset, from, to, company};
}

const companyOf = (scope, range) => scope.companies.length === 1 ? scope.companies[0] : range.company;

export async function reportData(env, scope, range) {
  const one = companyOf(scope, range);
  return listEntries(env.DB, {companyId: one ? one.id : null, from: range.from, to: range.to, limit: 5000, liveOnly: !one});
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function reportCsv(scope, range, r) {
  const many = !companyOf(scope, range);
  const lines = [(many ? ['Month', 'Company', 'Description', 'Project', 'Hours'] : ['Month', 'Description', 'Project', 'Hours']).join(',')]
    .concat(r.entries.map(e => (many ? [monthName(e.month), e.company, e.description, e.project, e.hours] : [monthName(e.month), e.description, e.project, e.hours]).map(csvCell).join(',')));
  lines.push((many ? ['Total', '', '', '', r.total_hours] : ['Total', '', '', r.total_hours]).map(csvCell).join(','));
  const name = companyOf(scope, range)?.name || 'all-companies';
  return new Response('﻿' + lines.join('\r\n'), {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${slug(name)}-work-log-${range.from || 'start'}-${range.to || currentMonth()}.csv"`}});
}

const listNames = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
// first line is the title (shown without a closing full stop), the rest the details
const split = d => { const i = d.indexOf('\n'), t = (i < 0 ? d : d.slice(0, i)).replace(/\.$/, ''); return [t, i < 0 ? '' : d.slice(i + 1)]; };

export function reportPage(scope, range, r, base) {
  const one = companyOf(scope, range), many = scope.companies.length > 1;
  const label = range.preset === 'all' ? 'All time'
    : range.from && range.from === range.to ? monthLabel(range.from)
    : `${range.from ? monthName(range.from) : 'Start'} to ${range.to ? monthName(range.to) : 'now'}`;
  const rq = range.preset === 'custom' ? `from=${range.from}&to=${range.to}` : `range=${range.preset}`;
  const cq = range.company ? `&company=${range.company.id}` : '';
  const link = (q, c = cq) => `${base}?${q}${c}`;

  // by company, largest items
  const by = {};
  for (const e of r.entries) { const b = by[e.company] ||= {id: e.company_id, n: 0, h: 0, items: []}; b.n++; b.h += e.hours; b.items.push(e); }
  const names = Object.keys(by).sort((a, b) => by[b].h - by[a].h);
  const companyTable = !one && names.length ? `<section class="card dash"><h2>By company</h2><table class="by"><thead><tr><th>Company</th><th class="n">Items</th><th class="n">Hours</th><th class="share">Share</th><th class="n">Avg per item</th></tr></thead><tbody>`
    + names.map(n => { const b = by[n], pct = r.total_hours ? b.h / r.total_hours * 100 : 0;
      return `<tr><td><a href="${link(rq, '&company=' + b.id)}">${esc(n)}</a></td><td class="n">${b.n}</td><td class="n"><b>${fmtHours(b.h)}</b></td><td class="share"><span class="sbar"><i style="width:${pct.toFixed(1)}%"></i></span><span class="pct">${pct.toFixed(0)}%</span></td><td class="n">${fmtHours(b.h / b.n)}</td></tr>`; }).join('')
    + `<tr class="sum"><td>Total</td><td class="n">${r.count}</td><td class="n"><b>${fmtHours(r.total_hours)}</b></td><td class="share"></td><td class="n">${r.count ? fmtHours(r.total_hours / r.count) : ''}</td></tr></tbody></table></section>` : '';
  const top = list => list.slice().sort((a, b) => b.hours - a.hours).slice(0, 5)
    .map(e => `<li><a href="#e${e.id}" data-open="e${e.id}"><span class="t">${esc(split(e.description)[0])}</span><b>${fmtHours(e.hours)} h</b></a></li>`).join('');
  const largest = names.length ? `<section class="card dash"><h2>Largest items</h2><div class="tops">`
    + names.map(n => `<div class="topcol"><h3>${one ? '' : `<a href="${link(rq, '&company=' + by[n].id)}">${esc(n)}</a>`}</h3><ol>${top(by[n].items)}</ol></div>`).join('') + `</div></section>` : '';

  // the full list: one line per item, tap for the details
  const byMonth = {};
  for (const e of r.entries) byMonth[e.month] = (byMonth[e.month] || 0) + e.hours;
  let rows = '', cur = '';
  for (const e of r.entries) {
    if (e.month !== cur) { cur = e.month; rows += `<div class="mrow"><span>${esc(monthLabel(e.month))}</span><b>${fmtHours(byMonth[e.month])} h</b></div>`; }
    const [t, more] = split(e.description);
    rows += `<details class="item" id="e${e.id}"><summary><span class="t">${esc(t)}</span>${!one ? `<span class="co">${esc(e.company)}</span>` : ''}<b class="h">${fmtHours(e.hours)}</b></summary>`
      + `<div class="more">${more ? `<p>${esc(more)}</p>` : ''}${e.project ? `<span class="proj">${esc(e.project)}</span>` : ''}${!more && !e.project ? '<p class="muted">No further details.</p>' : ''}</div></details>`;
  }
  const title = one ? one.name : listNames(scope.companies.map(c => c.name));
  return page(`${title} work log`, `<div class="wrap">
<header class="top"><div><p class="kicker">Work log</p><h1>${esc(title)}</h1></div>
<div class="by">Prepared by <strong>VectorPC</strong><br>${esc(label)}</div></header>
<section class="card filters noprint"><nav class="presets">${PRESETS.map(([k, v]) => `<a href="${link('range=' + k)}"${range.preset === k ? ' class="on"' : ''}>${v}</a>`).join('')}</nav>
<form class="custom" method="get" action="${base}"><span>From</span><input type="month" name="from" value="${esc(range.from)}" aria-label="From month" placeholder="2026-10"><span>to</span><input type="month" name="to" value="${esc(range.to)}" aria-label="To month" placeholder="2026-11">${range.company ? `<input type="hidden" name="company" value="${range.company.id}">` : ''}<button type="submit">Apply</button></form>
${many ? `<nav class="presets cos"><a href="${link(rq, '')}"${!range.company ? ' class="on"' : ''}>All companies</a>${scope.companies.map(c => `<a href="${link(rq, '&company=' + c.id)}"${range.company && range.company.id === c.id ? ' class="on"' : ''}>${esc(c.name)}</a>`).join('')}</nav>` : ''}
<p class="note">Months run from the 26th to the 25th.</p></section>
<section class="summary"><div class="card stat"><div class="k">Total hours</div><div class="v">${fmtHours(r.total_hours)} <small>h</small></div><div class="s">${esc(label)}</div></div>
<div class="card stat"><div class="k">Items of work</div><div class="v">${r.count}</div><div class="s">${r.count ? fmtHours(r.total_hours / r.count) + ' h per item on average' : '&nbsp;'}</div></div></section>
${r.entries.length ? companyTable + largest : ''}
<div class="actions"><h2 class="lh">All work</h2><a class="btn ghost noprint" href="${base}/csv?${rq}${cq}">Download CSV</a><button type="button" class="btn ghost noprint" onclick="openAll()">Show all details</button><button type="button" class="btn ghost noprint" onclick="openAll();print()">Print or save PDF</button></div>
<section class="card list">${r.entries.length ? rows + `<div class="mrow total"><span>Total</span><b>${fmtHours(r.total_hours)} h</b></div>` : `<div class="empty">No work logged for ${esc(label)}.</div>`}</section>
<footer>Generated ${esc(prettyDate(today()))} &middot; VectorPC &middot; vectorpc.co.za</footer></div>
<script>function openAll(){document.querySelectorAll('details.item').forEach(function(d){d.open=true})}
function openHash(){var d=location.hash&&document.getElementById(location.hash.slice(1));if(d&&d.tagName==='DETAILS'){d.open=true;d.scrollIntoView({block:'center'});d.classList.add('flash');setTimeout(function(){d.classList.remove('flash')},1600)}}
addEventListener('hashchange',openHash);openHash();</script>`);
}
