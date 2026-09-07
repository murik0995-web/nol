# NOL

**Zero subscriptions. Zero employees. Zero lock-in.**

Subscriptions exist because software was built by expensive humans. Software is now built by agents. Rent has lost its reason to exist. NOL is the first company that lives in that reality: every business tool, open source, free, built and maintained by AI agents. Take the code and leave whenever you want.

Live: https://murik0995-web.github.io/nol/

## What's inside

| App | Replaces | Imports |
|---|---|---|
| `apps/crm.html` | Salesforce, HubSpot (incl. reporting), Pipedrive… | contacts & deals CSV |
| `apps/desk.html` | Zendesk, Freshdesk, Intercom… | tickets CSV |
| `apps/people.html` | BambooHR, Gusto, Rippling… | employee directory CSV |
| `apps/leave.html` | Timetastic, Vacation Tracker, LeaveBoard, Calamari… | leave / absence CSV, public holidays CSV |
| `apps/hiring.html` | Workable, Greenhouse, Lever, Breezy HR, Recruitee, Teamtailor, Homerun… | candidates & jobs CSV |
| `apps/wiki.html` | Notion, Confluence, Slite… | Markdown / HTML files |
| `apps/meetings.html` | Fellow, Hugo, Hypercontext, Notion meetings… | meetings CSV |
| `apps/tasks.html` | Trello, Asana, Jira, Linear, monday… | Trello JSON, tasks CSV |
| `apps/goals.html` | Perdoo, Weekdone, Profit.co, Quantive, Viva Goals… | OKR CSV |
| `apps/quotes.html` | Qwilr, Proposify, Better Proposals, PandaDoc, Zoho Books… | quotes / proposals CSV |
| `apps/standups.html` | Geekbot, Standuply, DailyBot, Range, Jell… | standup history CSV |
| `apps/retros.html` | Parabol, Retrium, EasyRetro, TeamRetro, Metro Retro… | retro board CSV |
| `apps/invoices.html` | FreshBooks, QuickBooks, Xero, Wave… | invoices CSV |
| `apps/contracts.html` | PandaDoc, Concord, ContractSafe, Juro, DocuSign CLM… | contracts CSV |
| `apps/expenses.html` | Expensify, Zoho Expense, Rydoo, Pleo… | bank statements & expense CSV |
| `apps/inventory.html` | Sortly, Zoho Inventory, inFlow, Katana, Cin7 Core… | items / stock CSV |
| `apps/assets.html` | Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory, Freshservice… | asset register CSV |
| `apps/subscriptions.html` | Vendr, Zylo, Torii, Cledara, Spendflo, Sastrify… | pasted statement, subscriptions CSV |
| `apps/timesheets.html` | Toggl Track, Harvest, Clockify, TimeCamp… | detailed time report CSV |

