// Real round trip against GitHub: create a private repo, push, simulate another device, merge, conflict retry, tombstone, delete repo.
// Needs a github.com token in the git credential store. Run: node scripts/sync-e2e.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const N = createRequire(import.meta.url)('../assets/nol.js');
const { store, sync } = N;
const token = execSync('printf "protocol=https\\nhost=github.com\\n" | git credential fill').toString().match(/password=(.*)/)[1].trim();
const repo = 'murik0995-web/nol-data-e2e';
const sleep = ms => new Promise(r => setTimeout(r, ms));
sync.schedule = () => {}; // no background pushes during the scripted sequence
sync.cfg = { token, repo, shas: {} };
// wipe the fixed test repo so every run starts from empty collections (the token has no delete_repo scope)
if (await sync.api('GET', '/repos/' + repo)) {
  const t = await sync.api('GET', `/repos/${repo}/git/trees/main`).catch(() => null);
  for (const f of (t && t.tree) || []) if (f.path.endsWith('.json')) await sync.api('PUT', `/repos/${repo}/contents/${f.path}`, { message: 'e2e wipe', content: Buffer.from('[]').toString('base64'), sha: f.sha, branch: 'main' });
  console.log('wiped test repo');
}

store.reset();
const ada = store.add('contacts', { name: 'Ada' });
store.add('tasks', { title: 'Ship it', status: 'To do' });
await sync.connect(token, repo, true);
console.log('connected →', sync.cfg.repo, sync.cfg.branch);
// GitHub reads can lag a write by a few seconds; poll until the predicate holds.
const get = async (c, ok = () => true) => { let r; for (let i = 0; i < 20; i++) { r = JSON.parse(await sync.api('GET', `/repos/${repo}/contents/${c}.json?ref=${sync.cfg.branch}&t=${Date.now()}`, null, true)); if (ok(r)) return r; await sleep(1000); } return r; };
let r = await get('contacts', r => r.some(x => x.name === 'Ada')); assert.ok(r.find(x => x.id === ada.id && x.name === 'Ada'), 'Ada pushed'); console.log('✓ initial push');

// another device edits remotely
const cur = await sync.api('GET', `/repos/${repo}/contents/contacts.json?ref=${sync.cfg.branch}`);
await sync.api('PUT', `/repos/${repo}/contents/contacts.json`, { message: 'other device', content: Buffer.from(JSON.stringify(r.concat([{ id: 'bob', name: 'Bob', created: new Date().toISOString() }]))).toString('base64'), sha: cur.sha, branch: sync.cfg.branch });
const carol = store.add('contacts', { name: 'Carol' });
await sync.pull();
assert.deepEqual(store.all('contacts').map(x => x.name).sort(), ['Ada', 'Bob', 'Carol']); console.log('✓ merge on pull');
r = await get('contacts', r => r.length === 3); assert.equal(r.length, 3, 'local Carol pushed back'); console.log('✓ dirty pushed after pull');

// stale sha → conflict → pull + retry
sync.cfg.shas.contacts = '0'.repeat(40);
store.update('contacts', carol.id, { name: 'Carol X' });
await sync.push();
r = await get('contacts', r => r.some(x => x.name === 'Carol X')); assert.ok(r.find(x => x.name === 'Carol X'), 'conflict resolved'); console.log('✓ conflict retry');

// tombstone
store.remove('contacts', 'bob'); await sync.push();
r = await get('contacts', r => (r.find(x => x.id === 'bob') || {}).deleted === true); assert.equal(r.find(x => x.id === 'bob').deleted, true); assert.equal(store.all('contacts').length, 2); console.log('✓ tombstone synced');

// fresh device: empty local, pull everything
store.reset(); sync.cfg.shas = {}; await sync.pull(true);
assert.deepEqual(store.all('contacts').map(x => x.name).sort(), ['Ada', 'Carol X']); assert.equal(store.all('tasks').length, 1); console.log('✓ fresh device pull');

console.log('SYNC E2E OK'); process.exit(0);
