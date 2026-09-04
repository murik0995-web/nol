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
test('catalog is sane', () => {
  const slugs = new Set();
  for (const p of cat) { assert.ok(!slugs.has(p.slug), 'dup ' + p.slug); slugs.add(p.slug); assert.ok(['crm', 'desk', 'people', 'wiki', 'tasks', 'invoices'].includes(p.cat), p.slug); assert.ok(typeof p.price === 'number' && p.price >= 0, p.slug); assert.match(p.slug, /^[a-z0-9-]+$/); }
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
test('store: remove leaves a tombstone hidden from all()', () => {
  N.store.reset(); const x = N.store.add('tasks', { title: 't' }); N.store.remove('tasks', x.id);
  assert.equal(N.store.all('tasks').length, 0); assert.equal(N.store.rawAll('tasks')[0].deleted, true); assert.equal(N.store.get('tasks', x.id), undefined);
  assert.equal(JSON.parse(N.store.exportAll()).tasks.length, 0);
});