- **Hiring** — jobs and candidates in one app. A stage board (Applied → Screen → Interview → Offer → Hired / Rejected) with drag and drop between columns and your own card order inside one, filtered by job. Source on every candidate, resumes attached to the record, timestamped notes with @mentions, recruiters and hiring managers from People. A candidate CSV from any ATS imports in one click: jobs are created from its job column and its own stage names are folded onto the board.
- **Leave** — a month calendar of who is off, built from the very time-off requests People already keeps: one record, two views. Weeks start on Monday, weekends are shaded, today is marked, a pending request is drawn with a dashed border and can be approved or declined without leaving the calendar. **Out today** sits above the month with the day each person is back. A **Holidays** tab keeps the days your company does not work — yours to fill in, NOL ships no country calendar — and marks them on every month. **Export iCal** writes the whole workspace as an `.ics` of all-day events you can subscribe to in Google Calendar, Outlook or Apple Calendar. A leave CSV from any tracker imports in one click, day-first dates included, with foreign approval names folded onto pending / approved / declined.
- **Meetings** — an agenda before the meeting, Markdown notes during it, decisions and action items after. Attendees come from People, and every action item becomes a real task in Tasks with its owner and due date; the meeting keeps the link, so an action ticked off in Tasks reads as done here too. A **Decisions** tab is the log of every decision of every meeting, newest first, one click from the meeting it was made in. A meeting happening today shows up in the Today strip. A CSV from any meeting-notes tool imports in one click: attendees, agenda, notes, decisions and action items are read out of whatever the export called those columns.
- **Retros** — a retrospective board per sprint: what went well, what to improve, what to do next. Every card carries votes, so the loudest problem sorts to the top of its column, and a card in the action column becomes a real task in Tasks with the author as its owner — the card keeps the link, so a task finished in Tasks reads as done here. A finished retro goes to the **archive** and every board you ever ran stays readable. The columns are yours: a CSV from any retro tool imports in one click and its own template is folded onto the three that matter — Continue becomes *Went well*, Stop becomes *To improve*, Start becomes *Action items* — while a column we have no name for, like Kudos, keeps its own.
- **CRM reports and dedupe** — a **Reports** tab in CRM: open pipeline and closed-won tiles, win rate as an SVG donut, pipeline by stage, closed-won by month as an SVG chart, and a per-owner table. **Duplicates** finds contacts sharing an email or a phone (however either was typed) and merges each group in one click into the fullest record. Every contact and every company gets a **Timeline**: notes, deals, tickets and invoices in one list, newest first.
- **Inventory** — items with SKU, quantity, location and reorder level, a one-click **Low stock** filter for everything at or below its reorder point, and a **Stock movements** log: every receipt, shipment and recount with its date, quantity, reason and person. A quantity typed into the item form is logged too, so the movements never disagree with the stock on hand. Suppliers are CRM companies, people come from People, and the Home page shows what is running low.
- **Assets** — an IT and equipment register: device, asset tag, serial number, category, the person from People holding it, location, purchase date, purchase cost and warranty end. A **Warranty ending** filter for everything already out of warranty or running out inside 30 days, and a warranty that ends today shows up in the Today strip. **Check in** takes a device back from whoever held it and puts it in stock. Suppliers are CRM companies. A CSV from any register imports in one click: dates in whatever order the export wrote them, and foreign status names (Deployed, Ready to Deploy, Under Repair, Archived) folded onto in use / in stock / in repair / retired.
- **Subscriptions** — every tool you pay for with its owner, seats, cost and billing cycle, normalised to one monthly and one yearly number whatever the cycle. Renewals inside 30 days are flagged on the row, counted in the header and filtered in one click; the day a renewal lands it shows up in the Today strip. **Paste statement** runs the pasted card statement through the same catalogue `unsubscribe.html` uses, takes the amount off the line when there is one and estimates the list price when there is not, and each recognised tool carries a link to the NOL app that replaces it.
- **Invoice payments and recurring** — record full or partial payments with a date, a method and a reference; the balance due prints on the invoice itself and the status follows the money (draft → sent → partial → paid). Mark an invoice **monthly** or **quarterly** and opening Invoices drops the next draft on schedule, catching up on every period missed. Your bank details sit on the paper, and numbering restarts every January: `2026-0001`.
- `apps/company-page.html` — one page per client: contacts, deals, tickets, invoices with balance, tasks and notes together. Linked from CRM, Desk and Invoices.
- `apps/trash-history.html` — trash and history for the whole workspace: every deleted record in one place, restored in one click or purged forever, plus a change log (and workspace repo commits when Team sync is on). In the sidebar of every app.
- `apps/factory.html` — the conveyor from the inside: the daemon's live state (agents busy, spend against budget, what is building), the **Factory** board with an inline answer box for the questions the conveyor asks, QA reports from the tester agent, and the last ten journal events. The live section only answers on the owner's machine; everywhere else it stays quiet.
- **Today strip** on Home and above every app: tasks due today or overdue, invoices past their due date, time off starting today, subscriptions renewing today. One click opens the record, another hides it until tomorrow. Turn on browser notifications and NOL tells you while a tab is open — no server, no account, nothing leaves the browser.
- **Cmd/Ctrl+K** in any app — one search across contacts, companies, deals, tickets, people, pages, tasks, invoices, expenses, inventory items, assets, meetings and subscriptions, with recents and keyboard navigation.
- `unsubscribe.html` — paste a card statement or a list of tools, see the yearly rent, move each one.
- `alt/<slug>/` — one page per replaced subscription (generated from `data/saas.json`).
- `factory.html` — public build log, rendered from `journal/events.json`.

