// End-to-end tests in a local Workers runtime (Miniflare + D1). Build first: npx wrangler deploy --dry-run --outdir dist
import {Miniflare} from 'miniflare';
import {generateKeyPairSync, sign, randomBytes} from 'node:crypto';
import {execSync} from 'node:child_process';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

execSync('npx wrangler deploy --dry-run --outdir dist', {stdio: 'ignore'});
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : '  -> ' + extra)); };

// the VectorPC app's key pair (stands in for the app's HubNotify entrypoint)
const kp = generateKeyPairSync('ed25519');
const pub = kp.publicKey.export({format: 'der', type: 'spki'}).subarray(12).toString('base64url');
const makePass = (aud, extra = {}, ttl = 120) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({aud, iat: now, exp: now + ttl, jti: randomBytes(18).toString('base64url'), sub: 'ricky', ...extra})).toString('base64url');
  return body + '.' + sign(null, Buffer.from(body), kp.privateKey).toString('base64url');
};

const mf = new Miniflare({
  workers: [
    {name: 'worklog', modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2026-07-30', d1Databases: ['DB'],
      bindings: {ADMIN_USER: 'ricky', ADMIN_PASSWORD: 'correct horse battery'},
      serviceBindings: {HUB: {name: 'hub', entrypoint: 'HubNotify'}}},
    {name: 'hub', modules: true, compatibilityDate: '2026-07-30',
      script: `import {WorkerEntrypoint} from 'cloudflare:workers';
        export class HubNotify extends WorkerEntrypoint { async pubkey() { return ${JSON.stringify(pub)}; } }
        export default { fetch() { return new Response('hub'); } };`},
  ],
});
const B = 'https://worklog.test';
const req = (path, init = {}) => mf.dispatchFetch(B + path, {redirect: 'manual', ...init});
const form = obj => ({method: 'POST', body: new URLSearchParams(obj).toString(), headers: {'Content-Type': 'application/x-www-form-urlencoded'}});

// ---------- sign-in ----------
t('signed out, / goes to the sign-in page', (await req('/')).headers.get('Location') === '/login');
const lp = await (await req('/login')).text();
t('sign-in page has username and password', lp.includes('name="username"') && lp.includes('type="password"') && !lp.includes('No password is set'));
const bad = await req('/login', form({username: 'ricky', password: 'nope'}));
t('wrong password is refused', bad.status === 401 && (await bad.text()).includes('Wrong username or password'));
const ok = await req('/login', form({username: 'Ricky', password: 'correct horse battery'}));
const setc = ok.headers.get('Set-Cookie') || '';
t('right password signs in (username not case sensitive)', ok.status === 303 && /__Host-wl_admin=\d{13}\.\d+\.[0-9a-f]{64}/.test(setc) && /HttpOnly/.test(setc) && /Secure/.test(setc));
const cookie = setc.split(';')[0];
const H = {Cookie: cookie, Origin: B, 'Content-Type': 'application/json'};
const page = await (await req('/', {headers: {Cookie: cookie}})).text();
t('admin page loads with the VectorPC bar', page.includes('class="vpx-bar"') && page.includes('>Work Log</a>') && page.includes('https://app.vectorpc.co.za/') && page.includes('id="entries"'));
const ic = await req('/icon-192.png'), mkSvg = await req('/mark.svg');
t('the VectorPC icons are served', ic.status === 200 && ic.headers.get('Content-Type') === 'image/png' && (await ic.arrayBuffer()).byteLength === 11128 && mkSvg.status === 200 && (await mkSvg.text()).includes('<svg') && page.includes('rel="icon"'));
const script = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join(';\n');
const dir = mkdtempSync(join(tmpdir(), 'wl-'));
writeFileSync(join(dir, 'c.js'), script);
let syntax = true;
try { execSync(`node --check ${join(dir, 'c.js')}`, {stdio: 'pipe'}); } catch (e) { syntax = false; }
t('admin page script is valid JavaScript', syntax);
const forged = cookie.replace(/.$/, c => (c === 'a' ? 'b' : 'a'));
t('a changed cookie is refused', (await req('/admin/api/state', {headers: {Cookie: forged}})).status === 401);
const api = async (path, method = 'GET', body) => {
  const r = await req('/admin/api' + path, {method, headers: H, body: body ? JSON.stringify(body) : undefined});
  return {status: r.status, ...(await r.json())};
};

