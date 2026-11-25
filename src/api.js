// JSON APIs: /admin/api/* (signed-in admin, same origin) and /api/v1/* (Bearer API token, for scripts).
import * as db from './db.js';
import {UserError, json, presetRange, presetLabels, csvCell, randomToken, currentMonth, monthName, hashPassword} from './util.js';
import {signOutEverywhere} from './auth.js';
import {callTool} from './mcp.js';

async function body(req) {
  try { return await req.json(); } catch { throw new UserError('Body must be JSON'); }
}

function rangeFrom(sp) {
  const preset = sp.get('range');
  if (preset) { const r = presetRange(preset); if (r) return r; }
  return {from: sp.get('from') || '', to: sp.get('to') || ''};
}

async function clientLink(D, origin) {
  return {url: `${origin}/r/${await db.getMeta(D, 'client_token')}`, has_password: Boolean(await db.getMeta(D, 'client_password'))};
}

const companyOut = (c, origin) => ({...c, report_url: `${origin}/r/${c.share_token}`});

export async function adminApi(req, env, url) {
  const D = env.DB, path = url.pathname.replace(/^\/admin\/api/, ''), m = req.method;
  let mm;

  if (path === '/state' && m === 'GET') {
    const companies = (await db.listCompanies(D)).map(c => companyOut(c, url.origin));
    return json({companies, month: currentMonth(), origin: url.origin, labels: presetLabels()});
  }

  if (path === '/entries' && m === 'GET') {
    const sp = url.searchParams, {from, to} = rangeFrom(sp);
    return json(await db.listEntries(D, {companyId: sp.get('company') || null, from, to, q: sp.get('q') || ''}));
  }
  if (path === '/entries.csv' && m === 'GET') {
    const sp = url.searchParams, {from, to} = rangeFrom(sp);
    const r = await db.listEntries(D, {companyId: sp.get('company') || null, from, to, q: sp.get('q') || '', limit: 5000});
    // no Source column: this file may be sent to a client
    const lines = [['Month', 'Company', 'Hours', 'Description', 'Project'].join(',')]
      .concat(r.entries.map(e => [monthName(e.month), e.company, e.hours, e.description, e.project].map(csvCell).join(',')));
    lines.push(['Total', '', r.total_hours, '', ''].map(csvCell).join(','));
    return new Response('﻿' + lines.join('\r\n'), {headers: {'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="worklog-${from || 'start'}-${to || currentMonth()}.csv"`, 'Cache-Control': 'no-store'}});
  }
  if (path === '/entries' && m === 'POST') {
    const b = await body(req);
    const c = await db.getCompany(D, b.company_id);
    if (!c) throw new UserError('Choose a company');
    return json({entry: await db.addEntry(D, c.id, b, 'manual')});
  }
  if ((mm = path.match(/^\/entries\/(\d+)$/))) {
    if (m === 'PUT') {
      const b = await body(req);
      let cid;
      if (b.company_id !== undefined) { const c = await db.getCompany(D, b.company_id); if (!c) throw new UserError('Choose a company'); cid = c.id; }
      return json({entry: await db.updateEntry(D, mm[1], b, cid)});
    }
    if (m === 'DELETE') return json(await db.deleteEntry(D, mm[1]));
  }
  if (path === '/import' && m === 'POST') {
    const b = await body(req);
    return json(await db.bulkAdd(D, b.rows, {source: 'import', createCompanies: !!b.create_companies}));
  }

  if (path === '/companies' && m === 'POST') return json({company: companyOut(await db.createCompany(D, await body(req)), url.origin)});
  if ((mm = path.match(/^\/companies\/(\d+)$/))) {
    if (m === 'PUT') return json({company: companyOut(await db.updateCompany(D, mm[1], await body(req)), url.origin)});
    if (m === 'DELETE') return json(await db.deleteCompany(D, mm[1]));
  }

  if (path === '/settings' && m === 'GET') {
    const token = await db.getMeta(D, 'api_token');
    return json({mcp_url: `${url.origin}/mcp/${token}`, api_token: token, origin: url.origin, user: env.ADMIN_USER || 'ricky'});
  }
  if (path === '/settings/new-token' && m === 'POST') {
    await db.setMeta(D, 'api_token', randomToken(32));
    const token = await db.getMeta(D, 'api_token');
    return json({mcp_url: `${url.origin}/mcp/${token}`, api_token: token});
  }
  if (path === '/client-link' && m === 'GET') return json(await clientLink(D, url.origin));
  if (path === '/client-link' && m === 'POST') {
    const b = await body(req);
    if (b.new_link) await db.setMeta(D, 'client_token', randomToken(24));
    if (b.client_password !== undefined) {
      const p = String(b.client_password || '');
      if (p && p.length < 6) throw new UserError('Client password must be at least 6 characters');
      await db.setMeta(D, 'client_password', p ? await hashPassword(p) : '');
    }
    return json(await clientLink(D, url.origin));
  }
  if (path === '/settings/sign-out-all' && m === 'POST') { await signOutEverywhere(env); return json({ok: true}); }

  return json({error: 'Not found'}, 404);
}

// REST for scripts and git hooks: same operations as the MCP tools.
//   GET  /api/v1/companies
//   GET  /api/v1/entries?company=&range=|from=&to=&search=
//   POST /api/v1/entries   {company, date, hours, description, project}  or  {entries: [...], create_missing_companies}
export async function restApi(req, env, url) {
  const path = url.pathname.replace(/^\/api\/v1/, ''), m = req.method;
  const run = async (tool, args) => {
    const out = await callTool(env, url.origin, tool, args);
    return json({ok: !out.error, message: out.text, ...out.data}, out.error ? 400 : 200);
  };
  if (path === '/companies' && m === 'GET') return run('list_companies', {});
  if (path === '/entries' && m === 'GET') {
    const sp = url.searchParams;
    return run('list_work', {company: sp.get('company') || undefined, range: sp.get('range') || undefined,
      from: sp.get('from') || undefined, to: sp.get('to') || undefined, search: sp.get('search') || undefined, limit: Number(sp.get('limit')) || 1000});
  }
  if (path === '/entries' && m === 'POST') {
    const b = await body(req);
    return Array.isArray(b.entries) ? run('log_work_bulk', b) : run('log_work', b);
  }
  return json({error: 'Not found'}, 404);
}
