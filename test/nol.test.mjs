import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const N = createRequire(import.meta.url)('../assets/nol.js');
const cat = createRequire(import.meta.url)('../data/saas.json');

test('contracts: placeholders, the notice deadline, and what needs a decision', () => {
  N.store.reset();
  assert.equal(N.fillVars('Hi {{company}}, from {{us}}. {{oops}}', { company: 'Acme', us: '' }), 'Hi Acme, from {{us}}. {{oops}}'); // empty and unknown placeholders stay visible
  assert.deepEqual(N.varsIn('{{a}} {{ b }} {{a}}'), ['a', 'b']);

  assert.equal(N.noticeDate({ end: '2026-12-31', noticeDays: 60 }), '2026-11-01');
  assert.equal(N.noticeDate({ end: '2026-12-31', noticeDays: 0 }), '');         // no notice period, no deadline
  assert.equal(N.noticeDate({ end: '', noticeDays: 30 }), '');

  const c = { status: 'signed', end: '2026-12-31', noticeDays: 60, autoRenew: true };
  assert.equal(N.contractDue(c, '2026-10-31'), '');                             // the day before the deadline: nothing to decide
  assert.equal(N.contractDue(c, '2026-11-01'), 'notice');                       // say no today, or it renews itself
  assert.equal(N.contractDue(c, '2027-01-01'), 'renews');
  assert.equal(N.contractDue(Object.assign({}, c, { autoRenew: false }), '2027-01-01'), 'expires');
  assert.equal(N.contractDue(Object.assign({}, c, { status: 'draft' }), '2026-11-01'), ''); // a contract nobody signed owes nothing
  assert.equal(N.contractDue(Object.assign({}, c, { end: '' }), '2026-11-01'), '');

  N.store.add('contracts', { title: 'Lease', status: 'signed', end: '2026-12-31', noticeDays: 60, autoRenew: true });
  N.store.add('contracts', { title: 'Next year', status: 'signed', end: '2027-06-30', noticeDays: 30, autoRenew: false });
  const w = N.contractWatch(90, '2026-10-15');
  assert.equal(w.length, 1);                                                    // the second one is past the horizon
  assert.equal(w[0].kind, 'notice'); assert.equal(w[0].date, '2026-11-01');
  assert.equal(N.contractWatch(400, '2026-10-15').length, 2);
  N.store.reset();
});
test('standups: an answer under the blockers question is a blocker, "nothing" is not', () => {
  const qs = ['What did you do yesterday?', 'What will you do today?', 'Anything blocking you?'];
  assert.equal(N.standupBlocker(qs, ['shipped the parser', 'test it', 'waiting on server access']), 'waiting on server access');
  assert.equal(N.standupBlocker(qs, ['a', 'b', 'No']), '');                     // "no" answers the question without raising anything
  assert.equal(N.standupBlocker(qs, ['a', 'b', 'nothing yet']), '');
  assert.equal(N.standupBlocker(qs, ['a', 'b', '  ']), '');                     // an empty answer is not a blocker either
  assert.equal(N.standupBlocker(qs, ['a', 'b']), '');
  assert.equal(N.standupBlocker(['Что вам мешает?'], ['Жду доступы']), 'Жду доступы');
  assert.equal(N.standupBlocker(['Что вам мешает?'], ['Ничего']), '');
  assert.equal(N.standupBlocker(['What did you ship?'], ['nothing at all']), ''); // no blockers question, no blocker
  assert.equal(N.standupBlocker(null, null), '');
});
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
test('header mapping: Sortly, Zoho Inventory and Cin7 Core stock exports', () => {
  const spec = { sku: ['sku', 'variant code sku', 'item code', 'code'], name: ['name', 'item name', 'product name', 'description'], qty: ['quantity', 'stock on hand', 'in stock', 'stock'], reorder: ['reorder level', 'reorder point', 'minimum before reorder', 'reorder'], location: ['location', 'warehouse', 'folder', 'bin'], cost: ['unit cost', 'purchase rate', 'cost', 'price'] };
  const sortly = N.mapHeaders(['Item Name', 'Quantity', 'Folder', 'Price', 'Notes'], spec);
  assert.equal(sortly.name, 'Item Name'); assert.equal(sortly.qty, 'Quantity'); assert.equal(sortly.location, 'Folder'); assert.equal(sortly.cost, 'Price');
  const zoho = N.mapHeaders(['Item Name', 'SKU', 'Stock On Hand', 'Reorder Level', 'Purchase Rate'], spec);
  assert.equal(zoho.sku, 'SKU'); assert.equal(zoho.qty, 'Stock On Hand'); assert.equal(zoho.reorder, 'Reorder Level'); assert.equal(zoho.cost, 'Purchase Rate');
  const cin7 = N.mapHeaders(['SKU', 'Name', 'Quantity', 'Location', 'Bin', 'Minimum Before Reorder'], spec);
  assert.equal(cin7.reorder, 'Minimum Before Reorder'); assert.equal(cin7.location, 'Location'); // "Minimum Before Reorder" must not be read as the quantity on hand
  assert.equal(cin7.qty, 'Quantity');
});
test('retro columns: foreign templates folded onto the three that matter, unknown ones kept', () => {
  assert.equal(N.retroColumn('What went well'), 'Went well');
  assert.equal(N.retroColumn("What didn't go well"), 'To improve');   // "well" is in there too: the negative has to win
  assert.equal(N.retroColumn('Continue'), 'Went well');
  assert.equal(N.retroColumn('Stop'), 'To improve');
  assert.equal(N.retroColumn('Stop doing'), 'To improve');            // not an action column: "to do" inside "stop doing" must not steal it
  assert.equal(N.retroColumn('Start'), 'Action items');
  assert.equal(N.retroColumn('Glad'), 'Went well');
  assert.equal(N.retroColumn('Mad'), 'To improve');
  assert.equal(N.retroColumn('Lacked'), 'To improve');
  assert.equal(N.retroColumn('Next steps'), 'Action items');
  assert.equal(N.retroColumn('Что улучшить'), 'To improve');
  assert.equal(N.retroColumn('Что сделать'), 'Action items');
  assert.equal(N.retroColumn('Что прошло хорошо'), 'Went well');
  assert.equal(N.retroColumn(''), 'Went well');                       // no column in the export: everything lands in the first one
  assert.equal(N.retroColumn('Kudos'), 'Kudos');                      // a real column of theirs we have no name for keeps its own
  assert.ok(N.RETRO_COLUMNS.every(c => N.retroColumn(c) === c));      // our own columns survive a round trip through an export and an import
});
test('catalog is sane', () => {
  const slugs = new Set();
  for (const p of cat) {
    assert.ok(!slugs.has(p.slug), 'dup ' + p.slug); slugs.add(p.slug);
    assert.ok(['crm', 'desk', 'people', 'orgchart', 'hiring', 'wiki', 'tasks', 'goals', 'standups', 'quotes', 'invoices', 'contracts', 'expenses', 'timesheets', 'inventory', 'assets', 'meetings', 'subscriptions', 'leave', 'retros', 'status'].includes(p.cat), p.slug);
    assert.ok(p.price === null || (typeof p.price === 'number' && p.price >= 0), p.slug); // null = we have no list price for it; a missing key is a typo and still fails
    assert.ok(p.price !== null || p.tier, p.slug + ': a product without a price has to say why in its tier');
    assert.match(p.slug, /^[a-z0-9-]+$/);
  }
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
test('wiki: [[links]] resolve, unknown ones offer to create, backlinks find the sources, pasted images stay local', () => {
  N.store.reset();
  const hub = N.store.add('pages', { title: 'Team values', body: '' });
  const src = N.store.add('pages', { title: 'Onboarding', body: 'Read [[Team values]], [[Q&A|the FAQ]] and [[Nowhere]].' });
  const html = N.md(src.body);
  assert.match(html, new RegExp(`<a class="wl" href="wiki\\.html#${hub.id}">Team values</a>`));
  assert.match(html, /<a class="wl new" href="wiki\.html#new=Nowhere"/);
  assert.match(html, /<a class="wl new" href="wiki\.html#new=Q%26A"[^>]*>the FAQ<\/a>/); // target read back out of already-escaped text
  assert.deepEqual(N.backlinks(hub).map(p => p.id), [src.id]);
  assert.deepEqual(N.backlinks(src), []);
  assert.match(N.md('![shot](nol:abc-1)'), /<img data-nol="abc-1" alt="shot">/); // an attachment id, never a network fetch
  N.store.reset();
});
test('manual order: move a card before another, to the end, unknown target', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(N.reorder(list, 'd', 'b'), ['a', 'd', 'b', 'c']);
  assert.deepEqual(N.reorder(list, 'a', null), ['b', 'c', 'd', 'a']);
  assert.deepEqual(N.reorder(list, 'a', 'a'), ['b', 'c', 'd', 'a']);
  assert.deepEqual(N.reorder(list, 'b', 'gone'), ['a', 'c', 'd', 'b']);
  assert.deepEqual(N.reorder(list, 'b', 'a'), ['b', 'a', 'c', 'd']);
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

test('reminders: overdue and today tasks, overdue invoices, time off starting today; snoozing is the browser’s business, not this list’s', () => {
  N.store.reset();
  const at = Date.parse('2026-09-07T12:00:00Z'), d = n => new Date(at + n * 864e5).toISOString().slice(0, 10);
  const late = N.store.add('tasks', { title: 'Answer overdue tickets', status: 'To do', due: d(-1), assignee: 'Ivan Petrov' });
  const soon = N.store.add('tasks', { title: 'Close August invoices', status: 'To do', due: d(0) });
  N.store.add('tasks', { title: 'Hire a second engineer', status: 'To do', due: d(20) }); // not today's problem
  N.store.add('tasks', { title: 'Launch retro', status: 'Done', due: d(-8) });            // finished, stays quiet
  N.store.add('tasks', { title: 'Someday', status: 'To do', due: '' });                   // no due date, no reminder
  const bill = N.store.add('invoices', { number: 'INV-0004', status: 'sent', due: d(-6), billto: 'Acme Foods' });
  N.store.add('invoices', { number: 'INV-0006', status: 'draft', due: d(-6) });           // a draft was never sent to anyone
  N.store.add('invoices', { number: 'INV-0003', status: 'paid', due: d(-16) });
  const off = N.store.add('timeoff', { person: 'Maria Kozlova', type: 'Vacation', from: d(0), to: d(6), status: 'approved' });
  N.store.add('timeoff', { person: 'Olga Novikova', from: d(3), to: d(3), status: 'approved' }); // starts later
  N.store.add('timeoff', { person: 'Ivan Petrov', from: d(0), to: d(1), status: 'pending' });    // not approved yet
  const sub = N.store.add('subscriptions', { tool: 'Zendesk Suite', owner: 'Elena Sokolova', cost: 445, cycle: 'monthly', renewal: d(0), status: 'active' });
  N.store.add('subscriptions', { tool: 'Notion', renewal: d(12), status: 'active' });            // the app warns 30 days ahead, the strip only on the day
  N.store.add('subscriptions', { tool: 'Trello', renewal: d(0), status: 'cancelled' });          // cancelled: it renews for nobody
  const r = N.reminders(at);
  assert.deepEqual(r.map(x => x.key), [`task:${late.id}`, `invoice:${bill.id}`, `task:${soon.id}`, `sub:${sub.id}`, `timeoff:${off.id}`]); // overdue first, then what is due today
  assert.deepEqual(r.map(x => x.label), ['overdue', 'invoice', 'today', 'renewal', 'time off']);
  assert.equal(r[3].url, 'subscriptions.html#open=' + sub.id);
  assert.equal(r[0].url, 'tasks.html#open=' + late.id);
  assert.equal(r[1].title, 'INV-0004'); assert.equal(r[1].sub, 'Acme Foods');
  assert.equal(r[4].url, 'people.html#timeoff');
  assert.equal(N.reminders(at + 21 * 864e5).length, 4); // three weeks on: every unfinished task is overdue; the time off and the renewal are no longer news — each only announces its own day
  N.store.reset();
});

test('reminders: a warranty that ends today, and only on its own day; a retired device warns nobody', () => {
  N.store.reset();
  const at = Date.parse('2026-09-07T12:00:00Z'), d = n => new Date(at + n * 864e5).toISOString().slice(0, 10);
  const mac = N.store.add('assets', { name: 'MacBook Pro 14"', tag: 'NOL-1001', person: 'Anna Smirnova', status: 'in use', warranty: d(0) });
  N.store.add('assets', { name: 'ThinkPad T14', status: 'in use', warranty: d(9) });   // the app flags it 30 days ahead, the strip only on the day
  N.store.add('assets', { name: 'Acer TravelMate', status: 'retired', warranty: d(0) }); // written off: its warranty is nobody's problem
  N.store.add('assets', { name: 'MikroTik hEX', status: 'in stock', warranty: '' });     // no warranty date, no reminder
  const r = N.reminders(at);
  assert.deepEqual(r.map(x => x.key), [`asset:${mac.id}`]);
  assert.equal(r[0].label, 'warranty'); assert.equal(r[0].tone, 'amber');
  assert.equal(r[0].sub, 'Anna Smirnova');
  assert.equal(r[0].url, 'assets.html#open=' + mac.id);
  assert.equal(N.reminders(at + 9 * 864e5).length, 1); // the ThinkPad's day comes, the MacBook's has passed
  N.store.reset();
});

test('reminders: a meeting only on the day it happens, with its attendees', () => {
  N.store.reset();
  const at = Date.parse('2026-09-07T12:00:00Z'), d = n => new Date(at + n * 864e5).toISOString().slice(0, 10);
  const now = N.store.add('meetings', { title: 'Sales stand-up', date: d(0), time: '10:00', attendees: ['Anna Smirnova', 'Ivan Petrov'] });
  N.store.add('meetings', { title: 'North Wind demo', date: d(4), attendees: ['Anna Smirnova'] });  // still ahead
  N.store.add('meetings', { title: 'Quarterly planning', date: d(-14), attendees: [] });            // already held
  N.store.add('meetings', { title: 'Someday', date: '' });                                          // no date, no reminder
  const r = N.reminders(at);
  assert.deepEqual(r.map(x => x.key), [`meeting:${now.id}`]);
  assert.equal(r[0].label, 'meeting'); assert.equal(r[0].tone, 'blue');
  assert.equal(r[0].sub, 'Anna Smirnova, Ivan Petrov');
  assert.equal(r[0].url, 'meetings.html#open=' + now.id);
  assert.equal(N.reminders(at + 4 * 864e5).length, 1); // the demo's day comes, the stand-up's has passed
  N.store.reset();
});

test('duplicate contacts: one group per person, however the email or phone was typed', () => {
  N.store.reset();
  const a = N.store.add('contacts', { name: 'Anna Smirnova', email: 'Anna@Acme.io', phone: '+7 916 100-10-20' });
  const b = N.store.add('contacts', { name: 'A. Smirnova', email: 'anna@acme.io ', phone: '' });          // same email, different case
  const c = N.store.add('contacts', { name: 'Anna S.', email: 'anna.s@acme.io', phone: '8 (916) 100 10 20' }); // same phone, other notation → joins through b's group
  const d = N.store.add('contacts', { name: 'Ivan Petrov', email: 'ivan@acme.io', phone: '+7 916 200-30-40' });
  N.store.add('contacts', { name: 'No contacts given', email: '', phone: '123' });                        // too short to be a phone, nothing to match on
  const gs = N.dupGroups(N.store.all('contacts'));
  assert.equal(gs.length, 1);
  assert.deepEqual(gs[0].map(x => x.id).sort(), [a.id, b.id, c.id].sort());
  assert.ok(!gs[0].some(x => x.id === d.id));
  N.store.reset();
});

test('timeline: notes, deals, tickets and invoices of a contact and of a company, newest first', () => {
  N.store.reset();
  const co = N.store.add('companies', { name: 'Acme Foods' });
  const c = N.store.add('contacts', { name: 'Anna Smirnova', email: 'anna@acme.io', companyId: co.id });
  N.store.add('deals', { name: 'CRM rollout', amount: 1000, stage: 'Won', contact: 'anna smirnova', companyId: co.id });
  N.store.add('tickets', { subject: 'Invoice not arriving', status: 'open', email: 'ANNA@acme.io' });
  N.store.add('invoices', { number: 'INV-0001', clientId: co.id, status: 'paid', issued: '2026-01-05', items: [{ qty: 2, rate: 50 }], taxRate: 10 });
  N.store.add('notes', { coll: 'contacts', ref: c.id, text: 'Prefers email\nsecond line' });
  const ev = N.activity('contacts', c.id);
  assert.deepEqual(ev.map(e => e.kind).sort(), ['deal', 'invoice', 'note', 'ticket']);
  assert.equal(ev.find(e => e.kind === 'note').title, 'Prefers email');   // first line only
  assert.equal(ev.find(e => e.kind === 'invoice').amount, 110);           // 2 × 50 plus 10% tax
  assert.equal(ev[ev.length - 1].kind, 'invoice');                        // issued in January, oldest
  assert.deepEqual(N.activity('companies', co.id).map(e => e.kind).sort(), ['deal', 'invoice', 'note', 'ticket']); // the company carries the notes written on its people too
  N.store.reset();
});

test('hiring: stage names from any ATS fold onto the board, unknown ones keep their own column', () => {
  const seen = ['Application Review', 'new', 'Phone Screen', 'Technical Interview', 'Onsite', 'Offer Sent', 'Offer Accepted', 'Rejected after onsite', 'Disqualified', 'Withdrew'].map(N.hireStage);
  assert.deepEqual(seen, ['Applied', 'Applied', 'Screen', 'Interview', 'Interview', 'Offer', 'Hired', 'Rejected', 'Rejected', 'Rejected']);
  assert.equal(N.hireStage(''), 'Applied');            // no stage column in the export: everyone lands in the first column
  assert.equal(N.hireStage('Trial day'), 'Trial day'); // a real step of theirs we have no name for gets its own column
  assert.ok(N.HIRE_STAGES.every(s => N.hireStage(s) === s)); // our own stages survive a round trip through an export and an import
});

test('hiring: candidates and jobs are in the workspace search', () => {
  N.store.reset();
  const j = N.store.add('jobs', { title: 'Support engineer', dept: 'Support', status: 'Open' });
  N.store.add('candidates', { name: 'Anna Smirnova', email: 'anna@mail.example', stage: 'Screen', source: 'Referral', jobId: j.id });
  const byName = N.searchAll('smirnova');
  assert.equal(byName[0].label, 'Candidate');
  assert.ok(byName[0].url.startsWith('hiring.html#open='));
  assert.equal(byName[0].sub, 'Screen · Referral');
  assert.equal(N.searchAll('referral')[0].label, 'Candidate');           // found by source too
  assert.equal(N.searchAll('support engineer')[0].label, 'Job');
  N.store.reset();
});

test('invoices: payments drive the balance and the status, numbering restarts each year, a monthly invoice catches up on every period it missed', () => {
  N.store.reset();
  const inv = N.store.add('invoices', { number: '2026-0001', status: 'sent', issued: '2026-01-31', due: '2026-02-14', taxRate: 20, items: [{ qty: 2, rate: 100 }], payments: [{ date: '2026-02-10', amount: 100, method: 'Card' }] });
  assert.equal(N.invTotal(inv), 240);
  assert.equal(N.invPaid(inv), 100);
  assert.equal(N.invBalance(inv), 140);                          // part of it is in, the rest is still owed
  assert.equal(N.invBalance({ ...inv, status: 'paid' }), 0);     // ticked off by hand or imported without payment rows: nothing is owed
  assert.equal(N.invOverdue(inv, '2026-03-01'), true);
  assert.equal(N.invOverdue(inv, '2026-02-01'), false);
  assert.equal(N.invOpen({ status: 'draft' }), false);           // a draft was never sent to anyone

  assert.equal(N.addMonths('2026-01-31', 1), '2026-02-28');      // there is no 31st of February
  assert.equal(N.addMonths('2026-10-31', 3), '2027-01-31');
  assert.equal(N.addMonths('2026-04-30', 1, 31), '2026-05-31');  // the anchor day brings it back to the 31st
  assert.equal(N.nextInvoiceNumber('2026-05-04'), '2026-0002');  // the counter runs inside the year
  assert.equal(N.nextInvoiceNumber('2027-01-02'), '2027-0001');  // and starts again in January

  N.store.update('invoices', inv.id, { recur: 'monthly', recurNext: '2026-03-31' });
  const made = N.runRecurring('2026-06-01');                     // nobody opened NOL since March: three drafts, not one
  assert.deepEqual(made.map(x => x.number), ['2026-0002', '2026-0003', '2026-0004']);
  assert.deepEqual(made.map(x => x.issued), ['2026-03-31', '2026-04-30', '2026-05-31']);
  assert.deepEqual(made.map(x => [x.status, x.due, x.payments.length]), [['draft', '2026-04-14', 0], ['draft', '2026-05-14', 0], ['draft', '2026-06-14', 0]]);
  assert.ok(made.every(x => !x.recur && x.recurOf === inv.id));  // the copies are plain drafts, only the original keeps repeating
  assert.equal(N.store.get('invoices', inv.id).recurNext, '2026-06-30');
  assert.equal(N.runRecurring('2026-06-01').length, 0);          // the same day twice mints nothing
  N.store.reset();
});

test('goals: weighted rollup, quarter boundaries, pace and status', () => {
  N.store.reset();
  const o = N.store.add('goals', { title: 'Grow', quarter: '2026-Q3', parent: '' });
  assert.equal(N.goalProgress(o), 0);                            // no key results, nothing typed
  N.store.add('goals', { title: 'A', parent: o.id, weight: 3, progress: 100 });
  N.store.add('goals', { title: 'B', parent: o.id, weight: 1, progress: 20 });
  assert.equal(N.goalProgress(o), 80);                           // (100·3 + 20·1) / 4
  const k = N.store.add('goals', { title: 'C', parent: o.id, progress: 0 });
  assert.equal(N.goalProgress(o), 64);                           // (100·3 + 20·1 + 0·1) / 5 — a key result nobody weighted counts as one
  N.store.update('goals', k.id, { weight: 0 });
  assert.equal(N.goalProgress(o), 80);                           // weight 0: carried by the objective, not counted
  assert.equal(N.keyResults(o.id).length, 3);
  assert.equal(N.goalProgress(o, [{ weight: 0, progress: 40 }, { weight: 0, progress: 60 }]), 50); // every weight zeroed: a plain average, never a division by zero
  assert.equal(N.goalProgress({ progress: 250 }, []), 100);       // progress is clamped to 0…100

  assert.equal(N.quarterOf('2026-09-07'), '2026-Q3');
  assert.equal(N.quarterOf('2026-01-01'), '2026-Q1');
  assert.deepEqual(N.quarterRange('2026-Q3'), ['2026-07-01', '2026-09-30']);
  assert.deepEqual(N.quarterRange('2026-Q1'), ['2026-01-01', '2026-03-31']);
  assert.deepEqual(N.quarterRange('nonsense'), ['', '']);
  assert.equal(N.goalPace('2026-Q3', '2026-07-01'), 0);
  assert.equal(N.goalPace('2026-Q3', '2026-08-15'), 49);        // 45 days into a 91-day quarter
  assert.equal(N.goalPace('2026-Q3', '2026-12-31'), 100);        // a quarter that is over is 100% gone, never more
  assert.equal(N.goalPace('2026-Q3', '2026-01-01'), 0);          // and one that has not started is 0

  assert.equal(N.goalStatus(100, 20), 'done');
  assert.equal(N.goalStatus(45, 50), 'on track');                // within 10 points of the pace
  assert.equal(N.goalStatus(30, 50), 'at risk');
  assert.equal(N.goalStatus(10, 50), 'behind');
  N.store.reset();
});

test('quotes: a discount in percent or in money, tax on what is left, expiry and numbering per year', () => {
  N.store.reset();
  const items = [{ desc: 'Consulting', qty: 10, rate: 100 }, { desc: 'Licence', qty: 2, rate: 250 }]; // 1500
  assert.equal(N.quoteTotals({ items }).total, 1500);
  const pct = N.quoteTotals({ items, discount: '10%', taxRate: 20 });
  assert.deepEqual([pct.sub, pct.disc, pct.net, pct.tax, pct.total], [1500, 150, 1350, 270, 1620]); // tax follows the discount, not the list price
  const flat = N.quoteTotals({ items, discount: '250', taxRate: 20 });
  assert.deepEqual([flat.disc, flat.total], [250, 1500]);
  assert.equal(N.quoteTotals({ items, discount: '1,5%' }).disc, 22.5);       // a comma is how half a percent is written here
  assert.equal(N.quoteTotals({ items, discount: '9000' }).disc, 1500);       // never more than the subtotal: a quote does not owe the client money
  assert.equal(N.quoteTotals({ items, discount: 'free of charge' }).disc, 0);
  assert.equal(N.quoteTotals({ items, discount: '' }).disc, 0);
  assert.equal(N.quoteTotals({}).total, 0);                                  // an empty quote is zero, not NaN

  assert.equal(N.quoteExpired({ status: 'sent', valid: '2026-01-01' }, '2026-02-01'), true);
  assert.equal(N.quoteExpired({ status: 'sent', valid: '2026-03-01' }, '2026-02-01'), false);
  assert.equal(N.quoteExpired({ status: 'accepted', valid: '2026-01-01' }, '2026-02-01'), false); // an answered quote cannot lapse
  assert.equal(N.quoteExpired({ status: 'sent', valid: '' }, '2026-02-01'), false);               // no date, no expiry
  assert.equal(N.quoteOpen({ status: 'draft' }), true);
  assert.equal(N.quoteOpen({ status: 'declined' }), false);

  assert.equal(N.nextQuoteNumber('2026-05-05'), 'Q-2026-0001');
  N.store.add('quotes', { number: 'Q-2026-0007' });
  N.store.add('quotes', { number: 'Q-2025-0099' });
  assert.equal(N.nextQuoteNumber('2026-05-05'), 'Q-2026-0008');
  assert.equal(N.nextQuoteNumber('2027-01-01'), 'Q-2027-0001');              // the counter starts again every January
  assert.equal(N.nextInvoiceNumber('2026-05-05'), '2026-0001');              // quotes have their own series, invoices are untouched
  N.store.reset();
});

test('header mapping: Qwilr, Proposify and PandaDoc quote exports; “Tax” and “Tax %” are one header name', () => {
  const spec = { number: ['quote number', 'number', 'quote'], title: ['quote name', 'title', 'name'], client: ['client name', 'client', 'customer'], issued: ['quote date', 'date'], valid: ['expiry date', 'valid until', 'expiry'], status: ['status'], desc: ['description'], qty: ['quantity'], rate: ['unit price'], amount: ['total'], taxrate: ['tax rate', 'tax %'], tax: ['tax amount', 'tax'] };
  const pro = N.mapHeaders(['Quote Number', 'Quote Name', 'Client Name', 'Quote Date', 'Expiry Date', 'Status', 'Description', 'Quantity', 'Unit Price', 'Tax Rate'], spec);
  assert.equal(pro.number, 'Quote Number'); assert.equal(pro.title, 'Quote Name'); assert.equal(pro.valid, 'Expiry Date'); assert.equal(pro.taxrate, 'Tax Rate');
  const qw = N.mapHeaders(['Quote', 'Client', 'Date', 'Expiry', 'Status', 'Total', 'Tax'], spec);
  assert.equal(qw.number, 'Quote'); assert.equal(qw.client, 'Client'); assert.equal(qw.valid, 'Expiry'); assert.equal(qw.amount, 'Total');
  assert.equal(qw.taxrate, 'Tax'); // norm() strips the %, so "Tax" and "Tax %" arrive under the same name: the importer has to decide by the value, and a 2000 there is money, not a rate
});

test('org chart: the manager field builds the tree, and names nobody answers to are the report', () => {
  const P = (name, manager) => ({ id: name, name, manager });
  const t = N.orgTree([P('Anna', ''), P('Ivan', 'anna'), P('Maria', 'Anna '), P('Olga', 'Maria'), P('Pavel', 'Nobody Here'), P('Sergey', 'Sergey')]);
  assert.deepEqual(t.roots.map(r => r.p.name), ['Anna', 'Pavel', 'Sergey']);   // the top, the person whose manager is not in the directory, the person who is their own manager
  assert.deepEqual(t.roots[0].kids.map(k => k.p.name), ['Ivan', 'Maria']);     // case and stray spaces still point at the same person
  assert.deepEqual(t.roots[0].kids[1].kids.map(k => k.p.name), ['Olga']);
  assert.deepEqual(t.noManager.map(p => p.name), ['Anna']);
  assert.deepEqual(t.missing.map(m => [m.person.name, m.manager]), [['Pavel', 'Nobody Here']]);
  assert.deepEqual(t.loops.map(p => p.name), ['Sergey']);

  const loop = N.orgTree([P('A', 'C'), P('B', 'A'), P('C', 'B')]);             // a ring has no top: it is cut once, and all three still appear exactly once
  const seen = []; (function w(ns) { for (const n of ns) { seen.push(n.p.name); w(n.kids); } })(loop.roots);
  assert.deepEqual(seen.sort(), ['A', 'B', 'C']);
  assert.equal(loop.roots.length, 1);
  assert.equal(loop.loops.length, 1);

  assert.deepEqual(N.orgTree([]).roots, []);
  assert.deepEqual(N.orgTree(null).roots, []);
});

test('leave: iCal all-day events and who is out on a day', () => {
  N.store.reset();
  const ics = N.ical([
    { uid: 'a1', start: '2026-09-07', end: '2026-09-11', summary: 'Anna Smirnova \u2014 Vacation', desc: 'approved' },
    { uid: 'h1', start: '2026-01-01', summary: 'New Year; day, off' },
    { start: 'whenever', summary: 'no date, no event' },
  ], 'NOL Leave', Date.parse('2026-09-07T10:00:00Z'));
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-2), 'END:VCALENDAR');
  assert.equal(lines.filter(l => l === 'BEGIN:VEVENT').length, 2);              // a row without a real date is skipped, not written as Invalid Date
  assert.ok(lines.includes('DTSTAMP:20260907T100000Z'));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20260907'));
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260912'));                       // DTEND is exclusive: the last day off is the 11th
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260102'));                       // a one-day holiday still ends the next morning
  assert.ok(lines.includes('SUMMARY:New Year\\; day\\, off'));                   // ; and , escaped, or the calendar reads them as field separators
  assert.equal(N.ical([], 'x').includes('BEGIN:VEVENT'), false);

  N.store.add('timeoff', { person: 'Anna', from: '2026-09-07', to: '2026-09-11', status: 'approved' });
  N.store.add('timeoff', { person: 'Ivan', from: '2026-09-07', to: '2026-09-07', status: 'pending' });
  assert.deepEqual(N.outOn('2026-09-09').map(o => o.person), ['Anna']);         // a pending request is not out of office yet
  assert.deepEqual(N.outOn('2026-09-07').map(o => o.person), ['Anna']);
  assert.deepEqual(N.outOn('2026-09-12'), []);
});

test('status: the banner reads the worst component, and the static page escapes what people typed', () => {
  const comps = [{ id: 'a', name: 'API', status: 'operational' }, { id: 'b', name: 'Reports', status: 'maintenance' }];
  assert.equal(N.statusOverall(comps, []), 'maintenance');                        // planned work is not an outage, but it is not silence either
  assert.equal(N.statusOverall(comps, [{ status: 'resolved' }]), 'maintenance');
  assert.equal(N.statusOverall([{ status: 'operational' }], [{ status: 'monitoring' }]), 'incident'); // nothing marked down yet, but somebody is working
  assert.equal(N.statusOverall([{ status: 'degraded' }, { status: 'major' }, { status: 'operational' }], []), 'major');
  assert.equal(N.statusOverall([], []), 'operational');
  assert.equal(N.statusOverall([{ status: '' }, { status: 'nonsense' }], []), 'operational'); // an imported status nobody recognises never invents an outage

  assert.deepEqual(N.statusUpdates({ updates: [{ t: '2026-09-01T10:00' }, { t: '2026-09-01T12:00' }] }).map(u => u.t), ['2026-09-01T12:00', '2026-09-01T10:00']);
  assert.deepEqual(N.statusUpdates({}), []);

  const html = N.statusPage({
    title: 'Acme <Status>', at: '2026-09-08T12:00:00Z', components: comps,
    incidents: [{ id: 'i1', title: 'API slow & sad', status: 'investigating', impact: 'minor', started: '2026-09-08T09:20', componentIds: ['a'], updates: [{ t: '2026-09-08T09:20', status: 'investigating', text: 'Looking at <script>alert(1)</script>' }] },
      { id: 'i2', title: 'Mail delayed', status: 'resolved', impact: 'major', started: '2026-09-02T14:00', updates: [] }],
  });
  assert.match(html, /^<!doctype html>/);
  assert.equal(/<script/i.test(html), false);                                     // a static page with a script in it is a status page nobody can trust
  assert.equal(html.includes('Acme <Status>'), false);
  assert.match(html, /Acme &lt;Status&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Under maintenance/);                                        // the worst component drives the banner and the component list
  assert.match(html, /Maintenance in progress/);
  assert.match(html, /API slow &amp; sad/);
  assert.match(html, /Mail delayed/);
  assert.equal(html.includes('undefined'), false);
  assert.equal(html.includes('NaN'), false);
});
