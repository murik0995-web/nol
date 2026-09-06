// usage: node factory/browser.mjs <url> <width> <height> <js-expression | SHOT:<png path>>  · env PRE="<js to run before>"  — fresh headless Chrome per call, real mobile emulation, locale via --lang env LANG_UI (ru|en)
import { spawn } from 'node:child_process';
const [url, w, hgt, expr] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 100);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', `--lang=${process.env.LANG_UI || 'en'}`, `--accept-lang=${process.env.LANG_UI || 'en'}`, `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/cdpeval-${port}`, `--window-size=${w},${hgt}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 30; i++) { try { ver = await (await fetch(`http://localhost:${port}/json/version`)).json(); break; } catch { await sleep(300); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const tg = await send('Target.getTargets'); const targetId = tg.result.targetInfos.find(t => t.type === 'page').targetId;
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +hgt, deviceScaleFactor: 1, mobile: true }, sessionId);
await send('Page.navigate', { url }, sessionId); await sleep(2500);
if (process.env.PRE) { await send('Runtime.evaluate', { expression: process.env.PRE, awaitPromise: true }, sessionId); await sleep(900); }
if (expr.startsWith('SHOT:')) { const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId); const { writeFileSync } = await import('node:fs'); writeFileSync(expr.slice(5), Buffer.from(shot.result.data, 'base64')); console.log('shot', expr.slice(5)); }
else { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId); console.log(JSON.stringify(r.result?.result?.value ?? r.result, null, 1)); }
ws.close(); chrome.kill();
