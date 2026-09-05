/* NOL shared runtime: storage, sync via your own GitHub repo, CSV, header mapping, SaaS detection, markdown, UI. No deps, no build. Works in browser and Node (tests). */
(function (root) {
  const COLLS = ['companies', 'contacts', 'deals', 'tickets', 'people', 'timeoff', 'pages', 'tasks', 'invoices', 'expenses', 'settings'];
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
        let remote = []; try { remote = JSON.parse(await sync.api('GET', `/repos/${sync.cfg.repo}/contents/${c}.json?ref=${sync.cfg.branch}`, null, true)) || []; } catch (e) { remote = []; }
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

  const APPS = [['crm', 'CRM'], ['desk', 'Desk'], ['people', 'People'], ['wiki', 'Wiki'], ['tasks', 'Tasks'], ['invoices', 'Invoices'], ['expenses', 'Expenses']];
  function syncButton() {
    const b = h('button', { class: 'btn sm ghost', onclick: syncDialog });
    const paint = () => { b.replaceChildren(); if (!sync.on()) { b.append('Team sync'); b.title = 'Share this workspace with your team through a private GitHub repository you own'; return; } const dot = { ok: 'var(--ok)', syncing: 'var(--amber)', error: 'var(--red)', off: 'var(--dim)' }[sync.status] || 'var(--dim)'; b.append(h('span', { style: `display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot}` }), sync.cfg.repo); b.title = sync.err || (sync.last ? 'Synced ' + new Date(sync.last).toLocaleTimeString() : 'Connected'); };
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
  function topbar(active, base = '../') {
    const bar = h('div', { class: 'top' }, h('div', { class: 'wrap' },
      h('a', { class: 'mark', href: base }, h('b', {}, '0'), 'NOL'),
      h('nav', { class: 'tabs' }, APPS.map(([k, n]) => h('a', { href: base + 'apps/' + k + '.html', class: k === active ? 'on' : '' }, n))),
      h('div', { class: 'grow' }),
      langButton(),
      syncButton(),
      h('button', { class: 'btn sm ghost', title: 'Download everything NOL stores in this browser as one JSON file', onclick: () => { download('nol-export.json', store.exportAll()); toast('Everything exported. It is yours.'); } }, 'Export all'),
      h('button', { class: 'btn sm ghost', title: 'Restore a NOL export', onclick: async () => { const [f] = await pickFile('.json'); if (!f) return; try { store.importAll(await readFile(f)); toast('Restored. Reloading…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That is not a NOL export.'); } } }, 'Restore')
    ));
    document.body.prepend(bar);
    if (/(^|[#&])connect=/.test(location.hash)) { // device link: #connect=<token>&repo=<owner/repo>&lang=ru → connects this browser, then reloads clean
      const q = Object.fromEntries(location.hash.slice(1).split('&').map(kv => kv.split('=').map(decodeURIComponent)));
      if (q.lang) localStorage.setItem(LANG_KEY, q.lang);
      history.replaceState(null, '', location.pathname);
      sync.connect(q.connect, q.repo || '', false).then(() => location.replace(location.pathname)).catch(e => alert(e.message));
      return;
    }
    if (sync.on()) sync.start(); else if (/join=/.test(location.hash)) setTimeout(syncDialog, 300);
  }
  function empty(title, hint) { return h('div', { class: 'empty' }, h('b', {}, title), hint); }

  const NOL = { lang, setLang, t, tr, translateNode, store, sync, mergeColl, parseCSV, csvToObjects, toCSV, mapHeaders, pick, fullName, norm, detectSaaS, monthlyCost, md, esc, h, download, readFile, pickFile, toast, fmtMoney, fmtDate, currency, setCurrency, money, currencySelect, CURRENCIES, topbar, syncDialog, empty, id, now, APPS };
  root.NOL = NOL;
  i18nStart();
  if (typeof module !== 'undefined' && module.exports) module.exports = NOL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
