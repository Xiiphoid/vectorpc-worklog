# Instructions for Claude

Both need the "VectorPC Work Log" connector added in Claude (Settings, Connectors, Add custom connector, the URL
from the Work Log's Settings tab).

## 1. Project instruction (paste into every client project, or the repo's CLAUDE.md)

Change the company and project on the first two lines.

```
## Work log
Company: Bulldog Abrasives
Project: BMS

After finishing any piece of work in this project, and always after pushing code, log it in the
"VectorPC Work Log" connector with log_work. Do not ask me first; tell me in one line what you logged.
- company and project: as above
- month: the billing month (YYYY-MM) the work belongs to; entries have no day. Months run from the
  26th to the 25th: work up to 25 Nov is 2026-11, work from 26 Nov is 2026-12 (South African time)
- one entry per distinct piece of work, not one entry for the whole session
- description: first line a short title of what was done (like "Fixed web emails failing since the PHP
  upgrade"), then a line or two of details in plain language the client understands: what was changed,
  fixed or built and why, and how it was checked. No passwords, keys, server paths or em dashes.
- hours: my figure if I give one. Otherwise estimate what a senior developer would need to do the same
  work by hand, without AI: understanding the request, investigating, designing, coding, testing,
  deploying and checking afterwards. Steps of 0.5, minimum 0.5. Never use how long you took.
  Yardsticks from earlier work: a small CSS fix tested on phones and pushed live 2 h; tracing and fixing
  a broken PHP extension after an upgrade 4 h; a new permission with its screens 6 h; a multi-form
  builder with custom questions and a live preview 28 h.
Before logging, call list_work for this company (range last-3) and do not log anything that is
already there.
```

## 2. Catch-up prompt (run once in each Bulldog project: everything after the October log)

```
Log all the work done in this project that is not in the VectorPC Work Log yet.

1. Call list_work for "Bulldog Abrasives" with range "all" to see what is already logged. The October log
   (billing month 2026-10) ends with BMS #47 "Sidebar scrolling fixed on phones, and the fix pushed live" and
   Brand Champions app #32 "Test site deployments". Everything after those is not logged yet.
2. Go through this project's history since then: commits and pull requests (git log with dates), the
   chats in this project, the changelog and the tickets (DEVE numbers). List every distinct piece of
   work finished after those items. Leave out anything already in the log (compare titles and details).
3. For each piece of work prepare one entry:
   - company: Bulldog Abrasives
   - project: BMS or Brand Champions app
   - month: the billing month it belongs to, YYYY-MM, from the commit or chat date (South African time).
     Billing months run from the 26th to the 25th: work up to 25 Nov is 2026-11, from 26 Nov 2026-12.
     Entries have a month only, no day.
   - description: first line a short title like the October "Work item" column, then the details in
     plain client language like the October "Details" column. No passwords, keys, server paths or em dashes.
   - hours: what a senior developer would need to do it by hand without AI (understanding, investigating,
     designing, coding, testing, deploying, checking). Steps of 0.5, minimum 0.5. Calibrate against the
     October items already in the log (list_work shows them with their hours). Never use how long you took.
4. Show me the list as a table (month, project, title, hours) with the total per month, and wait
   for my OK.
5. When I say OK, save them all with one log_work_bulk call, then tell me how many were saved and the
   total hours for this billing month.
```
