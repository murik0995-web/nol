# NOL

**Zero subscriptions. Zero employees. Zero lock-in.**

Subscriptions exist because software was built by expensive humans. Software is now built by agents. Rent has lost its reason to exist. NOL is the first company that lives in that reality: every business tool, open source, free, built and maintained by AI agents. Take the code and leave whenever you want.

Live: https://murik0995-web.github.io/nol/

## What's inside

| App | Replaces | Imports |
|---|---|---|
| `apps/crm.html` | Salesforce, HubSpot, Pipedrive… | contacts & deals CSV |
| `apps/desk.html` | Zendesk, Freshdesk, Intercom… | tickets CSV |
| `apps/people.html` | BambooHR, Gusto, Rippling… | employee directory CSV |
| `apps/wiki.html` | Notion, Confluence, Slite… | Markdown / HTML files |
| `apps/tasks.html` | Trello, Asana, Jira, monday… | Trello JSON, tasks CSV |
| `apps/invoices.html` | FreshBooks, QuickBooks, Xero, Wave… | invoices CSV |

- `unsubscribe.html` — paste a card statement or a list of tools, see the yearly rent, move each one.
- `alt/<slug>/` — one page per replaced subscription (generated from `data/saas.json`).
- `factory.html` — public build log, rendered from `journal/events.json`.

Everything runs in the browser. Data lives in `localStorage` under one key (`nol.db`) shared by all apps: a requester in Desk is a contact in CRM, an assignee in Tasks is a person in People. **Export all** dumps it as one JSON file. **Restore** loads it back.

## Team sync

Click **Team sync** in any app. Paste a GitHub token (the link preselects the `repo` scope), and NOL creates a private repository in your account, `you/nol-data`, one JSON file per collection. Every teammate you invite by username works on the same data from their own browser. Sync is a union merge by record id, newest `updated` wins, deletions travel as tombstones, and a stale write retries after a pull. Nothing passes through NOL. Your company's data is a git repository you own, with history and backups.

`node scripts/sync-e2e.mjs` runs the whole flow against real GitHub (needs a token in the git credential store).

## The factory, automated

`factory/run.sh` is one shift: reset to `origin/main`, hand `factory/PROMPT.md` to an agent, then push only if `node --test` and `node scripts/build.mjs` pass. The backlog is a NOL Tasks board: project **Factory** in the workspace repo `nol-data`, read and updated by `factory/backlog.mjs` (`next`, `start`, `done`, `block`). NOL runs on NOL. Open issues labelled `request` with 3+ 👍 jump the queue. `factory/queue.json` is only the initial seed. A launchd job (`com.nol.factory`) runs the shift daily at 09:00 for 100 days.

## Run it yourself

No build step for the apps. Static files, any web server:

```
python3 -m http.server 8787   # then open http://localhost:8787
```

Regenerate the wall of alternatives after editing `data/saas.json`:

```
node scripts/build.mjs
node --test
```

Self-hosting is a fork. That is the point.

## Prices in the catalogue

`data/saas.json` holds public list prices, approximate, in USD per user per month (or `flat: true` per month), checked September 2026. Wrong? [Open an issue](https://github.com/murik0995-web/nol/issues/new). Product names belong to their owners; NOL is not affiliated with any of them.

## The factory

Every day for 100 days the agents ship a free open twin of a tool people pay for, in public. [Request one](https://github.com/murik0995-web/nol/issues/new?template=request.yml), vote with 👍, watch the [log](https://murik0995-web.github.io/nol/factory.html).

MIT.
