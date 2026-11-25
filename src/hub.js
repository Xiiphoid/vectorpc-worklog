// VectorPC app link (app.vectorpc.co.za), the same scheme as Monitoring and Solar Quotes. Nothing secret is shared:
//   the app signs short passes with its Ed25519 key:
//     pass = base64url(JSON {aud, sub, iat, exp, jti, to}) + "." + base64url(Ed25519 signature of that text)
//   and this Worker checks them with the app's public key, fetched over the HUB service binding.
//   - /sso takes a "worklog-sso" pass (two minutes, used once) and signs this device in for 30 days.
//   - /api/hub-summary takes a "worklog-summary" pass in X-Hub-Token: the Work Log tile (hours this billing month).
import {issueAdminCookie, passwordConfigured} from './auth.js';
import {json, redirect, currentMonth, monthName, periodOf} from './util.js';

let hubKey = null;
const b64 = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function appKey(env) {
  if (hubKey && hubKey.exp > Date.now()) return hubKey.key;
  if (!env.HUB || !env.HUB.pubkey) return null;
  const key = await crypto.subtle.importKey('raw', b64(await env.HUB.pubkey()), {name: 'Ed25519'}, false, ['verify']);
  hubKey = {key, exp: Date.now() + 3600000};
  return key;
}

export async function readPass(env, pass, aud) {
  const m = /^([A-Za-z0-9_-]{10,2000})\.([A-Za-z0-9_-]{86})$/.exec(String(pass || ''));
  if (!m) return null;
  try {
    const key = await appKey(env);
    if (!key || !await crypto.subtle.verify('Ed25519', key, b64(m[2]), new TextEncoder().encode(m[1]))) return null;
    const p = JSON.parse(new TextDecoder().decode(b64(m[1]))), now = Math.floor(Date.now() / 1000);
    return p && p.aud === aud && p.exp > now && p.iat <= now + 30 ? p : null;
  } catch { return null; }
}

// only a path inside this Worker
const cleanTo = to => {
  const s = String(to || '');
  return s.startsWith('/') && !s.startsWith('//') && s.length < 300 && !/[\x00-\x1f\\]/.test(s) ? s : '/';
};

export async function hubSso(req, env, url) {
  const p = await readPass(env, url.searchParams.get('t'), 'worklog-sso');
  let ok = Boolean(p) && /^[A-Za-z0-9_-]{16,64}$/.test(p.jti || '') && passwordConfigured(env);
  if (ok) {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS hub_sso_used (jti TEXT PRIMARY KEY, used_at INTEGER)').run();
    await env.DB.prepare('DELETE FROM hub_sso_used WHERE used_at<?').bind(Date.now() - 86400000).run();
    // a pass used before is refused
    ok = await env.DB.prepare('INSERT INTO hub_sso_used (jti,used_at) VALUES (?,?)').bind(p.jti, Date.now()).run().then(() => true, () => false);
  }
  if (!ok) return redirect('/login');
  return redirect(cleanTo(p.to), {'Set-Cookie': await issueAdminCookie(env), 'Referrer-Policy': 'no-referrer'});
}

/** The Work Log tile: hours logged in the current billing month (26th to 25th), and the split per company. */
export async function hubSummary(req, env) {
  if (!await readPass(env, req.headers.get('X-Hub-Token'), 'worklog-summary')) return json({error: 'Unauthorized'}, 401);
  const month = currentMonth(), per = periodOf(month + '-25');
  const {results} = await env.DB.prepare(`SELECT c.name, SUM(e.hours) AS h, COUNT(*) AS n FROM entries e JOIN companies c ON c.id=e.company_id
    WHERE e.month=? GROUP BY c.id ORDER BY h DESC`).bind(month).all();
  const hours = Math.round(results.reduce((a, r) => a + r.h, 0) * 100) / 100;
  return json({
    hours, entries: results.reduce((a, r) => a + r.n, 0), month: monthName(month), key: month, from: per.from, to: per.to, label: per.label,
    companies: results.slice(0, 5).map(r => ({name: r.name, hours: Math.round(r.h * 100) / 100})),
  });
}
