// Small shared helpers: responses, escaping, dates, hours, crypto.

export const VERSION = 'r1';
export const TZ = 'Africa/Johannesburg';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers},
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers},
  });
}

export function redirect(location, headers = {}) {
  return new Response(null, {status: 303, headers: {Location: location, 'Cache-Control': 'no-store', ...headers}});
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ---- dates ----

export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}

export function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export function checkDate(s, field = 'date') {
  if (!isDate(s)) throw new UserError(`${field} must be a real date in YYYY-MM-DD format (got "${s}")`);
  return s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyDate(s) {
  const [y, m, d] = s.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Billing months run from the 26th to the 25th: 25 Nov is November, 26 Nov is December.
export const PERIOD_END_DAY = 25;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodOf(date) {
  let [y, m, d] = date.split('-').map(Number);
  if (d > PERIOD_END_DAY) { m++; if (m === 13) { m = 1; y++; } }
  const key = `${y}-${String(m).padStart(2, '0')}`;
  const to = `${key}-${PERIOD_END_DAY}`;
  const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const from = `${py}-${String(pm).padStart(2, '0')}-${PERIOD_END_DAY + 1}`;
  return {key, from, to, name: `${MONTH_NAMES[m - 1]} ${y}`, label: `${MONTH_NAMES[m - 1]} ${y} (${shortDate(from)} to ${shortDate(to)})`};
}

export const shortDate = s => { const [, m, d] = s.split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]}`; };

// ---- billing months ("YYYY-MM"): entries carry a month and year, never a day ----

export const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
export const monthName = key => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const monthLabel = key => periodOf(`${key}-${PERIOD_END_DAY}`).label;
export const currentMonth = (now = new Date()) => periodOf(today(now)).key;
export function addMonths(key, n) {
  let y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// "2026-11", "November 2026", "Nov 2026", "11/2026", or a day ("2026-11-26" is December: the 26th rule).
export function toMonth(v, field = 'month') {
  const s = String(v ?? '').trim();
  let m;
  if (isMonth(s)) return s;
  if (isDate(s)) return periodOf(s).key;
  if ((m = s.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/i))) {
    const i = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{1,2})[/.-](\d{4})$/)) && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  throw new UserError(`${field} must be a billing month like 2026-11 (got "${v}")`);
}

// Named ranges (in billing months) used by the report page, admin filters and Claude.
export function presetRange(name, now = new Date()) {
  const cur = currentMonth(now), y = cur.slice(0, 4);
  switch (name) {
    case 'this-month': return {from: cur, to: cur};
    case 'last-month': { const p = addMonths(cur, -1); return {from: p, to: p}; }
    case 'last-3': return {from: addMonths(cur, -2), to: cur};
    case 'this-year': return {from: `${y}-01`, to: `${y}-12`};
    case 'last-year': return {from: `${y - 1}-01`, to: `${y - 1}-12`};
    case 'all': return {from: '', to: ''};
    default: return null;
  }
}

export function presetLabels(now = new Date()) {
  const cur = currentMonth(now);
  return {'this-month': `This month: ${monthName(cur)}`, 'last-month': `Last month: ${monthName(addMonths(cur, -1))}`};
}

// ---- hours ----

// Accepts 1.5, "1.5", "1,5", "1:30", "90m", "1h30", "1h 30m".
export function parseHours(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return NaN;
  let m;
  if ((m = s.match(/^(\d+):([0-5]?\d)$/))) return Number(m[1]) + Number(m[2]) / 60;
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)m(?:in(?:s|utes?)?)?$/))) return Number(m[1].replace(',', '.')) / 60;
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)h(?:rs?|ours?)?(?:(\d+)m(?:in(?:s|utes?)?)?)?$/))) return Number(m[1].replace(',', '.')) + (m[2] ? Number(m[2]) / 60 : 0);
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return NaN;
}

export function checkHours(v) {
  const h = parseHours(v);
  if (!Number.isFinite(h) || h <= 0 || h > 500) throw new UserError(`hours must be a number above 0 and at most 500 (got "${v}")`);
  return Math.round(h * 100) / 100;
}

export const fmtHours = h => (Math.round(Number(h || 0) * 100) / 100).toFixed(2);

// ---- crypto ----

const enc = new TextEncoder();

export function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

// Constant-time string comparison (compares HMACs of both so length does not leak).
export async function safeEqual(a, b) {
  const key = 'cmp';
  const [x, y] = await Promise.all([hmacHex(key, String(a)), hmacHex(key, String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const PBKDF2_ITER = 20000; // about 4 ms: fits the Workers Free CPU budget
export async function hashPassword(password, salt = randomToken(16)) {
  const k = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITER}, k, 256);
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${hex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [kind, iter, salt] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || Number(iter) !== PBKDF2_ITER || !salt) return false;
  return safeEqual(await hashPassword(password, salt), stored);
}

export function getCookie(req, name) {
  const c = (req.headers.get('Cookie') || '').split(/;\s*/).find(x => x.startsWith(name + '='));
  return c ? decodeURIComponent(c.slice(name.length + 1)) : '';
}

export const clientIp = req => req.headers.get('CF-Connecting-IP') || 'local';

export function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s;
}
