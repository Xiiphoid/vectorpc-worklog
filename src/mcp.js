// MCP server (Streamable HTTP, JSON responses) so any Claude chat or project can log work.
// Connector URL: https://<worker>/mcp/<API token>  (the token is on the Settings tab).
import * as db from './db.js';
import {UserError, VERSION, fmtHours, json, presetRange, monthName, monthLabel} from './util.js';

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `VectorPC Work Log: Ricky's record of billable work per client company (Bulldog Abrasives, RSB and others).
When Ricky asks to "log the work" (or after you push code for a client project), call log_work with:
- company: the client company (call list_companies if unsure; never invent a new company, ask or use add_company only when Ricky confirms it is new)
- month: the billing month the work belongs to, YYYY-MM (entries have a month and year only, no day). Billing months run from the 26th to the 25th: work done up to 25 Nov is 2026-11, work from 26 Nov is 2026-12. Defaults to the current billing month. You may give date (YYYY-MM-DD, South African time) instead and it is turned into its billing month.
- hours: decimal hours in steps of 0.5 (0.5 minimum). Use Ricky's figure if he gives one. Otherwise estimate the hours a senior developer would need to do the same work by hand, without AI help: understanding the problem, investigating, designing, coding, testing, deploying and checking afterwards. Do not use how long the Claude session took.
- description: a short title line, then a detailed, client-readable account of the work done: what was changed, fixed or built and why, in plain language a client understands. Several sentences or short "- " lines are fine. No secrets, passwords, keys or internal file paths.
- project: optional repo or project name.
- The client reads every description: write as VectorPC describing its own work. Never mention Claude, Claude Code, AI assistants, prompts or sessions, or that any of it was automated or written by AI. Entries that mention Claude are refused.
After logging, confirm the entry back to Ricky in one line (company, date, hours).`;

const companyProp = {type: 'string', description: 'Client company name or alias, e.g. "Bulldog Abrasives" or "RSB"'};
const entryProps = {
  company: companyProp,
  month: {type: 'string', description: 'Billing month YYYY-MM (26th to 25th: 26 Nov 2026 belongs to 2026-12). Defaults to the current billing month.'},
  date: {type: 'string', description: 'Optional instead of month: the day the work was done (YYYY-MM-DD); it is turned into its billing month.'},
  hours: {type: 'number', description: 'Hours, decimal in steps of 0.5. Ricky\'s figure if given, otherwise what a senior developer would need to do the work by hand (not how long Claude took)'},
  description: {type: 'string', description: 'Detailed, client-readable description of the work done'},
  project: {type: 'string', description: 'Optional repo or project name'},
};

export const TOOLS = [
  {name: 'log_work', title: 'Log work',
    description: 'Log one piece of work done for a client company (date, hours, detailed description).',
    inputSchema: {type: 'object', properties: entryProps, required: ['company', 'hours', 'description']},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}},
  {name: 'log_work_bulk', title: 'Log many work entries',
    description: 'Log many entries at once (backfills and imports). Entries identical to an existing one (same company, date, hours and description) are skipped, so it is safe to re-run. If any row is invalid nothing is saved and the errors are returned.',
    inputSchema: {type: 'object', properties: {
      entries: {type: 'array', maxItems: 1000, items: {type: 'object', properties: entryProps, required: ['company', 'hours', 'description']}},
      create_missing_companies: {type: 'boolean', description: 'Create companies that do not exist yet. Only true when Ricky confirmed they are new clients.'},
    }, required: ['entries']},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false}},
  {name: 'list_companies', title: 'List companies',
    description: 'List client companies with aliases, total hours, last logged date and the client report link.',
    inputSchema: {type: 'object', properties: {}},
    annotations: {readOnlyHint: true, openWorldHint: false}},
  {name: 'list_work', title: 'List logged work',
    description: 'List logged work, optionally for one company and a range of billing months, with the total hours. range can be this-month, last-month, last-3, this-year, last-year or all; or give from/to as YYYY-MM.',
    inputSchema: {type: 'object', properties: {
      company: companyProp,
      range: {type: 'string', enum: ['this-month', 'last-month', 'last-3', 'this-year', 'last-year', 'all']},
      from: {type: 'string', description: 'First billing month, YYYY-MM'}, to: {type: 'string', description: 'Last billing month, YYYY-MM'},
      search: {type: 'string', description: 'Text to search for in descriptions or project names'},
      limit: {type: 'number', description: 'Max entries returned (default 100)'},
    }},
    annotations: {readOnlyHint: true, openWorldHint: false}},
  {name: 'update_work', title: 'Update a work entry',
    description: 'Change an existing entry by id (from list_work). Only the fields given are changed.',
    inputSchema: {type: 'object', properties: {id: {type: 'number'}, ...entryProps}, required: ['id']},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false}},
  {name: 'delete_work', title: 'Delete a work entry',
    description: 'Delete an entry by id. Only when Ricky asks for it.',
    inputSchema: {type: 'object', properties: {id: {type: 'number'}}, required: ['id']},
    annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false}},
  {name: 'add_company', title: 'Add a company',
    description: 'Add a new client company (only when Ricky confirms it is a new client). Aliases are other names it goes by, so "log for RSB" finds it.',
    inputSchema: {type: 'object', properties: {name: {type: 'string'}, aliases: {type: 'string', description: 'Comma separated'}}, required: ['name']},
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}},
];

