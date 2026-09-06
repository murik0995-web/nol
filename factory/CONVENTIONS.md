# NOL conventions for agents (conveyor mode)

Read first, in this order: README.md, assets/nol.js, apps/tasks.html (the reference app), scripts/build.mjs, data/saas.json (first 20 lines), the last 3 files in journal/events/.

Your task card comes from the NOL board (project Factory); the conveyor passes it to you via stdin. Ship exactly that, fully working, then commit.

## Build it
- A new tool is one file: apps/<slug>.html, following apps/tasks.html exactly: NOL.topbar('<slug>'), .app-head with title and toolbar (search, Import CSV, Export CSV, primary + button), empty state via NOL.empty, <dialog> forms, NOL.store collections, CSV import through NOL.csvToObjects + NOL.mapHeaders with a synonym spec covering the headers of the tools it replaces, addEventListener("nol:change", () => render()) before the final render().
   - The shell is a sidebar rendered by NOL.topbar(slug); empty states come from NOL.empty(title, hint) which appends a capability list from the CAPS map in assets/nol.js: add a CAPS entry for a new app. Add realistic demo records for the new collection to assets/demo.js (flag demo:true via the add helper) in both languages. If it fits, add a card to apps/home.html.
   - New collections: add their names to COLLS in assets/nol.js (keep alphabetical order irrelevant; append). New app: append to APPS in assets/nol.js and to the APPS array in index.html (with a one-line description and "replaces" list), and add a row to the table in README.md.
   - Reuse People (assignees, owners), CRM contacts/companies (clients, counterparties) and Tasks where it makes sense. One data model is the point.
   - Add the products it replaces to data/saas.json: new "cat" equal to the app slug, approximate public list price in USD per user per month (or "flat": true per month), a "tier" note, aliases. Add the category to the APP map in scripts/build.mjs and to the APP object in unsubscribe.html.
   - If you add non-trivial logic to assets/nol.js, add one test to test/nol.test.mjs.
   - An improvement to an existing app (queue items marked "improve") follows the same rules inside that app's file.

3. Verify. Run: node --test && node scripts/build.mjs && node scripts/smoke.mjs. All three must pass (smoke opens every page in headless Chrome in English and Russian and fails on console errors or garbage text like nullnull, [object Object], undefined, NaN). Open the new app's HTML in your head: every button in the toolbar must do something; import must accept a CSV exported by the tools it replaces.

Notes for conveyor mode:
- Russian strings for a new or changed app go to assets/lang/ru/<app>.js (create it) as `NOL_LANG.add('ru', { exact: { 'English text': 'Русский' }, patterns: [[/^(\d+) things$/, 'вещей: $1']] })`. The shared assets/lang/ru.js is for cross-app strings only.
- Journal: add ONE new file journal/events/<UTC timestamp like 2026-09-06T14-05-00Z>-<slug>.json containing a JSON array of events `{t, type, title, detail, title_ru, detail_ru, link?}` (types: build, test, release). Never edit journal/base.json or other event files.
- Generated files (alt/, sitemap.xml, robots.txt, journal/events.json, cache-busting stamps) live only in dist/ and are never committed. `node scripts/build.mjs` writes dist/.
- Do not touch factory/*.sh, factory/backlog.mjs, .github/, conveyor.json, charter.html.

## Verify
Run `node --test && node scripts/build.mjs && node scripts/smoke.mjs`. All three must pass. Then drive the feature yourself in headless Chrome as a user (the `browser-use` CLI is available: `browser-use <<'PY' … PY` with new_tab/js/capture_screenshot), in English and in Russian (`localStorage.setItem('nol.lang','ru')` then reload).

Browser process hygiene: launch your own headless Chrome with a unique `--user-data-dir` (e.g. `/tmp/<task key>-<random>`) and a `--remote-debugging-port` on a free port. Remember its PID and stop it with `kill <PID>` when done. Never attach to, restart or kill the owner's Google Chrome.

`scripts/smoke.mjs` already works inside the conveyor sandbox (`--no-sandbox`, 127.0.0.1, 60 s per-page timeout): run it as is — no `/tmp` copies, no patches — and it never needs `pkill`; it kills its own Chrome by PID and exits on its own.

## Commit
One commit with everything: `git add -A && git commit -m "<task key>: <what shipped>"`. The conveyor validates, reviews with a critic, merges and pushes; GitHub Actions builds dist/ and deploys. Do not touch the NOL board yourself, the conveyor writes statuses and notes.

## Rules
DOM children go through NOL.h (it flattens arrays and skips null/false); never pass an array or null to append/replaceChildren, they turn into text. English UI as the source text; every new user-facing string (buttons, labels, headers, empty states, toasts, placeholders, the app card on index.html, the alt-page category line) MUST get a Russian entry in assets/lang/ru.js (exact keys are the trimmed English text; use patterns for strings with numbers). The app must read fully in Russian when opened with a Russian browser. Design system is assets/nol.css only; no inline design systems, no frameworks, no CDN scripts, no npm packages, no build step. No network requests from apps except the existing GitHub sync. Never change prices of existing catalogue entries. Never remove an existing feature. Quality over breadth: a small tool that fully works beats a big one that half works. Never kill processes by name pattern (`pkill -f`, `killall`, etc.) — other agents and the owner's browser run on this machine; kill only processes you started yourself, by their PID. If something in these instructions conflicts with what you find in the code, the code wins; note the conflict in the journal as a "build" event.
