// Browser code for the admin page. Serialised with toString(), so it must not use anything from module scope.
export function client() {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = h => (Math.round(Number(h || 0) * 100) / 100).toFixed(2);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pretty = d => { const [y, m, dd] = d.split('-'); return `${Number(dd)} ${MONTHS[m - 1]} ${y}`; };
  let state = {companies: [], month: ''}, entries = [];
  const desc = d => { const i = d.indexOf('\n'); return i < 0 ? esc(d) : '<strong>' + esc(d.slice(0, i)) + '</strong>\n' + esc(d.slice(i + 1)); };
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // billing months run 26th to 25th
  const monthOfDay = d => { let [y, m, dd] = d.split('-').map(Number); if (dd > 25) { m++; if (m === 13) { m = 1; y++; } } return y + '-' + String(m).padStart(2, '0'); };
  const mName = k => k ? MONTHS_LONG[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) : '';
  const mRange = k => { const [y, m] = k.split('-').map(Number); const p = m === 1 ? 12 : m - 1; return '26 ' + MONTHS[p - 1] + ' to 25 ' + MONTHS[m - 1]; };

  function toast(t) { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 2600); }

  async function api(path, opts = {}) {
    const r = await fetch('/admin/api' + path, {...opts, headers: {'Content-Type': 'application/json', ...(opts.headers || {})}, credentials: 'same-origin'});
    if (r.status === 401) { location.href = '/login'; throw new Error('Signed out'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
    return j;
  }

  // ---------- tabs ----------
  function show(tab) {
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('[data-view]').forEach(v => v.hidden = v.dataset.view !== tab);
    if (tab === 'settings') loadSettings();
    if (tab === 'companies') renderCompanies();
    history.replaceState(null, '', tab === 'work' ? location.pathname + location.search : '#' + tab);
  }
  $$('.tabs button').forEach(b => b.onclick = () => show(b.dataset.tab));

  // ---------- state ----------
  async function loadState() {
    state = await api('/state');
    const live = state.companies.filter(c => !c.archived);
    const fc = $('#f-company'), cur = fc.value;
    fc.innerHTML = '<option value="">All companies</option>' + state.companies.map(c => `<option value="${c.id}">${esc(c.name)}${c.archived ? ' (archived)' : ''}</option>`).join('');
    fc.value = cur;
    for (const [k, v] of Object.entries(state.labels || {})) { const o = $('#f-range option[value="' + k + '"]'); if (o) o.textContent = v; }
    $('#entry-form').company_id.innerHTML = live.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    renderCompanies();
  }

  // ---------- work list ----------
  function query() {
    const p = new URLSearchParams();
    const c = $('#f-company').value, r = $('#f-range').value, q = $('#f-q').value.trim();
    if (c) p.set('company', c);
    if (r === 'custom') { if ($('#f-from').value) p.set('from', $('#f-from').value); if ($('#f-to').value) p.set('to', $('#f-to').value); }
    else p.set('range', r);
    if (q) p.set('q', q);
    return p.toString();
  }

  async function loadEntries() {
    $('#filters').classList.toggle('custom-on', $('#f-range').value === 'custom');
    const qs = query();
    $('#csv').href = '/admin/api/entries.csv?' + qs;
    try {
      const r = await api('/entries?' + qs);
      entries = r.entries;
      $('#s-hours').innerHTML = fmt(r.total_hours) + ' <small>h</small>';
      $('#s-count').textContent = r.count;
      const by = {};
      for (const e of entries) by[e.company] = (by[e.company] || 0) + e.hours;
      const names = Object.keys(by).sort((a, b) => by[b] - by[a]);
      $('#s-by').innerHTML = !$('#f-company').value && names.length > 1 ? names.map(n => `<span class="chip">${esc(n)} <b>${fmt(by[n])} h</b></span>`).join('') : '';
      const perMonth = {};
      for (const e of entries) perMonth[e.month] = (perMonth[e.month] || 0) + e.hours;
      let lastM = '';
      $('#entries').innerHTML = entries.length ? entries.map(e => `${e.month !== lastM ? (lastM = e.month, `<div class="mhead"><span><b>${mName(e.month)}</b> · ${mRange(e.month)}</span><b>${fmt(perMonth[e.month])} h</b></div>`) : ''}<div class="entry" data-id="${e.id}">
        <div class="body"><div class="c">${esc(e.company)}</div><div class="t">${desc(e.description)}</div>${e.project ? `<span class="tag">${esc(e.project)}</span>` : ''}${e.source !== 'manual' ? `<span class="tag ${e.source}">${e.source === 'claude' ? 'Claude' : e.source === 'import' ? 'Imported' : 'API'}</span>` : ''}</div>
        <div class="h">${fmt(e.hours)} h</div></div>`).join('') + (r.truncated ? `<div class="empty">Showing the latest ${entries.length} of ${r.count}. Narrow the dates to see the rest.</div>` : '')
        : '<div class="empty">No work logged for this selection.</div>';
    } catch (e) { $('#entries').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  let qTimer;
  $('#f-q').oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(loadEntries, 250); };
  ['#f-company', '#f-range', '#f-from', '#f-to'].forEach(s => $(s).onchange = loadEntries);
  $('#entries').onclick = ev => { const row = ev.target.closest('.entry'); if (row) openEntry(entries.find(e => e.id === Number(row.dataset.id))); };

  // ---------- entry dialog ----------
  const dlg = $('#entry-dlg'), form = $('#entry-form');
  let editing = null;
  function openEntry(e) {
    editing = e || null;
    $('#entry-title').textContent = e ? 'Edit work' : 'Log work';
    $('#entry-del').hidden = !e;
    $('#entry-msg').textContent = '';
    if (e && !state.companies.find(c => c.id === e.company_id && !c.archived)) {
      form.company_id.insertAdjacentHTML('beforeend', `<option value="${e.company_id}" data-temp>${esc(e.company)}</option>`);
    }
    form.company_id.value = e ? e.company_id : ($('#f-company').value || form.company_id.value);
    form.month.value = e ? e.month : state.month;
    form.hours.value = e ? e.hours : '';
    form.description.value = e ? e.description : '';
    form.project.value = e ? e.project : '';
    dlg.showModal();
    (e ? form.description : form.hours).focus();
  }
  $('#add-entry').onclick = () => {
    if (!state.companies.some(c => !c.archived)) { toast('Add a company first'); show('companies'); return; }
    openEntry(null);
  };
  dlg.addEventListener('close', () => form.company_id.querySelectorAll('[data-temp]').forEach(o => o.remove()));
  form.onsubmit = async ev => {
    if (ev.submitter && ev.submitter.value !== 'save') return;
    ev.preventDefault();
    const body = {company_id: Number(form.company_id.value), month: form.month.value.trim(), hours: form.hours.value.trim(), description: form.description.value, project: form.project.value};
    $('#entry-save').disabled = true;
    try {
      await api(editing ? '/entries/' + editing.id : '/entries', {method: editing ? 'PUT' : 'POST', body: JSON.stringify(body)});
      dlg.close(); toast(editing ? 'Saved' : 'Logged'); loadEntries(); loadState();
    } catch (e) { $('#entry-msg').className = 'msg bad'; $('#entry-msg').textContent = e.message; }
    finally { $('#entry-save').disabled = false; }
  };
  $('#entry-del').onclick = async () => {
    if (!editing) return;
    const b = $('#entry-del');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to delete'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Delete'; }, 3000); return; }
    try { await api('/entries/' + editing.id, {method: 'DELETE'}); dlg.close(); toast('Deleted'); loadEntries(); loadState(); }
    catch (e) { $('#entry-msg').className = 'msg bad'; $('#entry-msg').textContent = e.message; }
  };

  // ---------- companies ----------
  function renderCompanies() {
    $('#companies').innerHTML = state.companies.length ? state.companies.map(c => `<div class="company${c.archived ? ' archived' : ''}" data-id="${c.id}">
      <div><div class="n">${esc(c.name)}${c.archived ? ' <span class="tag">Archived</span>' : ''}</div>
      <div class="s">${c.aliases ? 'Also: ' + esc(c.aliases) + ' · ' : ''}${fmt(c.total_hours)} h in ${c.entry_count} entries${c.last_month ? ' · last ' + mName(c.last_month) : ''}${c.has_password ? ' · client page has a password' : ''}</div></div>
      <div class="acts"><button class="small" data-act="copy">Copy client link</button><a class="small" href="${esc(c.report_url)}" target="_blank" rel="noopener" style="align-self:center;font-size:12.5px">Open</a>
      <button class="small" data-act="view">Work</button><button class="small" data-act="edit">Edit</button></div></div>`).join('')
      : '<div class="empty">No companies yet. Add Bulldog Abrasives, RSB and the rest here, or import a spreadsheet.</div>';
  }
  $('#companies').onclick = async ev => {
    const b = ev.target.closest('button[data-act]'); if (!b) return;
    const c = state.companies.find(x => x.id === Number(b.closest('.company').dataset.id));
    if (b.dataset.act === 'copy') { await navigator.clipboard.writeText(c.report_url); toast('Client link copied'); }
    if (b.dataset.act === 'edit') openCompany(c);
    if (b.dataset.act === 'view') { $('#f-company').value = c.id; show('work'); loadEntries(); }
  };
  const cdlg = $('#company-dlg'), cform = $('#company-form');
  let ced = null;
  function openCompany(c) {
    ced = c || null;
    $('#company-title').textContent = c ? 'Edit company' : 'Add company';
    cform.name.value = c ? c.name : ''; cform.aliases.value = c ? c.aliases : '';
    cform.client_password.value = ''; cform.archived.checked = !!(c && c.archived);
    $('#pw-state').textContent = c ? (c.has_password ? 'The client page asks for a password. Type a new one to change it.' : 'No password: anyone with the link can view it. Type one to add a password.') : 'Optional. Without one, anyone with the link can view it.';
    $('#pw-clear').hidden = !(c && c.has_password); $('#new-link').hidden = !c; $('#company-del').hidden = !(c && c.entry_count === 0);
    $('#company-msg').textContent = '';
    cdlg.showModal(); cform.name.focus();
  }
  $('#add-company').onclick = () => openCompany(null);
  async function saveCompany(patch, done) {
    try {
      if (ced) await api('/companies/' + ced.id, {method: 'PUT', body: JSON.stringify(patch)});
      else {
        const r = await api('/companies', {method: 'POST', body: JSON.stringify({name: patch.name, aliases: patch.aliases})});
        if (patch.client_password) await api('/companies/' + r.company.id, {method: 'PUT', body: JSON.stringify({client_password: patch.client_password})});
      }
      cdlg.close(); toast(done || 'Saved'); await loadState(); loadEntries();
    } catch (e) { $('#company-msg').className = 'msg bad'; $('#company-msg').textContent = e.message; }
  }
  cform.onsubmit = ev => {
    if (ev.submitter && ev.submitter.value !== 'save') return;
    ev.preventDefault();
    const patch = {name: cform.name.value, aliases: cform.aliases.value, archived: cform.archived.checked};
    if (cform.client_password.value) patch.client_password = cform.client_password.value;
    saveCompany(patch);
  };
  $('#pw-clear').onclick = () => saveCompany({client_password: ''}, 'Password removed');
  $('#new-link').onclick = () => {
    const b = $('#new-link');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Old link stops working. Tap again'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'New client link'; }, 3500); return; }
    saveCompany({new_link: true}, 'New link made. Copy it from the list');
  };
  $('#company-del').onclick = async () => {
    try { await api('/companies/' + ced.id, {method: 'DELETE'}); cdlg.close(); toast('Deleted'); loadState(); }
    catch (e) { $('#company-msg').className = 'msg bad'; $('#company-msg').textContent = e.message; }
  };

  // ---------- settings ----------
  let insTpl = null;
  function fillIns() {
    if (!insTpl) return;
    const c = $('#ins-company').value || '<CLIENT COMPANY>', p = $('#ins-project').value.trim() || '<PROJECT OR REPO>';
    const f = t => t.split('<CLIENT COMPANY>').join(c).split('<PROJECT OR REPO>').join(p);
    $('#snippet').textContent = f(insTpl.a); $('#snippet-api').textContent = f(insTpl.b);
  }
  $('#ins-company').onchange = fillIns;
  $('#ins-project').oninput = fillIns;
  async function loadSettings() {
    const s = await api('/settings');
    const ic = $('#ins-company'), keep = ic.value;
    ic.innerHTML = '<option value="">Choose a company</option>' + state.companies.filter(c => !c.archived).map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    ic.value = keep;
    $('#mcp-url').value = s.mcp_url;
    $('#snippet').textContent = `## Work log
Company: <CLIENT COMPANY>
Project: <PROJECT OR REPO>

After finishing any piece of work in this project, and always after pushing code, log it in the
"VectorPC Work Log" connector with log_work. Do not ask me first; tell me in one line what you logged.
- company and project: as above
- month: the billing month (YYYY-MM) the work belongs to; entries have no day. Months run from the
  26th to the 25th: work up to 25 Nov is 2026-11, work from 26 Nov is 2026-12 (South African time)
- one entry per distinct piece of work, not one entry for the whole session
- description: first line a short title of what was done (like "Fixed web emails failing since the PHP
  upgrade"), then a line or two of details in plain language the client understands: what was changed,
  fixed or built and why, and how it was checked. No passwords, keys, server paths or em dashes.
- hours: my figure if I give one. Otherwise estimate what a senior developer would need to do the same
  work by hand, without AI: understanding the request, investigating, designing, coding, testing,
  deploying and checking afterwards. Steps of 0.5, minimum 0.5. Never use how long you took.
  Yardsticks from earlier work: a small CSS fix tested on phones and pushed live 2 h; tracing and fixing
  a broken PHP extension after an upgrade 4 h; a new permission with its screens 6 h; a multi-form
  builder with custom questions and a live preview 28 h.
Before logging, call list_work for this company (range last-3) and do not log anything that is
already there.
Catching up: the first time you work in this project in a session, and whenever I say "catch up the
work log", call list_work for this company (range all). Find where the log ends by matching its newest
entries' titles to this project's history (git log with dates, pull requests, tickets, changelog, chats).
Everything finished after that point that is not in the log must be logged the same way. If that is more
than 5 items, show me a table (month, title, hours, total per month) and wait for my OK, then save them
with one log_work_bulk call.`;
    $('#snippet-api').textContent = `## Work log
Company: <CLIENT COMPANY>
Project: <PROJECT OR REPO>

Work log API: ${s.origin}/api/v1
API key: ${s.api_token}
Send the key as the header "Authorization: Bearer <key>". Write JSON bodies to a temp file and send them with
curl --data @file -H "Content-Type: application/json" (avoids quoting problems).
- See what is logged: GET /entries?company=<company>&range=last-3   (ranges: this-month, last-month, last-3, this-year, all)
- Log one item: POST /entries  {"company","month","hours","description","project"}
- Log many: POST /entries  {"entries":[...]}  (all or nothing; exact duplicates are skipped)

After finishing any piece of work in this project, and always after pushing code, log it for the company
above. Do not ask me first; tell me in one line what you logged.
- Check GET /entries for the company (range last-3) first, and do not log anything already there.
- month: the billing month YYYY-MM. Months run from the 26th to the 25th: work up to 25 Nov is 2026-11,
  work from 26 Nov is 2026-12 (South African time). No days.
- one entry per distinct piece of work, not one for the whole session
- description: first line a short title of what was done, then a line or two of details in plain language
  the client understands. No passwords, keys, server paths or em dashes.
- hours: my figure if I give one. Otherwise what a senior developer would need to do the same work by
  hand without AI (understanding, investigating, designing, coding, testing, deploying, checking).
  Steps of 0.5, minimum 0.5. Never use how long you took.
Catching up: the first time you work in this project in a session, and whenever I say "catch up the
work log", call GET /entries for the company (range all). Find where the log ends by matching its newest
entries' titles to this project's history (git log with dates, pull requests, tickets, changelog, chats).
Everything finished after that point that is not in the log must be logged the same way. If that is more
than 5 items, show me a table (month, title, hours, total per month) and wait for my OK, then save them
with one POST /entries {"entries":[...]} call.`;
    insTpl = {a: $('#snippet').textContent, b: $('#snippet-api').textContent};
    fillIns();
    $('#curl').textContent = `curl -X POST ${s.origin}/api/v1/entries \\
  -H "Authorization: Bearer ${s.api_token}" \\
  -H "Content-Type: application/json" \\
  -d '{"company":"BMS","month":"${state.month}","hours":1.5,"description":"Title\\nDetails","project":"bulldogerp"}'`;
  }
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-copy]'); if (!b) return;
    const el = document.getElementById(b.dataset.copy);
    await navigator.clipboard.writeText(el.value ?? el.textContent); toast('Copied');
  });
  $('#new-token').onclick = async () => {
    const b = $('#new-token');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Claude disconnects. Tap again'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'New token'; }, 3500); return; }
    await api('/settings/new-token', {method: 'POST'}); toast('New token made. Update the connector URL in Claude'); loadSettings();
  };
  $('#sign-out-all').onclick = async () => { await api('/settings/sign-out-all', {method: 'POST'}); location.href = '/login'; };

  // ---------- import ----------
  const FIELDS = [['date', 'Month (or date)'], ['company', 'Company'], ['description', 'Description'], ['details', 'Details (added under the description)'], ['hours', 'Hours'], ['project', 'Project']];
  const GUESS = {date: /^(month|billing month|period|date|day|work ?date|when)$/i, company: /^(company|client|customer|account|business)( name)?$/i,
    description: /^(description|work( done| item)?|item|task|tasks|desc|summary|activity)$/i, details: /^(details?|notes?|comments?|more)$/i,
    hours: /^(hours?|hrs?|time|duration|time spent|qty|quantity)$/i, project: /^(project|repo|repository|job|system)$/i};
  let imp = null; // {sheets: [{name, rows: [[cell]]}], headerRow, map}

  const serialToDate = n => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  const MON = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12};
  function toDate(c) {
    if (c == null || c === '') return '';
    if (typeof c === 'object' && c.t === 'n') return !c.time && c.v > 20000 && c.v < 80000 ? serialToDate(Math.floor(c.v)) : '';
    const v = typeof c === 'object' ? c.v : c;
    if (typeof v === 'number') return v > 20000 && v < 80000 ? serialToDate(Math.floor(v)) : '';
    const s = String(v).trim();
    let m;
    const iso = (y, mo, d) => { y = Number(y); if (y < 100) y += 2000; const out = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const dt = new Date(out + 'T00:00:00Z'); return !isNaN(dt) && dt.toISOString().slice(0, 10) === out ? out : ''; };
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{4})-(\d{1,2})$/)) && +m[2] >= 1 && +m[2] <= 12) return m[1] + '-' + m[2].padStart(2, '0');
    if ((m = s.match(/^(\d{1,2})[/.](\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return m[2] + '-' + m[1].padStart(2, '0');
    if ((m = s.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/i)) && MON[m[1].slice(0, 3).toLowerCase()]) return m[2] + '-' + String(MON[m[1].slice(0, 3).toLowerCase()]).padStart(2, '0');
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return Number(m[2]) > 12 ? iso(m[3], m[1], m[2]) : iso(m[3], m[2], m[1]); // South African d/m/y
    if ((m = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})$/i))) { const mo = MON[m[2].toLowerCase().slice(0, 4)] || MON[m[2].toLowerCase().slice(0, 3)]; if (mo) return iso(m[3], mo, m[1]); }
    if ((m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i)) && MON[m[1].slice(0, 3).toLowerCase()]) return iso(m[3], MON[m[1].slice(0, 3).toLowerCase()], m[2]);
    return '';
  }
  function toHours(c) {
    if (c == null || c === '') return '';
    if (typeof c === 'object') { if (c.t === 'n') return c.time ? Math.round(c.v * 24 * 100) / 100 : c.v; return String(c.v).trim(); }
    return c;
  }
  const text = c => c == null ? '' : typeof c === 'object' ? (c.w ?? String(c.v ?? '')).trim() : String(c).trim();

  function parseCsv(str) {
    const rows = []; let row = [], f = '', q = false;
    const delim = (str.split('\n')[0].match(/;/g) || []).length > (str.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (q) { if (ch === '"') { if (str[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true; else if (ch === delim) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && str[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()));
  }

  function loadXlsxLib() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Could not load the Excel reader. Save the sheet as CSV and try again.')); document.head.appendChild(s); });
  }

  function sheetRows(ws) {
    if (!ws['!ref']) return [];
    const range = XLSX.utils.decode_range(ws['!ref']), rows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({r, c})];
        if (!cell || cell.v === undefined || cell.v === null) { row.push(''); continue; }
        const z = String(cell.z || '');
        const isTime = cell.t === 'n' && /h/i.test(z) && /:/.test(z) && !/[dy]/i.test(z);
        const isDate = cell.t === 'n' && /[dy]/i.test(z.replace(/\[[^\]]*\]|"[^"]*"/g, ''));
        row.push({v: cell.t === 'd' ? cell.v.toISOString().slice(0, 10) : cell.v, t: cell.t === 'd' ? 's' : cell.t, w: cell.w, time: isTime, date: isDate});
      }
      if (row.some(x => text(x))) rows.push(row);
    }
    return rows;
  }

  function findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const hits = rows[i].filter(c => Object.values(GUESS).some(g => g.test(text(c)))).length;
      if (hits >= 2) return i;
    }
    return 0;
  }

  $('#imp-file').onchange = async ev => {
    const file = ev.target.files[0]; if (!file) return;
    $('#imp-msg').className = 'msg'; $('#imp-msg').textContent = 'Reading ' + file.name + '…'; $('#imp-setup').hidden = true;
    try {
      let sheets;
      if (/\.csv$/i.test(file.name)) sheets = [{name: file.name.replace(/\.csv$/i, ''), rows: parseCsv(await file.text())}];
      else {
        await loadXlsxLib();
        const wb = XLSX.read(await file.arrayBuffer(), {cellDates: false, cellNF: true, cellText: true});
        sheets = wb.SheetNames.map(n => ({name: n, rows: sheetRows(wb.Sheets[n])})).filter(s => s.rows.length > 1);
      }
      if (!sheets.length) throw new Error('No rows found in that file.');
      const looksLikeLog = sh => { const h = sh.rows[findHeader(sh.rows)].map(text); return h.some(x => GUESS.description.test(x)) && h.some(x => GUESS.hours.test(x)); };
      imp = {sheets, chosen: sheets.map((sh, i) => looksLikeLog(sh) ? i : -1).filter(i => i >= 0)};
      if (!imp.chosen.length) imp.chosen = [0];
      setupSheet();
      $('#imp-msg').textContent = `${file.name}: ${sheets.length} sheet${sheets.length > 1 ? 's' : ''} with data.`;
      $('#imp-setup').hidden = false;
    } catch (e) { $('#imp-msg').className = 'msg bad'; $('#imp-msg').textContent = e.message; }
  };

  function setupSheet() {
    const s = imp.sheets[imp.chosen[0]];
    imp.header = findHeader(s.rows);
    const headers = s.rows[imp.header].map(text);
    imp.map = {};
    for (const [f] of FIELDS) { const i = headers.findIndex(h => GUESS[f].test(h)); imp.map[f] = i >= 0 ? String(i) : ''; }
    if (!imp.map.company) imp.map.company = '@fixed';
    if (!imp.map.date) imp.map.date = '@fixed';
    if (!imp.map.project && imp.chosen.length > 1) imp.map.project = '@sheet';
    imp.fixed = imp.fixed || '';
    imp.fixedDate = imp.fixedDate || state.month;
    const extra = {company: '<option value="@sheet">Sheet name</option><option value="@fixed">One company for all rows</option>',
      date: '<option value="@fixed">One month for all rows</option>', project: '<option value="@sheet">Sheet name</option>'};
    const opts = f => `<option value="">(none)</option>${extra[f] || ''}` + headers.map((h, i) => `<option value="${i}">${esc(h || 'Column ' + (i + 1))}</option>`).join('');
    $('#imp-map').innerHTML = (imp.sheets.length > 1 ? `<div class="f" style="grid-column:1/-1;font-size:12.5px;color:var(--muted);font-weight:600">Sheets to import<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">${imp.sheets.map((x, i) => `<label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-weight:500"><input type="checkbox" data-sheet="${i}" ${imp.chosen.includes(i) ? 'checked' : ''} style="width:auto;min-height:0">${esc(x.name)} (${x.rows.length - 1})</label>`).join('')}</div></div>` : '')
      + FIELDS.map(([f, label]) => `<label class="f">${label}<select data-f="${f}">${opts(f)}</select></label>`).join('')
      + `<label class="f" id="imp-fixed-wrap">Company for all rows<input id="imp-fixed" list="imp-companies" value="${esc(imp.fixed)}"><datalist id="imp-companies">${state.companies.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></label>`
      + `<label class="f" id="imp-date-wrap">Billing month for all rows<input id="imp-date" type="month" value="${esc(imp.fixedDate)}" placeholder="2026-10"><span class="hint" id="imp-date-hint"></span></label>`;
    $$('#imp-map select[data-f]').forEach(sel => { sel.value = imp.map[sel.dataset.f]; sel.onchange = () => { imp.map[sel.dataset.f] = sel.value; preview(); }; });
    $$('#imp-map input[data-sheet]').forEach(cb => cb.onchange = () => {
      imp.chosen = $$('#imp-map input[data-sheet]').filter(x => x.checked).map(x => Number(x.dataset.sheet));
      if (!imp.chosen.length) { cb.checked = true; imp.chosen = [Number(cb.dataset.sheet)]; }
      setupSheet();
    });
    $('#imp-fixed').oninput = () => { imp.fixed = $('#imp-fixed').value; preview(); };
    $('#imp-date').oninput = () => { imp.fixedDate = $('#imp-date').value; preview(); };
    preview();
  }

  function buildRows() {
    const list = imp.chosen.map(i => imp.sheets[i]);
    const out = [];
    for (const s of list) {
      const h = findHeader(s.rows);
      for (const r of s.rows.slice(h + 1)) {
        const get = f => imp.map[f] !== '' && !imp.map[f].startsWith('@') ? r[Number(imp.map[f])] : '';
        const company = imp.map.company === '@sheet' ? s.name : imp.map.company === '@fixed' ? imp.fixed : text(get('company'));
        const item = text(get('description')), details = text(get('details'));
        const row = {company: String(company || '').trim(), month: imp.map.date === '@fixed' ? imp.fixedDate : (d => d.length === 10 ? monthOfDay(d) : d)(toDate(get('date'))), hours: toHours(get('hours')),
          description: item && details ? `${item.replace(/[.:]$/, '')}.\n${details}` : item || details, project: imp.map.project === '@sheet' ? s.name : text(get('project'))};
        if (/^(grand )?totals?( hours)?$/i.test(item) || /^(grand )?totals?$/i.test(text(r[0]))) continue;
        const err = [];
        if (!row.company) err.push('no company');
        if (!/^\d{4}-\d{2}$/.test(row.month || '')) err.push('month "' + text(get('date')) + '" not understood');
        const hv = typeof row.hours === 'number' ? row.hours : parseFloat(String(row.hours).replace(',', '.'));
        if (!(hv > 0 && hv <= 500) && !/^\d+:\d{2}$|^\d+(\.\d+)?\s*h/i.test(String(row.hours))) err.push('hours "' + row.hours + '" not valid');
        if (!row.description) err.push('no description');
        const blank = !row.description && !text(get('hours'));
        if (!blank) out.push({row, err, sheet: s.name});
      }
    }
    return out;
  }

  function preview() {
    $('#imp-fixed-wrap').style.display = imp.map.company === '@fixed' ? '' : 'none';
    $('#imp-date-wrap').style.display = imp.map.date === '@fixed' ? '' : 'none';
    $('#imp-date-hint').textContent = /^\d{4}-\d{2}$/.test(imp.fixedDate || '') ? mName(imp.fixedDate) + ': ' + mRange(imp.fixedDate) : '';
    const rows = buildRows(), bad = rows.filter(r => r.err.length);
    const known = new Set(state.companies.flatMap(c => [c.name, ...c.aliases.split(',')].map(x => x.trim().toLowerCase()).filter(Boolean)));
    const unknown = [...new Set(rows.map(r => r.row.company).filter(c => c && !known.has(c.toLowerCase())))];
    const total = rows.filter(r => !r.err.length).reduce((a, r) => a + (typeof r.row.hours === 'number' ? r.row.hours : parseFloat(String(r.row.hours).replace(',', '.')) || 0), 0);
    imp.rows = rows;
    $('#imp-summary').innerHTML = `${rows.length} rows, about ${fmt(total)} h${bad.length ? `, <span style="color:var(--red)">${bad.length} with problems (fix or they block the import)</span>` : ''}${unknown.length ? `<br>Not in the log yet: ${unknown.map(esc).join(', ')} (tick "Create companies" or add them with aliases first)` : ''}`;
    $('#imp-go').disabled = !rows.length || bad.length > 0;
    const show = bad.length ? bad.slice(0, 50) : rows.slice(0, 50);
    $('#imp-preview').innerHTML = `<table><thead><tr><th>Month</th><th>Company</th><th>Hours</th><th>Description</th><th>Project</th>${bad.length ? '<th>Problem</th>' : ''}</tr></thead><tbody>`
      + show.map(r => `<tr class="${r.err.length ? 'bad' : ''}"><td>${esc(mName(r.row.month) || r.row.month)}</td><td>${esc(r.row.company)}</td><td>${esc(r.row.hours)}</td><td class="desc">${esc(r.row.description)}</td><td>${esc(r.row.project)}</td>${bad.length ? `<td class="err">${esc(r.err.join(', '))}${imp.chosen.length > 1 ? ' (' + esc(r.sheet) + ')' : ''}</td>` : ''}</tr>`).join('')
      + `</tbody></table>${rows.length > show.length ? `<p class="hint" style="padding:8px 10px">Showing ${show.length} of ${rows.length}.</p>` : ''}`;
  }

  $('#imp-go').onclick = async () => {
    const rows = imp.rows.map(r => r.row), b = $('#imp-go');
    b.disabled = true;
    let imported = 0, dups = 0, hours = 0, created = [];
    try {
      for (let i = 0; i < rows.length; i += 400) {
        b.textContent = `Importing ${Math.min(i + 400, rows.length)} of ${rows.length}…`;
        const r = await api('/import', {method: 'POST', body: JSON.stringify({rows: rows.slice(i, i + 400), create_companies: $('#imp-create').checked})});
        if (r.errors.length) throw new Error(r.errors.slice(0, 5).map(e => `Row ${i + e.row}: ${e.error}`).join(' · '));
        imported += r.imported; dups += r.skipped_duplicates; hours += r.total_hours_imported || 0; created = created.concat(r.created_companies);
      }
      $('#imp-msg').className = 'msg ok';
      $('#imp-msg').textContent = `Imported ${imported} entries (${fmt(hours)} h). Skipped ${dups} already in the log.${created.length ? ' New companies: ' + created.join(', ') + '.' : ''}`;
      $('#imp-setup').hidden = true; $('#imp-file').value = '';
      await loadState(); $('#f-range').value = 'all'; loadEntries();
    } catch (e) { $('#imp-msg').className = 'msg bad'; $('#imp-msg').textContent = (imported ? `Imported ${imported} before stopping. ` : '') + e.message; }
    finally { b.disabled = false; b.textContent = 'Import'; }
  };

  // ---------- start ----------
  loadState().then(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('company')) $('#f-company').value = sp.get('company');
    if (sp.get('range')) $('#f-range').value = sp.get('range');
    loadEntries();
    const tab = location.hash.slice(1);
    if (['companies', 'import', 'settings'].includes(tab)) show(tab);
  }).catch(e => toast(e.message));
}