const shortEntry = e => ({id: e.id, company: e.company, month: e.month, hours: e.hours, description: e.description, ...(e.project ? {project: e.project} : {})});

async function monthTotal(env, companyId, month) {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(hours),0) AS h FROM entries WHERE company_id=? AND month=?').bind(companyId, month).first();
  return Math.round(r.h * 100) / 100;
}

// The client reads every description and project name: nothing about Claude may reach it.
const TOOL_WORDS = /\b(claude|chatgpt|copilot|codex)\b|\bai[- ]generated\b|\b(this|the|our|my) (claude |chat )?session\b/i;
function clientSafe(e, row = '') {
  for (const f of ['description', 'project']) {
    if (e && typeof e[f] === 'string' && TOOL_WORDS.test(e[f])) {
      throw new UserError(`${row}The ${f} mentions "${e[f].match(TOOL_WORDS)[0]}". The client reads it: describe the work as VectorPC did it, without mentioning Claude, AI tools or sessions.`);
    }
  }
}

export async function callTool(env, origin, name, args = {}) {
  const D = env.DB;
  if (name === 'log_work' || name === 'update_work') clientSafe(args);
  if (name === 'log_work_bulk' && Array.isArray(args.entries)) args.entries.forEach((e, i) => clientSafe(e, `Nothing saved. Row ${i + 1}: `));
  switch (name) {
    case 'log_work': {
      const c = await db.requireCompany(D, args.company);
      if (c.archived) throw new UserError(`${c.name} is archived. Unarchive it on the Companies tab first.`);
      const e = await db.addEntry(D, c.id, args, 'claude');
      const month = await monthTotal(env, c.id, e.month);
      return {text: `Logged ${fmtHours(e.hours)} h for ${c.name} in ${monthLabel(e.month)} (entry ${e.id}). ${c.name} total for ${monthName(e.month)}: ${fmtHours(month)} h.`,
        data: {entry: shortEntry(e), month_total_hours: month}};
    }
    case 'log_work_bulk': {
      const r = await db.bulkAdd(D, args.entries, {source: 'claude', createCompanies: !!args.create_missing_companies});
      if (r.errors.length) return {error: true, text: `Nothing saved. ${r.errors.length} row(s) have problems:\n` + r.errors.slice(0, 30).map(e => `row ${e.row}: ${e.error}`).join('\n'), data: r};
      return {text: `Imported ${r.imported} entries (${fmtHours(r.total_hours_imported)} h), skipped ${r.skipped_duplicates} duplicates.${r.created_companies.length ? ' New companies: ' + r.created_companies.join(', ') + '.' : ''}`, data: r};
    }
    case 'list_companies': {
      const list = (await db.listCompanies(D)).map(c => ({id: c.id, name: c.name, aliases: c.aliases, archived: c.archived,
        total_hours: c.total_hours, entries: c.entry_count, last_month: c.last_month, report_url: `${origin}/r/${c.share_token}`, report_password: c.has_password}));
      return {text: list.length ? list.map(c => `${c.name}${c.aliases ? ' (' + c.aliases + ')' : ''}${c.archived ? ' [archived]' : ''}: ${fmtHours(c.total_hours)} h, last ${c.last_month ? monthName(c.last_month) : 'never'}`).join('\n') : 'No companies yet.', data: {companies: list}};
    }
    case 'list_work': {
      let {from, to} = args;
      if (args.range) ({from, to} = presetRange(args.range) || {from, to});
      const company = args.company ? await db.requireCompany(D, args.company) : null;
      const r = await db.listEntries(D, {companyId: company?.id, from, to, q: args.search, limit: Math.min(Number(args.limit) || 100, 1000)});
      const span = from && from === to ? monthName(from) : `${from ? monthName(from) : 'start'} to ${to ? monthName(to) : 'now'}`;
      return {text: `${company ? company.name : 'All companies'}, ${span}: ${r.count} entries, ${fmtHours(r.total_hours)} h.` + (r.truncated ? ` Showing the latest ${r.entries.length}.` : ''),
        data: {company: company?.name || null, from: from || null, to: to || null, total_hours: r.total_hours, count: r.count, entries: r.entries.map(shortEntry)}};
    }
    case 'update_work': {
      const company = args.company !== undefined ? await db.requireCompany(D, args.company) : null;
      const e = await db.updateEntry(D, args.id, args, company?.id);
      return {text: `Updated entry ${e.id}: ${e.company}, ${monthName(e.month)}, ${fmtHours(e.hours)} h.`, data: {entry: shortEntry(e)}};
    }
    case 'delete_work': {
      const r = await db.deleteEntry(D, args.id);
      return {text: `Deleted entry ${r.entry.id} (${r.entry.company}, ${monthName(r.entry.month)}, ${fmtHours(r.entry.hours)} h).`, data: {deleted: shortEntry(r.entry)}};
    }
    case 'add_company': {
      const c = await db.createCompany(D, args);
      return {text: `Added ${c.name}. Client report: ${origin}/r/${c.share_token}`, data: {id: c.id, name: c.name, aliases: c.aliases, report_url: `${origin}/r/${c.share_token}`}};
    }
    default: throw new UserError(`Unknown tool ${name}`);
  }
}

