// UI smoke test: serve the repo, open every page in headless Chrome (English and Russian), fail on console errors, exceptions, or garbage text.
// Run: node scripts/smoke.mjs   (needs Google Chrome). Used by factory/run.sh as a shipping gate.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const ROOT = process.cwd() + '/dist'; // built site: run node scripts/build.mjs first
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html'; const f = join(ROOT, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
if (!existsSync(ROOT)) { console.log('dist/ missing: run node scripts/build.mjs first'); process.exit(2); }
const pages = ['index.html', 'unsubscribe.html', 'factory.html', 'charter.html', 'alt/index.html', ...readdirSync(join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
const alt = readdirSync(join(ROOT, 'alt')).find(d => existsSync(join(ROOT, 'alt', d, 'index.html'))); if (alt) pages.push(`alt/${alt}/index.html`);
const BAD = [/nullnull/, /\[object \w+\]/, /\bundefined\b/, /\bNaN\b/, /\$\{/];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
for (const lang of ['en', 'ru']) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--lang=${lang}`, `--accept-lang=${lang}`, `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/nol-smoke-${port}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  let ver; for (let i = 0; i < 40; i++) { try { ver = await (await fetch(`http://localhost:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
  if (!ver) { console.log('could not start Chrome'); process.exit(2); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' ').slice(0, 160)); };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const tg = await send('Target.getTargets'); const targetId = tg.result.targetInfos.find(t => t.type === 'page').targetId;
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
  for (const p of pages) {
    errors.length = 0;
    await send('Page.navigate', { url: base + p }, sessionId); await sleep(1800);
    const r = await send('Runtime.evaluate', { expression: "(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('.feed,.doc,[data-notranslate]').forEach(e=>e.remove());document.body.append(c);const t=c.innerText;c.remove();return t})()", returnByValue: true }, sessionId); // journal feed and user content are data, not UI
    const text = r.result?.result?.value || '';
    const bad = BAD.filter(re => re.test(text)).map(re => 'text matches ' + re);
    const probs = [...errors.filter(e => !/favicon|net::ERR_|Failed to load resource/.test(e)), ...bad];
    if (!text.trim()) probs.push('empty page');
    if (probs.length) { failures++; console.log(`✖ [${lang}] ${p}\n   ` + probs.join('\n   ')); } else console.log(`✔ [${lang}] ${p}`);
  }
  ws.close(); chrome.kill();
}
srv.close();
console.log(failures ? `${failures} page(s) failed` : `smoke OK: ${pages.length} pages × 2 languages`);
process.exit(failures ? 1 : 0);
