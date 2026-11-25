# VectorPC Work Log

Logs billable work per client company (BMS, Brandchamp, RSB and others): a billing month and year (no day), a
detailed description, hours and an optional project. Cloudflare Worker + D1 on the Workers Free plan.

| Address | What |
|---|---|
| `/` | Admin, username and password: Work (filters, totals, add, edit, delete, CSV), Companies (client links, aliases, client passwords), Import (Excel or CSV), Settings (Claude connector, API token) |
| `/r/<link>` | The client's page for one company: range of months, total hours, entries grouped by billing month, CSV, print or save as PDF. Read only. Optional password per company. |
| `/mcp/<token>` | MCP connector for Claude (every chat and project): `log_work`, `log_work_bulk`, `list_work`, `list_companies`, `update_work`, `delete_work`, `add_company` |
| `/api/v1/*` | REST for scripts, `Authorization: Bearer <token>`: `GET /companies`, `GET /entries?company=&range=`, `POST /entries` |
| `/sso`, `/api/hub-summary` | The VectorPC app (app.vectorpc.co.za): sign-in from the Work Log tile, and the tile's hours |

**Entries carry a billing month (`YYYY-MM`), never a day.** Billing months run from the 26th to the 25th: work up to
25 Nov is November, work from 26 Nov is December. Anything given a day (Claude's `date`, a Date column in an import)
is put in its billing month by that rule. "This month", "Last month", the client page, Claude's month totals and the
app tile all use it.

| Version | Deployed | Notes |
|---|---|---|
| r2 | 25 Nov 2026 | The VectorPC bar on top of the admin page (back to the app, Apps menu), as in the other VectorPC apps: `src/vpxbar.js` and `src/vpxstyle.js` are copies of the canonical ones in vectorpc-cloud-panel `manager/` (keep identical). Settings: pick a company and project to fill the Claude instructions in; the instruction with the API key comes first and includes catching up from where the log ends; the connector is an optional closed section. |
| r1 | 25 Nov 2026 | First version. |

## Set up (once)

1. Push this repo to `Xiiphoid/vectorpc-worklog` (private).
2. Cloudflare dashboard, Workers & Pages, Create, Import a repository, pick `vectorpc-worklog`. Build command: none.
   Deploy command: `npx wrangler deploy`. The first deploy creates the D1 database `vectorpc-worklog` and binds it
   (no database id in `wrangler.jsonc`). If the build cannot create it, create a D1 database called
   `vectorpc-worklog` in the dashboard and add its `database_id` to `wrangler.jsonc`.
3. The Worker, Settings, Variables and Secrets: add the secret `ADMIN_PASSWORD` (at least 8 characters).
   The username is `ricky` (`ADMIN_USER` in `wrangler.jsonc`).
4. Sign in at https://vectorpc-worklog.xiiphoid.workers.dev, add the companies (or import), copy the connector URL
   from Settings and add it in Claude: Settings, Connectors, Add custom connector, name "VectorPC Work Log".

The schema creates itself on the first request. Secrets: `ADMIN_PASSWORD` only. The API token and the session key
are made on first run and kept in D1 (`meta`); Settings can replace the token (Claude must then get the new URL).

## Claude

The connector tells Claude how to log: real company names only (aliases match, so "Bulldog" finds Bulldog
Abrasives; an unknown name is refused with the list), the billing month, a title line then client-readable
details, and hours. When Ricky gives no hours, Claude estimates what a **senior developer would need to do the work
by hand without AI** (investigating, designing, coding, testing, deploying), in steps of 0.5, never how long the
Claude session took. See `docs/CLAUDE-INSTRUCTIONS.md` for the project instruction and the catch-up prompt.

## Import

The Import tab reads .xlsx/.xls (SheetJS, loaded from cdn.sheetjs.com in the browser) and .csv. Columns are matched
by header name; the company can come from a column, the sheet name or one value for all rows, the month from a
Month or Date column (2026-10, Oct 2026, a date) or one month for all rows, the project from a column or the sheet name, and a Details column is added under
the description. Total rows are skipped. Rows identical to an existing entry (company, month, hours, description)
are skipped, so importing twice is safe. Unknown companies block the import unless "Create companies" is ticked.

## Build and test

```
npm install
npm test        # builds with wrangler --dry-run and runs test/worklog.test.js in Miniflare (50 checks)
```

Free plan limits: 10 ms CPU and 50 D1 calls per request. Imports go in chunks of 400 rows (a few D1 calls each);
client passwords use PBKDF2 with 20 000 rounds (about 4 ms).
