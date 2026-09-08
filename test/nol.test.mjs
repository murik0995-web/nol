import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
const N = createRequire(import.meta.url)('../assets/nol.js');
const cat = createRequire(import.meta.url)('../data/saas.json');

test('purchase orders: totals, what has arrived, what is late, and the number series', () => {
  N.store.reset();
  const items = [{ desc: 'Beans', qty: 10, rate: 100, recv: 10 }, { desc: 'Cups', qty: 20, rate: 5, recv: 0 }];
  assert.equal(N.poTotals({ items }).sub, 1100);
  assert.equal(N.poTotals({ items, taxRate: 20 }).total, 1320);
  assert.equal(N.poTotals({}).total, 0);                                       // an empty order is zero, not NaN

  assert.equal(N.poReceived({ items }).state, 'partial');
  assert.deepEqual(N.poReceived({ items }).received, 10);
  assert.equal(N.poReceived({ items: [{ qty: 4, recv: 4 }] }).state, 'full');
  assert.equal(N.poReceived({ items: [{ qty: 4, recv: 9 }] }).received, 4);    // two extra boxes still close one line, they do not make it 225% received
  assert.equal(N.poReceived({ items: [{ qty: 4, recv: 0 }] }).state, 'none');
  assert.equal(N.poReceived({}).state, 'none');
  assert.equal(N.poReceived({ items: [{ qty: 3, recv: 1 }, { qty: 1, recv: 0 }] }).pct, 25);

  const sent = { status: 'sent', expected: '2026-05-01', items };
  assert.equal(N.poOpen(sent), true);
  assert.equal(N.poLate(sent, '2026-05-02'), true);
  assert.equal(N.poLate(sent, '2026-05-01'), false);                           // the day it is expected is not yet late
  assert.equal(N.poLate({ status: 'draft', expected: '2026-05-01', items }, '2026-06-01'), false); // a draft was never sent to anybody
  assert.equal(N.poOpen({ status: 'cancelled', expected: '2026-05-01', items }), false);
  assert.equal(N.poLate({ status: 'sent', expected: '2026-05-01', items: [{ qty: 2, recv: 2 }] }, '2026-06-01'), false); // everything arrived: nothing to wait for

  assert.equal(N.nextPONumber('2026-05-05'), 'PO-2026-0001');
  N.store.add('purchases', { number: 'PO-2026-0007' });
  N.store.add('purchases', { number: 'PO-2025-0099' });                        // last year has its own series
  N.store.add('purchases', { number: 'SO-2026-4242' });                        // somebody else's numbering is not this counter
  assert.equal(N.nextPONumber('2026-05-05'), 'PO-2026-0008');
  assert.equal(N.nextPONumber('2027-01-02'), 'PO-2027-0001');
});

