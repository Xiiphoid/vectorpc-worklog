// Admin sign-in (username + password from Cloudflare settings), signed session cookies,
// login throttling, and per-company client page passwords.
import {getMeta, setMeta} from './db.js';
import {hmacHex, safeEqual, getCookie, clientIp, verifyPassword} from './util.js';

export const ADMIN_COOKIE = '__Host-wl_admin';
export const SESSION_DAYS = 30;
const MAX_FAILS = 8, FAIL_WINDOW = 15 * 60 * 1000;

export const adminUser = env => String(env.ADMIN_USER || 'ricky').trim();
export const passwordConfigured = env => String(env.ADMIN_PASSWORD || '').length >= 8;

async function sessionKey(env) {
  return `${await getMeta(env.DB, 'server_secret')}:${env.ADMIN_PASSWORD || ''}`;
}

export async function issueAdminCookie(env, now = Date.now(), days = SESSION_DAYS) {
  const expires = now + days * 86400000;
  const epoch = await getMeta(env.DB, 'session_epoch');
  const sig = await hmacHex(await sessionKey(env), `admin:v1:${expires}:${epoch}`);
  return `${ADMIN_COOKIE}=${expires}.${epoch}.${sig}; Max-Age=${days * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export const clearAdminCookie = () => `${ADMIN_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

export async function isAdmin(req, env, now = Date.now()) {
  if (!passwordConfigured(env)) return false;
  const [expires, epoch, sig] = getCookie(req, ADMIN_COOKIE).split('.');
  if (!/^\d{13}$/.test(expires || '') || !/^\d{1,9}$/.test(epoch || '') || !/^[0-9a-f]{64}$/.test(sig || '')) return false;
  if (Number(expires) <= now) return false;
  if (epoch !== await getMeta(env.DB, 'session_epoch')) return false;
  return safeEqual(sig, await hmacHex(await sessionKey(env), `admin:v1:${expires}:${epoch}`));
}

export async function signOutEverywhere(env) {
  const next = Number(await getMeta(env.DB, 'session_epoch') || '1') + 1;
  await setMeta(env.DB, 'session_epoch', next);
}

// Returns 'ok', 'bad' or 'locked'.
export async function checkLogin(req, env, username, password) {
  const ip = clientIp(req), now = Date.now();
  await env.DB.prepare('DELETE FROM login_failures WHERE at<?').bind(now - FAIL_WINDOW).run();
  const {n} = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_failures WHERE ip=?').bind(ip).first();
  if (n >= MAX_FAILS) return 'locked';
  const okUser = await safeEqual(String(username || '').trim().toLowerCase(), adminUser(env).toLowerCase());
  const okPass = await safeEqual(String(password || ''), String(env.ADMIN_PASSWORD || ''));
  if (passwordConfigured(env) && okUser && okPass) {
    await env.DB.prepare('DELETE FROM login_failures WHERE ip=?').bind(ip).run();
    return 'ok';
  }
  await env.DB.prepare('INSERT INTO login_failures(ip,at) VALUES(?,?)').bind(ip, now).run();
  return n + 1 >= MAX_FAILS ? 'locked' : 'bad';
}

// Same-origin check for state-changing admin requests (cookie auth).
export function sameOrigin(req, url) {
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('Origin');
  return !origin || origin === url.origin;
}

// ---- API token (MCP + REST) ----

export async function apiTokenValid(env, token) {
  const t = await getMeta(env.DB, 'api_token');
  return Boolean(t) && typeof token === 'string' && token.length >= 20 && safeEqual(token, t);
}

// ---- client report passwords ----

const reportCookieName = id => `__Secure-wl_r${Number(id)}`;
const REPORT_DAYS = 30;

export async function reportCookie(env, company, now = Date.now()) {
  const expires = now + REPORT_DAYS * 86400000;
  const sig = await hmacHex(await getMeta(env.DB, 'server_secret'), `report:v1:${company.id}:${company.share_token}:${company.client_password}:${expires}`);
  return `${reportCookieName(company.id)}=${expires}.${sig}; Max-Age=${REPORT_DAYS * 86400}; Path=/r/; HttpOnly; Secure; SameSite=Lax`;
}

export async function reportUnlocked(req, env, company, now = Date.now()) {
  if (!company.client_password) return true;
  const [expires, sig] = getCookie(req, reportCookieName(company.id)).split('.');
  if (!/^\d{13}$/.test(expires || '') || !/^[0-9a-f]{64}$/.test(sig || '') || Number(expires) <= now) return false;
  return safeEqual(sig, await hmacHex(await getMeta(env.DB, 'server_secret'), `report:v1:${company.id}:${company.share_token}:${company.client_password}:${expires}`));
}

export async function checkReportPassword(req, env, company, password) {
  const ip = 'r:' + clientIp(req), now = Date.now();
  await env.DB.prepare('DELETE FROM login_failures WHERE at<?').bind(now - FAIL_WINDOW).run();
  const {n} = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_failures WHERE ip=?').bind(ip).first();
  if (n >= MAX_FAILS) return 'locked';
  if (await verifyPassword(String(password || ''), company.client_password)) return 'ok';
  await env.DB.prepare('INSERT INTO login_failures(ip,at) VALUES(?,?)').bind(ip, now).run();
  return 'bad';
}
