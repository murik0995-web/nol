import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const N = createRequire(import.meta.url)('../assets/nol.js');
const cat = createRequire(import.meta.url)('../data/saas.json');

test('csv: quotes, escaped quotes, newlines inside quotes, CRLF, BOM', () => {
  const rows = N.parseCSV('﻿name,note\r\n"Doe, Jane","said ""hi""\nthen left"\r\nBob,plain\r\n');
  assert.deepEqual(rows, [['name', 'note'], ['Doe, Jane', 'said "hi"\nthen left'], ['Bob', 'plain']]);
});
test('header mapping: HubSpot contacts and Pipedrive deals', () => {
  const spec = { name: ['name', 'person - name'], first: ['first name'], last: ['last name'], email: ['email', 'person - email'], company: ['company name', 'organization - name'] };
  const hub = N.mapHeaders(['First Name', 'Last Name', 'Email', 'Company Name', 'Create Date'], spec);
  assert.equal(hub.first, 'First Name'); assert.equal(hub.company, 'Company Name'); assert.equal(hub.name, undefined);
  const row = { 'First Name': 'Ada', 'Last Name': 'Lovelace', Email: 'ada@x.io' };
  assert.equal(N.fullName(row, hub), 'Ada Lovelace');
  const pd = N.mapHeaders(['Person - Name', 'Person - Email', 'Organization - Name'], spec);
  assert.equal(pd.name, 'Person - Name'); assert.equal(pd.company, 'Organization - Name');
});
test('header mapping: exact match beats substring, no header reused', () => {
  const m = N.mapHeaders(['Requester email', 'Requester', 'Email'], { requester: ['requester'], email: ['requester email', 'email'] });
  assert.equal(m.requester, 'Requester'); assert.equal(m.email, 'Requester email');
});
test('detect SaaS in a statement and pull the real amount', () => {
  const found = N.detectSaaS('03/02  SALESFORCE.COM  1,650.00\n03/03 Zendesk Inc 445.00\nNotion\nsome random line 12.00\n5 users of Trello', cat);
  const by = Object.fromEntries(found.map(f => [f.product.slug, f]));
  assert.equal(by.salesforce.amount, 1650); assert.equal(by.zendesk.amount, 445); assert.equal(by.notion.amount, null); assert.equal(by.trello.amount, null);
  assert.equal(found.length, 4);
  assert.equal(N.monthlyCost(by.notion.product, 25), 250);
});
test('detect SaaS: no false positive on short or partial words', () => {
  assert.equal(N.detectSaaS('coffee shop 4.50\nfrontier airlines', cat).length, 0);
  assert.equal(N.detectSaaS('Front', cat)[0].product.slug, 'front');
});
test('header mapping: Expensify export and a bank statement, Description is merchant or notes', () => {
  const spec = { date: ['date', 'transaction date', 'timestamp'], merchant: ['merchant', 'vendor', 'payee', 'description'], amount: ['amount', 'debit'], credit: ['credit'], category: ['category'], notes: ['comment', 'memo', 'description'] };
  const ex = N.mapHeaders(['Timestamp', 'Merchant', 'Amount', 'Category', 'Description', 'Comment'], spec);
  assert.equal(ex.date, 'Timestamp'); assert.equal(ex.merchant, 'Merchant'); assert.equal(ex.amount, 'Amount'); assert.equal(ex.notes, 'Description');
  const bank = N.mapHeaders(['Date', 'Description', 'Debit', 'Credit'], spec);
  assert.equal(bank.merchant, 'Description'); assert.equal(bank.amount, 'Debit'); assert.equal(bank.credit, 'Credit'); assert.equal(bank.notes, undefined);
});
test('catalog is sane', () => {
  const slugs = new Set();
  for (const p of cat) { assert.ok(!slugs.has(p.slug), 'dup ' + p.slug); slugs.add(p.slug); assert.ok(['crm', 'desk', 'people', 'wiki', 'tasks', 'invoices', 'expenses', 'timesheets'].includes(p.cat), p.slug); assert.ok(typeof p.price === 'number' && p.price >= 0, p.slug); assert.match(p.slug, /^[a-z0-9-]+$/); }
});
test('durations: h:mm(:ss), decimal hours, minute suffix, garbage', () => {
  assert.equal(N.parseDuration('1:30'), 90);
  assert.equal(N.parseDuration('07:30:00'), 450);
  assert.equal(N.parseDuration('1.5'), 90);
  assert.equal(N.parseDuration('1,5h'), 90);
  assert.equal(N.parseDuration('45m'), 45);
  assert.equal(N.parseDuration('2 hours'), 120);
  assert.equal(N.parseDuration('abc'), 0);
  assert.equal(N.parseDuration(''), 0);
  assert.equal(N.fmtDur(495), '8:15');
  assert.equal(N.fmtDur(5), '0:05');
  assert.equal(N.fmtDur(0), '0:00');
});
test('markdown: headings, lists, code, links, checkboxes', () => {
  const html = N.md('# T\n\npara **b** *i* `c` [l](https://x.io)\n\n- a\n- [x] b\n\n1. one\n\n```\nx < y\n```\n\n> q');
  assert.match(html, /<h1>T<\/h1>/); assert.match(html, /<strong>b<\/strong> <em>i<\/em> <code>c<\/code> <a href="https:\/\/x.io"/);
  assert.match(html, /<ul>\n<li>a<\/li>\n<li><input type="checkbox" disabled checked> b<\/li>\n<\/ul>/); assert.match(html, /<ol>\n<li>one<\/li>/); assert.match(html, /<pre><code>x &lt; y<\/code><\/pre>/); assert.match(html, /<blockquote>q<\/blockquote>/);
});
test('store round-trip in memory', () => {
  N.store.reset(); const c = N.store.add('contacts', { name: 'A' }); N.store.update('contacts', c.id, { name: 'B' });
  assert.equal(N.store.get('contacts', c.id).name, 'B'); const dump = N.store.exportAll(); N.store.reset(); assert.equal(N.store.all('contacts').length, 0); N.store.importAll(dump); assert.equal(N.store.all('contacts')[0].name, 'B');
  assert.throws(() => N.store.importAll('"nope"'));
});
test('merge: union by id, newest wins, tombstone propagates', () => {
  const local = [{ id: 'a', name: 'A', created: '2026-01-01T00:00:00Z' }, { id: 'b', name: 'B-local', created: '2026-01-01T00:00:00Z', updated: '2026-01-03T00:00:00Z' }, { id: 'c', name: 'C', created: '2026-01-01T00:00:00Z' }];
  const remote = [{ id: 'b', name: 'B-remote', created: '2026-01-01T00:00:00Z', updated: '2026-01-02T00:00:00Z' }, { id: 'c', name: 'C', created: '2026-01-01T00:00:00Z', updated: '2026-01-05T00:00:00Z', deleted: true }, { id: 'd', name: 'D', created: '2026-01-04T00:00:00Z' }];
  const m = Object.fromEntries(N.mergeColl(local, remote).map(x => [x.id, x]));
  assert.equal(Object.keys(m).length, 4); assert.equal(m.b.name, 'B-local'); assert.equal(m.c.deleted, true); assert.equal(m.d.name, 'D'); assert.equal(m.a.name, 'A');
});
test('workspace currency: default by locale, one setting formats every money field', () => {
  N.store.reset();
  assert.equal(N.currency(), 'USD');
  assert.equal(N.money(1234.5), '$1,234.50');
  assert.equal(N.money(1234.5, 0), '$1,235');
  N.setCurrency('EUR');
  assert.equal(N.currency(), 'EUR');
  assert.equal(N.money(1234.5), '€1,234.50');
  assert.equal(N.money(-99), '-€99.00');
  N.setCurrency('RUB');
  assert.equal(N.store.all('settings').length, 1); // one record, updated in place, ready to sync
  assert.match(N.money(5), /₽/);
  N.store.reset();
});
test('mentions: longest name wins, regex and HTML chars escaped, empty list is a no-op', () => {
  const html = N.mentions(N.md('Ping @Anna Smirnova and @Bob about it'), ['Anna', 'Anna Smirnova', 'Bob']);
  assert.match(html, /<span class="mention">@Anna Smirnova<\/span>/); // not the shorter '@Anna'
  assert.match(html, /<span class="mention">@Bob<\/span>/);
  assert.equal(N.mentions('hi @X (test)', ['X (test)']), 'hi <span class="mention">@X (test)</span>');
  assert.match(N.mentions(N.md('cc @A&B'), ['A&B']), /<span class="mention">@A&amp;B<\/span>/); // names meet md() already escaped
  assert.equal(N.mentions('no names here', []), 'no names here');
  assert.equal(N.mentions('email a@b.io stays', ['Zoe']), 'email a@b.io stays');
});
test('global search: title prefix outranks secondary-field hits, tombstones stay out, urls point home', () => {
  N.store.reset();
  const co = N.store.add('companies', { name: 'Acme Foods' });
  const c = N.store.add('contacts', { name: 'Anna Smirnova', email: 'anna@acme.io' });
  N.store.add('tasks', { title: 'Annual report', description: 'numbers for acme' });
  N.store.add('tickets', { subject: 'Printer broken', requester: 'Anna Smirnova' });
  const acme = N.searchAll('acme');
  assert.equal(acme.length, 3);
  assert.equal(acme[0].title, 'Acme Foods'); // title prefix beats email and description hits
  assert.equal(acme[0].url, 'company-page.html?id=' + co.id);
  assert.equal(N.searchAll('anna@acme.io')[0].coll, 'contacts'); // found by a field that is not the title
  const pr = N.searchAll('printer');
  assert.equal(pr[0].label, 'Ticket'); assert.equal(pr[0].url, 'desk.html#open=' + pr[0].id);
  N.store.remove('contacts', c.id);
  assert.ok(!N.searchAll('smirnova').some(r => r.coll === 'contacts')); // deleted record is gone, the ticket naming her stays
  assert.ok(N.searchAll('smirnova').some(r => r.coll === 'tickets'));
  assert.equal(N.searchAll('  ').length, 0);
  N.store.reset();
});
test('store: remove leaves a tombstone hidden from all()', () => {
  N.store.reset(); const x = N.store.add('tasks', { title: 't' }); N.store.remove('tasks', x.id);
  assert.equal(N.store.all('tasks').length, 0); assert.equal(N.store.rawAll('tasks')[0].deleted, true); assert.equal(N.store.get('tasks', x.id), undefined);
  assert.equal(JSON.parse(N.store.exportAll()).tasks.length, 0);
});
test('store: restore un-deletes and outruns the tombstone in a merge, purge is final', () => {
  N.store.reset(); const x = N.store.add('tasks', { title: 't' });
  N.store.remove('tasks', x.id);
  const back = N.store.restore('tasks', x.id);
  assert.equal(N.store.get('tasks', x.id).title, 't');
  assert.ok(!('deleted' in back) && back.updated);
  const tomb = { id: x.id, title: 't', created: back.created, updated: '2000-01-01T00:00:00Z', deleted: true };
  const m = N.mergeColl([back], [tomb]);
  assert.equal(m.length, 1); assert.ok(!m[0].deleted); // the restored copy wins on every synced device
  assert.equal(N.store.restore('tasks', x.id), undefined); // restoring a live record is a no-op
  assert.equal(N.store.restore('tasks', 'nope'), undefined);
  N.store.remove('tasks', x.id); N.store.purge('tasks', x.id);
  assert.equal(N.store.rawAll('tasks').length, 0);
  N.store.reset();
});
test('token detection: classic ghp_/40-hex vs fine-grained github_pat_', () => {
  assert.equal(N.classicToken('ghp_abc123DEF'), true);
  assert.equal(N.classicToken('a1b2c3d4e5'.repeat(4)), true);
  assert.equal(N.classicToken('github_pat_11ABCDEF_xyz'), false);
});

