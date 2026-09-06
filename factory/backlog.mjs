// The factory backlog lives in the NOL workspace itself: Tasks app, project "Factory", synced through the private repo <owner>/nol-data.
// Usage: node factory/backlog.mjs seed | list | next | start <id> | done <id> [note] | block <id> <why> | add <slug> "<title>" "<spec>" [--top]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
const REPO = process.env.NOL_WORKSPACE || 'murik0995-web/nol-data';
const token = process.env.GITHUB_TOKEN || execSync('printf "protocol=https\\nhost=github.com\\n" | git credential fill').toString().match(/password=(.*)/)[1].trim();
const now = () => new Date().toISOString();
async function api(method, path, body) {
  const r = await fetch('https://api.github.com' + path, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404 && method === 'GET') return null;
  if (!r.ok) { const e = new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function read() { const f = await api('GET', `/repos/${REPO}/contents/tasks.json?ref=main`); return f ? { tasks: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')), sha: f.sha } : { tasks: [], sha: null }; }
async function write(tasks, sha, msg) { const body = { message: msg, content: Buffer.from(JSON.stringify(tasks)).toString('base64'), branch: 'main' }; if (sha) body.sha = sha; return api('PUT', `/repos/${REPO}/contents/tasks.json`, body); }
async function update(id, patch, msg) {
  for (let i = 0; i < 3; i++) {
    const { tasks, sha } = await read(); const t = tasks.find(x => x.id === id); if (!t) throw new Error('no task ' + id);
    Object.assign(t, patch, { updated: now() });
    try { await write(tasks, sha, msg); return t; } catch (e) { if (e.status !== 409 && e.status !== 422 || i === 2) throw e; await new Promise(r => setTimeout(r, 800)); }
  }
}
const factory = tasks => tasks.filter(t => t.project === 'Factory' && !t.deleted);
const byRank = (a, b) => ((a.rank ?? 1e9) - (b.rank ?? 1e9));
const minRank = tasks => Math.min(0, ...factory(tasks).map(t => t.rank ?? 0));
const [cmd, id, ...rest] = process.argv.slice(2); const note = rest.join(' ');
if (cmd === 'seed') {
  if (!await api('GET', '/repos/' + REPO)) { await api('POST', '/user/repos', { name: REPO.split('/')[1], private: true, auto_init: true, description: 'NOL workspace data. Yours.' }); await new Promise(r => setTimeout(r, 2000)); console.log('created', REPO); }
  const { tasks, sha } = await read();
  if (factory(tasks).length && !rest.includes('--force') && id !== '--force') { console.log('Factory backlog already seeded:', factory(tasks).length, 'tasks. Use --force to append anyway.'); process.exit(0); }
  const q = JSON.parse(readFileSync(new URL('./queue.json', import.meta.url)));
  const shipped = [['crm', 'CRM'], ['desk', 'Desk'], ['people', 'People'], ['wiki', 'Wiki'], ['tasks', 'Tasks'], ['sync', 'Team sync via your own GitHub']].map(([slug, title], i) => ({ id: 'factory-' + slug, created: '2026-09-04T19:00:00Z', updated: '2026-09-04T21:00:00Z', title, slug, status: 'Done', project: 'Factory', assignee: 'Factory agent', priority: '', due: '', description: `Shipped on day 1.` }));
  const queued = q.map((x, i) => ({ id: 'factory-' + x.slug, created: now(), title: x.title, slug: x.slug, improve: x.improve || '', status: x.status === 'queued' ? 'Queued' : x.status, project: 'Factory', assignee: 'Factory agent', priority: i < 6 ? 'high' : '', due: '', description: `${x.spec}\n\nReplaces: ${x.replaces.join(', ')}.${x.improve ? `\nImproves: apps/${x.improve}.html` : ''}` }));
  await write(tasks.concat(shipped, queued), sha, 'factory: seed backlog'); console.log('seeded', shipped.length, 'done +', queued.length, 'queued →', REPO);
} else if (cmd === 'list') {
  const { tasks } = await read(); const f = factory(tasks); for (const t of [...f.filter(x => x.status !== 'Queued'), ...f.filter(x => x.status === 'Queued').sort(byRank)]) console.log(`${t.status.padEnd(9)} ${t.id.padEnd(22)} ${t.title}`);
} else if (cmd === 'next') {
  const { tasks } = await read(); const f = factory(tasks);
  const t = f.find(x => x.status === 'Building') || f.filter(x => x.status === 'Queued').sort(byRank)[0];
  console.log(t ? JSON.stringify({ id: t.id, title: t.title, slug: t.slug, improve: t.improve || '', description: t.description }, null, 2) : 'EMPTY');
} else if (cmd === 'start') { console.log(JSON.stringify(await update(id, { status: 'Building' }, `factory: building ${id}`))); }
else if (cmd === 'done') { const t = await update(id, { status: 'Done' }, `factory: done ${id}`); await update(id, { description: t.description + `\n\nShipped ${now().slice(0, 10)}${note ? ': ' + note : ''}` }, `factory: note ${id}`); console.log('done', id); }
else if (cmd === 'block') { const t = await update(id, { status: 'Blocked' }, `factory: blocked ${id}`); await update(id, { description: t.description + `\n\nBlocked ${now().slice(0, 10)}: ${note || 'no reason given'}` }, `factory: note ${id}`); console.log('blocked', id); }
else if (cmd === 'add') { const [title, spec] = rest.filter(r => r !== '--top'); const { tasks, sha } = await read(); const t = { id: 'factory-' + id, created: now(), title, slug: id, improve: '', status: 'Queued', project: 'Factory', assignee: 'Factory agent', priority: rest.includes('--top') ? 'high' : '', due: '', description: spec || '' }; if (rest.includes('--top')) t.rank = minRank(tasks) - 1; tasks.push(t); await write(tasks, sha, `factory: add ${t.id}`); console.log('added', t.id, rest.includes('--top') ? '(top of queue)' : ''); }
else if (cmd === 'top') { for (let i = 0; i < 3; i++) { const { tasks, sha } = await read(); const k = tasks.findIndex(x => x.id === id); if (k < 0) throw new Error('no task ' + id); tasks[k].rank = minRank(tasks) - 1; tasks[k].updated = now(); try { await write(tasks, sha, `factory: top ${id}`); console.log('top', id); break; } catch (e) { if (e.status !== 409 && e.status !== 422 || i === 2) throw e; } } }
else if (cmd === 'note') { const { tasks } = await read(); if (!tasks.find(x => x.id === id)) throw new Error('no task ' + id); for (let i = 0; i < 3; i++) { const f = await api('GET', `/repos/${REPO}/contents/notes.json?ref=main`); const notes = f ? JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')) : []; notes.push({ id: crypto.randomUUID(), created: now(), coll: 'tasks', ref: id, text: note.slice(0, 4000), author: 'Тестировщик' }); const body = { message: `qa: note ${id}`, content: Buffer.from(JSON.stringify(notes)).toString('base64'), branch: 'main' }; if (f) body.sha = f.sha; try { await api('PUT', `/repos/${REPO}/contents/notes.json`, body); console.log('note added'); break; } catch (e) { if (e.status !== 409 && e.status !== 422 || i === 2) throw e; } } }
else if (cmd === 'upload') { const dir = id; const { readdirSync, readFileSync } = await import('node:fs'); const urls = []; for (const f of readdirSync(dir)) { if (!/\.(png|json|md|txt)$/.test(f)) continue; const pathq = `qa/${dir.split('/').pop()}/${f}`; const cur = await api('GET', `/repos/${REPO}/contents/${pathq}?ref=main`); const body = { message: `qa: ${pathq}`, content: readFileSync(`${dir}/${f}`).toString('base64'), branch: 'main' }; if (cur) body.sha = cur.sha; await api('PUT', `/repos/${REPO}/contents/${pathq}`, body); urls.push(`https://github.com/${REPO}/blob/main/${pathq}`); } console.log(urls.join('\n')); }
else console.log('usage: node factory/backlog.mjs seed | list | next | start <id> | done <id> [note] | block <id> <why>');
