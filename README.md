# NOL

**Zero subscriptions. Zero employees. Zero lock-in.**

Subscriptions exist because software was built by expensive humans. Software is now built by agents. Rent has lost its reason to exist. NOL is the first company that lives in that reality: every business tool, open source, free, built and maintained by AI agents. Take the code and leave whenever you want.

Live: https://murik0995-web.github.io/nol/

## What's inside

| App | Replaces | Imports |
|---|---|---|
| `apps/dashboard.html` | Databox, Geckoboard, Klipfolio, Grow, Cyfe, DashThis, Whatagraph… | metric / KPI history CSV |
| `apps/crm.html` | Salesforce, HubSpot (incl. reporting), Pipedrive… | contacts & deals CSV |
| `apps/desk.html` | Zendesk, Freshdesk, Intercom… | tickets CSV |
| `apps/status.html` | Statuspage, Instatus, Hund, Better Stack, Status.io… | components & incidents CSV |
| `apps/people.html` | BambooHR, Gusto, Rippling… | employee directory CSV |
| `apps/orgchart.html` | Pingboard, ChartHop, OrgChart Now, Organimi… | employee directory CSV with a manager column |
| `apps/reviews.html` | Lattice, 15Five, Culture Amp, Small Improvements, Trakstar… | review cycle CSV |
| `apps/leave.html` | Timetastic, Vacation Tracker, LeaveBoard, Calamari… | leave / absence CSV, public holidays CSV |
| `apps/hiring.html` | Workable, Greenhouse, Lever, Breezy HR, Recruitee, Teamtailor, Homerun… | candidates & jobs CSV |
| `apps/onboarding.html` | Trainual, Enboarder, Sapling, Talmundo, WorkBright, Waybook, Eddy… | onboarding tasks / workflow CSV |
| `apps/training.html` | TalentLMS, Thinkific, Docebo, LearnUpon, Absorb LMS, 360Learning, SAP Litmos… | course / lesson / learner progress CSV |
| `apps/wiki.html` | Notion, Confluence, Slite… | Markdown / HTML files |
| `apps/helpcenter.html` | Zendesk Guide, Help Scout Docs, HelpDocs, Intercom Articles… | help center article CSV |
| `apps/meetings.html` | Fellow, Hugo, Hypercontext, Notion meetings… | meetings CSV |
| `apps/tasks.html` | Trello, Asana, Jira, Todoist, Linear, monday, TeamGantt, GanttPRO, Microsoft Project… | Trello JSON, tasks CSV (start, due and predecessor columns included) |
| `apps/goals.html` | Perdoo, Weekdone, Profit.co, Quantive, Viva Goals… | OKR CSV |
| `apps/quotes.html` | Qwilr, Proposify, Better Proposals, PandaDoc, Zoho Books… | quotes / proposals CSV |
| `apps/standups.html` | Geekbot, Standuply, DailyBot, Range, Jell… | standup history CSV |
| `apps/retros.html` | Parabol, Retrium, EasyRetro, TeamRetro, Metro Retro… | retro board CSV |
| `apps/feedback.html` | Canny, Nolt, Frill, Featurebase, UserVoice, Upvoty, Sleekplan… | feedback / feature requests CSV |
| `apps/roadmap.html` | ProductPlan, Roadmunk, Canny, airfocus, Productboard… | roadmap CSV |
| `apps/changelog.html` | Headway, Beamer, LaunchNotes, AnnounceKit, Noticeable, Frill, Olvy… | updates / release notes CSV |
| `apps/invoices.html` | FreshBooks, QuickBooks, Xero, Wave… | invoices CSV |
| `apps/captable.html` | Carta, Pulley, Ledgy, Cake Equity, Eqvista, Vestd… | cap table / stakeholder CSV |
| `apps/contracts.html` | PandaDoc, Concord, ContractSafe, Juro, DocuSign CLM… | contracts CSV |
| `apps/expenses.html` | Expensify, Zoho Expense, Rydoo, Pleo… | bank statements & expense CSV |
| `apps/purchase.html` | Precoro, Procurify, Tradogram, Order.co, Coupa… | purchase orders CSV |
| `apps/inventory.html` | Sortly, Zoho Inventory, inFlow, Katana, Cin7 Core… | items / stock CSV |
| `apps/assets.html` | Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory, Freshservice… | asset register CSV |
| `apps/rooms.html` | Robin, Skedda, Joan, OfficeRnD, Envoy, deskbird, Kadence, Roomzilla… | bookings / spaces CSV |
| `apps/cashflow.html` | Float, Pulse, Finmark, Agicap, Cashflow Frog, Dryrun… | forecast / scenario CSV |
| `apps/budgets.html` | Budgyt, Cube, Vena, PlanGuru, Anaplan, Planful, Prophix… | budget vs actuals CSV, months across the top or one row per month |
| `apps/subscriptions.html` | Vendr, Zylo, Torii, Cledara, Spendflo, Sastrify… | pasted statement, subscriptions CSV |
| `apps/timesheets.html` | Toggl Track, Harvest, Clockify, TimeCamp… | detailed time report CSV |

