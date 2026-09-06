/* NOL shared runtime: storage, sync via your own GitHub repo, CSV, header mapping, SaaS detection, markdown, UI. No deps, no build. Works in browser and Node (tests). */
(function (root) {
  const COLLS = ['companies', 'contacts', 'deals', 'tickets', 'people', 'timeoff', 'pages', 'tasks', 'invoices', 'expenses', 'timelogs', 'settings', 'notes'];
  const KEY = 'nol.db', SYNC_KEY = 'nol.sync';
  const hasLS = typeof localStorage !== 'undefined';
  let mem = null; // Node fallback
  const dirty = new Set();

  const now = () => new Date().toISOString();
  function fill(j) { j = j && typeof j === 'object' ? j : {}; for (const c of COLLS) if (!Array.isArray(j[c])) j[c] = []; j.meta = j.meta || { created: now() }; return j; }
  function load() { try { const raw = hasLS ? localStorage.getItem(KEY) : mem; if (raw) return fill(JSON.parse(raw)); } catch (e) { } return fill({}); }
  function persist(schedule = true) { const s = JSON.stringify(db); if (hasLS) localStorage.setItem(KEY, s); else mem = s; if (schedule) sync.schedule(); } // ponytail: localStorage ~5MB ceiling; move to IndexedDB when a real company hits it
  const id = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  let db = load();
  const live = c => db[c].filter(x => !x.deleted);

  const store = {
    colls: COLLS,
    all: live,
    rawAll: c => db[c],
    get: (c, i) => db[c].find(x => x.id === i && !x.deleted),
    add(c, o) { const r = Object.assign({ id: id(), created: now() }, o); db[c].push(r); dirty.add(c); persist(); return r; },
    addMany(c, arr) { const rs = arr.map(o => Object.assign({ id: id(), created: now() }, o)); db[c].push(...rs); dirty.add(c); persist(); return rs; },
    update(c, i, patch) { const x = store.get(c, i); if (x) { Object.assign(x, patch, { updated: now() }); dirty.add(c); persist(); } return x; },
    remove(c, i) { const x = db[c].find(x => x.id === i); if (x) { x.deleted = true; x.updated = now(); dirty.add(c); persist(); } }, // tombstone, so a deletion wins on every synced device
    counts() { return Object.fromEntries(COLLS.map(c => [c, live(c).length])); },
    exportAll() { const out = { meta: db.meta }; for (const c of COLLS) out[c] = live(c); return JSON.stringify(out, null, 2); },
    importAll(json) { const j = JSON.parse(json); if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('Not a NOL export'); db = fill(j); COLLS.forEach(c => dirty.add(c)); persist(); },
    reset() { db = fill({}); persist(false); },
  };

  /* ---------- merge: union by id, newest updated/created wins, tombstones included ---------- */
  const stamp = x => x.updated || x.created || '';
  function mergeColl(local, remote) {
    const m = new Map(local.map(x => [x.id, x]));
    for (const r of remote || []) { if (!r || !r.id) continue; const l = m.get(r.id); if (!l || stamp(r) > stamp(l)) m.set(r.id, r); }
    return [...m.values()];
  }

  /* ---------- sync: the workspace is a private GitHub repo the company owns ---------- */
  const emit = name => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name)); };
  const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sync = {
    cfg: (() => { try { return JSON.parse((hasLS ? localStorage.getItem(SYNC_KEY) : null) || 'null'); } catch (e) { return null; } })(),
    status: 'off', last: null, err: null, timer: null, pushT: null, busy: false,
    on() { return !!(sync.cfg && sync.cfg.token && sync.cfg.repo); },
    saveCfg() { if (!hasLS) return; sync.cfg ? localStorage.setItem(SYNC_KEY, JSON.stringify(sync.cfg)) : localStorage.removeItem(SYNC_KEY); },
    async api(method, path, body, raw) {
      const r = await fetch('https://api.github.com' + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + sync.cfg.token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
      if (r.status === 404 && method === 'GET') return null;
      if (!r.ok) { const t = await r.text(); const e = new Error(`GitHub ${r.status}: ${(t.match(/"message":"([^"]+)"/) || [, t])[1].slice(0, 160)}`); e.status = r.status; throw e; }
      return r.status === 204 ? null : raw ? r.text() : r.json();
    },
    async connect(token, full, create = true) {
      sync.cfg = { token: token.trim(), repo: (full || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''), shas: {} };
      const me = await sync.api('GET', '/user'); sync.cfg.user = me.login;
      if (!sync.cfg.repo) sync.cfg.repo = me.login + '/nol-data';
      let repo = await sync.api('GET', '/repos/' + sync.cfg.repo);
      if (!repo) { if (!create) throw new Error('Repository not found: ' + sync.cfg.repo); repo = await sync.api('POST', '/user/repos', { name: sync.cfg.repo.split('/')[1], private: true, auto_init: true, description: 'NOL workspace data. Yours.' }); await sleep(1500); }
      sync.cfg.branch = repo.default_branch || 'main'; sync.saveCfg();
      await sync.pull(true); sync.start(); emit('nol:sync');
    },
    async pull(force) {
      let files = [];
      try { const t = await sync.api('GET', `/repos/${sync.cfg.repo}/git/trees/${sync.cfg.branch}`); files = (t && t.tree) || []; } catch (e) { if (e.status !== 409) throw e; }
      let changed = false;
      for (const c of COLLS) {
        const f = files.find(x => x.path === c + '.json'); if (!f) { if (db[c].length) dirty.add(c); continue; }
        if (!force && sync.cfg.shas[c] === f.sha) continue;
        let remote = []; try { remote = JSON.parse(await sync.api('GET', `/repos/${sync.cfg.repo}/git/blobs/${f.sha}`, null, true)) || []; } catch (e) { if (e.status) throw e; remote = []; } // by blob sha: immutable, so content and sha can never disagree (contents?ref= can lag a write and silently drop records)
        const merged = mergeColl(db[c], remote), jm = JSON.stringify(merged);
        if (jm !== JSON.stringify(db[c])) { db[c] = merged; changed = true; }
        if (jm !== JSON.stringify(remote)) dirty.add(c); else dirty.delete(c);
        sync.cfg.shas[c] = f.sha;
      }
      sync.saveCfg(); if (changed) { persist(false); emit('nol:change'); }
      if (dirty.size) await sync.push(false, false);
    },
    async push(all, retry = true) {
      const colls = all ? COLLS.filter(c => db[c].length || sync.cfg.shas[c]) : [...dirty];
      for (const c of colls) {
        const body = { message: `nol: ${c} (${live(c).length})`, content: b64(JSON.stringify(db[c])), branch: sync.cfg.branch }; if (sync.cfg.shas[c]) body.sha = sync.cfg.shas[c];
        try { const res = await sync.api('PUT', `/repos/${sync.cfg.repo}/contents/${c}.json`, body); sync.cfg.shas[c] = res.content.sha; dirty.delete(c); }
        catch (e) { if ((e.status === 409 || e.status === 422) && retry) { await sync.pull(true); return; } throw e; }
      }
      sync.saveCfg();
    },
    async run(fn) {
      if (sync.busy) { setTimeout(() => sync.run(fn), 1200); return; }
      sync.busy = true; sync.status = 'syncing'; emit('nol:sync');
      try { await fn(); sync.status = 'ok'; sync.last = Date.now(); sync.err = null; } catch (e) { sync.status = 'error'; sync.err = e.message; console.warn('[nol sync]', e); }
      finally { sync.busy = false; emit('nol:sync'); }
    },
    schedule() { if (!sync.on() || !dirty.size) return; clearTimeout(sync.pushT); sync.pushT = setTimeout(() => sync.run(() => sync.push()), 1500); },
    start() {
      if (!sync.on() || typeof window === 'undefined') return;
      clearInterval(sync.timer); sync.timer = setInterval(() => { if (document.visibilityState === 'visible') sync.run(() => sync.pull()); }, 30000); // ponytail: 30s polling of one tree request; webhooks/SSE when someone needs live cursors
      if (!sync._focus) { sync._focus = true; window.addEventListener('focus', () => sync.run(() => sync.pull())); }
      sync.run(() => sync.pull());
    },
    disconnect() { clearInterval(sync.timer); sync.cfg = null; sync.saveCfg(); sync.status = 'off'; emit('nol:sync'); },
    invite(username) { return sync.api('PUT', `/repos/${sync.cfg.repo}/collaborators/${username.trim().replace(/^@/, '')}`, { permission: 'push' }); },
    joinLink() { return location.origin + location.pathname + '#join=' + sync.cfg.repo; },
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
    for (const [field, syns] of Object.entries(spec)) { const hit = H.find(x => !used.has(x.h) && syns.some(s => norm(s) === x.n)); if (hit) { map[field] = hit.h; used.add(hit.h); } }
    for (const [field, syns] of Object.entries(spec)) { if (map[field]) continue; const hit = H.find(x => !used.has(x.h) && syns.some(s => x.n.includes(norm(s)))); if (hit) { map[field] = hit.h; used.add(hit.h); } }
    return map;
  }
  const pick = (row, map, f) => map[f] ? String(row[map[f]] ?? '').trim() : '';
  const fullName = (row, map) => pick(row, map, 'name') || [pick(row, map, 'first'), pick(row, map, 'last')].filter(Boolean).join(' ');

  /* ---------- durations: '1:30', '07:30:00', '1.5', '1,5h', '45m' → minutes; fmtDur(495) → '8:15' ---------- */
  function parseDuration(s) {
    s = String(s ?? '').trim().toLowerCase(); if (!s) return 0;
    if (s.includes(':')) { const p = s.split(':').map(Number); if (p.some(isNaN)) return 0; return Math.round(p[0] * 60 + (p[1] || 0) + (p[2] || 0) / 60); }
    const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(h|hours?|m|min|mins|minutes?|ч|м)?\.?$/); if (!m) return 0;
    const n = parseFloat(m[1].replace(',', '.'));
    return Math.round(/^m|^м/.test(m[2] || '') ? n : n * 60);
  }
  const fmtDur = min => { min = Math.round(+min || 0); return Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0'); };

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

  /* ---------- tiny markdown ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
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
  const fmtDate = s => s ? new Date(s).toLocaleDateString(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  function pickFile(accept, multiple) { return new Promise(res => { const i = h('input', { type: 'file', accept, multiple: !!multiple, class: 'hidden' }); i.onchange = () => { res([...i.files]); i.remove(); }; document.body.append(i); i.click(); }); }

  /* ---------- workspace currency: one record in the synced 'settings' collection; display only, amounts are never converted ---------- */
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'UAH', 'KZT', 'BYN', 'AMD', 'GEL', 'TRY', 'AED', 'CNY', 'JPY', 'INR', 'PLN', 'CHF', 'CAD', 'AUD', 'BRL'];
  const currency = () => { const s = store.get('settings', 'workspace'); return (s && s.currency) || (lang() === 'ru' ? 'RUB' : 'USD'); };
  function setCurrency(code) { store.get('settings', 'workspace') ? store.update('settings', 'workspace', { currency: code }) : store.add('settings', { id: 'workspace', currency: code }); emit('nol:change'); }
  const nf = {};
  function money(n, dec = 2) { const k = lang() + currency() + dec; nf[k] = nf[k] || new Intl.NumberFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { style: 'currency', currency: currency(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec }); return nf[k].format(+n || 0); }
  const syms = {};
  const curSymbol = c => syms[c] = syms[c] || new Intl.NumberFormat('en', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find(p => p.type === 'currency').value;
  function currencySelect() {
    return h('select', { class: 'input', style: 'min-width:0;width:auto', title: 'Workspace currency', onchange: e => { setCurrency(e.target.value); toast('Currency set for the whole workspace.'); } },
      CURRENCIES.map(c => h('option', { value: c, selected: c === currency() }, curSymbol(c) + ' ' + c)));
  }


  /* ---------- language: Russian for Russian browsers, English for the world, toggle in the top bar. Dictionary-driven: assets/lang/<lang>.js ---------- */
  const LANG_KEY = 'nol.lang';
  const lang = () => { try { return localStorage.getItem(LANG_KEY) || (((typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'); } catch (e) { return 'en'; } };
  function setLang(l) { localStorage.setItem(LANG_KEY, l); location.reload(); }
  const pageKey = () => typeof location === 'undefined' ? '' : /\/alt\//.test(location.pathname) ? 'alt' : (location.pathname.split('/').pop() || 'index.html');
  const NOTEXT = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);
  const seen = new WeakSet();
  function tr(text) {
    const d = root.NOL_LANG && root.NOL_LANG[lang()]; if (!d || text == null) return null;
    const k = String(text).trim(); if (!k || /^[\d\s$€£%.,:;·—–\-+→←()\/]*$/.test(k)) return null;
    const pg = d.pages && d.pages[pageKey()];
    let out = (pg && pg[k]) ?? d.exact[k];
    if (out == null) for (const [re, rep] of d.patterns) { if (re.test(k)) { out = k.replace(re, rep); break; } }
    return out == null ? null : String(text).replace(k, out);
  }
  const t = s => tr(s) ?? s;
  function translateNode(n) {
    if (n.nodeType === 3) { if (seen.has(n)) return; seen.add(n); const p = n.parentNode; if (!p || NOTEXT.has(p.nodeName) || (p.closest && p.closest('[data-notranslate]'))) return; const v = tr(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1) return;
    if (n.closest && n.closest('[data-notranslate]')) return;
    for (const a of ['placeholder', 'title', 'aria-label']) if (n.hasAttribute(a)) { const v = tr(n.getAttribute(a)); if (v != null) n.setAttribute(a, v); }
    if (NOTEXT.has(n.nodeName)) return;
    for (const c of [...n.childNodes]) translateNode(c);
  }
  function i18nStart() {
    if (typeof document === 'undefined' || lang() === 'en') return;
    const src = (document.currentScript && document.currentScript.src) || ''; const base = src.replace(/assets\/nol\.js.*$/, '');
    const s = document.createElement('script'); s.src = base + 'assets/lang/' + lang() + '.js' + (src.includes('?') ? '?' + src.split('?')[1] : '');
    s.onload = () => {
      document.documentElement.lang = lang(); translateNode(document.body); const v = tr(document.title); if (v) document.title = v;
      new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') { seen.delete(m.target); translateNode(m.target); } else m.addedNodes.forEach(translateNode); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    document.head.append(s);
  }
  const langButton = () => h('button', { class: 'btn sm ghost', title: 'Language / Язык', onclick: () => setLang(lang() === 'ru' ? 'en' : 'ru') }, lang() === 'ru' ? 'EN' : 'RU');

  const APPS = [['home', 'Home'], ['crm', 'CRM'], ['desk', 'Desk'], ['people', 'People'], ['wiki', 'Wiki'], ['tasks', 'Tasks'], ['invoices', 'Invoices'], ['expenses', 'Expenses'], ['timesheets', 'Time']];
  const ICONS = {
    home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
    crm: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    desk: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M4.9 19.1l4.2-4.2',
    people: 'M20 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM9 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 18a4 4 0 0 1 8 0M15 10h4M15 14h4',
    wiki: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM9 7h7M9 11h5',
    tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    invoices: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    expenses: 'M2 7h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 11h20M6 16h4M2 7l2-3h16l2 3',
    timesheets: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3.5 2',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  };
  const icon = k => { const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.setAttribute('viewBox', '0 0 24 24'); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', ICONS[k] || ICONS.home); el.append(path); return el; };
  function wsButton() {
    const dot = h('i'), lbl = h('span'); const b = h('div', { class: 'ws', onclick: syncDialog }, dot, lbl);
    const paint = () => { if (!sync.on()) { dot.style.background = 'var(--dim)'; lbl.textContent = t('Local workspace · click to sync'); b.title = t('Share this workspace with your team through a private GitHub repository you own'); return; } dot.style.background = { ok: 'var(--ok)', syncing: 'var(--amber)', error: 'var(--red)' }[sync.status] || 'var(--dim)'; lbl.textContent = sync.cfg.repo; b.title = sync.err || (sync.last ? t('Synced') + ' ' + new Date(sync.last).toLocaleTimeString() : t('Connected')); };
    window.addEventListener('nol:sync', paint); paint(); return b;
  }
  function syncDialog() {
    let dlg = document.getElementById('nol-sync'); if (!dlg) { dlg = h('dialog', { id: 'nol-sync' }); document.body.append(dlg); }
    const join = (location.hash.match(/join=([^&]+)/) || [])[1] || '';
    if (!sync.on()) {
      const tok = h('input', { class: 'input', type: 'password', placeholder: 'ghp_… paste the token here', autocomplete: 'off' });
      const repo = h('input', { class: 'input', placeholder: 'owner/nol-data · leave empty to create one for you', value: join ? decodeURIComponent(join) : '' });
      const btn = h('button', { class: 'btn acid' }, 'Connect');
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: async e => { e.preventDefault(); if (!tok.value.trim()) return; btn.disabled = true; btn.textContent = 'Connecting…'; try { await sync.connect(tok.value, repo.value, !join); toast('Connected. This workspace now syncs through ' + sync.cfg.repo); dlg.close(); emit('nol:change'); } catch (err) { sync.cfg = null; sync.saveCfg(); alert(err.message); btn.disabled = false; btn.textContent = 'Connect'; } } },
        h('h3', {}, join ? 'Join your team workspace' : 'Team sync, through your own GitHub'),
        h('p', { class: 'mute', style: 'margin-bottom:14px' }, 'Your workspace becomes a private repository you own. Everyone you invite works on the same contacts, tickets, people, pages and tasks. History, backups and access control come from GitHub. Nothing passes through NOL. Free.'),
        h('div', { class: 'field' }, h('label', { class: 'f' }, '1 · GitHub token'), h('p', { class: 'mute', style: 'font-size:13px;margin-bottom:6px' }, h('a', { class: 'acid', href: 'https://github.com/settings/tokens/new?scopes=repo&description=NOL%20team%20sync', target: '_blank', rel: 'noopener' }, 'Create a token on GitHub →'), ' Scope “repo” is preselected. Click Generate, copy, paste. It is stored only in this browser.'), tok),
        h('div', { class: 'field' }, h('label', { class: 'f' }, '2 · Repository'), repo, join && h('p', { class: 'mute', style: 'font-size:13px;margin-top:6px' }, 'Your teammate invited you to this repository. Accept the GitHub invitation first if you have not.')),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => dlg.close() }, 'Cancel'), btn)));
    } else {
      const user = h('input', { class: 'input', placeholder: 'github username' });
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: e => e.preventDefault() },
        h('h3', {}, 'Team workspace'),
        h('p', { class: 'mute' }, 'Repository ', h('a', { class: 'acid', href: 'https://github.com/' + sync.cfg.repo, target: '_blank', rel: 'noopener' }, sync.cfg.repo), ' · signed in as ', h('b', {}, sync.cfg.user), h('br'), sync.err ? h('span', { style: 'color:var(--red)' }, sync.err) : sync.last ? 'Last sync ' + new Date(sync.last).toLocaleTimeString() : 'Connected'),
        h('div', { class: 'field', style: 'margin-top:16px' }, h('label', { class: 'f' }, 'Invite a teammate'), h('div', { class: 'row' }, user, h('button', { type: 'button', class: 'btn', onclick: async () => { if (!user.value.trim()) return; try { await sync.invite(user.value); toast(`Invited ${user.value}. Send them the join link.`); user.value = ''; } catch (err) { alert(err.message); } } }, 'Invite'))),
        h('p', { class: 'mute', style: 'font-size:13px;margin-top:8px' }, 'They accept the GitHub invitation, open the join link, paste their own token. Done.'),
        h('div', { class: 'actions', style: 'justify-content:space-between' },
          h('button', { type: 'button', class: 'btn ghost danger', onclick: () => { if (confirm(t('Disconnect? Local data stays in this browser.'))) { sync.disconnect(); dlg.close(); } } }, 'Disconnect'),
          h('span', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => { navigator.clipboard.writeText(sync.joinLink()); toast('Join link copied.'); } }, 'Copy join link'), h('button', { type: 'button', class: 'btn', onclick: () => sync.run(() => sync.pull(true)) }, 'Sync now'), h('button', { type: 'button', class: 'btn acid', onclick: () => dlg.close() }, 'Done')))));
    }
    dlg.showModal();
  }
  /* ---------- app shell: sidebar with workspace status, apps, language, data ---------- */
  let activeApp = '', activeBase = '../';
  function topbar(active, base = '../') {
    activeApp = active; activeBase = base;
    document.body.classList.add('shell');
    window.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && !e.altKey && e.code === 'KeyK') { e.preventDefault(); searchDialog(); } });
    const side = h('aside', { class: 'nav' },
      h('a', { class: 'mark', href: base + 'apps/home.html' }, h('b', {}, '0'), 'NOL'),
      wsButton(),
      h('a', { class: 'item', href: '#', onclick: e => { e.preventDefault(); searchDialog(); } }, icon('search'), h('span', {}, 'Search'), h('kbd', {}, /Mac|iP/.test(navigator.platform) ? '⌘K' : 'Ctrl K')),
      h('div', { class: 'sec' }, 'Workspace'),
      APPS.map(([k, n]) => h('a', { class: 'item' + (k === active ? ' on' : ''), href: base + 'apps/' + k + '.html' }, icon(k), h('span', {}, n))),
      h('div', { class: 'foot' },
        langButton(),
        h('button', { class: 'btn sm ghost', title: 'Download everything NOL stores in this browser as one JSON file', onclick: () => { download('nol-export.json', store.exportAll()); toast('Everything exported. It is yours.'); } }, 'Export all'),
        h('button', { class: 'btn sm ghost', title: 'Restore a NOL export', onclick: async () => { const [f] = await pickFile('.json'); if (!f) return; try { store.importAll(await readFile(f)); toast('Restored. Reloading…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That is not a NOL export.'); } } }, 'Restore'),
        h('a', { class: 'btn sm ghost', href: base, title: 'About NOL' }, 'About')));
    document.body.prepend(side);
    demoTag();
    window.addEventListener('nol:change', demoTag);
    if (/(^|[#&])connect=/.test(location.hash)) { // device link: #connect=<token>&repo=<owner/repo>&lang=ru → connects this browser, then reloads clean
      const q = Object.fromEntries(location.hash.slice(1).split('&').map(kv => kv.split('=').map(decodeURIComponent)));
      if (q.lang) localStorage.setItem(LANG_KEY, q.lang);
      history.replaceState(null, '', location.pathname);
      sync.connect(q.connect, q.repo || '', false).then(() => location.replace(location.pathname)).catch(e => alert(e.message));
      return;
    }
    if (sync.on()) sync.start(); else if (/join=/.test(location.hash)) setTimeout(syncDialog, 300);
    if (/[?&]demo=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); if (!Object.values(store.counts()).some(n => n)) demo.load(); }
  }

  /* ---------- demo workspace: realistic sample data, flagged demo:true, removable in one click ---------- */
  const demo = {
    on() { return COLLS.some(c => db[c].some(x => x.demo && !x.deleted)); },
    load() {
      if (sync.on() && !confirm(t('Demo data will sync to your team workspace too. Remove it any time with one click. Continue?'))) return Promise.resolve(false);
      return new Promise((res, rej) => { if (root.NOL_DEMO) { root.NOL_DEMO.load(); emit('nol:change'); toast(t('Demo workspace loaded.')); return res(true); } const src = [...document.scripts].map(x => x.src).find(x => /assets\/nol\.js/.test(x)) || ''; const sc = document.createElement('script'); sc.src = src.replace(/assets\/nol\.js.*$/, 'assets/demo.js' + (src.includes('?') ? '?' + src.split('?')[1] : '')); sc.onload = () => { root.NOL_DEMO.load(); emit('nol:change'); toast(t('Demo workspace loaded.')); res(true); }; sc.onerror = rej; document.head.append(sc); });
    },
    clear() { for (const c of COLLS) for (const x of db[c]) if (x.demo && !x.deleted) { x.deleted = true; x.updated = now(); dirty.add(c); } persist(); emit('nol:change'); toast(t('Demo data removed. Your own records stayed.')); },
  };
  function demoTag() { const old = document.querySelector('.demo-tag'); if (!demo.on()) { if (old) old.remove(); return; } if (old) return; document.body.append(h('div', { class: 'demo-tag' }, 'Demo data', h('button', { class: 'btn sm', onclick: demo.clear }, 'Remove demo'))); }

  /* ---------- components ---------- */
  const hue = s => { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 360; };
  function avatar(name, cls = '') { const n = String(name || '?').trim(); const ini = n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'; return h('span', { class: 'av ' + cls, style: `background:hsl(${hue(n)} 70% 70%)`, title: n }, ini); }
  const who = (name, cls) => h('span', { class: 'who' }, avatar(name, cls), h('span', {}, name));
  function bars(items, fmt = String) { const max = Math.max(1, ...items.map(i => +i.value || 0)); return h('div', { class: 'bars' }, items.map(i => h('div', { class: 'bar' }, h('span', { class: 'lbl', title: i.label }, i.label), h('div', { class: 'trk' }, h('div', { class: 'fil', style: `width:${Math.round((+i.value || 0) / max * 100)}%;background:${i.color || 'var(--acid)'}` })), h('span', { class: 'val' }, fmt(i.value || 0))))); }
  function cols(items, fmt = String) { const max = Math.max(1, ...items.map(i => +i.value || 0)); return h('div', { class: 'cols' }, items.map(i => h('div', { class: 'c', title: `${i.label}: ${fmt(i.value || 0)}` }, h('b', { class: i.dim ? 'dim' : '', style: `height:${Math.max(2, Math.round((+i.value || 0) / max * 100))}%` }), h('small', {}, i.label)))); }
  const tile = (k, l, opts = {}) => { const L = String(k).length, fs = L > 11 ? 17 : L > 8 ? 21 : L > 6 ? 25 : 28; return h('div', { class: 'tile ' + (opts.cls || '') }, h('div', { class: 'k', title: k, style: `font-size:${fs}px` }, k), h('div', { class: 'l' }, l), opts.d && h('span', { class: 'd' }, opts.d)); };

  /* ---------- notes: one timestamped Markdown timeline on any record, shared by every app ---------- */
  function mentions(html, names) {
    const alts = names.filter(Boolean).sort((a, b) => b.length - a.length).map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return alts ? html.replace(new RegExp('@(' + alts + ')', 'g'), '<span class="mention">@$1</span>') : html;
  }
  function notesPanel(coll, ref) {
    const wrap = h('div', { class: 'notes' });
    function paint() {
      const list = live('notes').filter(n => n.coll === coll && n.ref === ref).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
      const names = live('people').map(p => p.name);
      const ta = h('textarea', { class: 'input', placeholder: 'Add a note… Markdown and @name work', style: 'font-family:var(--font);font-size:14px;min-height:54px', onkeydown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote(); } });
      const addNote = () => { const v = ta.value.trim(); if (!v) return; store.add('notes', { coll, ref, text: v, author: (sync.cfg && sync.cfg.user) || '' }); paint(); };
      wrap.replaceChildren(
        h('label', { class: 'f' }, 'Activity'),
        h('div', { class: 'lst' }, list.map(n => {
          const a = n.author || t('You');
          const box = h('div', { class: 'b' },
            h('div', { class: 'hd' }, h('b', {}, a), h('span', {}, new Date(n.created).toLocaleString()), n.updated && h('span', { class: 'dim' }, 'edited'),
              h('span', { class: 'ops' },
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => {
                  const ed = h('textarea', { class: 'input', style: 'font-family:var(--font);font-size:14px;min-height:54px' }, n.text);
                  box.replaceChildren(ed, h('div', { class: 'row', style: 'margin-top:6px' },
                    h('button', { type: 'button', class: 'btn sm acid', onclick: () => { if (ed.value.trim()) store.update('notes', n.id, { text: ed.value.trim() }); paint(); } }, 'Save'),
                    h('button', { type: 'button', class: 'btn sm ghost', onclick: paint }, 'Cancel')));
                } }, 'Edit'),
                h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => { if (confirm(t('Delete note?'))) { store.remove('notes', n.id); paint(); } } }, 'Delete'))),
            h('div', { class: 'tx', html: mentions(md(n.text), names) }));
          return h('div', { class: 'n' }, avatar(a), box);
        })),
        ta, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'btn sm', onclick: addNote }, 'Add note')));
    }
    paint(); return wrap;
  }

  const CAPS = {
    crm: ['Contacts, companies and deals in one place', 'Deal pipeline with drag and drop and money per stage', 'Import from HubSpot, Pipedrive or Salesforce CSV', 'A requester in Desk and a client in Invoices are the same record', 'A client page per company: deals, tickets, invoices, tasks and notes together', 'Timestamped notes with @mentions on every record'],
    desk: ['Tickets with threaded replies and internal notes', 'Priorities, statuses, assignees from People', 'Import from Zendesk or Freshdesk CSV'],
    people: ['Directory with teams and managers', 'Time-off requests approved in one click', 'Import from BambooHR, Gusto or Rippling CSV', 'Timestamped notes with @mentions on every record'],
    wiki: ['Markdown pages with folders and search', 'Import Notion or Confluence exports', 'Export everything as one file'],
    tasks: ['Board and list, projects, assignees, due dates', 'Import Trello JSON or Asana, Jira, ClickUp, monday CSV', 'Overdue flags, drag between columns', 'Timestamped notes with @mentions on every record'],
    invoices: ['Line items, tax, statuses, print to PDF', 'Clients from CRM companies, workspace currency', 'Import from FreshBooks, QuickBooks, Xero or Wave CSV', 'Timestamped notes with @mentions on every record'],
    expenses: ['Categories, merchants, payment methods, monthly totals', 'Bank or card statement CSV import', 'Refunds as negative amounts', 'Timestamped notes with @mentions on every record'],
    timesheets: ['Start and stop a timer or add hours by hand', 'Weekly grid per person and project with day totals', 'Projects come from Tasks, people from People', 'Import from Toggl Track, Harvest or Clockify CSV'],
  };
  function empty(title, hint) {
    const caps = CAPS[activeApp] || [];
    return h('div', { class: 'empty' }, h('b', {}, title), h('p', { class: 'mute', style: 'text-align:center;margin-top:6px' }, hint),
      caps.length && h('div', { class: 'cap' }, caps.map(c => h('div', {}, c))),
      h('div', { class: 'acts' }, !demo.on() && h('button', { class: 'btn acid', onclick: () => demo.load() }, 'Load a demo workspace'), h('a', { class: 'btn', href: 'home.html' }, 'Open Home')));
  }

  /* ---------- global search: one query across every collection, Cmd/Ctrl+K from any app ---------- */
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SEARCH = {
    contacts: { label: 'Contact', title: r => r.name, sub: r => [r.title, r.email].filter(Boolean).join(' · '), extra: r => [r.email, r.phone, r.title], url: r => 'crm.html#open=' + r.id },
    companies: { label: 'Company', title: r => r.name, sub: () => '', extra: () => [], url: r => 'company-page.html?id=' + r.id },
    deals: { label: 'Deal', title: r => r.name, sub: r => [r.stage, r.contact].filter(Boolean).join(' · '), extra: r => [r.contact, r.stage, r.owner], url: r => 'crm.html#open=' + r.id },
    tickets: { label: 'Ticket', title: r => r.subject, sub: r => [r.status, r.requester].filter(Boolean).join(' · '), extra: r => [r.requester, r.email], url: r => 'desk.html#open=' + r.id },
    people: { label: 'Person', title: r => r.name, sub: r => [r.title, r.team].filter(Boolean).join(' · '), extra: r => [r.email, r.title, r.team, r.location], url: r => 'people.html#open=' + r.id },
    pages: { label: 'Page', title: r => r.title, sub: r => r.folder || '', extra: r => [r.folder, r.body], url: r => 'wiki.html#' + r.id },
    tasks: { label: 'Task', title: r => r.title, sub: r => [r.status, r.assignee].filter(Boolean).join(' · '), extra: r => [r.project, r.assignee, r.description], url: r => 'tasks.html#open=' + r.id },
    invoices: { label: 'Invoice', title: r => r.number || 'Invoice', sub: r => [r.billto, r.status].filter(Boolean).join(' · '), extra: r => [r.billto, r.status], url: r => 'invoices.html#open=' + r.id },
    expenses: { label: 'Expense', title: r => r.merchant, sub: r => [r.category, r.date].filter(Boolean).join(' · '), extra: r => [r.category, r.spender, r.notes], url: r => 'expenses.html#open=' + r.id },
  };
  const resultOf = (coll, r) => ({ coll, id: r.id, label: SEARCH[coll].label, title: String(SEARCH[coll].title(r) || '').trim() || '—', sub: String(SEARCH[coll].sub(r) || ''), url: SEARCH[coll].url(r) });
  function searchAll(q) {
    q = String(q || '').trim().toLowerCase(); if (!q) return [];
    const word = new RegExp('(^|[^a-zа-яё0-9])' + reEsc(q));
    const out = [];
    for (const coll of Object.keys(SEARCH)) for (const r of live(coll)) {
      const tl = String(SEARCH[coll].title(r) || '').toLowerCase();
      const score = tl === q ? 4 : tl.startsWith(q) ? 3 : word.test(tl) ? 2 : tl.includes(q) ? 1.5 : SEARCH[coll].extra(r).some(v => String(v || '').toLowerCase().includes(q)) ? 1 : 0;
      if (score) out.push(Object.assign(resultOf(coll, r), { score, ts: r.updated || r.created || '' }));
    }
    return out.sort((a, b) => b.score - a.score || b.ts.localeCompare(a.ts)).slice(0, 30);
  }
  const RECENT_KEY = 'nol.recent'; // per browser, not synced: what you opened is not the team's business
  const recent = {
    all() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').map(x => { const r = store.get(x.coll, x.id); return r && resultOf(x.coll, r); }).filter(Boolean); } catch (e) { return []; } },
    push(res) { try { const a = [{ coll: res.coll, id: res.id }, ...JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(x => x.id !== res.id)].slice(0, 7); localStorage.setItem(RECENT_KEY, JSON.stringify(a)); } catch (e) { } },
  };
  function searchDialog() {
    let dlg = document.getElementById('nol-search'); if (!dlg) { dlg = h('dialog', { class: 'pal', id: 'nol-search', onclick: e => { if (e.target === dlg) dlg.close(); } }); document.body.append(dlg); }
    let sel = 0, rows = [];
    const list = h('div', { class: 'lst' });
    const go = r => { recent.push(r); dlg.close(); const href = activeBase + 'apps/' + r.url; const here = href.split(/[#?]/)[0].endsWith(location.pathname.split('/').pop()); location.href = href; if (here) location.reload(); };
    const inp = h('input', {
      class: 'input', placeholder: 'Search contacts, deals, tickets, tasks, invoices…', autocomplete: 'off',
      oninput: () => { sel = 0; paint(); },
      onkeydown: e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { sel = (sel + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length; paint(); } } else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); go(rows[sel]); } }
    });
    function paint() {
      const q = inp.value.trim();
      rows = q ? searchAll(q) : recent.all();
      list.replaceChildren(h('div', {},
        !q && rows.length ? h('div', { class: 'hd' }, 'Recent') : null,
        rows.map((r, i) => h('div', { class: 'r' + (i === sel ? ' on' : ''), onclick: () => go(r), onmouseenter: () => { if (sel !== i) { sel = i; paint(); } } },
          h('span', { class: 'badge' }, r.label), h('span', { class: 'tt' }, r.title), r.sub && h('span', { class: 'sub' }, r.sub))),
        q && !rows.length ? h('div', { class: 'none' }, 'Nothing found') : null,
        !q && !rows.length ? h('div', { class: 'none' }, 'Type to search your whole workspace.') : null));
      const on = list.querySelector('.r.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    dlg.replaceChildren(h('div', { class: 'bd' }, inp, list, h('div', { class: 'ft' }, '↑↓ to navigate · Enter to open · Esc to close')));
    paint(); dlg.showModal();
  }

  const NOL = { lang, setLang, t, tr, translateNode, store, sync, mergeColl, demo, avatar, who, bars, cols, tile, icon, parseCSV, csvToObjects, toCSV, mapHeaders, pick, fullName, norm, parseDuration, fmtDur, detectSaaS, monthlyCost, md, esc, mentions, notesPanel, searchAll, searchDialog, h, download, readFile, pickFile, toast, fmtMoney, fmtDate, currency, setCurrency, money, currencySelect, CURRENCIES, topbar, syncDialog, empty, id, now, APPS };
  root.NOL = NOL;
  i18nStart();
  if (typeof module !== 'undefined' && module.exports) module.exports = NOL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