// ---------- companies ----------
const c1 = await api('/companies', 'POST', {name: 'Bulldog Abrasives', aliases: 'Bulldog, BMS, Keegan'});
const c2 = await api('/companies', 'POST', {name: 'RSB'});
t('companies are added with a private client link', c1.company?.id && /\/r\/[A-Za-z0-9_-]{32}$/.test(c1.company.report_url) && c2.company?.id);
t('duplicate company names are refused', (await api('/companies', 'POST', {name: 'bulldog abrasives'})).status === 409);
const xs = await req('/admin/api/companies', {method: 'POST', headers: {...H, Origin: 'https://evil.test'}, body: JSON.stringify({name: 'Evil'})});
t('cross-site change is refused', xs.status === 403);

// ---------- entries ----------
const e1 = await api('/entries', 'POST', {company_id: c1.company.id, month: '2026-11', hours: '1:30', description: 'Fixed the sidebar on phones', project: 'bulldogerp'});
t('an entry is logged with a month only (1:30 is 1.5 h)', e1.entry?.hours === 1.5 && e1.entry.month === '2026-11' && !('date' in e1.entry));
const e2 = await api('/entries', 'POST', {company_id: c1.company.id, date: '2026-11-26', hours: 2, description: 'Work on the 26th'});
t('a day given instead is put in its billing month (26 Nov is December)', e2.entry?.month === '2026-12');
const e3 = await api('/entries', 'POST', {company_id: c1.company.id, date: '2026-11-25', hours: 1, description: 'Work on the 25th'});
t('...and 25 Nov is November', e3.entry?.month === '2026-11');
await api('/entries/' + e3.entry.id, 'DELETE');
const e4 = await api('/entries', 'POST', {company_id: c1.company.id, month: 'October 2026', hours: 1, description: 'Named month'});
t('"October 2026" is understood', e4.entry?.month === '2026-10');
await api('/entries/' + e4.entry.id, 'DELETE');
t('bad months and hours are refused', (await api('/entries', 'POST', {company_id: c1.company.id, month: '2026-13', hours: 1, description: 'x'})).status === 400
  && (await api('/entries', 'POST', {company_id: c1.company.id, month: '2026-11', hours: 0, description: 'x'})).status === 400);
const upd = await api('/entries/' + e2.entry.id, 'PUT', {hours: 2.25});
t('an entry is edited', upd.entry?.hours === 2.25 && upd.entry.description === 'Work on the 26th');
const nov = await api('/entries?from=2026-11&to=2026-11');
t('a month range filters by billing month', nov.count === 1 && nov.total_hours === 1.5);
const st = await api('/state');
t('the filters are named for billing months', /^This month: \w+ \d{4}$/.test(st.labels['this-month']) && /^\d{4}-\d{2}$/.test(st.month));
const csv = await (await req('/admin/api/entries.csv?range=all', {headers: {Cookie: cookie}})).text();
t('CSV download has the months, rows and a total, no Source column', csv.includes('November 2026,Bulldog Abrasives,1.5,Fixed the sidebar on phones,bulldogerp') && /Total,,3\.75/.test(csv) && !/Source|manual/.test(csv), csv.slice(0, 300));

// ---------- import (the October Bulldog sheet shape: no dates, one month for all) ----------
const rows = [{company: 'Bulldog Abrasives', month: '2026-10', hours: 5, description: 'Moved the live BMS to /bms/.\nPlanned the cutover', project: 'BMS'},
  {company: 'Bulldog', month: '2026-10', hours: 28, description: 'DEVE0067: Marketing request forms', project: 'BMS'}];
const imp = await api('/import', 'POST', {rows});
t('import adds rows (aliases match, big items allowed)', imp.imported === 2 && imp.total_hours_imported === 33);
const again = await api('/import', 'POST', {rows});
t('importing the same rows again skips them', again.imported === 0 && again.skipped_duplicates === 2);
const unk = await api('/import', 'POST', {rows: [{company: 'Nobody Ltd', month: '2026-10', hours: 1, description: 'x'}]});
t('an unknown company blocks the import unless asked to create it', unk.imported === 0 && unk.errors.length === 1 && /No company matches/.test(unk.errors[0].error));
const mk = await api('/import', 'POST', {rows: [{company: 'Nobody Ltd', month: '2026-10', hours: 1, description: 'x'}], create_companies: true});
t('...and creates it when asked', mk.imported === 1 && mk.created_companies[0] === 'Nobody Ltd');