- **Dashboard** — KPI tiles read straight out of the other apps, and the metrics no app knows about. Twenty tiles are on offer — open pipeline, open tickets, open and overdue tasks, headcount, money to collect, revenue and spend this month, goals on track, quotes out, monthly tool spend, months of runway, low stock, open incidents, candidates in play, assets in use, contracts to decide, hours this week, meetings ahead — and you pick which ones this dashboard watches; the choice is one record in the workspace, so the whole team sees the same board. Under them sit **metrics you keep by hand**: website visitors, NPS, churn, units shipped. A metric has a unit (plain number, money or percent), a target, a direction — higher is better, or lower is — and a reading whenever you have one. Each card draws a sparkline of every reading, the change against the previous one in green or red according to that direction, and a bar against the target. A CSV from Databox, Geckoboard, Klipfolio, Grow, Cyfe or DashThis imports in one click: one row per reading, several metrics in the same file, and a re-import corrects a day rather than duplicating it.
- **Hiring** — jobs and candidates in one app. A stage board (Applied → Screen → Interview → Offer → Hired / Rejected) with drag and drop between columns and your own card order inside one, filtered by job. Source on every candidate, resumes attached to the record, timestamped notes with @mentions, recruiters and hiring managers from People. A candidate CSV from any ATS imports in one click: jobs are created from its job column and its own stage names are folded onto the board.
- **Reviews** — performance review cycles with the questions you actually ask: one form per person holding the self review and the manager review side by side, a rating on five steps on each side, and a **Shared with the person** tick when the manager has handed it over. A cycle knows who is in it, so **Still to write** lists everyone who has not started, and closing a cycle stops it asking for anything while every word stays readable. **1:1s** are Markdown notes between a manager and one person, kept in the same collection as every other meeting — so a 1:1 written here also shows up in Meetings and on Home. **History** is per person: every cycle they went through with the rating they got, and how many 1:1s you have written with them. A CSV from any performance tool imports in one click, in both shapes those tools export — one row per question or one column per question — and their own wording for a rating ("Exceeds expectations", `4/5`, a ten-point score, a percentage) is folded onto the same five steps.
- **Onboarding** — the checklist a new hire actually gets, and how far through it they are. A template is a list of steps, each with an owner from People and a **day counted from the start date**: `-3` is the laptop ordered the week before, `0` is the first morning, `+30` is the thirty-day review — so one template fits everybody and every real date is worked out from the day that person starts. Starting somebody copies the template onto them, and picking a name from People fills in their role and their first day by itself; from there the board shows progress, the next step and how many steps are late. Any step still open can be sent to Tasks as a real task with its owner and its due date. A CSV from Trainual, Enboarder, Sapling, Workable or Eddy imports in one click: rows that name a person become that person's onboarding, rows that do not become a template, and a due date is turned back into a day offset from the start date.
- **Training** — the courses a company teaches itself, built out of the wiki it already wrote. A lesson is one Wiki page plus, if you want it, a few multiple-choice questions; the arrows in the editor set the order people read them in, and **Add a Wiki folder** turns a whole folder into a course in one click. Somebody is enrolled with a date to finish by, then reads each lesson right here — the page rendered the way Wiki renders it — and answers the questions underneath. The answers are marked on the spot: at or above the course's **pass mark** the lesson is ticked off, below it the wrong ones are marked and the lesson can be retaken as many times as it takes, and a failed retake never takes away a lesson already passed. **People** shows every learner with lessons done, score, what is due and what is overdue. A TalentLMS, Thinkific, Docebo, LearnUpon or Absorb export lands as courses and progress in one file: rows that name a learner are that person's progress, rows that do not are the course itself, and a lesson whose name matches a Wiki page picks that page up by itself.
- **Leave** — a month calendar of who is off, built from the very time-off requests People already keeps: one record, two views. Weeks start on Monday, weekends are shaded, today is marked, a pending request is drawn with a dashed border and can be approved or declined without leaving the calendar. **Out today** sits above the month with the day each person is back. A **Holidays** tab keeps the days your company does not work — yours to fill in, NOL ships no country calendar — and marks them on every month. **Export iCal** writes the whole workspace as an `.ics` of all-day events you can subscribe to in Google Calendar, Outlook or Apple Calendar. A leave CSV from any tracker imports in one click, day-first dates included, with foreign approval names folded onto pending / approved / declined.
- **Meetings** — an agenda before the meeting, Markdown notes during it, decisions and action items after. Attendees come from People, and every action item becomes a real task in Tasks with its owner and due date; the meeting keeps the link, so an action ticked off in Tasks reads as done here too. A **Decisions** tab is the log of every decision of every meeting, newest first, one click from the meeting it was made in. A meeting happening today shows up in the Today strip. A CSV from any meeting-notes tool imports in one click: attendees, agenda, notes, decisions and action items are read out of whatever the export called those columns.
- **Retros** — a retrospective board per sprint: what went well, what to improve, what to do next. Every card carries votes, so the loudest problem sorts to the top of its column, and a card in the action column becomes a real task in Tasks with the author as its owner — the card keeps the link, so a task finished in Tasks reads as done here. A finished retro goes to the **archive** and every board you ever ran stays readable. The columns are yours: a CSV from any retro tool imports in one click and its own template is folded onto the three that matter — Continue becomes *Went well*, Stop becomes *To improve*, Start becomes *Action items* — while a column we have no name for, like Kudos, keeps its own.
- **Feedback** — a board of what customers actually ask for, sorted by how many asked. A vote is recorded by your team, not by a visitor filling a form: the arrow on a row is one more person who asked on a call, and the customers you know by name are listed on the idea itself, picked from CRM contacts and companies — so a request from three small accounts is never confused with a request from your biggest one. Every idea carries an area, a status (open, planned, in progress, done, declined) and, when it becomes work, a real task in Tasks that it stays linked to. A CSV from Canny, Nolt, Frill, Featurebase or UserVoice imports in one click: an imported vote count is kept as the count nobody wrote a name for and the named voters add to it, and the board's own columns fold onto the five statuses — *not planned* and *closed* become **Declined**, anything the catalogue has no name for stays **Open**, where somebody is still waiting for an answer.
- **Roadmap** — a Now / Next / Later board for what you are building. Every item carries a theme, an owner from People and a timeframe, and can be linked to a real task in Tasks: when that task is done the item reads as shipped here, so the roadmap never disagrees with the board the work actually happens on. **Publish** writes the public roadmap as one standalone HTML file — no scripts, no fonts, no requests, nothing to track your visitors with — that you upload wherever your site lives; only the items you tick as public go in it, and owners stay internal. A CSV from ProductPlan, Roadmunk, Canny, airfocus, Productboard or Dragonboat imports in one click, and its own buckets fold onto the three lanes: *in progress* becomes **Now**, *planned* becomes **Next**, anything the catalogue has no name for lands in **Later**, where it promises nobody anything.
- **Changelog** — the product updates you ship, written in Markdown with a version, a date and tags of your own (Added, Improved, Fixed, or whatever you call them). A draft stays inside the workspace until you change its status, so a half-written entry never reaches a customer. **Publish HTML** builds the page itself: one standalone file with every published update, its stylesheet inlined, no scripts and nothing loaded from the network — put it on GitHub Pages, drop it on your own site, or send it to a customer as an attachment, and it looks the same in all three. Entries from any updates tool import in one click, with a body-only export getting its first line as a heading.
- **CRM reports and dedupe** — a **Reports** tab in CRM: open pipeline and closed-won tiles, win rate as an SVG donut, pipeline by stage, closed-won by month as an SVG chart, and a per-owner table. **Duplicates** finds contacts sharing an email or a phone (however either was typed) and merges each group in one click into the fullest record. Every contact and every company gets a **Timeline**: notes, deals, tickets and invoices in one list, newest first.
- **Inventory** — items with SKU, quantity, location and reorder level, a one-click **Low stock** filter for everything at or below its reorder point, and a **Stock movements** log: every receipt, shipment and recount with its date, quantity, reason and person. A quantity typed into the item form is logged too, so the movements never disagree with the stock on hand. Suppliers are CRM companies, people come from People, and the Home page shows what is running low.
- **Assets** — an IT and equipment register: device, asset tag, serial number, category, the person from People holding it, location, purchase date, purchase cost and warranty end. A **Warranty ending** filter for everything already out of warranty or running out inside 30 days, and a warranty that ends today shows up in the Today strip. **Check in** takes a device back from whoever held it and puts it in stock. Suppliers are CRM companies. A CSV from any register imports in one click: dates in whatever order the export wrote them, and foreign status names (Deployed, Ready to Deploy, Under Repair, Archived) folded onto in use / in stock / in repair / retired.
- **Rooms** — meeting rooms and hot desks, and who has them. A resource carries its kind (room or desk), how many people fit, which floor it is on and what is in it, so a booking for ten never lands in a room for four. The **Day** view is one track per resource over the hours of one day: bookings are drawn as blocks, now is a red line, and clicking an empty hour books that room from that hour. **A conflict is refused, not recorded**: a booking that would take a resource somebody already holds is shown the booking in the way and never saved, and because the end of a span is exclusive, 10:00–11:00 and 11:00–12:00 are back to back rather than a clash. **By person** is every booking each of you has from today on, soonest first. A CSV from Robin, Skedda, Joan or OfficeRnD imports in one click: rooms are created from the file, times in either 24-hour or am/pm form are read, and rows the file double-books are skipped and counted rather than silently overwriting each other.
- **Budgets** — what each team planned to spend on each category this year, against what it actually spent. The grid is the app: twelve months across the top, a line per team and category down the side, and you type straight into the cells — **Budget**, **Actual** and **Variance** are three views of the same twelve numbers, and the totals, the team subtotals and the tiles repaint as you type without ever taking the cursor out of the cell. Anything spent over its budget reads red, on the month, on the line, on the team and on the year. A line can be told to take its actuals from **Expenses** in the same category instead, so the money you already log once is never typed twice. Owners come from People and teams from the People directory. A CSV imports in one click in either shape those tools export — months across the top (`Jan`, `Jan-26`, `2026-01`, `Январь`) or one row per month with a period column — with `Budget` and `Actual` columns, or a scenario column saying which is which; a re-import corrects the months it carries and leaves the rest alone.
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