async function handleRpc(env, origin, msg) {
  const {id, method, params = {}} = msg || {};
  const isNotification = id === undefined || id === null;
  const reply = result => ({jsonrpc: '2.0', id, result});
  const fail = (code, message) => ({jsonrpc: '2.0', id: id ?? null, error: {code, message}});
  if (!msg || msg.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid request');
  if (isNotification) return null;
  switch (method) {
    case 'initialize': {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return reply({protocolVersion: v, capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'vectorpc-worklog', title: 'VectorPC Work Log', version: VERSION}, instructions: INSTRUCTIONS});
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({tools: TOOLS});
    case 'tools/call': {
      try {
        const out = await callTool(env, origin, params.name, params.arguments || {});
        return reply({content: [{type: 'text', text: out.text}], structuredContent: out.data, isError: !!out.error});
      } catch (e) {
        if (e instanceof UserError) return reply({content: [{type: 'text', text: e.message}], isError: true});
        console.error(e);
        return reply({content: [{type: 'text', text: 'Server error: ' + (e.message || e)}], isError: true});
      }
    }
    case 'resources/list': return reply({resources: []});
    case 'prompts/list': return reply({prompts: []});
    default: return fail(-32601, `Method not found: ${method}`);
  }
}

export async function handleMcp(req, env, url) {
  if (req.method === 'GET') return new Response('Method Not Allowed', {status: 405, headers: {Allow: 'POST'}});
  if (req.method === 'DELETE') return new Response(null, {status: 204});
  if (req.method !== 'POST') return new Response('Method Not Allowed', {status: 405, headers: {Allow: 'POST'}});
  let body;
  try { body = await req.json(); } catch { return json({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}, 400); }
  const batch = Array.isArray(body);
  const out = (await Promise.all((batch ? body : [body]).map(m => handleRpc(env, url.origin, m)))).filter(Boolean);
  if (!out.length) return new Response(null, {status: 202});
  return json(batch ? out : out[0]);
}
