// Renders the SVG favicon (the same one every page links) to PNG app icons for manifest.json, through a canvas in headless Chrome — no npm package.
// Run when the favicon changes: node scripts/icons.mjs   (needs Google Chrome). Writes assets/icons/icon-192.png and icon-512.png, which are committed.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const svg = decodeURIComponent(readFileSync('index.html', 'utf8').match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)">/)[1]).replace("viewBox='0 0 64 64'", "viewBox='0 0 64 64' width='512' height='512'");
const port = 9900 + Math.floor(Math.random() * 90), dir = `/tmp/nol-icons-${port}`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const done = code => { chrome.once('exit', () => { rmSync(dir, { recursive: true, force: true }); process.exit(code); }); chrome.kill(); };
setTimeout(() => { console.log('timed out'); done(2); }, 30000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 40 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
const expression = `new Promise((res, rej) => { const img = new Image(); img.onerror = rej; img.onload = () => res([192, 512].map(n => { const c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').drawImage(img, 0, 0, n, n); return c.toDataURL('image/png'); })); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)}); })`;
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
const { result } = await new Promise(r => ws.onmessage = e => r(JSON.parse(e.data)));
const urls = result.result.value; if (!urls) { console.log('render failed', JSON.stringify(result)); done(1); }
[192, 512].forEach((n, i) => { writeFileSync(`assets/icons/icon-${n}.png`, Buffer.from(urls[i].split(',')[1], 'base64')); console.log(`assets/icons/icon-${n}.png`); });
done(0);