test('attachments: readable size and a safe repository path', () => {
  assert.equal(N.fmtSize(0), '0 B');
  assert.equal(N.fmtSize(2048), '2.0 KB');
  assert.equal(N.fmtSize(25 * 1024 * 1024), '25 MB');
  assert.equal(N.filePath('expenses', 'rec1', '0123456789ab', 'Счёт №1 / final.pdf'), 'files/expenses/rec1/01234567-Счёт_1_final.pdf');
  assert.equal(N.filePath('tasks', 'r', 'id', '../../etc/passwd'), 'files/tasks/r/id-etc_passwd'); // no traversal out of the record folder
  assert.equal(N.filePath('tasks', 'r', 'id', ''), 'files/tasks/r/id-file');
});

test('desk SLA: first-reply target until an agent answers, then resolution; a solved ticket is judged by its solve time', () => {
  const cfg = { urgent: [1, 4], normal: [8, 48] };
  const t0 = Date.parse('2026-09-01T00:00:00Z'), min = 6e4, hour = 36e5;
  const open = { priority: 'urgent', status: 'open', created: '2026-09-01T00:00:00Z', messages: [{ from: 'requester', t: '2026-09-01T00:00:00Z' }] };
  assert.equal(N.slaState(open, cfg, t0 + 30 * min).stage, 'first');
  assert.equal(N.slaState(open, cfg, t0 + 30 * min).breached, false);
  assert.equal(N.slaState(open, cfg, t0 + 90 * min).breached, true); // the 1h first-reply target passed
  const replied = { ...open, messages: [...open.messages, { from: 'agent', t: '2026-09-01T00:30:00Z' }] };
  assert.equal(N.slaState(replied, cfg, t0 + 90 * min).stage, 'solve');
  assert.equal(N.slaState(replied, cfg, t0 + 90 * min).breached, false); // answered in time, now the 4h resolution target counts
  assert.equal(N.slaState(replied, cfg, t0 + 5 * hour).breached, true);
  const solved = { ...replied, status: 'solved', solvedAt: '2026-09-01T03:00:00Z' };
  assert.equal(N.slaState(solved, cfg, t0 + 999 * hour).breached, false); // solved inside the target: the clock later cannot break it
  assert.equal(N.slaState({ ...solved, solvedAt: '2026-09-01T09:00:00Z' }, cfg, t0).breached, true);
  const odd = { priority: 'whatever', status: 'open', created: '2026-09-01T00:00:00Z' };
  assert.equal(N.slaState(odd, cfg, t0 + 9 * hour).stage, 'first'); // unknown priority falls back to normal, a ticket with no messages does not throw
  assert.equal(N.slaState(odd, cfg, t0 + 9 * hour).breached, true);
  assert.equal(N.slaState(odd, null, t0).breached, false); // no workspace targets set: the built-in ones apply
  assert.ok(Number.isFinite(N.slaState({ priority: 'normal', status: 'open' }, cfg, t0).due)); // no created date, still a number, never NaN in the UI
});
