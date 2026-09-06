// The tester: after the conveyor merges and pushes, wait for the live deploy, then let a QA agent use the product
// as a real user (both languages, desktop and phone), save screenshots, write a report to the owner's card,
// and file every real defect as a bug card on the board — which the conveyor then picks up. Run by conveyor.json "after_merge".
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
const LIVE = process.env.NOL_LIVE || 'https://murik0995-web.github.io/nol/';
const { TASK_KEY = 'local', TASK_TITLE = 'manual run', TASK_BODY = '', MERGE_SHA = '', TASK_SOURCE_REF = '' } = process.env;
const CLAUDE = process.env.CLAUDE_BIN || '/Users/muratmacbook/.nvm/versions/node/v24.18.0/bin/claude';
const nolId = (TASK_SOURCE_REF.match(/^nol:[^:]+:(.+)$/) || [])[1] || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = s => console.log(`[tester ${TASK_KEY}] ${s}`);

// 1. wait for the deploy of exactly this merge (GitHub Actions ≈ 1 min); fall back to a local build of dist/
let base = LIVE, srv = null;
if (MERGE_SHA) {
  for (let i = 0; i < 60; i++) { try { const v = (await (await fetch(LIVE + 'version.txt?t=' + Date.now())).text()).trim(); if (v.startsWith(MERGE_SHA)) break; } catch { } if (i === 59) base = ''; await sleep(6000); }
}
if (!base) {
  say('live deploy did not arrive in 6 minutes, testing a local build instead');
  execSync('node scripts/build.mjs', { stdio: 'ignore' });
  const ROOT = process.cwd() + '/dist', MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };
  srv = createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = join(ROOT, p); if (!existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
  await new Promise(r => srv.listen(0, r)); base = `http://localhost:${srv.address().port}/`;
}
say(`testing ${base}`);

// 2. the QA agent
const dir = `factory/qa/${new Date().toISOString().slice(0, 10)}-${TASK_KEY}`; mkdirSync(dir, { recursive: true });
const prompt = `You are the NOL tester, an independent QA engineer. A change was just merged and deployed.

Change under test: ${TASK_KEY} — ${TASK_TITLE}
Task description:
${TASK_BODY || '(no description)'}

Product URL: ${base}   (apps live under ${base}apps/<slug>.html; add ?demo=1 on the first load to fill the workspace with realistic sample data)
Save everything into: ${dir}/

Tools you have:
- browser-use CLI, a headless Chrome that keeps state between calls:
    browser-use <<'PY'
    new_tab("${base}apps/home.html?demo=1"); wait_for_load()
    print(page_info()); print(js("document.body.innerText.slice(0, 400)"))
    js("window.__errs=[];addEventListener('error',e=>__errs.push(e.message))")
    path = capture_screenshot()   # returns a PNG path; copy it into ${dir}/ with a numbered name
    click_at_xy(x, y)
    PY
  Switch the UI to Russian: js("localStorage.setItem('nol.lang','ru'); location.reload()") then wait_for_load(). Back to English with 'en'.
- node factory/browser.mjs "<url>" <width> <height> "SHOT:${dir}/NN-name.png"  with env LANG_UI=ru|en and optional env PRE="<js to run before the shot>" — clean screenshots at a given locale and viewport (desktop 1440x900, phone 390x844). Each call is a fresh browser (no state), so use ?demo=1 in the URL.
- node factory/backlog.mjs add <slug> "<title>" "<description>" --top — files a card on the NOL board (project Factory).

Do this, in order:
1. From the task description derive 4 to 8 concrete user checks: what a user does and what they must see. Always include: the happy path, one edge case, the Russian UI, and phone width (390px).
2. Perform every check for real in the browser. One screenshot per check into ${dir}/NN-<slug>.png.
3. Look for: broken layout or overflow, English text left in the Russian UI, "undefined" / "NaN" / "[object" / "nullnull" in visible text, dead buttons, data lost after reload, JavaScript errors (read js("JSON.stringify(window.__errs)")), money shown without the workspace currency.
4. Write ${dir}/report.json exactly as: {"key":"${TASK_KEY}","title":${JSON.stringify(TASK_TITLE)},"url":"${base}","verdict":"pass"|"fail","checks":[{"name":"...","ok":true,"note":"...","shot":"NN-name.png"}],"summary_ru":"2–4 предложения по-русски для владельца: что проверено, что нашлось"}
5. For EVERY failed check file a bug card: node factory/backlog.mjs add bug-${TASK_KEY.toLowerCase()}-<n> "Bug: <short English title>" "Steps: ... Expected: ... Actual: ... Screenshot: ${dir}/NN-name.png" --top
Rules: never modify product code, never run git commit or push, never edit the board except through the add command above. Only real defects become bugs; a cosmetic nit goes into the note, not a card. Finish within 20 minutes. Your last line must be: VERDICT: pass or VERDICT: fail.`;
const r = spawnSync(CLAUDE, ['-p', prompt, '--permission-mode', 'bypassPermissions', '--output-format', 'text'], { encoding: 'utf8', maxBuffer: 64e6, timeout: 30 * 60 * 1000, env: { ...process.env, LANG_UI: 'ru' } });
writeFileSync(`${dir}/agent.md`, (r.stdout || '') + (r.stderr ? '\n\n[stderr]\n' + r.stderr : ''));
if (srv) srv.close();

// 3. report back to the owner's card
let report = null; try { report = JSON.parse(readFileSync(`${dir}/report.json`, 'utf8')); } catch { }
const verdict = report?.verdict || (/VERDICT:\s*pass/i.test(r.stdout || '') ? 'pass' : 'fail');
const checks = report?.checks || [];
const failed = checks.filter(c => !c.ok);
say(`verdict ${verdict}: ${checks.length - failed.length}/${checks.length} checks passed`);
if (nolId) {
  let links = '';
  try { links = execSync(`node factory/backlog.mjs upload ${dir}`, { encoding: 'utf8' }).trim(); } catch (e) { say('upload failed: ' + e.message.slice(0, 200)); }
  const lines = [`Тестировщик · ${verdict === 'pass' ? 'ПРОШЛО' : 'НАЙДЕНЫ ДЕФЕКТЫ'} · проверок ${checks.length - failed.length}/${checks.length}`, report?.summary_ru || '', ...checks.map(c => `${c.ok ? '✓' : '✗'} ${c.name}${c.note ? ' — ' + c.note : ''}`), links ? 'Скриншоты:\n' + links : ''].filter(Boolean).join('\n');
  const n = spawnSync('node', ['factory/backlog.mjs', 'note', nolId, lines], { encoding: 'utf8' }); if (n.status !== 0) say('note failed: ' + (n.stderr || '').slice(0, 200));
}
console.log(`QA ${TASK_KEY}: ${verdict} (${checks.length - failed.length}/${checks.length}); bugs filed: ${failed.length}; ${report?.summary_ru || ''}`.slice(0, 800));
process.exit(verdict === 'pass' ? 0 : 1);
