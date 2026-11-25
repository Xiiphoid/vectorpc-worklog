# CLAUDE.md: VectorPC Work Log

Owner: Ricky Tavares (VectorPC). Cloudflare Worker + D1 on the Workers Free plan (10 ms CPU, 50 D1 calls per request).
Deploys from GitHub with Workers Builds on every push to `main` (deploy command `npx wrangler deploy`).

- `src/worker.js` routes; `src/db.js` schema (self-upgrading, bump `SCHEMA_VERSION` and add statements) and data;
  `src/auth.js` sign-in, sessions, client passwords; `src/mcp.js` the Claude connector; `src/api.js` admin JSON
  and REST; `src/hub.js` the VectorPC app link; `src/ui/` pages (`admin.client.js` is sent with `toString()`,
  so it must not use anything from module scope).
- Entries have a billing month (`entries.month`, `YYYY-MM`), never a day. Billing months run from the 26th to the
  25th (`PERIOD_END_DAY`, `periodOf()`, `toMonth()` in `src/util.js`); a day given anywhere goes through `toMonth()`.
- Hours Claude estimates are what a senior developer would need by hand, never Claude's own time (`INSTRUCTIONS`
  in `src/mcp.js`, `docs/CLAUDE-INSTRUCTIONS.md`, the Settings snippet).
- Secrets: only `ADMIN_PASSWORD` (dashboard). Never put secrets in `wrangler.jsonc`.
- Writing style for anything a user or client reads: plain, no em dashes.
- `npm test` must pass (Miniflare end-to-end). Add a check for every behaviour change. Update the version table in README.
