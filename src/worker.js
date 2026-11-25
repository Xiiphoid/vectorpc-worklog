// VectorPC Work Log: Cloudflare Worker + D1.
//   /                admin (username + password)          /r/<link>      client report (read only)
//   /mcp/<token>     MCP connector for Claude             /api/v1/*      REST, Bearer token
//   /sso, /api/hub-summary   VectorPC app (app.vectorpc.co.za) sign-in and tile
import {ensureSchema, companyByToken} from './db.js';
import {UserError, json, html, redirect, VERSION} from './util.js';
import {isAdmin, checkLogin, issueAdminCookie, clearAdminCookie, passwordConfigured, sameOrigin, apiTokenValid,
  reportUnlocked, reportCookie, checkReportPassword} from './auth.js';
import {adminApi, restApi} from './api.js';
import {handleMcp} from './mcp.js';
import {loginPage, adminPage} from './ui/admin.js';
import {reportPage, reportLogin, reportRange, reportData, reportCsv} from './ui/report.js';
import {hubSso, hubSummary} from './hub.js';
import {icon192, touch, mark} from './icons.js';

const ICONS = {'/favicon.ico': icon192, '/icon-192.png': icon192, '/apple-touch-icon.png': touch, '/mark.svg': mark};
const iconResponse = i => new Response(Uint8Array.from(atob(i.b64), c => c.charCodeAt(0)), {headers: {'Content-Type': i.type, 'Cache-Control': 'public, max-age=86400'}});

async function route(req, env, url) {
  const p = url.pathname, m = req.method;

  if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', {headers: {'Content-Type': 'text/plain'}});
  if (ICONS[p]) return iconResponse(ICONS[p]);
  if (p === '/version') return json({name: 'vectorpc-worklog', version: VERSION});

  await ensureSchema(env.DB);

  // ---- Claude connector and REST ----
  let mm;
  if ((mm = p.match(/^\/mcp\/([A-Za-z0-9_-]{20,64})\/?$/))) {
    if (!await apiTokenValid(env, mm[1])) return json({error: 'Not found'}, 404);
    return handleMcp(req, env, url);
  }
  if (p.startsWith('/api/v1/')) {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ') || !await apiTokenValid(env, auth.slice(7).trim())) return json({error: 'Unauthorized'}, 401);
    return restApi(req, env, url);
  }

  // ---- VectorPC app ----
  if (p === '/sso' && m === 'GET') return hubSso(req, env, url);
  if (p === '/api/hub-summary' && m === 'GET') return hubSummary(req, env, url);

  // ---- client report ----
  if ((mm = p.match(/^\/r\/([A-Za-z0-9_-]{20,64})(\/csv)?\/?$/))) {
    const company = await companyByToken(env.DB, mm[1]);
    if (!company) return html('<!doctype html><meta name="viewport" content="width=device-width"><p style="font-family:system-ui;padding:40px;text-align:center;color:#64748b">This link is not valid. Ask VectorPC for a new one.</p>', 404);
    const base = `/r/${company.share_token}`;
    if (m === 'POST' && !mm[2]) {
      const form = await req.formData().catch(() => null);
      const r = await checkReportPassword(req, env, company, form?.get('password'));
      if (r === 'ok') return redirect(base, {'Set-Cookie': await reportCookie(env, company)});
      return html(reportLogin(company, r === 'locked' ? 'Too many attempts. Try again in 15 minutes.' : 'That password is not right.'), r === 'locked' ? 429 : 401);
    }
    if (m !== 'GET') return json({error: 'Method not allowed'}, 405);
    if (!await reportUnlocked(req, env, company)) return mm[2] ? redirect(base) : html(reportLogin(company));
    const range = reportRange(url);
    const data = await reportData(env, company, range);
    return mm[2] ? reportCsv(company, range, data) : html(reportPage(company, range, data, base));
  }

  // ---- admin ----
  if (p === '/login') {
    if (m === 'POST') {
      const form = await req.formData().catch(() => null);
      const r = await checkLogin(req, env, form?.get('username'), form?.get('password'));
      if (r === 'ok') return redirect('/', {'Set-Cookie': await issueAdminCookie(env)});
      return html(loginPage({notConfigured: !passwordConfigured(env), error: r === 'locked' ? 'Too many attempts. Try again in 15 minutes.' : 'Wrong username or password.'}), r === 'locked' ? 429 : 401);
    }
    if (await isAdmin(req, env)) return redirect('/');
    return html(loginPage({notConfigured: !passwordConfigured(env)}));
  }
  if (p === '/logout') return redirect('/login', {'Set-Cookie': clearAdminCookie()});

  const admin = await isAdmin(req, env);
  if (p.startsWith('/admin/api/')) {
    if (!admin) return json({error: 'Signed out'}, 401);
    if (m !== 'GET' && !sameOrigin(req, url)) return json({error: 'Cross-site request refused'}, 403);
    return adminApi(req, env, url);
  }
  if (p === '/' || p === '/index.html') return admin ? html(adminPage()) : redirect('/login');

  return json({error: 'Not found'}, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof UserError) return json({error: e.message}, e.status);
      console.error(e);
      return json({error: 'Something went wrong on the server'}, 500);
    }
  },
};
