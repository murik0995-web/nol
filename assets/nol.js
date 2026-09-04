/* NOL shared runtime: storage, CSV, header mapping, SaaS detection, markdown, UI. No deps, no build. Works in browser and Node (tests). */
(function (root) {
  const COLLS = ['companies', 'contacts', 'deals', 'tickets', 'people', 'timeoff', 'pages', 'tasks'];
  const KEY = 'nol.db';
  const hasLS = typeof localStorage !== 'undefined';
  let mem = null; // Node fallback

  function fill(j) { j = j && typeof j === 'object' ? j : {}; for (const c of COLLS) if (!Array.isArray(j[c])) j[c] = []; j.meta = j.meta || { created: now() }; return j; }
  function load() { try { const raw = hasLS ? localStorage.getItem(KEY) : mem; if (raw) return fill(JSON.parse(raw)); } catch (e) { } return fill({}); }
  function persist() { const s = JSON.stringify(db); if (hasLS) localStorage.setItem(KEY, s); else mem = s; } // ponytail: localStorage ~5MB ceiling; move to IndexedDB when a real company hits it
  const id = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const now = () => new Date().toISOString();
  let db = load();

  const store = {
    colls: COLLS,
    all: c => db[c],
    get: (c, i) => db[c].find(x => x.id === i),
    add(c, o) { const r = Object.assign({ id: id(), created: now() }, o); db[c].push(r); persist(); return r; },
    addMany(c, arr) { const rs = arr.map(o => Object.assign({ id: id(), created: now() }, o)); db[c].push(...rs); persist(); return rs; },
    update(c, i, patch) { const x = store.get(c, i); if (x) { Object.assign(x, patch, { updated: now() }); persist(); } return x; },
    remove(c, i) { db[c] = db[c].filter(x => x.id !== i); persist(); },
    counts() { return Object.fromEntries(COLLS.map(c => [c, db[c].length])); },
    exportAll() { return JSON.stringify(db, null, 2); },
    importAll(json) { const j = JSON.parse(json); if (!j || typeof j !== 'object') throw new Error('Not a NOL export'); db = fill(j); persist(); },
    reset() { db = fill({}); persist(); },
  };

  /* ---------- CSV (RFC 4180: quotes, escaped quotes, newlines inside quotes, CRLF) ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';' && !text.includes(',')) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  function csvToObjects(text) {
    const rows = parseCSV(text); if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map(h => h.trim());
    return { headers, rows: rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
  }
  function toCSV(objs, cols) {
    const esc = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(','), ...objs.map(o => cols.map(c => esc(o[c])).join(','))].join('\n');
  }

  /* ---------- header mapping: spec = { field: ['synonym', ...] } ---------- */
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  function mapHeaders(headers, spec) {
    const map = {}, used = new Set();
    const H = headers.map(h => ({ h, n: norm(h) }));
    for (const [field, syns] of Object.entries(spec)) {           // pass 1: exact
      const hit = H.find(x => !used.has(x.h) && syns.some(s => norm(s) === x.n));
      if (hit) { map[field] = hit.h; used.add(hit.h); }
    }
    for (const [field, syns] of Object.entries(spec)) {           // pass 2: contains
      if (map[field]) continue;
      const hit = H.find(x => !used.has(x.h) && syns.some(s => x.n.includes(norm(s))));
      if (hit) { map[field] = hit.h; used.add(hit.h); }
    }
    return map;
  }
  const pick = (row, map, f) => map[f] ? String(row[map[f]] ?? '').trim() : '';
  const fullName = (row, map) => pick(row, map, 'name') || [pick(row, map, 'first'), pick(row, map, 'last')].filter(Boolean).join(' ');

  /* ---------- SaaS detection in pasted text (statement lines or tool list) ---------- */
  function detectSaaS(text, catalog) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const found = new Map();
    for (const line of lines) {
      const L = line.toLowerCase();
      for (const p of catalog) {
        const names = [p.name, ...(p.aliases || [])].map(a => a.toLowerCase());
        if (!names.some(a => a.length >= 3 && new RegExp('(^|[^a-z0-9])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i').test(L))) continue;
        const m = L.replace(/[\d.,]+\s*(users?|seats?|people|licen[cs]es?)/g, '').match(/(?:[$€£]\s?)?(\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))\b/);
        const amount = m ? parseFloat(m[1].replace(/[ ,]/g, '')) : null;
        const prev = found.get(p.slug);
        if (!prev) found.set(p.slug, { product: p, amount, line });
        else if (amount && !prev.amount) prev.amount = amount;
      }
    }
    return [...found.values()];
  }
  const monthlyCost = (p, seats) => p.flat ? p.price : p.price * seats;

  /* ---------- tiny markdown (headings, bold, italic, code, links, lists, quotes, hr, paragraphs) ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    const out = []; const lines = String(src || '').replace(/\r/g, '').split('\n');
    let i = 0, list = null, para = [];
    const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push(`</${list}>`); list = null; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { flushP(); flushL(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>'); i++; continue; }
      let m;
      if ((m = l.match(/^(#{1,6})\s+(.*)/))) { flushP(); flushL(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
      else if (/^(-{3,}|\*{3,})\s*$/.test(l)) { flushP(); flushL(); out.push('<hr>'); }
      else if ((m = l.match(/^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.*)/))) { flushP(); if (list !== 'ul') { flushL(); list = 'ul'; out.push('<ul>'); } const box = m[1] ? `<input type="checkbox" disabled ${m[1].trim() ? 'checked' : ''}> ` : ''; out.push(`<li>${box}${inline(m[2])}</li>`); }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); list = 'ol'; out.push('<ol>'); } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^>\s?(.*)/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
      else if (l.trim() === '') { flushP(); flushL(); }
      else para.push(l);
      i++;
    }
    flushP(); flushL();
    return out.join('\n');
  }

  /* ---------- UI helpers (browser only) ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }
  function download(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
  function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2600); }
  const fmtMoney = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtDate = s => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  function pickFile(accept, multiple) { return new Promise(res => { const i = h('input', { type: 'file', accept, multiple: !!multiple, class: 'hidden' }); i.onchange = () => { res([...i.files]); i.remove(); }; document.body.append(i); i.click(); }); }

  const APPS = [['crm', 'CRM'], ['desk', 'Desk'], ['people', 'People'], ['wiki', 'Wiki'], ['tasks', 'Tasks']];
  function topbar(active, base = '../') {
    const bar = h('div', { class: 'top' }, h('div', { class: 'wrap' },
      h('a', { class: 'mark', href: base }, h('b', {}, '0'), 'NOL'),
      h('nav', { class: 'tabs' }, APPS.map(([k, n]) => h('a', { href: base + 'apps/' + k + '.html', class: k === active ? 'on' : '' }, n))),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn sm ghost', title: 'Download everything NOL stores in this browser as one JSON file', onclick: () => { download('nol-export.json', store.exportAll()); toast('Everything exported. It is yours.'); } }, 'Export all'),
      h('button', { class: 'btn sm ghost', title: 'Restore a NOL export', onclick: async () => { const [f] = await pickFile('.json'); if (!f) return; try { store.importAll(await readFile(f)); toast('Restored. Reloading…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That is not a NOL export.'); } } }, 'Restore'),
      h('a', { class: 'btn sm', href: 'https://github.com/murik0995-web/nol', target: '_blank', rel: 'noopener' }, 'Source')
    ));
    document.body.prepend(bar);
  }
  function empty(title, hint) { return h('div', { class: 'empty' }, h('b', {}, title), hint); }
  function confirmDialog(text) { return confirm(text); }

  const NOL = { store, parseCSV, csvToObjects, toCSV, mapHeaders, pick, fullName, norm, detectSaaS, monthlyCost, md, esc, h, download, readFile, pickFile, toast, fmtMoney, fmtDate, topbar, empty, confirmDialog, id, now, APPS };
  root.NOL = NOL;
  if (typeof module !== 'undefined' && module.exports) module.exports = NOL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
