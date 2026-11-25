// D1 schema (self-upgrading on first request) and all data access.
import {UserError, checkHours, randomToken, hashPassword, toMonth, currentMonth, isMonth, monthName} from './util.js';

export const SCHEMA_VERSION = 2;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS companies(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    aliases TEXT NOT NULL DEFAULT '',
    share_token TEXT NOT NULL UNIQUE,
    client_password TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS entries(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    month TEXT NOT NULL,
    description TEXT NOT NULL,
    hours REAL NOT NULL,
    project TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS entries_company_month ON entries(company_id, month)`,
  `CREATE INDEX IF NOT EXISTS entries_month ON entries(month)`,
  `CREATE TABLE IF NOT EXISTS login_failures(ip TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS login_failures_ip ON login_failures(ip, at)`,
];

let ready = null;
export async function ensureSchema(db) {
  if (ready) return ready;
  ready = (async () => {
    try {
      const row = await db.prepare("SELECT value FROM meta WHERE key='schema_version'").first();
      if (row && Number(row.value) >= SCHEMA_VERSION) return;
    } catch { /* first run: no meta table yet */ }
    await db.batch(SCHEMA.map(s => db.prepare(s)));
    const defaults = [
      ['schema_version', String(SCHEMA_VERSION)],
      ['server_secret', randomToken(32)],
      ['api_token', randomToken(32)],
      ['session_epoch', '1'],
      ['client_token', randomToken(24)],   // the client link that shows every company (2)
    ];
    await db.batch(defaults.map(([k, v]) => db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)').bind(k, v)));
    await db.prepare("UPDATE meta SET value=? WHERE key='schema_version'").bind(String(SCHEMA_VERSION)).run();
  })().catch(e => { ready = null; throw e; });
  return ready;
}

export async function getMeta(db, key) {
  return (await db.prepare('SELECT value FROM meta WHERE key=?').bind(key).first())?.value || '';
}
export async function setMeta(db, key, value) {
  await db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').bind(key, String(value)).run();
}

// ---------- companies ----------

const norm = s => String(s || '').toLowerCase().replace(/\(pty\)|\bltd\b|\bpty\b|\bcc\b|\binc\b|[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function listCompanies(db, {includeArchived = true} = {}) {
  const {results} = await db.prepare(`
    SELECT c.id, c.name, c.aliases, c.share_token, c.archived, c.created_at,
           c.client_password IS NOT NULL AS has_password,
           COALESCE(SUM(e.hours),0) AS total_hours, COUNT(e.id) AS entry_count, MAX(e.month) AS last_month
    FROM companies c LEFT JOIN entries e ON e.company_id=c.id
    ${includeArchived ? '' : 'WHERE c.archived=0'}
    GROUP BY c.id ORDER BY c.archived, c.name COLLATE NOCASE`).all();
  return results.map(r => ({...r, has_password: !!r.has_password, archived: !!r.archived, total_hours: Math.round(r.total_hours * 100) / 100}));
}

export async function getCompany(db, id) {
  return db.prepare('SELECT * FROM companies WHERE id=?').bind(Number(id)).first();
}

export async function companyByToken(db, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || '')) return null;
  return db.prepare('SELECT * FROM companies WHERE share_token=?').bind(token).first();
}

// Finds a company by id, exact name, alias, or a single unambiguous partial match.
// Returns {company} or {matches} (for a helpful error).
export async function resolveCompany(db, input, all = null) {
  return matchCompany(all || await listCompanies(db), input);
}

export function matchCompany(all, input) {
  if (input === undefined || input === null || String(input).trim() === '') return {matches: []};
  if (typeof input === 'number' || /^\d+$/.test(String(input))) {
    const c = all.find(x => x.id === Number(input));
    if (c) return {company: c};
  }
  const q = norm(input);
  if (!q) return {matches: []};
  const names = c => [c.name, ...String(c.aliases || '').split(',')].map(norm).filter(Boolean);
  const exact = all.filter(c => names(c).includes(q));
  if (exact.length === 1) return {company: exact[0]};
  if (exact.length > 1) return {matches: exact};
  const partial = all.filter(c => !c.archived && names(c).some(n => n.includes(q) || (q.includes(n) && n.length >= 3)));
  if (partial.length === 1 && q.length >= 3) return {company: partial[0]};
  return {matches: partial};
}

export async function requireCompany(db, input, list = null) {
  const everything = list || await listCompanies(db);
  const r = matchCompany(everything, input);
  if (r.company) return r.company;
  const all = everything.filter(c => !c.archived).map(c => c.name);
  if (r.matches.length > 1) throw new UserError(`"${input}" matches more than one company: ${r.matches.map(c => c.name).join(', ')}. Use the exact name.`);
  throw new UserError(`No company matches "${input}". Existing companies: ${all.length ? all.join(', ') : '(none yet)'}. If this is a new client, add it first (add_company).`);
}

function cleanAliases(a) {
  const list = Array.isArray(a) ? a : String(a || '').split(',');
  return [...new Set(list.map(s => String(s).trim()).filter(Boolean))].join(', ').slice(0, 500);
}

function cleanName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n || n.length > 120) throw new UserError('Company name is required (max 120 characters)');
  return n;
}

export async function createCompany(db, {name, aliases = ''}) {
  const n = cleanName(name);
  const dup = await db.prepare('SELECT id FROM companies WHERE name=? COLLATE NOCASE').bind(n).first();
  if (dup) throw new UserError(`A company called "${n}" already exists`, 409);
  const row = await db.prepare('INSERT INTO companies(name,aliases,share_token) VALUES(?,?,?) RETURNING id')
    .bind(n, cleanAliases(aliases), randomToken(24)).first();
  return getCompany(db, row.id);
}

export async function updateCompany(db, id, patch) {
  const c = await getCompany(db, id);
  if (!c) throw new UserError('Company not found', 404);
  const name = patch.name !== undefined ? cleanName(patch.name) : c.name;
  if (name.toLowerCase() !== c.name.toLowerCase()) {
    const dup = await db.prepare('SELECT id FROM companies WHERE name=? COLLATE NOCASE AND id<>?').bind(name, c.id).first();
    if (dup) throw new UserError(`A company called "${name}" already exists`, 409);
  }
  const aliases = patch.aliases !== undefined ? cleanAliases(patch.aliases) : c.aliases;
  const archived = patch.archived !== undefined ? (patch.archived ? 1 : 0) : c.archived;
  let pw = c.client_password;
  if (patch.client_password !== undefined) {
    const p = String(patch.client_password || '');
    if (p && p.length < 6) throw new UserError('Client password must be at least 6 characters');
    pw = p ? await hashPassword(p) : null;
  }
  const token = patch.new_link ? randomToken(24) : c.share_token;
  await db.prepare('UPDATE companies SET name=?, aliases=?, archived=?, client_password=?, share_token=? WHERE id=?')
    .bind(name, aliases, archived, pw, token, c.id).run();
  return getCompany(db, c.id);
}

export async function deleteCompany(db, id) {
  const n = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE company_id=?').bind(Number(id)).first();
  if (n.n > 0) throw new UserError('This company has logged work. Archive it instead, or delete its entries first.', 409);
  await db.prepare('DELETE FROM companies WHERE id=?').bind(Number(id)).run();
  return {deleted: true};
}

// ---------- entries ----------

const SOURCES = new Set(['manual', 'claude', 'import', 'api']);

export function cleanEntry(input, {partial = false} = {}) {
  const out = {};
  // a billing month; a day given instead is turned into its billing month (26th to 25th)
  if (!partial || input.month !== undefined || input.date !== undefined) {
    const m = input.month ?? input.date;
    out.month = m === undefined || m === null || m === '' ? currentMonth() : toMonth(m);
  }
  if (!partial || input.hours !== undefined) out.hours = checkHours(input.hours);
  if (!partial || input.description !== undefined) {
    const d = String(input.description ?? '').trim();
    if (!d) throw new UserError('description is required');
    if (d.length > 10000) throw new UserError('description is too long (max 10 000 characters)');
    out.description = d;
  }
  if (input.project !== undefined) out.project = String(input.project || '').trim().slice(0, 120);
  return out;
}

const ENTRY_SELECT = `SELECT e.id, e.company_id, c.name AS company, e.month, e.description, e.hours, e.project, e.source, e.created_at, e.updated_at
  FROM entries e JOIN companies c ON c.id=e.company_id`;

export async function getEntry(db, id) {
  return db.prepare(`${ENTRY_SELECT} WHERE e.id=?`).bind(Number(id)).first();
}

export async function addEntry(db, companyId, input, source = 'manual') {
  const e = cleanEntry(input);
  const row = await db.prepare('INSERT INTO entries(company_id,month,description,hours,project,source) VALUES(?,?,?,?,?,?) RETURNING id')
    .bind(companyId, e.month, e.description, e.hours, e.project || '', SOURCES.has(source) ? source : 'manual').first();
  return getEntry(db, row.id);
}

export async function updateEntry(db, id, input, companyId) {
  const cur = await getEntry(db, id);
  if (!cur) throw new UserError(`Entry ${id} not found`, 404);
  const e = cleanEntry(input, {partial: true});
  await db.prepare(`UPDATE entries SET company_id=?, month=?, description=?, hours=?, project=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?`)
    .bind(companyId ?? cur.company_id, e.month ?? cur.month, e.description ?? cur.description, e.hours ?? cur.hours, e.project ?? cur.project, cur.id).run();
  return getEntry(db, cur.id);
}

export async function deleteEntry(db, id) {
  const cur = await getEntry(db, id);
  if (!cur) throw new UserError(`Entry ${id} not found`, 404);
  await db.prepare('DELETE FROM entries WHERE id=?').bind(cur.id).run();
  return {deleted: true, entry: cur};
}

export async function listEntries(db, {companyId, from, to, q, limit = 2000, liveOnly = false} = {}) {
  const where = [], binds = [];
  if (liveOnly) where.push('c.archived=0');
  if (companyId) { where.push('e.company_id=?'); binds.push(Number(companyId)); }
  if (from) { where.push('e.month>=?'); binds.push(toMonth(from, 'from')); }
  if (to) { where.push('e.month<=?'); binds.push(toMonth(to, 'to')); }
  if (q) { where.push("(e.description LIKE ? ESCAPE '\\' OR e.project LIKE ? ESCAPE '\\')"); const like = '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%'; binds.push(like, like); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lim = Math.min(Math.max(Number(limit) || 2000, 1), 5000);
  const [rows, tot] = await db.batch([
    db.prepare(`${ENTRY_SELECT} ${w} ORDER BY e.month DESC, e.id ASC LIMIT ${lim}`).bind(...binds),
    db.prepare(`SELECT COALESCE(SUM(e.hours),0) AS hours, COUNT(*) AS n FROM entries e JOIN companies c ON c.id=e.company_id ${w}`).bind(...binds),
  ]);
  const t = tot.results[0];
  return {entries: rows.results, total_hours: Math.round(t.hours * 100) / 100, count: t.n, truncated: t.n > rows.results.length};
}

// Bulk insert (import / Claude backfill). All-or-nothing validation; rows identical to an existing
// entry (same company, month, hours, description) are skipped, so re-running an import is safe.
export async function bulkAdd(db, rows, {source = 'import', createCompanies = false} = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new UserError('No rows to import');
  if (rows.length > 1000) throw new UserError('At most 1000 rows per call (split bigger imports)');
  const all = await listCompanies(db);
  const errors = [], prepared = [], newNames = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    try {
      const name = String(r.company ?? '').trim().replace(/\s+/g, ' ');
      if (!name) throw new UserError('company is missing');
      let company = matchCompany(all, name).company;
      if (!company) {
        if (!createCompanies) await requireCompany(db, name, all); // throws a helpful error
        if (name.length > 120) throw new UserError('company name is too long');
        newNames.set(name.toLowerCase(), newNames.get(name.toLowerCase()) || name);
      }
      prepared.push({company, newName: company ? null : name.toLowerCase(), ...cleanEntry(r)});
    } catch (e) {
      if (!(e instanceof UserError)) throw e;
      errors.push({row: i + 1, error: e.message});
    }
  }
  if (errors.length) return {imported: 0, skipped_duplicates: 0, errors, created_companies: []};
  const created = [];
  for (const [key, name] of newNames) {
    const c = await createCompany(db, {name});
    created.push(c.name);
    newNames.set(key, c);
  }
  for (const p of prepared) p.company_id = p.company ? p.company.id : newNames.get(p.newName).id;

  const existing = new Set();
  const ids = [...new Set(prepared.map(p => p.company_id))];
  const lists = await db.batch(ids.map(cid => db.prepare('SELECT company_id, month, hours, description FROM entries WHERE company_id=?').bind(cid)));
  for (const l of lists) for (const x of l.results) existing.add(`${x.company_id}|${x.month}|${x.hours}|${x.description.trim()}`);
  const fresh = [];
  let dup = 0;
  for (const p of prepared) {
    const k = `${p.company_id}|${p.month}|${p.hours}|${p.description}`;
    if (existing.has(k)) { dup++; continue; }
    existing.add(k);
    fresh.push(p);
  }
  const src = SOURCES.has(source) ? source : 'import';
  for (let i = 0; i < fresh.length; i += 250) {
    await db.batch(fresh.slice(i, i + 250).map(p =>
      db.prepare('INSERT INTO entries(company_id,month,description,hours,project,source) VALUES(?,?,?,?,?,?)')
        .bind(p.company_id, p.month, p.description, p.hours, p.project || '', src)));
  }
  return {imported: fresh.length, skipped_duplicates: dup, errors: [], created_companies: created,
    total_hours_imported: Math.round(fresh.reduce((a, p) => a + p.hours, 0) * 100) / 100};
}