test('rooms: a booking clashes only on the same resource, the same day and overlapping minutes', () => {
  const b = { id: 'b1', roomId: 'r1', date: '2026-09-08', from: '10:00', to: '11:00' };
  const others = [
    { id: 'b1', roomId: 'r1', date: '2026-09-08', from: '10:00', to: '11:00' },   // itself
    { id: 'b2', roomId: 'r1', date: '2026-09-08', from: '11:00', to: '12:00' },   // starts as the first one ends
    { id: 'b3', roomId: 'r1', date: '2026-09-08', from: '09:00', to: '10:00' },   // ends as the first one starts
    { id: 'b4', roomId: 'r2', date: '2026-09-08', from: '10:15', to: '10:45' },   // another room, same minutes
    { id: 'b5', roomId: 'r1', date: '2026-09-09', from: '10:15', to: '10:45' },   // same room, next day
    { id: 'b6', roomId: 'r1', date: '2026-09-08', from: '10:30', to: '11:30' },   // real overlap
    { id: 'b7', roomId: 'r1', date: '2026-09-08', from: '09:30', to: '12:00', deleted: true }, // in Trash: it holds nothing
  ];
  assert.deepEqual(N.bookingClash(b, others).map(x => x.id), ['b6']);
  assert.deepEqual(N.bookingClash({ roomId: 'r1', date: '2026-09-08', from: '09:00', to: '13:00' }, others).map(x => x.id), ['b1', 'b2', 'b3', 'b6']); // a new booking has no id and swallows the day
  assert.deepEqual(N.bookingClash({ roomId: 'r1', date: '2026-09-08', from: '11:00', to: '11:00' }, others), []); // zero minutes holds nothing
  assert.deepEqual(N.bookingClash({ roomId: 'r1', date: '2026-09-08', from: '12:00', to: '09:00' }, others), []); // backwards span, same
  assert.deepEqual(N.bookingClash({ roomId: 'r1', date: '2026-09-08', from: '', to: '' }, others), []);
  assert.deepEqual(N.bookingClash(null, others), []);
  assert.equal(N.bookingMins('09:05'), 545);
  assert.ok(!isFinite(N.bookingMins('')));
});

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
test('gantt: what a bar covers, and a dependency that cannot hold', () => {
  assert.deepEqual(N.taskSpan({ start: '2026-09-01', due: '2026-09-05' }), { s: '2026-09-01', e: '2026-09-05' });
  assert.deepEqual(N.taskSpan({ due: '2026-09-05' }), { s: '2026-09-05', e: '2026-09-05' });   // a due date and nothing else: one day wide
  assert.deepEqual(N.taskSpan({ start: '2026-09-05' }), { s: '2026-09-05', e: '2026-09-05' });
  assert.deepEqual(N.taskSpan({ start: '2026-09-09', due: '2026-09-02' }), { s: '2026-09-02', e: '2026-09-09' }); // typed backwards, drawn forwards
  assert.equal(N.taskSpan({}), null);                                             // no dates: nothing to draw
  const a = { id: 'a', start: '2026-09-01', due: '2026-09-10' };
  const by = i => ({ a })[i];
  const b = { id: 'b', start: '2026-09-11', due: '2026-09-15', deps: ['a'] };
  assert.deepEqual(N.depClash(b, by), []);
  assert.deepEqual(N.depClash(Object.assign({}, b, { start: '2026-09-10' }), by), []);         // handover on the same day is not a clash
  assert.deepEqual(N.depClash(Object.assign({}, b, { start: '2026-09-05' }), by), ['a']);      // starts while the thing blocking it is still running
  assert.deepEqual(N.depClash(Object.assign({}, b, { deps: ['gone'] }), by), []);              // a predecessor that was deleted blocks nothing
  assert.deepEqual(N.depClash({ id: 'c' }, by), []);
});
test('recurring tasks: the occurrence that follows a task you tick off', () => {
  const t = { id: 't1', title: 'Weekly report', repeat: 'weekly', start: '2026-09-01', due: '2026-09-03', assignee: 'Anna', subs: [{ text: 'Add it up', done: true }, { text: 'Send it', done: true }] };
  const n = N.nextTask(t, '2026-09-04');
  assert.equal(n.due, '2026-09-10');
  assert.equal(n.start, '2026-09-08');                                            // the two-day gap between start and due travels with the task
  assert.deepEqual(n.subs, [{ text: 'Add it up', done: false }, { text: 'Send it', done: false }]); // a fresh occurrence starts unticked
  assert.equal(n.repeatOf, 't1');
  assert.equal(n.assignee, 'Anna');
  assert.equal(n.status, undefined);                                              // the column is the caller's call, not this function's

  assert.equal(N.nextTask({ repeat: 'daily', due: '2026-09-03' }, '2026-09-03').due, '2026-09-04');
  assert.equal(N.nextTask({ repeat: 'monthly', due: '2026-01-31' }, '2026-02-01').due, '2026-02-28'); // one short month does not move the anchor day
  assert.equal(N.nextTask({ repeat: 'monthly', due: '2026-01-31' }, '2026-04-01').due, '2026-04-30'); // and it comes back to the 30th, not the 28th
  assert.equal(N.nextTask({ repeat: 'weekly', due: '2026-09-03' }, '2026-09-30').due, '2026-10-01');  // ticked off four weeks late: the next one lands ahead, not in the past
  assert.equal(N.nextTask({ repeat: 'daily', start: '2026-09-03' }, '2026-09-03').start, '2026-09-04');
  assert.equal(N.nextTask({ repeat: 'daily', start: '2026-09-03' }, '2026-09-03').due, '');           // a task with only a start keeps only a start
  assert.equal(N.nextTask({ repeat: 'weekly' }, '2026-09-03').due, '2026-09-10');                     // no dates at all: the rule still says when
  assert.equal(N.nextTask({ due: '2026-09-03' }, '2026-09-03'), null);            // nothing repeating, nothing to create
  assert.equal(N.nextTask({ repeat: 'yearly', due: '2026-09-03' }, '2026-09-03'), null); // a rule we do not have
  assert.equal(N.nextTask(null), null);
});
test('catalog is sane', () => {
  const slugs = new Set();
  for (const p of cat) {
    assert.ok(!slugs.has(p.slug), 'dup ' + p.slug); slugs.add(p.slug);
    assert.ok(['crm', 'desk', 'people', 'orgchart', 'hiring', 'wiki', 'tasks', 'goals', 'standups', 'quotes', 'invoices', 'contracts', 'expenses', 'timesheets', 'inventory', 'assets', 'meetings', 'subscriptions', 'leave', 'retros', 'status', 'cashflow', 'helpcenter', 'roadmap', 'changelog', 'dashboard', 'onboarding', 'captable', 'reviews', 'purchase', 'feedback', 'budgets', 'rooms', 'training'].includes(p.cat), p.slug);
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

test('cash flow: cycles land in their own months, a one-off pays once, open invoices and subscriptions join the projection, and the runway is the month the cash runs out', () => {
  N.store.reset();
  N.store.add('settings', { id: 'workspace', cashOpening: 1000 });
  N.store.add('cashflow', { name: 'Retainer', kind: 'in', amount: 300, cycle: 'monthly', start: '2026-01-10' });
  N.store.add('cashflow', { name: 'Tax', kind: 'out', amount: 600, cycle: 'quarterly', start: '2026-01-20' });
  N.store.add('cashflow', { name: 'Laptops', kind: 'out', amount: 900, cycle: 'once', start: '2026-03-05' });
  N.store.add('cashflow', { name: 'Ads', kind: 'out', amount: 100, cycle: 'monthly', start: '2026-01-01', end: '2026-02-28' });

  const ads = N.store.all('cashflow').find(x => x.name === 'Ads');
  assert.equal(N.cashDue(ads, '2026-02'), 100);
  assert.equal(N.cashDue(ads, '2026-03'), 0);                                    // an end date stops the repeat
  const tax = N.store.all('cashflow').find(x => x.name === 'Tax');
  assert.deepEqual(['2026-01', '2026-02', '2026-04'].map(m => N.cashDue(tax, m)), [600, 0, 600]);
  const laptops = N.store.all('cashflow').find(x => x.name === 'Laptops');
  assert.deepEqual(['2026-02', '2026-03', '2026-04'].map(m => N.cashDue(laptops, m)), [0, 900, 0]);

  const bare = N.cashPlan('2026-01-15', 4, { invoices: false, subs: false });
  assert.equal(bare.opening, 1000);
  assert.deepEqual(bare.months.map(m => m.net), [-400, 200, -600, -300]);         // Jan 300-600-100, Feb 300-100, Mar 300-900, Apr 300-600
  assert.deepEqual(bare.months.map(m => m.balance), [600, 800, 200, -100]);
  assert.equal(bare.runway, 3);                                                  // the fourth month is the one that ends in the red
  assert.equal(bare.low.month, '2026-04');

  N.store.add('invoices', { number: '2026-0001', status: 'sent', due: '2026-02-20', taxRate: 0, items: [{ qty: 1, rate: 500 }], payments: [] });
  N.store.add('invoices', { number: '2026-0002', status: 'draft', due: '2026-02-20', taxRate: 0, items: [{ qty: 1, rate: 9999 }], payments: [] });
  N.store.add('subscriptions', { tool: 'Notion', cost: 1200, cycle: 'yearly', status: 'active' });
  const full = N.cashPlan('2026-01-15', 4);
  assert.deepEqual(full.months.map(m => m.in), [300, 800, 300, 300]);            // the sent invoice lands on its due month; a draft was never sent to anyone
  assert.deepEqual(full.months.map(m => m.out), [800, 200, 1000, 700]);          // 1200 a year is 100 a month, whatever the billing cycle

  const broke = N.cashPlan('2026-03-01', 3, { invoices: false, subs: false });   // opening 1000, March -600, April +300, May +300
  assert.equal(broke.months[0].balance, 400);
  N.store.update('settings', 'workspace', { cashOpening: 100 });
  assert.equal(N.cashPlan('2026-03-01', 3, { invoices: false, subs: false }).runway, 0); // out of cash in the very first month
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

test('help center: a Wiki folder becomes a static site with working search, as files or as one page', () => {
  N.store.reset();
  const setup = N.store.add('pages', { title: 'Setting up', body: 'Read [[Ответы на вопросы]] first.\n\n- one\n- two' });
  const faq = N.store.add('pages', { title: 'Ответы на вопросы', body: '# Ответы\n\nПишите нам. ![shot](nol:abc-1)' });
  const arts = [
    { id: setup.id, title: setup.title, section: 'Getting started', body: setup.body },
    { id: faq.id, title: faq.title, section: '', body: faq.body },
    { title: 'Setting up', section: 'Getting started', body: 'A second page with the same name.' },
  ];
  const site = N.helpSite(arts, { title: 'Acme help', tagline: 'Answers' });
  const names = Object.keys(site.files);
  assert.deepEqual(names, ['style.css', 'search.js', 'index.html', 'setting-up.html', 'otvety-na-voprosy.html', 'setting-up-2.html']); // Cyrillic is transliterated, a repeated title never overwrites the first file
  assert.equal(site.images, 1); // an attachment lives in the workspace, so it is left out and counted
  assert.doesNotMatch(site.files['otvety-na-voprosy.html'], /data-nol/);
  assert.match(site.files['setting-up.html'], /<a href="otvety-na-voprosy\.html">Ответы на вопросы<\/a>/); // a [[wiki link]] becomes a link between two files
  assert.match(site.files['index.html'], /<a href="setting-up\.html">Setting up/);
  assert.match(site.files['index.html'], /Getting started/);
  assert.match(site.files['search.js'], /Ответы на вопросы/);
  assert.doesNotMatch(site.files['search.js'], /<\/script/i); // article text can contain a closing tag; it must not close the one it sits in
  assert.match(site.files['index.html'], /<script src="search\.js">/);

  const one = N.helpSite(arts, { title: 'Acme help', single: true });
  assert.deepEqual(Object.keys(one.files), ['help-center.html']);
  const html = one.files['help-center.html'];
  assert.match(html, /<article class="hca" id="setting-up" hidden>/);
  assert.match(html, /<a href="#otvety-na-voprosy">Ответы на вопросы<\/a>/); // same link, now an anchor inside the one file
  assert.ok(!/<link rel="stylesheet"/.test(html) && /<style>/.test(html) && /var HC=/.test(html)); // self-contained: style and search travel with it

  assert.equal(N.helpSlug('', 4), 'article-5'); // a page with no usable characters still gets a name
  N.store.reset();
});

test('header mapping: Zendesk Guide, Help Scout Docs, Intercom and HelpDocs article exports', () => {
  const SPEC = {
    title: ['title', 'article title', 'name', 'article name', 'subject', 'question', 'headline'],
    body: ['body', 'article body', 'content', 'text', 'html', 'answer', 'article content'],
    section: ['section', 'category', 'collection', 'folder', 'topic', 'group', 'section name', 'category name', 'collection name', 'parent'],
  };
  assert.deepEqual(N.mapHeaders(['Article ID', 'Article Title', 'Article Body', 'Section', 'Category', 'Locale'], SPEC), { title: 'Article Title', body: 'Article Body', section: 'Section' });
  assert.deepEqual(N.mapHeaders(['Article ID', 'Name', 'Text', 'Collection', 'Status'], SPEC), { title: 'Name', body: 'Text', section: 'Collection' });
  assert.deepEqual(N.mapHeaders(['id', 'title', 'description', 'body', 'collection'], SPEC), { title: 'title', body: 'body', section: 'collection' }); // the summary column never wins over the article itself
  assert.deepEqual(N.mapHeaders(['Title', 'Description', 'Body', 'Category', 'Slug'], SPEC), { title: 'Title', body: 'Body', section: 'Category' });
});

test('feedback: foreign boards fold onto five statuses, votes add the named to the counted', () => {
  assert.equal(N.feedbackStatus('Under Review'), 'open');
  assert.equal(N.feedbackStatus('Planned'), 'planned');
  assert.equal(N.feedbackStatus('Not planned'), 'declined');                    // "planned" is in there too: the refusal has to win
  assert.equal(N.feedbackStatus("Won't do"), 'declined');
  assert.equal(N.feedbackStatus('In Progress'), 'progress');
  assert.equal(N.feedbackStatus('Complete'), 'done');
  assert.equal(N.feedbackStatus('Closed'), 'declined');                         // Canny and UserVoice close what they will not build
  assert.equal(N.feedbackStatus('Марафон 2027'), 'open');                       // an unrecognised bucket is still somebody asking
  assert.equal(N.feedbackStatus(''), 'open');
  assert.ok(N.FEEDBACK_STATES.every(s => N.feedbackStatus(N.FEEDBACK_LABEL[s]) === s)); // our own labels survive an export and an import

  assert.equal(N.feedbackVotes({ votes: 12, voters: ['Anna', 'Ivan'] }), 14);   // the count nobody named plus the customers written down
  assert.equal(N.feedbackVotes({ votes: '7' }), 7);
  assert.equal(N.feedbackVotes({ voters: ['Anna'] }), 1);
  assert.equal(N.feedbackVotes({ votes: -3 }), 0);                              // a negative in an import is not a vote against
  assert.equal(N.feedbackVotes({}), 0);
  assert.equal(N.feedbackVotes(null), 0);

  const SPEC = { // the spec apps/feedback.html imports with
    title: ['title', 'post title', 'idea', 'suggestion', 'feature', 'feature request', 'request', 'summary', 'subject', 'headline'],
    desc: ['details', 'description', 'body', 'content', 'text', 'comment', 'notes', 'note'],
    status: ['status', 'state', 'column', 'stage'],
    votes: ['votes', 'vote count', 'score', 'upvotes', 'voters', 'vote', 'points', 'supporters', 'likes'],
    area: ['board', 'category', 'categories', 'tags', 'tag', 'label', 'labels', 'topic', 'segment', 'product', 'component', 'type'],
    requester: ['author', 'created by', 'submitted by', 'submitter', 'reporter', 'requester', 'customer', 'user', 'opened by'],
    company: ['company', 'organization', 'organisation', 'account', 'workspace'],
    date: ['created', 'created at', 'created date', 'submitted at', 'posted at', 'date'],
  };
  const canny = N.mapHeaders(['Title', 'Details', 'Status', 'Score', 'Board', 'Author', 'Author Email', 'Created'], SPEC);
  assert.equal(canny.title, 'Title'); assert.equal(canny.votes, 'Score'); assert.equal(canny.area, 'Board');
  assert.equal(canny.requester, 'Author'); assert.equal(canny.date, 'Created'); // "Author Email" must not steal the author column
  const uv = N.mapHeaders(['Suggestion', 'Description', 'Votes', 'Category', 'Status', 'Created at', 'Company'], SPEC);
  assert.deepEqual(uv, { title: 'Suggestion', desc: 'Description', status: 'Status', votes: 'Votes', area: 'Category', company: 'Company', date: 'Created at' });
  assert.equal(N.mapHeaders(['Post Title', 'Content', 'Upvotes', 'Posted at'], SPEC).date, 'Posted at'); // "Posted at" is a date, never the post
});

test('roadmap: buckets fold onto three lanes, the public page escapes what it publishes', () => {
  N.store.reset();
  assert.equal(N.roadmapLane('In Progress'), 'now');
  assert.equal(N.roadmapLane('Planned'), 'next');
  assert.equal(N.roadmapLane('Backlog'), 'later');
  assert.equal(N.roadmapLane('Complete'), 'shipped');
  assert.equal(N.roadmapLane('Marketing 2027'), 'later');                       // an unrecognised bucket promises nothing
  assert.equal(N.roadmapLane(''), 'next');

  const t = N.store.add('tasks', { title: 'Stock import', status: 'Done' });
  assert.equal(N.roadmapShipped({ taskId: t.id }), true);                       // a task finished in Tasks ships the item it is linked to
  assert.equal(N.roadmapShipped({ taskId: N.store.add('tasks', { title: 'x', status: 'Doing' }).id }), false);
  assert.equal(N.roadmapShipped({ shipped: true }), true);
  assert.equal(N.roadmapShipped({}), false);

  const html = N.roadmapHTML([
    { title: 'Pay <online>', lane: 'now', area: 'Money & "more"', timeframe: 'Q4 2026', desc: 'A pay button.' },
    { title: 'Boards on a phone', lane: 'next' },
    { title: 'Leave calendar', lane: 'now', shipped: true },
    { title: '   ', lane: 'later' },
  ], { title: 'Acme <roadmap>', updated: '2026-09-08' });
  assert.match(html, /^<!doctype html>/);
  assert.ok(!/<script/i.test(html));                                            // a public page with no scripts: nothing to run, nothing to track with
  assert.ok(html.includes('Pay &lt;online&gt;') && html.includes('Money &amp; &quot;more&quot;'));
  assert.ok(!html.includes('Pay <online>') && !html.includes('<roadmap>'));
  assert.ok(!/undefined|NaN|\[object/.test(html));                              // an item with no theme, timeframe or description leaves no holes
  assert.ok(html.includes('Leave calendar') && html.includes('Shipped'));
  assert.equal((html.match(/<article>/g) || []).length, 2);                     // shipped goes to its own list, an empty title is not published
  assert.equal((html.match(/<section class="lane">/g) || []).length, 3);
  assert.ok(N.roadmapHTML([], {}).includes('Nothing here yet.'));
});

test('changelog: one standalone HTML file, drafts left out', () => {
  N.store.reset();
  const html = N.changelogHtml([
    { title: 'Faster search', version: 'v1.2.1', date: '2026-03-04', tags: ['Improved'], body: 'Cmd/Ctrl+K no longer stalls.\n\n- On 20,000 records' },
    { title: 'CSV import', version: 'v1.4.0', date: '2026-09-01', tags: ['Added', 'Fixed'], body: '**Columns** are matched for you.' },
    { title: 'Dark theme', date: '2026-12-01', status: 'draft', body: 'Not out yet.' },
    { title: 'Undated note <script>', date: 'whenever', tags: [], body: '' },
  ], { title: 'NOL Changelog', subtitle: 'What we shipped', lang: 'en', empty: 'Nothing published yet.' });

  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(/<script|<link|https?:\/\//.test(html), false);                   // standalone: nothing to fetch, nothing to execute, so it is safe to hand to anyone
  assert.equal(html.includes('Dark theme'), false);                              // a draft is not published
  assert.ok(html.indexOf('CSV import') < html.indexOf('Faster search'));         // newest first
  assert.ok(html.includes('<time datetime="2026-09-01">1 September 2026</time>'));
  assert.ok(html.includes('&lt;script&gt;'));                                    // a title is escaped, never injected
  assert.ok(html.includes('Undated note'));
  assert.ok(html.includes('>whenever<'));                                        // a date typed as free text prints as it was typed, not as Invalid Date
  assert.equal(html.match(/<article>/g).length, 3);
  assert.ok(html.includes('<strong>Columns</strong>'));                          // the body is the same Markdown the app previews
  assert.ok(html.includes('<span class="tag">Added</span><span class="tag">Fixed</span>'));
  assert.equal(html.includes('Nothing published yet.'), false);

  const none = N.changelogHtml([{ title: 'Dark theme', status: 'draft' }], { empty: 'Nothing published yet.' });
  assert.ok(none.includes('Nothing published yet.'));
  assert.equal(none.includes('<article>'), false);
  assert.ok(N.changelogHtml([], {}).includes('<title>Changelog</title>'));        // no title given: the file still says what it is
});

test('reviewRating: one five-step scale out of every wording a performance tool exports', () => {
  assert.equal(N.reviewRating('Exceeds expectations'), 4);
  assert.equal(N.reviewRating('Significantly exceeds expectations'), 5);       // the strongest wording first: it contains the word the step below would claim
  assert.equal(N.reviewRating('Meets expectations'), 3);
  assert.equal(N.reviewRating('Does not meet expectations'), 1);               // a negative is never read as the middle step it contains
  assert.equal(N.reviewRating('Needs improvement'), 2);
  assert.equal(N.reviewRating('\u041f\u0440\u0435\u0432\u044b\u0448\u0430\u0435\u0442 \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u044f'), 4);
  assert.equal(N.reviewRating('4'), 4);
  assert.equal(N.reviewRating('4 out of 5'), 4);
  assert.equal(N.reviewRating('4/5'), 4);
  assert.equal(N.reviewRating('9'), 5);                                        // a ten-point score lands on the same five steps
  assert.equal(N.reviewRating('7/10'), 4);
  assert.equal(N.reviewRating('85%'), 4);
  assert.equal(N.reviewRating(''), 0);                                         // no rating stays no rating: never an invented middle step
  assert.equal(N.reviewRating('0'), 0);
  assert.equal(N.reviewRating('Kudos'), 0);
  assert.equal(N.ratingLabel(3), 'Met expectations');
  assert.equal(N.ratingLabel(0), '');
});

test('budgets: a month read out of any export, the grid adds up, actuals follow Expenses', () => {
  assert.equal(N.budgetMonth('Jan'), 1);
  assert.equal(N.budgetMonth('January 2026'), 1);
  assert.equal(N.budgetMonth('Jan-26'), 1);
  assert.equal(N.budgetMonth('2026-03'), 3);
  assert.equal(N.budgetMonth('09/2026'), 9);
  assert.equal(N.budgetMonth('Сентябрь'), 9);
  assert.equal(N.budgetMonth('5'), 5);
  assert.equal(N.budgetMonth('Marketing'), 0);                                   // a category that starts like March is not March
  assert.equal(N.budgetMonth('Q1'), 0);                                          // a quarter is not a month of ours
  assert.equal(N.budgetMonth('13'), 0);
  assert.equal(N.budgetMonth(''), 0);

  const roll = N.budgetRoll([{ plan: [100, 100], actual: [90] }, { plan: [50], actual: [80, 10, 'n/a'] }]); // a word where a number belongs is zero, never NaN
  assert.deepEqual(roll.plan.slice(0, 3), [150, 100, 0]);
  assert.deepEqual(roll.actual.slice(0, 3), [170, 10, 0]);
  assert.equal(roll.planTotal, 250);
  assert.equal(roll.actualTotal, 180);
  assert.equal(roll.variance, 70);
  assert.equal(N.budgetRoll([]).used, 0);                                        // nothing planned is no percentage, not a division by zero
  assert.equal(N.budgetState(100, 120), 'over');
  assert.equal(N.budgetState(100, 100), 'on');
  assert.equal(N.budgetState(100, 80), 'under');

  N.store.reset();
  N.store.add('expenses', { date: '2026-02-11', category: 'Software', amount: 300 });
  N.store.add('expenses', { date: '2026-02-20', category: 'Software', amount: 200 });
  N.store.add('expenses', { date: '2026-02-20', category: 'Travel', amount: 900 });   // another category is another budget line's business
  N.store.add('expenses', { date: '2025-02-20', category: 'Software', amount: 700 }); // and another year is another budget
  const line = { year: '2026', category: 'Software', plan: Array(12).fill(400), actual: [1, 1], fromExpenses: true };
  assert.equal(N.budgetActual(line)[1], 500);
  assert.equal(N.budgetActual(line)[0], 0);
  assert.deepEqual(N.budgetActual({ ...line, fromExpenses: false }).slice(0, 2), [1, 1]); // a line nobody linked keeps what was typed or imported
  assert.equal(N.budgetRoll([{ plan: line.plan, actual: N.budgetActual(line) }]).variance, 4300);
});

test('pages: no null passed straight to replaceChildren', () => {                 // h() skips a null child, replaceChildren turns it into the visible text "null" — NOL-57
  const dir = new URL('../', import.meta.url);
  const pages = [...readdirSync(new URL('apps/', dir)).map(f => 'apps/' + f), 'index.html', 'unsubscribe.html', 'factory.html', 'assets/nol.js']
    .filter(f => /\.(html|js)$/.test(f));
  const bad = [];
  for (const f of pages) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\breplaceChildren\(/g)) {
      let i = m.index + m[0].length, depth = 1, top = '';
      while (i < src.length && depth > 0) {                                      // walk to the matching ), keeping only the text at argument level
        const c = src[i++];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (depth === 1) top += c;
      }
      if (/(^|[^.\w])(null|undefined|false)([^\w]|$)/.test(top)) bad.push(`${f}: ${top.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('dashboard: a sparkline of one reading, of a flat series, and of a real one', () => {
  assert.equal(N.sparkPath([]), '');                                             // nothing to draw, and nothing to hand <path d="">
  assert.equal(N.sparkPath([7]), 'M0 14L100 14');                                // one reading is a flat line: a lone point draws nothing at all
  assert.equal(N.sparkPath([5, 5, 5]), 'M0 14L50 14L100 14');                    // a flat series runs through the middle, not along the floor
  assert.equal(N.sparkPath([0, 10]), 'M0 28L100 0');                             // y is inverted: the biggest reading sits at the top of the box
  assert.equal(N.sparkPath([1, 2, 3], 60, 10), 'M0 10L30 5L60 0');
  assert.equal(/NaN|undefined/.test(N.sparkPath(['12', null, 4])), false);       // an imported reading is a string, a missing one is null: neither may reach the path
});

test('cap table: outstanding, fully diluted, and what a priced round does to everybody', () => {
  assert.equal(N.capClass(''), 'Common');                                        // a grant with no class typed is plain stock
  assert.equal(N.capClass('Series A Preferred'), 'Preferred');
  assert.equal(N.capClass('Class B Common Stock'), 'Common');
  assert.equal(N.capClass('Unallocated option pool'), 'Pool');                   // the pool is read before options: it is nobody's grant
  assert.equal(N.capClass('ISO options'), 'Options');
  assert.equal(N.capClass('Tracking units'), 'Tracking units');                  // a class of theirs keeps its own name

  const list = [
    { holder: 'Ann', class: 'Common', shares: 6000000 },
    { holder: 'Boris', class: 'Common', shares: 3000000 },
    { holder: 'Ann', class: 'Options', shares: 500000 },                         // the same person twice is one line in the ownership
    { holder: '', class: 'Pool', shares: 500000 },
    { holder: 'Nobody', class: 'Common', shares: 'n/a' },                        // a word where a number belongs is zero shares, never NaN
  ];
  const cap = N.capTable(list);
  assert.equal(cap.outstanding, 9000000);                                        // options and the pool are not issued stock
  assert.equal(cap.options, 500000);
  assert.equal(cap.pool, 500000);
  assert.equal(cap.fullyDiluted, 10000000);
  assert.deepEqual(cap.holders.map(g => g.holder), ['Ann', 'Boris']);            // the pool belongs to no one, so it is not a holder
  assert.equal(cap.holders[0].shares, 6500000);
  assert.equal(cap.holders[0].pct, 65);

  const flat = N.dilute(list, { raise: 5000000, pre: 10000000 });                // no pool top-up: the price is the pre-money over everything that exists today
  assert.equal(flat.price, 1);
  assert.equal(flat.investor, 5000000);
  assert.equal(flat.newPool, 0);
  assert.equal(flat.total, 15000000);
  assert.equal(Math.round(flat.investorPct * 100) / 100, 33.33);                 // the investor owns raise / post-money
  assert.equal(Math.round(flat.holders[0].after * 100) / 100, 43.33);

  const shuffle = N.dilute(list, { raise: 5000000, pre: 10000000, poolPct: 15 });
  assert.equal(shuffle.newPool, 2258065);
  assert.equal(Math.round(shuffle.poolPct * 100) / 100, 15);                     // the pool lands on the number that was asked for
  assert.equal(Math.round(shuffle.investorPct * 100) / 100, 33.33);              // and the new investor is not diluted by it
  assert.ok(shuffle.holders[0].after < flat.holders[0].after);                   // everybody already here pays for the pool

  const impossible = N.dilute(list, { raise: 5000000, pre: 10000000, poolPct: 90 }); // no pre-money can pay for that pool
  assert.equal(impossible.newPool, 0);
  assert.equal(impossible.price, 1);

  const nothing = N.dilute([], { raise: 1000, pre: 0 });                          // an empty table and no valuation: zeroes, not NaN
  assert.deepEqual([nothing.price, nothing.investor, nothing.total, nothing.poolPct], [0, 0, 0, 0]);
});

test('training: a quiz is marked, a course is only finished when every lesson is', () => {
  const quiz = [{ q: 'a?', opts: ['no', 'yes'], a: 1 }, { q: 'b?', opts: ['x', 'y', 'z'], a: 2 }];
  assert.deepEqual(N.quizScore(quiz, [1, 2]), { right: 2, of: 2, pct: 100 });
  assert.deepEqual(N.quizScore(quiz, [1, 0]), { right: 1, of: 2, pct: 50 });
  assert.deepEqual(N.quizScore(quiz, []), { right: 0, of: 2, pct: 0 });            // nothing ticked is nothing right, not a pass
  assert.deepEqual(N.quizScore(quiz, ['1', 2]), { right: 1, of: 2, pct: 50 });     // a radio value read as text is not an answer
  assert.equal(N.quizScore([], []).pct, 100);                                      // a lesson with no questions is passed by reading it
  assert.equal(N.quizScore(null, null).of, 0);

  const course = { pass: 70, lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }] };
  const fresh = N.courseProgress(course, { done: {} });
  assert.deepEqual([fresh.done, fresh.total, fresh.pct, fresh.complete], [0, 3, 0, false]);
  assert.equal(fresh.score, null);                                                 // no answers yet: no score, and 0% would be a lie
  assert.equal(fresh.next.id, 'l1');

  const half = N.courseProgress(course, { done: { l1: { right: 2, of: 2 }, l3: { right: 1, of: 2 } } });
  assert.deepEqual([half.done, half.pct, half.complete], [2, 67, false]);
  assert.equal(half.score, 75);                                                    // 3 of 4 questions right across the lessons taken
  assert.equal(half.next.id, 'l2');                                                // the next lesson is the first one still open, not the one after the last pass

  const all = N.courseProgress(course, { done: { l1: {}, l2: {}, l3: {} } });
  assert.equal(all.complete, true);
  assert.equal(all.next, null);
  assert.equal(all.score, null);                                                   // read, never quizzed: still no score
  assert.equal(N.courseProgress({ lessons: [] }, { done: {} }).complete, false);   // an empty course is not a finished one
  assert.equal(N.courseProgress(null, null).total, 0);

  const late = { due: '2026-01-01' };
  assert.equal(N.enrolLate(course, Object.assign({ done: {} }, late), '2026-02-01'), true);
  assert.equal(N.enrolLate(course, Object.assign({ done: { l1: {}, l2: {}, l3: {} } }, late), '2026-02-01'), false); // finished late is still finished
  assert.equal(N.enrolLate(course, { done: {} }, '2026-02-01'), false);            // no date to finish by, nothing to be late for
});