// ---------- MCP ----------
const st2 = await api('/settings');
const mcpPath = new URL(st2.mcp_url).pathname;
const rpc = async (method, params, id = 1) => (await req(mcpPath, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream'}, body: JSON.stringify({jsonrpc: '2.0', id, method, params})})).json();
t('MCP needs the right token', (await req('/mcp/' + 'x'.repeat(43), {method: 'POST', body: '{}'})).status === 404);
const init = await rpc('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 't', version: '1'}});
t('MCP initialize', init.result?.protocolVersion === '2025-06-18' && init.result.capabilities.tools && /senior developer/.test(init.result.instructions));
t('MCP notifications get 202', (await req(mcpPath, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'})})).status === 202);
const tl = await rpc('tools/list', {});
t('MCP lists the tools', ['log_work', 'log_work_bulk', 'list_companies', 'list_work', 'update_work', 'delete_work', 'add_company'].every(n => tl.result.tools.some(x => x.name === n)));
const lw = await rpc('tools/call', {name: 'log_work', arguments: {company: 'bulldog', month: '2026-11', hours: 3, description: 'Ticket push to VectorPC Support', project: 'bulldogerp'}});
t('log_work finds "bulldog" by alias and reports the billing month', !lw.result.isError && /Bulldog Abrasives/.test(lw.result.content[0].text) && /in November 2026 \(26 Oct to 25 Nov\).*November 2026: 4\.50 h/.test(lw.result.content[0].text), lw.result.content[0].text);
const lw2 = await rpc('tools/call', {name: 'log_work', arguments: {company: 'Acme', hours: 1, description: 'x'}});
t('log_work refuses an unknown company and lists the real ones', lw2.result.isError && /Existing companies: .*Bulldog Abrasives.*RSB/.test(lw2.result.content[0].text));
const cl = await rpc('tools/call', {name: 'log_work', arguments: {company: 'RSB', hours: 1, description: 'Built the export with Claude Code'}});
t('a description that mentions Claude is refused', cl.result.isError && /Claude Code|claude/i.test(cl.result.content[0].text) && /client reads it/.test(cl.result.content[0].text));
const cl2 = await rpc('tools/call', {name: 'log_work', arguments: {company: 'RSB', hours: 1, description: 'Charlie AI assistant: answers about debtors'}});
t('an AI feature of the client\'s own system is fine', !cl2.result.isError);
await rpc('tools/call', {name: 'delete_work', arguments: {id: cl2.result.structuredContent.entry.id}});
const rcl = await req('/api/v1/entries', {method: 'POST', headers: {Authorization: 'Bearer ' + (await api('/settings')).api_token, 'Content-Type': 'application/json'}, body: JSON.stringify({entries: [{company: 'RSB', hours: 1, description: 'ok'}, {company: 'RSB', hours: 1, description: 'Done in this Claude session'}]})});
t('the API refuses it too, all or nothing', rcl.status === 400 && (j => /Row 2/.test(j.error || j.message || ''))(await rcl.json()));
const ls = await rpc('tools/call', {name: 'list_work', arguments: {company: 'RSB', range: 'all'}});
t('list_work works', !ls.result.isError && ls.result.structuredContent.count === 0);
const lc = await rpc('tools/call', {name: 'list_companies', arguments: {}});
t('list_companies gives totals and links', lc.result.structuredContent.companies.find(c => c.name === 'Bulldog Abrasives').total_hours === 39.75);
const dl = await rpc('tools/call', {name: 'delete_work', arguments: {id: lw.result.structuredContent.entry.id}});
t('delete_work', !dl.result.isError && /Deleted entry/.test(dl.result.content[0].text));
const bk = await rpc('tools/call', {name: 'log_work_bulk', arguments: {entries: [{company: 'RSB', month: '2026-11', hours: 2, description: 'a'}, {company: 'RSB', month: '2026-11', hours: -1, description: 'b'}]}});
t('log_work_bulk is all or nothing', bk.result.isError && /row 2/.test(bk.result.content[0].text));

// ---------- REST ----------
const rest = await req('/api/v1/entries', {method: 'POST', headers: {Authorization: 'Bearer ' + st2.api_token, 'Content-Type': 'application/json'}, body: JSON.stringify({company: 'RSB', month: '2026-11', hours: 1.5, description: 'Server patching'})});
const rj = await rest.json();
t('REST log works with the Bearer token', rest.status === 200 && rj.ok && rj.entry.company === 'RSB');
t('REST refuses a wrong token', (await req('/api/v1/companies', {headers: {Authorization: 'Bearer nope'}})).status === 401);

// ---------- client report ----------
const link = new URL(c1.company.report_url).pathname;
const rp = await (await req(link + '?from=2026-10&to=2026-12')).text();
t('client report shows the company, entries and total', rp.includes('Bulldog Abrasives') && rp.includes('Moved the live BMS to /bms/.') && rp.includes('36.75') && !rp.includes('<td class="d"'), rp.match(/Total hours[\s\S]{0,120}/)?.[0]);
t('client report groups by billing month, no days', rp.includes('October 2026 (26 Sep to 25 Oct)') && rp.includes('November 2026 (26 Oct to 25 Nov)') && rp.includes('December 2026 (26 Nov to 25 Dec)') && !/\d{1,2} (Oct|Nov) 2026</.test(rp));
t('client report does not show other companies', !rp.includes('Server patching'));
const rcsv = await (await req(link + '/csv?range=all')).text();
t('client CSV download', rcsv.replace(/^\uFEFF/, '').startsWith('Month,Description,Project,Hours') && rcsv.includes('Work on the 26th'), rcsv.slice(0, 80));
t('a wrong link is a 404', (await req('/r/' + 'a'.repeat(32))).status === 404);
await api('/companies/' + c2.company.id, 'PUT', {client_password: 'rsb-secret'});
const rsbLink = new URL(c2.company.report_url).pathname;
const locked = await (await req(rsbLink)).text();
t('a client password hides the report', locked.includes('type="password"') && !locked.includes('Server patching'));
const wrongPw = await req(rsbLink, form({password: 'nope'}));
t('wrong client password', wrongPw.status === 401);
const rightPw = await req(rsbLink, form({password: 'rsb-secret'}));
const rc = (rightPw.headers.get('Set-Cookie') || '').split(';')[0];
const unlocked = await (await req(rsbLink + '?range=all', {headers: {Cookie: rc}})).text();
t('right client password opens it', rightPw.status === 303 && unlocked.includes('Server patching'));
const nl = await api('/companies/' + c2.company.id, 'PUT', {new_link: true});
t('a new link retires the old one', (await req(rsbLink)).status === 404 && nl.company.share_token !== c2.company.share_token);

// ---------- VectorPC app ----------
t('tile details need a signed pass', (await req('/api/hub-summary', {headers: {'X-Hub-Token': 'x'}})).status === 401);
t('a pass for another purpose is refused', (await req('/api/hub-summary', {headers: {'X-Hub-Token': makePass('worklog-sso')}})).status === 401);
const hs = await (await req('/api/hub-summary', {headers: {'X-Hub-Token': makePass('worklog-summary')}})).json();
t('tile details: hours this billing month', typeof hs.hours === 'number' && /to 25/.test(hs.label) && /^\d{4}-\d{2}$/.test(hs.key) && Array.isArray(hs.companies), JSON.stringify(hs));
const sp = makePass('worklog-sso', {to: '/?company=1'});
const sso = await req('/sso?t=' + encodeURIComponent(sp));
t('app sign-in sets the session and opens the page', sso.status === 303 && sso.headers.get('Location') === '/?company=1' && /__Host-wl_admin=/.test(sso.headers.get('Set-Cookie') || ''));
t('an app sign-in pass works once', (await req('/sso?t=' + encodeURIComponent(sp))).headers.get('Location') === '/login');
const evil = await req('/sso?t=' + encodeURIComponent(makePass('worklog-sso', {to: '//evil.test/'})));
t('sign-in never leaves this site', evil.headers.get('Location') === '/');

// ---------- settings ----------
const nt = await api('/settings/new-token', 'POST');
t('a new token retires the old connector URL', (await req(mcpPath, {method: 'POST', body: '{}'})).status === 404 && nt.mcp_url !== st2.mcp_url);
await api('/settings/sign-out-all', 'POST');
t('sign out everywhere ends sessions', (await req('/admin/api/state', {headers: {Cookie: cookie}})).status === 401);

// ---------- throttling ----------
let last;
for (let i = 0; i < 9; i++) last = await req('/login', form({username: 'ricky', password: 'x' + i}));
t('repeated wrong passwords are locked out', last.status === 429);

await mf.dispose();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