Everything runs in the browser. Data lives in `localStorage` under one key (`nol.db`) shared by all apps: a requester in Desk is a contact in CRM, an assignee in Tasks is a person in People. **Export all** dumps it as one JSON file. **Restore** loads it back.

## Team sync

Click **Team sync** in any app. Paste a GitHub token (the link preselects the `repo` scope), and NOL creates a private repository in your account, `you/nol-data`, one JSON file per collection. Every teammate you invite by username works on the same data from their own browser. Sync is a union merge by record id, newest `updated` wins, deletions travel as tombstones, and a stale write retries after a pull. Nothing passes through NOL. Your company's data is a git repository you own, with history and backups.

`node scripts/sync-e2e.mjs` runs the whole flow against real GitHub (needs a token in the git credential store).

## The factory, automated

Since 6 September the factory runs on the [conveyor](../conveyor): the NOL board (project **Factory**) is a task source, up to 3 agents work in isolated worktrees, gates + critic run before merge, statuses and notes come back to the cards, and a tester agent (`factory/tester.mjs`, run by the conveyor after every merge) uses the deployed product as a real user in both languages and on phone width, writes a report with screenshots to the task card, and files every defect as a bug card that the conveyor then fixes. `conveyor.json` holds the repo settings; `factory/CONVENTIONS.md` is what every agent reads first. The older single-agent loop below stays as a fallback.

### Fallback: single-agent loop

`factory/run.sh` is one shift: reset to `origin/main`, hand `factory/PROMPT.md` to an agent, then push only if `node --test` and `node scripts/build.mjs` pass. The backlog is a NOL Tasks board: project **Factory** in the workspace repo `nol-data`, read and updated by `factory/backlog.mjs` (`next`, `start`, `done`, `block`). NOL runs on NOL. Open issues labelled `request` with 3+ 👍 jump the queue. `factory/queue.json` is only the initial seed. `factory/loop.sh` runs shift after shift, around the clock, while the machine is on (launchd `com.nol.factory`, KeepAlive). A task that fails two shifts is blocked and the loop moves on.

## Run it yourself

No build step for the apps. Static files, any web server:

```
python3 -m http.server 8787   # then open http://localhost:8787
```

Build the deployable site (alt pages, sitemap, journal, cache-busting) into `dist/`, then check it:

```
node --test && node scripts/build.mjs && node scripts/smoke.mjs
```

GitHub Actions runs the same build on every push to `main` and deploys `dist/` to Pages (`.github/workflows/pages.yml`). Generated files are never committed. Journal events live one file per shift in `journal/events/`; `journal/base.json` is the frozen history.

Self-hosting is a fork. That is the point.

## Prices in the catalogue

`data/saas.json` holds public list prices, approximate, in USD per user per month (or `flat: true` per month), checked September 2026. Wrong? [Open an issue](https://github.com/murik0995-web/nol/issues/new). Product names belong to their owners; NOL is not affiliated with any of them.

## The factory

Every day for 100 days the agents ship a free open twin of a tool people pay for, in public. [Request one](https://github.com/murik0995-web/nol/issues/new?template=request.yml), vote with 👍, watch the [log](https://murik0995-web.github.io/nol/factory.html).

MIT.
