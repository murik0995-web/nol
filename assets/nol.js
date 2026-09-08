/* NOL shared runtime: storage, sync via your own GitHub repo, CSV, header mapping, SaaS detection, markdown, UI. No deps, no build. Works in browser and Node (tests). */
(function (root) {
  const COLLS = ['companies', 'contacts', 'deals', 'tickets', 'people', 'timeoff', 'pages', 'tasks', 'invoices', 'expenses', 'timelogs', 'settings', 'notes', 'files', 'macros', 'goals', 'jobs', 'candidates', 'items', 'movements', 'subscriptions', 'quotes', 'pricelist', 'contracts', 'templates', 'assets', 'standups', 'checkins', 'meetings', 'holidays', 'retros', 'retrocards', 'components', 'incidents', 'cashflow', 'roadmap', 'releases', 'metrics', 'holdings', 'rounds', 'onboardings', 'onboardplans', 'cycles', 'reviews', 'purchases', 'feedback', 'mindmaps'];  const KEY = 'nol.db', SYNC_KEY = 'nol.sync';
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
    add(c, o) { const r = Object.assign({ id: id(), created: now() }, o); db[c].push(r); dirty.add(c); try { persist(); } catch (e) { db[c].pop(); throw e; } return r; }, // browser storage can be full (attachments are the first records big enough to hit it): drop the record rather than show one that survives no reload
    addMany(c, arr) { const rs = arr.map(o => Object.assign({ id: id(), created: now() }, o)); db[c].push(...rs); dirty.add(c); persist(); return rs; },
    update(c, i, patch) { const x = store.get(c, i); if (x) { Object.assign(x, patch, { updated: now() }); dirty.add(c); persist(); } return x; },
    remove(c, i) { const x = db[c].find(x => x.id === i); if (x) { x.deleted = true; x.updated = now(); dirty.add(c); persist(); } }, // tombstone, so a deletion wins on every synced device
    restore(c, i) { const x = db[c].find(x => x.id === i && x.deleted); if (x) { delete x.deleted; x.updated = now(); dirty.add(c); persist(); } return x; }, // un-tombstone: the fresh `updated` outruns the tombstone in every merge
    purge(c, i) { const k = db[c].findIndex(x => x.id === i); if (k > -1) { db[c].splice(k, 1); dirty.add(c); persist(); } }, // ponytail: on a synced workspace another device's tombstone can union-merge back into the repo file; it stays deleted-flagged either way
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

  /* ---------- duplicate contacts: the same person is the same email or the same phone, however either was typed ---------- */
  const lc = s => String(s || '').trim().toLowerCase();
  const dupPhone = s => { const d = String(s || '').replace(/\D/g, ''); return d.length < 7 ? '' : d.slice(-10); }; // last 10 digits: +7 916 …, 8 (916) … and 916 … are one number
  const dupKeys = c => { const k = []; if (lc(c.email)) k.push('e:' + lc(c.email)); if (dupPhone(c.phone)) k.push('p:' + dupPhone(c.phone)); return k; };
  function dupGroups(list) {
    const up = new Map(list.map(c => [c.id, c.id]));
    const find = i => { while (up.get(i) !== i) { up.set(i, up.get(up.get(i))); i = up.get(i); } return i; };
    const first = new Map();
    for (const c of list) for (const k of dupKeys(c)) { // one group even when A shares an email with B and B shares a phone with C
      const o = first.get(k); if (o == null) { first.set(k, c.id); continue; }
      const a = find(o), b = find(c.id); if (a !== b) up.set(a, b);
    }
    const by = new Map();
    for (const c of list) { const r = find(c.id); (by.get(r) || by.set(r, []).get(r)).push(c); }
    return [...by.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length || lc(a[0].name).localeCompare(lc(b[0].name)));
  }

  /* ---------- links of one record: the timeline and the client page read the same rules ---------- */
  const invTotal = inv => { const sub = (inv.items || []).reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0); return sub + sub * (+inv.taxRate || 0) / 100; };
  const invPaid = inv => (inv.payments || []).reduce((s, p) => s + (+p.amount || 0), 0);
  const invBalance = inv => inv.status === 'paid' ? 0 : Math.round((invTotal(inv) - invPaid(inv)) * 100) / 100; // "paid" is the owner's word: an invoice imported or ticked off by hand carries no payment rows and still owes nothing
  const invOpen = inv => inv.status === 'sent' || inv.status === 'partial';       // money a client still owes; a draft was never sent to anyone
  const invOverdue = (inv, t0) => invOpen(inv) && !!inv.due && inv.due < (t0 || day());
  function linked(coll, ref) {
    const rec = store.get(coll, ref);
    if (!rec) return { contacts: [], deals: [], tickets: [], invoices: [], notes: [] };
    const notesOf = (c, r) => live('notes').filter(n => n.coll === c && n.ref === r);
    if (coll === 'companies') {
      const contacts = live('contacts').filter(c => c.companyId === ref);
      const em = new Set(contacts.map(c => lc(c.email)).filter(Boolean)), nm = new Set(contacts.map(c => lc(c.name)).filter(Boolean));
      return { contacts, deals: live('deals').filter(d => d.companyId === ref),
        tickets: live('tickets').filter(t => t.companyId ? t.companyId === ref : (t.email && em.has(lc(t.email))) || (t.requester && nm.has(lc(t.requester)))), // a ticket linked to a company in Desk belongs to that company only
        invoices: live('invoices').filter(i => i.clientId === ref),
        notes: [...notesOf('companies', ref), ...contacts.flatMap(c => notesOf('contacts', c.id))] }; // a note about one of its people is activity of the company too
    }
    const name = lc(rec.name), email = lc(rec.email);
    return { contacts: [rec],
      deals: live('deals').filter(d => name && lc(d.contact) === name),
      tickets: live('tickets').filter(t => (email && lc(t.email) === email) || (name && lc(t.requester) === name)),
      invoices: rec.companyId ? live('invoices').filter(i => i.clientId === rec.companyId) : [], // a contact has no invoices of their own: these are their company's
      notes: notesOf('contacts', ref) };
  }
  function activity(coll, ref) {
    const L = linked(coll, ref), out = [];
    for (const n of L.notes) out.push({ t: n.created, kind: 'note', title: String(n.text || '').split('\n')[0].slice(0, 120), sub: n.author || '', url: '' });
    for (const d of L.deals) out.push({ t: (['Won', 'Lost'].includes(d.stage) && d.close) || d.created, kind: 'deal', title: d.name, sub: d.stage || '', amount: +d.amount || 0, url: 'crm.html#open=' + d.id });
    for (const t of L.tickets) out.push({ t: t.created, kind: 'ticket', title: t.subject, sub: t.status || '', url: 'desk.html#open=' + t.id });
    for (const i of L.invoices) out.push({ t: i.issued || i.created, kind: 'invoice', title: i.number || 'Invoice', sub: i.status || '', amount: invTotal(i), url: 'invoices.html#open=' + i.id });
    return out.filter(e => e.t).sort((a, b) => String(b.t).localeCompare(String(a.t)));
  }

  /* ---------- invoice numbering and recurring drafts: one rule for the whole workspace, so two tabs never mint the same number ---------- */
  function addMonths(iso, n, anchorDay) {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(anchorDay || d, last)); // 31 January plus one month is the last day of February, not the 3rd of March; the anchor day keeps the 31st from sliding to the 28th forever
    return t.toISOString().slice(0, 10);
  }
  function nextInvoiceNumber(year) {                                              // 2026-0001: the counter starts again every January
    const y = String(year || day()).slice(0, 4);
    let mx = 0;
    for (const i of live('invoices')) { const p = String(i.number || '').split('-'); if (p.length === 2 && p[0] === y && /^\d+$/.test(p[1])) mx = Math.max(mx, +p[1]); }
    return y + '-' + String(mx + 1).padStart(4, '0');
  }
  const RECUR = { monthly: 1, quarterly: 3 };
  function runRecurring(t0) {                                                     // every invoice marked repeating drops a draft copy on its date, and catches up if nobody opened NOL for a while
    t0 = t0 || day(); const made = [];
    for (const inv of live('invoices')) {
      if (!RECUR[inv.recur] || !inv.recurNext) continue;
      const gap = inv.issued && inv.due ? Math.round((Date.parse(inv.due) - Date.parse(inv.issued)) / 864e5) : 14;
      const anchorDay = +String(inv.issued || inv.recurNext).slice(8, 10) || 1; // an invoice issued on the 31st keeps landing on the 31st, not on the 28th after one short month
      let next = inv.recurNext;
      for (let guard = 0; guard < 60 && next && next <= t0; guard++) {             // ponytail: 60 periods is five years of catch-up, enough for a laptop that was closed
        made.push(store.add('invoices', {
          number: nextInvoiceNumber(next), clientId: inv.clientId, issued: next, due: day(Date.parse(next) + Math.max(0, gap) * 864e5),
          status: 'draft', taxRate: +inv.taxRate || 0, from: inv.from || '', billto: inv.billto || '', bank: inv.bank || '', notes: inv.notes || '',
          items: (inv.items || []).map(x => ({ desc: x.desc, qty: x.qty, rate: x.rate })), payments: [], recurOf: inv.id,
        }));
        next = addMonths(next, RECUR[inv.recur], anchorDay);
      }
      if (next !== inv.recurNext) store.update('invoices', inv.id, { recurNext: next });
    }
    return made;
  }

  /* ---------- cash flow: recurring and one-off items projected month by month; the runway falls out of the same numbers ---------- */
  const CASH_CYCLES = { once: 0, monthly: 1, quarterly: 3, yearly: 12 };          // months between two payments; 'once' never repeats
  const ym = iso => String(iso || '').slice(0, 7);
  const ymAdd = (m, n) => { const y = +m.slice(0, 4), i = +m.slice(5, 7) - 1 + n; return (y + Math.floor(i / 12)) + '-' + String((i % 12 + 12) % 12 + 1).padStart(2, '0'); };
  const ymGap = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  function cashDue(item, m) {                                                     // what this item moves in the month 'YYYY-MM': a cycle that does not land in it moves nothing
    const start = ym(item.start); if (!/^\d{4}-\d{2}$/.test(start) || m < start) return 0;
    const end = ym(item.end); if (end && m > end) return 0;
    const step = CASH_CYCLES[item.cycle] == null ? 1 : CASH_CYCLES[item.cycle];
    const gap = ymGap(start, m);
    if (!step) return gap === 0 ? +item.amount || 0 : 0;                          // a one-off pays in its own month and never again
    return gap % step ? 0 : +item.amount || 0;
  }
  const cashOpening = () => { const s = store.get('settings', 'workspace'); return +(s && s.cashOpening) || 0; };
  function cashPlan(t0, n, src) {                                                 // n months from t0: money in, money out, the balance after each one, and the month the cash runs out
    const from = ym(t0 || day()), N = Math.max(1, +n || 12), use = src || {};
    const items = live('cashflow').filter(x => x.active !== false);
    const invs = use.invoices === false ? [] : live('invoices').filter(i => invOpen(i) && invBalance(i) > 0);
    const subs = use.subs === false ? [] : live('subscriptions').filter(s => s.status !== 'cancelled' && +s.cost);
    const subMonthly = subs.reduce((t, s) => t + (+s.cost || 0) / (CASH_CYCLES[s.cycle] || 1), 0);
    let balance = cashOpening();
    const months = [];
    for (let k = 0; k < N; k++) {
      const m = ymAdd(from, k);
      let mi = 0, mo = 0;
      for (const x of items) { const v = cashDue(x, m); if (x.kind === 'in') mi += v; else mo += v; }
      for (const i of invs) { const d = ym(i.due) || from; if (d === m || (k === 0 && d < from)) mi += invBalance(i); } // an invoice already overdue is money still expected, in the first month
      mo += subMonthly;
      balance = Math.round((balance + mi - mo) * 100) / 100;
      months.push({ month: m, in: Math.round(mi * 100) / 100, out: Math.round(mo * 100) / 100, net: Math.round((mi - mo) * 100) / 100, balance });
    }
    const gone = months.findIndex(m => m.balance < 0);
    return { opening: cashOpening(), months, runway: gone < 0 ? null : gone, low: months.reduce((a, b) => b.balance < a.balance ? b : a, months[0]) };
  }

  /* ---------- quotes: one discount field that takes "10%" or a flat amount, and one place that turns lines into totals — the paper, the list and the invoice a quote becomes all read it ---------- */
  const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
  function discountAmt(discount, base) {                                          // "10%" is a share of the subtotal, "500" is money off; anything else is no discount at all
    const raw = String(discount == null ? '' : discount).trim().replace(',', '.');
    if (!raw) return 0;
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n <= 0) return 0;
    return Math.min(base, raw.includes('%') ? base * n / 100 : n);                // never more than the subtotal: a quote does not owe the client money
  }
  function quoteTotals(q) {
    const sub = (q.items || []).reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0);
    const disc = discountAmt(q.discount, sub), net = sub - disc, tax = net * (+q.taxRate || 0) / 100;
    return { sub, disc, net, tax, total: net + tax };                             // tax is charged on what the client actually pays, so the discount comes off first
  }
  const quoteOpen = q => q.status === 'draft' || q.status === 'sent';
  const quoteExpired = (q, t0) => q.status === 'sent' && !!q.valid && q.valid < (t0 || day()); // a quote nobody answered stops being a promise on its own date
  function nextQuoteNumber(year) {                                                // Q-2026-0001, counted per year like an invoice, with its own series
    const y = String(year || day()).slice(0, 4);
    let mx = 0;
    for (const q of live('quotes')) { const p = String(q.number || '').split('-'); if (p.length === 3 && p[0] === 'Q' && p[1] === y && /^\d+$/.test(p[2])) mx = Math.max(mx, +p[2]); }
    return 'Q-' + y + '-' + String(mx + 1).padStart(4, '0');
  }

  /* ---------- purchase orders: what was ordered from a vendor, what has actually arrived, and who approved the spend. The received quantity lives on the line, so "received" stays a fact about goods and never a status somebody typed over. ---------- */
  const PO_STATUSES = ['draft', 'pending', 'approved', 'sent', 'rejected', 'cancelled'];
  const PO_DEAD = ['rejected', 'cancelled'];                                      // nothing will ever arrive against these two
  function poTotals(po) {
    const sub = (((po || {}).items) || []).reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0);
    const tax = sub * (+((po || {}).taxRate) || 0) / 100;
    return { sub, tax, total: sub + tax };
  }
  function poReceived(po) {                                                       // ordered against arrived, across every line
    const lines = (((po || {}).items) || []).filter(i => (+i.qty || 0) > 0);
    const ordered = lines.reduce((s, i) => s + (+i.qty || 0), 0);
    const received = lines.reduce((s, i) => s + Math.min(Math.max(+i.recv || 0, 0), +i.qty || 0), 0); // a vendor who sends two extra boxes still closed one line, not 120% of the order
    return { ordered, received, state: !ordered || !received ? 'none' : received >= ordered ? 'full' : 'partial', pct: ordered ? Math.round(received / ordered * 100) : 0 };
  }
  const poOpen = po => !!po && !PO_DEAD.includes(po.status) && poReceived(po).state !== 'full'; // money promised to a vendor that is not on the shelf yet
  const poLate = (po, t0) => poOpen(po) && po.status !== 'draft' && !!po.expected && po.expected < (t0 || day()); // a draft was never sent to anybody, so it cannot be late
  function nextPONumber(year) {                                                   // PO-2026-0001: its own series, counted again every January like an invoice
    const y = String(year || day()).slice(0, 4);
    let mx = 0;
    for (const p of live('purchases')) { const s = String(p.number || '').split('-'); if (s.length === 3 && s[0].toUpperCase() === 'PO' && s[1] === y && /^\d+$/.test(s[2])) mx = Math.max(mx, +s[2]); }
    return 'PO-' + y + '-' + String(mx + 1).padStart(4, '0');
  }

  /* ---------- contracts: a contract renews itself unless somebody says no in time, so the notice deadline is the date worth a reminder ---------- */
  function fillVars(text, vars) { return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => vars && k in vars && vars[k] !== '' ? vars[k] : m); } // an unfilled placeholder stays visible on the paper, so a missing detail is obvious
  const varsIn = text => [...new Set([...String(text || '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]))];
  function noticeDate(c) {                                                        // 60 days notice on a contract that ends 31 December: say no by 1 November
    const end = Date.parse(String((c && c.end) || '') + 'T00:00:00Z'), n = Math.max(0, +((c && c.noticeDays) || 0));
    return isNaN(end) || !n ? '' : new Date(end - n * 864e5).toISOString().slice(0, 10);
  }
  function contractDue(c, t0) {                                                   // what a signed contract needs today: nothing, the notice deadline, or the end date itself
    if (!c || c.status !== 'signed' || !c.end) return '';
    t0 = t0 || day();
    if (c.end <= t0) return c.autoRenew ? 'renews' : 'expires';
    const n = noticeDate(c);
    return n && n <= t0 ? 'notice' : '';
  }
  function contractWatch(days, t0) {                                              // every signed contract whose notice deadline or end date lands inside the next N days, soonest first
    t0 = t0 || day();
    const horizon = new Date(Date.parse(t0 + 'T00:00:00Z') + Math.max(0, +days || 0) * 864e5).toISOString().slice(0, 10);
    const out = [];
    for (const c of live('contracts')) {
      const now = contractDue(c, t0);
      if (now) { out.push({ c, kind: now, date: now === 'notice' ? noticeDate(c) : c.end }); continue; }
      if (c.status !== 'signed' || !c.end) continue;
      const n = noticeDate(c);
      if (n && n <= horizon) out.push({ c, kind: 'notice', date: n });
      else if (c.end <= horizon) out.push({ c, kind: c.autoRenew ? 'renews' : 'expires', date: c.end });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ---------- tasks on a timeline: what a bar covers, and a dependency that cannot hold ---------- */
  const taskSpan = t => {                                                         // one date only is a bar one day wide; a start typed after its due is drawn the way round it actually runs
    const a = (t && t.start) || (t && t.due) || '', b = (t && t.due) || (t && t.start) || '';
    return a && b ? (a <= b ? { s: a, e: b } : { s: b, e: a }) : null;
  };
  const depClash = (t, byId) => (Array.isArray(t.deps) ? t.deps : []).filter(i => { // finish-to-start: a predecessor still running when this one starts is out of order, a handover on the same day is not
    const p = byId(i), a = p && taskSpan(p), b = taskSpan(t);
    return !!(a && b && a.e > b.s);
  });

  /* ---------- goals: an objective is the weighted average of its key results, and the quarter says whether that number is good ---------- */
  const clampPct = n => Math.max(0, Math.min(100, Math.round(+n || 0)));
  const keyResults = oid => live('goals').filter(g => g.parent === oid);
  function goalProgress(g, krs) {                                                 // an objective with no key results keeps whatever was typed on it
    const kids = krs || keyResults(g.id);
    if (!kids.length) return clampPct(g.progress);
    const wt = k => k.weight == null || k.weight === '' ? 1 : Math.max(0, +k.weight || 0); // a key result nobody weighted counts as one, the way the form offers it
    const sum = kids.reduce((s, k) => s + wt(k), 0);
    if (!sum) return clampPct(kids.reduce((s, k) => s + clampPct(k.progress), 0) / kids.length); // every weight zeroed by hand: a plain average beats a division by zero
    return clampPct(kids.reduce((s, k) => s + clampPct(k.progress) * wt(k), 0) / sum);
  }
  const quarterOf = iso => { const d = String(iso || '').slice(0, 10) || day(); return d.slice(0, 4) + '-Q' + Math.ceil(+d.slice(5, 7) / 3); };
  function quarterRange(q) {                                                      // ['2026-07-01', '2026-09-30'] — the last day comes from day 0 of the next month, so no quarter length is hard-coded
    const m = /^(\d{4})-Q([1-4])$/.exec(String(q || '')); if (!m) return ['', ''];
    const y = +m[1], s = (+m[2] - 1) * 3;
    return [`${y}-${String(s + 1).padStart(2, '0')}-01`, day(Date.UTC(y, s + 3, 0))];
  }
  function goalPace(q, t0) {                                                      // how much of the quarter is gone: the line a key result is expected to be on today
    const [a, b] = quarterRange(q); if (!a) return 0;
    t0 = t0 || day();
    if (t0 <= a) return 0; if (t0 >= b) return 100;
    return clampPct((Date.parse(t0) - Date.parse(a)) / (Date.parse(b) - Date.parse(a)) * 100);
  }
  const goalStatus = (pct, pace) => pct >= 100 ? 'done' : pct >= pace - 10 ? 'on track' : pct >= pace - 25 ? 'at risk' : 'behind'; // 10 and 25 points of slack: starting values, every workspace argues about them anyway

  /* ---------- cap table: outstanding is the stock actually issued; fully diluted counts every option too, granted or still sitting unallocated in the pool. Those are the two numbers a founder is asked for, and they are never the same. ---------- */
  const CAP_CLASSES = ['Common', 'Preferred', 'Options', 'Pool'];
  const CAP_MAP = [ // the pool first: an "unallocated option pool" row is nobody's grant
    [/pool|unallocat|unissued|reserved|available|резерв|пул/i, 'Pool'],
    [/option|rsu|warrant|\bsar\b|esop|phantom|опцион/i, 'Options'],
    [/pref|series|seed|safe|convertible|note|привилег/i, 'Preferred'],
    [/common|ordinary|founder|equity|stock|share|обыкнов/i, 'Common'],
  ];
  function capClass(s) { // an unrecognised class is kept as it was written: a share class of theirs gets its own line
    s = String(s == null ? '' : s).trim(); if (!s) return 'Common';
    const hit = CAP_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : s;
  }
  const capShares = x => Math.max(0, Math.round(+(x && x.shares) || 0));          // shares are whole things; a blank or a word is zero, never NaN
  const capIsPool = x => capClass(x && x.class) === 'Pool';
  const capIsOption = x => capClass(x && x.class) === 'Options';
  function capTable(list) {
    let outstanding = 0, options = 0, pool = 0;
    const by = new Map();
    for (const x of list || []) {
      const n = capShares(x); if (!n) continue;
      if (capIsPool(x)) { pool += n; continue; }                                  // the unallocated pool belongs to nobody yet, so it is not a holder
      if (capIsOption(x)) options += n; else outstanding += n;
      const k = String((x && x.holder) || '').trim() || '—';
      const g = by.get(k) || { holder: k, shares: 0, classes: [] };
      g.shares += n; if (!g.classes.includes(capClass(x.class))) g.classes.push(capClass(x.class));
      by.set(k, g);
    }
    const fullyDiluted = outstanding + options + pool;
    const holders = [...by.values()].map(g => Object.assign(g, { pct: fullyDiluted ? g.shares / fullyDiluted * 100 : 0 })).sort((a, b) => b.shares - a.shares || a.holder.localeCompare(b.holder));
    return { outstanding, options, pool, fullyDiluted, holders };
  }
  function dilute(list, o) {                                                      // a priced round: the pool top-up comes out of the pre-money, the way a term sheet writes it, so it dilutes the existing holders and not the new investor
    const cap = capTable(list);
    const pre = Math.max(0, +((o || {}).pre) || 0), raise = Math.max(0, +((o || {}).raise) || 0);
    const target = Math.min(99, Math.max(0, +((o || {}).poolPct) || 0)) / 100;
    const S = cap.fullyDiluted, post = pre + raise;
    const k = pre > 0 ? target * post / pre : 0;
    const newPool = k > 0 && k < 1 ? Math.max(0, Math.round((cap.pool - k * S) / (k - 1))) : 0; // k ≥ 1 asks for a pool the pre-money cannot pay for: nothing is added, and the pool line below shows what it really comes to
    const price = pre > 0 && S + newPool > 0 ? pre / (S + newPool) : 0;
    const investor = price > 0 ? Math.round(raise / price) : 0;
    const total = S + newPool + investor;
    const pct = n => total ? n / total * 100 : 0;
    return {
      pre, raise, post, price, newPool, investor, total, before: cap,
      poolAfter: cap.pool + newPool, poolPct: pct(cap.pool + newPool), investorPct: pct(investor),
      holders: cap.holders.map(g => ({ holder: g.holder, shares: g.shares, before: g.pct, after: pct(g.shares) })),
    };
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

  /* ---------- iCalendar (RFC 5545): all-day events for a leave or holiday feed. DTEND is exclusive, so one day off ends the next morning ---------- */
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  function ical(events, name = 'NOL', at = Date.now()) {
    const stamp = new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = v => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const nextDay = d => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
    const fold = l => l.length <= 75 ? l : l.match(/.{1,74}/g).join('\r\n ');   // long summaries wrap onto continuation lines, or Outlook drops the event
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOL//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name)];
    for (const e of events || []) {
      if (!e || !isDay(e.start)) continue;
      const end = isDay(e.end) && e.end >= e.start ? e.end : e.start;
      out.push('BEGIN:VEVENT', 'UID:' + esc(e.uid || e.start + '-' + (e.summary || '')) + '@nol', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + e.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + nextDay(end).replace(/-/g, ''), 'SUMMARY:' + esc(e.summary));
      if (e.desc) out.push('DESCRIPTION:' + esc(e.desc));
      out.push('END:VEVENT');
    }
    out.push('END:VCALENDAR');
    return out.map(fold).join('\r\n') + '\r\n';
  }
  const outOn = d => live('timeoff').filter(o => o.status === 'approved' && o.from <= d && o.to >= d); // who is away on a given day: Home, Leave and anything else that asks

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

  /* ---------- manual order inside a group: move `id` in front of `beforeId` (or to the end), return the ids in their new order ---------- */
  function reorder(list, id, beforeId) {
    const ids = list.map(x => (x && x.id) || x).filter(x => x !== id);
    const i = beforeId && beforeId !== id ? ids.indexOf(beforeId) : -1;
    ids.splice(i < 0 ? ids.length : i, 0, id);
    return ids;
  }

  /* ---------- Desk SLA: [first reply, resolution] targets in hours per priority. Starting values only: every workspace edits them in Desk → SLA, they are nobody's promise to a customer. ---------- */
  const SLA = { urgent: [1, 4], high: [4, 24], normal: [8, 48], low: [24, 120] };
  function slaState(t, cfg, at = Date.now()) {
    const c = cfg || SLA, [fh, sh] = c[t.priority] || c.normal || SLA.normal;
    const start = Date.parse(t.created || '') || at, solveDue = start + sh * 36e5;
    if (t.status === 'solved') { const done = Date.parse(t.solvedAt || t.updated || '') || at; return { stage: 'solved', due: solveDue, at: done, breached: done > solveDue }; } // a solved ticket is judged by when it was solved, not by the clock now
    const replied = (t.messages || []).some(m => m.from === 'agent');
    const due = replied ? solveDue : start + fh * 36e5;
    return { stage: replied ? 'solve' : 'first', due, at, breached: at > due };
  }

  /* ---------- hiring: an ATS export names its stages its own way; fold them onto the board instead of growing a column per wording ---------- */
  const HIRE_STAGES = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected'];
  const HIRE_MAP = [ // most final first: "rejected after interview" is a rejection, not an interview
    [/reject|declin|disqualif|archiv|withdr|not a fit|no hire|dropped/i, 'Rejected'],
    [/hired|placed|onboard|offer accepted|accepted offer|start date/i, 'Hired'],
    [/offer/i, 'Offer'],
    [/interview|onsite|on-site|hiring manager|take.?home|final|panel|debrief/i, 'Interview'],
    [/screen|phone|assess|qualif|recruiter call|shortlist/i, 'Screen'],
    [/appli|new|inbox|sourced|lead|prospect|review|backlog/i, 'Applied'],
  ];
  function hireStage(s) { // an unrecognised stage is kept as it was written: a real pipeline step of theirs gets its own column
    s = String(s == null ? '' : s).trim(); if (!s) return 'Applied';
    const hit = HIRE_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : s;
  }

  /* ---------- org chart: the People manager field is the whole tree. A manager nobody in the directory answers to, and a loop with no top, are the two lines worth reporting. ---------- */
  function orgTree(list) {
    const people = (list || []).filter(Boolean);
    const key = n => String(n == null ? '' : n).trim().toLowerCase();
    const byName = new Map();
    for (const p of people) { const k = key(p.name); if (k && !byName.has(k)) byName.set(k, p); } // two namesakes: the first one is the manager everybody meant
    const parent = new Map(), noManager = [], missing = [], loops = [];
    for (const p of people) {
      const k = key(p.manager);
      if (!k) { noManager.push(p); continue; }                                    // the top of the company lives here too, next to the records nobody finished
      const m = byName.get(k);
      if (!m) { missing.push({ person: p, manager: String(p.manager).trim() }); continue; } // a name typed by hand, or an export whose manager left
      if (m.id === p.id) { loops.push(p); continue; }
      parent.set(p.id, m.id);
    }
    for (const p of people) {                                                     // a loop has no top: cut it at the first person the walk reaches twice, so everybody still appears exactly once
      let cur = parent.get(p.id);
      for (let n = 0; cur && n <= people.length; n++) { if (cur === p.id) { parent.delete(p.id); loops.push(p); break; } cur = parent.get(cur); }
    }
    const node = new Map(people.map(p => [p.id, { p, kids: [] }]));
    const roots = [];
    for (const p of people) { const m = parent.get(p.id); (m ? node.get(m).kids : roots).push(node.get(p.id)); }
    const byName2 = (a, b) => String(a.p.name || '').localeCompare(String(b.p.name || ''));
    for (const n of node.values()) n.kids.sort(byName2);
    return { roots: roots.sort(byName2), noManager, missing, loops };
  }

  /* ---------- retros: every retro tool names its columns its own way (Start/Stop/Continue, Mad/Sad/Glad, 4Ls); fold them onto the three that matter instead of growing a column per wording ---------- */
  const RETRO_COLUMNS = ['Went well', 'To improve', 'Action items'];
  const RETRO_MAP = [ // "what to do next" first: "stop doing X" is something to improve, not an action column
    [/action|\bto.?dos?\b|next step|take.?away|follow.?up|^start\b|сделать|действ|начать/i, 'Action items'],
    [/improve|impedim|didn.?t|did not|not go|worse|wrong|badly|\bstop\b|less of|\bsad\b|\bmad\b|angry|frustrat|lack|delta|minus|puzzl|concern|problem|issue|улучш|плохо|хуже|мешал|проблем|минус/i, 'To improve'],
    [/\bwell\b|good|great|glad|happy|liked?|love|keep|continue|more of|plus|success|proud|\bwin\b|хорошо|получилось|удал|плюс|продолж|нрав/i, 'Went well'],
  ];
  function retroColumn(s) { // an unrecognised column is kept as it was written: a template of theirs gets its own column
    s = String(s == null ? '' : s).trim(); if (!s) return RETRO_COLUMNS[0];
    const hit = RETRO_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : s;
  }

  /* ---------- reviews: every performance tool writes its scale its own way (1-5, "Exceeds expectations", a ten-point score, a percentage); fold them onto one five-step scale, so a rating imported from anywhere sorts next to one typed here ---------- */
  const RATINGS = ['Did not meet', 'Partially met', 'Met expectations', 'Exceeded', 'Outstanding'];
  const RATING_MAP = [ // the negatives first: "did not meet expectations" is the lowest step, and it contains the word every middle step would claim
    [/did ?n.?t|does ?n.?t|not meet|unsatisfact|unaccept|poor|underperform|well below|lowest|\u043d\u0435 \u0441\u043e\u043e\u0442\u0432\u0435\u0442|\u043d\u0435\u0443\u0434\u043e\u0432\u043b\u0435\u0442\u0432\u043e\u0440/i, 1],
    [/below|needs? (improve|development)|partial|\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e|\u043d\u0438\u0436\u0435 \u043e\u0436\u0438\u0434|\u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0443\u043b\u0443\u0447\u0448|\u0440\u0430\u0437\u0432\u0438\u0432\u0430/i, 2],
    [/outstanding|exceptional|far exceed|significantly exceed|greatly exceed|role model|top performer|\u0432\u044b\u0434\u0430\u044e\u0449|\u0437\u043d\u0430\u0447\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u043f\u0440\u0435\u0432\u044b\u0448|\u043e\u0431\u0440\u0430\u0437\u0446\u043e\u0432/i, 5],
    [/exceed|above|strong|\u043f\u0440\u0435\u0432\u044b\u0448|\u0432\u044b\u0448\u0435 \u043e\u0436\u0438\u0434|\u043e\u0442\u043b\u0438\u0447\u043d/i, 4],
    [/meet|on track|on target|solid|good|successful|as expected|\u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432|\u043e\u0436\u0438\u0434\u0430\u043d|\u0445\u043e\u0440\u043e\u0448/i, 3],
  ];
  function reviewRating(v) {                                                      // an empty cell or a word nobody recognises is no rating at all: 0, never an invented middle step
    const s = String(v == null ? '' : v).trim(); if (!s) return 0;
    const num = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:(?:\/|out of|\u0438\u0437)\s*(\d+))?\s*(%?)$/i);
    if (num) {
      let n = parseFloat(num[1].replace(',', '.'));
      if (!(n > 0)) return 0;
      const outOf = +num[2] || (num[3] ? 100 : 0);
      if (outOf > 0) n = n / outOf * 5; else if (n > 10) n = n / 20; else if (n > 5) n = n / 2; // a ten-point score and a percentage land on the same five steps as everything else
      return Math.max(1, Math.min(5, Math.round(n)));
    }
    const hit = RATING_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : 0;
  }
  const ratingLabel = n => RATINGS[Math.round(+n || 0) - 1] || '';

  /* ---------- roadmap: three lanes and one public page. An item is shipped when it says so or when the task it is linked to is done ---------- */
  const ROADMAP_LANES = ['now', 'next', 'later'];
  const LANE_NAME = { now: 'Now', next: 'Next', later: 'Later' };
  const LANE_MAP = [ // shipped first: "in progress" and "complete" both contain a word the other rows would claim
    [/ship|complete|\bdone\b|deliver|releas|launch|\blive\b|closed|готов|сделан|выпущ|запущ/i, 'shipped'],
    [/\bnow\b|current|progress|doing|active|build|underway|started|in.?flight|this (quarter|month|sprint)|сейчас|текущ|в работе|делаем/i, 'now'],
    [/next|planned|upcoming|soon|near.?term|committed|scheduled|approved|ready|дальше|следующ|планир|скоро/i, 'next'],
    [/later|future|backlog|someday|long.?term|idea|considering|exploring|researching|under review|maybe|wish|потом|позже|будущ|идея|бэклог/i, 'later'],
  ];
  function roadmapLane(s) { // a column name from any roadmap tool onto now / next / later, or 'shipped' for what is already out
    s = String(s == null ? '' : s).trim(); if (!s) return 'next';
    const hit = LANE_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : 'later';                                              // an unrecognised bucket promises nothing: it goes to Later, where the owner can move it
  }
  const roadmapShipped = x => !!(x && x.shipped) || /done|complete|closed|shipped|finished|resolved/i.test((x && x.taskId && (store.get('tasks', x.taskId) || {}).status) || ''); // ticked by hand, or the task it is linked to is finished in Tasks
  const localDay = iso => { const [y, m, d] = String(iso).split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date(iso); }; // a plain YYYY-MM-DD is parsed as UTC midnight and prints as the day before west of Greenwich
  function roadmapHTML(items, opts) {                                           // one standalone file: no scripts, no fonts, no requests — upload it anywhere
    opts = opts || {};
    const title = String(opts.title || '').trim() || t('Product roadmap');
    const list = (items || []).filter(x => x && String(x.title || '').trim());
    const shipped = list.filter(x => x.shipped);
    const lanes = ROADMAP_LANES.map(l => [l, list.filter(x => !x.shipped && x.lane === l)]);
    const meta = x => [x.area, x.timeframe].filter(Boolean).map(esc).join(' &middot; ');
    const card = x => `<article><h3>${esc(x.title)}</h3>${meta(x) ? `<p class="m">${meta(x)}</p>` : ''}${String(x.desc || '').trim() ? `<p>${esc(x.desc)}</p>` : ''}</article>`;
    const lane = ([l, xs]) => `<section class="lane"><h2><span class="dot ${l}"></span>${esc(t(LANE_NAME[l]))} <span class="n">${xs.length}</span></h2>${xs.map(card).join('') || `<p class="e">${esc(t('Nothing here yet.'))}</p>`}</section>`;
    const css = ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0a0a0b;color:#f4f4f5;font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'
      + 'main{max-width:1100px;margin:0 auto;padding:56px 20px 72px}h1{font-size:clamp(30px,5vw,52px);letter-spacing:-.02em;margin:0}'
      + '.up{color:#8b8b95;margin:10px 0 36px;font-size:14px}.lanes{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}'
      + '.lane{background:#111113;border:1px solid #26262b;border-radius:14px;padding:16px}'
      + 'h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;display:flex;align-items:center;gap:8px}'
      + '.dot{width:8px;height:8px;border-radius:50%;background:#d9ff3d}.dot.next{background:#6aa7ff}.dot.later{background:#5b5b66}.n{color:#5b5b66;font-weight:400}'
      + 'article{background:#161618;border:1px solid #26262b;border-radius:10px;padding:12px 14px;margin-bottom:10px}article:last-child{margin-bottom:0}'
      + 'h3{font-size:16px;margin:0;letter-spacing:-.01em}article p{margin:6px 0 0;font-size:14px;color:#8b8b95;white-space:pre-wrap;overflow-wrap:break-word}'
      + '.m{color:#d9ff3d;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.e{color:#5b5b66;font-size:14px;margin:0}'
      + '.done{margin-top:32px}.done ul{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:8px}'
      + '.done li{background:#111113;border:1px solid #26262b;border-radius:10px;padding:10px 14px;font-size:15px}.done li span{color:#3ddc84;margin-right:8px}'
      + 'footer{margin-top:44px;color:#5b5b66;font-size:13px}footer a{color:#d9ff3d}';
    return '<!doctype html><html lang="' + lang() + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + `<title>${esc(title)}</title><meta name="description" content="${esc(title)}: ${esc(t('what we are building now, what comes next, and what is on the list for later.'))}">`
      + `<style>${css}</style></head><body><main><h1>${esc(title)}</h1>`
      + `<p class="up">${esc(t('Updated'))} ${esc(fmtDate(localDay(opts.updated || day())))}</p>`
      + `<div class="lanes">${lanes.map(lane).join('')}</div>`
      + (shipped.length ? `<section class="done"><h2>${esc(t('Shipped'))} <span class="n">${shipped.length}</span></h2><ul>${shipped.map(x => `<li><span>✓</span>${esc(x.title)}</li>`).join('')}</ul></section>` : '')
      + `<footer>${esc(t('Built with'))} <a href="https://github.com/murik0995-web/nol">NOL</a>. ${esc(t('Free and open source.'))}</footer></main></body></html>`;
  }

  /* ---------- feedback board: what customers ask for, how many asked, and where it went ---------- */
  const FEEDBACK_STATES = ['open', 'planned', 'progress', 'done', 'declined'];
  const FEEDBACK_LABEL = { open: 'Open', planned: 'Planned', progress: 'In progress', done: 'Done', declined: 'Declined' };
  const FEEDBACK_MAP = [ // declined first: "not planned" and "won't do" both carry a word a later row would claim
    [/declin|reject|won.?t|wont|not planned|no plan|dupl|archiv|spam|closed|отклон|дубл|не будем|не планир/i, 'declined'],
    [/done|complete|shipped|ship|releas|launch|\blive\b|resolved|deliver|готов|сделан|выпущ|запущ/i, 'done'],
    [/progress|doing|building|develop|started|underway|in.?work|в работе|делаем|разраб/i, 'progress'],
    [/plan|next|upcoming|accepted|approved|scheduled|committed|roadmap|soon|планир|принят|дальше|скоро/i, 'planned'],
    [/open|new|under review|reviewing|considering|triage|backlog|idea|submitted|unreviewed|wish|откр|нов|идея|рассматр|бэклог/i, 'open'],
  ];
  function feedbackStatus(s) { // a column from Canny, Nolt, Frill, Featurebase or UserVoice onto one of our five
    s = String(s == null ? '' : s).trim(); if (!s) return 'open';
    const hit = FEEDBACK_MAP.find(([re]) => re.test(s));
    return hit ? hit[1] : 'open';                                               // an unrecognised bucket is still somebody asking: it stays Open until a human moves it
  }
  // votes = the count imported or typed in (customers nobody wrote down) + the customers written down by name
  const feedbackVotes = x => Math.max(0, Math.round(+((x || {}).votes) || 0)) + (Array.isArray((x || {}).voters) ? (x || {}).voters.length : 0);

  /* ---------- mind maps: one document, one array of nodes, every node holding the id of its parent. Nothing stores a coordinate — the picture is computed from the tree, so a keyboard indent, a dragged branch and an imported outline all land in the same layout, and the SVG export is that layout written out. ---------- */
  const MIND_TINTS = ['#d9ff3d', '#6aa7ff', '#3ddc84', '#ffb84d', '#c58cff', '#ff5a5f', '#4dd6d0', '#ff9f68'];
  const MIND = { h: 34, roots: 42, vgap: 10, hgap: 54, pad: 26, max: 280 };
  const r1 = n => Math.round(n * 10) / 10;
  const mindWidth = (text, root, extra) => Math.max(root ? 104 : 78, Math.min(MIND.max, Math.round(String(text == null ? '' : text).length * (root ? 9.2 : 7.6)) + 30)) + (+extra || 0); // extra is the room the child counter and the note dot take on screen: the text keeps its own space instead of being cut short
  const mindCut = (text, root) => { const s = String(text == null ? '' : text), n = Math.floor((MIND.max - 30) / (root ? 9.2 : 7.6)); return s.length > n ? s.slice(0, n - 1) + '…' : s; }; // a box is as wide as its text up to a limit; past it the file says so with an ellipsis, the way the screen does
  const mindNodes = m => (m && Array.isArray(m.nodes) ? m.nodes : []).filter(n => n && n.id);
  function mindKids(map) {                                                        // parent id → its children in array order; a node whose parent was deleted hangs off the root instead of disappearing
    const list = mindNodes(map), ids = new Set(list.map(n => n.id)), by = new Map();
    for (const n of list) { const p = n.parent && n.parent !== n.id && ids.has(n.parent) ? n.parent : ''; (by.get(p) || by.set(p, []).get(p)).push(n); }
    return by;
  }
  function mindLayout(map) {
    const list = mindNodes(map), by = mindKids(map), seen = new Set(), nodes = [];
    const wOf = n => mindWidth(n.text, false, ((by.get(n.id) || []).length ? (n.col ? 26 : 17) : 0) + (n.note ? 11 : 0));
    const rootW = mindWidth((map || {}).title, true, (by.get('') || []).length ? 17 : 0);
    const hide = i => { for (const k of by.get(i) || []) if (!seen.has(k.id)) { seen.add(k.id); hide(k.id); } }; // everything under a collapsed branch counts as placed, or the pass at the end would draw it again as a branch of its own
    function place(n, depth, side, x, top, tint, up) {
      seen.add(n.id);
      if (n.col) hide(n.id);
      const w = wOf(n), kids = n.col ? [] : (by.get(n.id) || []).filter(k => !seen.has(k.id)); // filtered against seen: a parent ring in an imported file must not spin here
      const rec = { id: n.id, text: String(n.text || ''), note: String(n.note || ''), depth, side, tint, up, w, h: MIND.h, x, y: 0, kids: (by.get(n.id) || []).length, col: !!n.col };
      nodes.push(rec);
      let block = 0;
      for (const k of kids) block += place(k, depth + 1, side, side > 0 ? x + w + MIND.hgap : x - MIND.hgap - wOf(k), top + block, tint, n.id) + MIND.vgap;
      if (kids.length) block -= MIND.vgap;
      const height = Math.max(MIND.h, block);
      rec.y = top + height / 2;                                                   // a parent sits level with the middle of everything under it
      return height;
    }
    const tops = by.get('') || [];
    const branch = (arr, side) => { let t = 0; for (const n of arr) t += place(n, 1, side, side > 0 ? rootW + MIND.hgap : -MIND.hgap - wOf(n), t, MIND_TINTS[tops.indexOf(n) % MIND_TINTS.length], '') + MIND.vgap; return Math.max(0, t - MIND.vgap); };
    const a = nodes.length, rh = branch(tops.filter((_, i) => i % 2 === 0), 1);    // branches alternate right, left, right: the root ends up in the middle of its own map
    const b = nodes.length, lh = branch(tops.filter((_, i) => i % 2 === 1), -1);
    const c = nodes.length, H = Math.max(MIND.roots, rh, lh);
    for (let i = a; i < b; i++) nodes[i].y += (H - rh) / 2;                        // each side is centred on the root, not hung from the top
    for (let i = b; i < c; i++) nodes[i].y += (H - lh) / 2;
    let below = H + MIND.vgap;                                                     // a node whose parents form a ring is reachable from nothing: it still gets a branch of its own, under the map
    for (const n of list) if (!seen.has(n.id)) below += place(n, 1, 1, rootW + MIND.hgap, below, MIND_TINTS[nodes.length % MIND_TINTS.length], '') + MIND.vgap;
    nodes.unshift({ id: '', text: String((map || {}).title || ''), note: '', depth: 0, side: 0, tint: MIND_TINTS[0], up: null, w: rootW, h: MIND.roots, x: 0, y: H / 2, kids: tops.length, col: false, root: true });
    const x0 = Math.min(...nodes.map(n => n.x)), y0 = Math.min(...nodes.map(n => n.y - n.h / 2));
    for (const n of nodes) { n.x = r1(n.x + MIND.pad - x0); n.y = r1(n.y + MIND.pad - y0); }
    const w = Math.max(...nodes.map(n => n.x + n.w)) + MIND.pad, h = Math.max(...nodes.map(n => n.y + n.h / 2)) + MIND.pad;
    const at = new Map(nodes.map(n => [n.id, n])), edges = [];
    for (const n of nodes) {
      const p = n.root ? null : at.get(n.up); if (!p) continue;
      const x1 = n.side > 0 ? p.x + p.w : p.x, x2 = n.side > 0 ? n.x : n.x + n.w, mx = r1((x1 + x2) / 2);
      edges.push({ id: n.id, tint: n.tint, d: `M${r1(x1)} ${p.y}C${mx} ${p.y},${mx} ${n.y},${r1(x2)} ${n.y}` }); // one flat S from the parent's edge to the child's, so branches never cross their own boxes
    }
    return { nodes, edges, w: r1(w), h: r1(h), root: nodes[0] };
  }
  function mindOutline(map) {                                                     // the tree flattened depth first: one row per node with its level, the shape every mind map tool writes to a spreadsheet
    const by = mindKids(map), out = [], seen = new Set();
    const walk = (pid, d) => { for (const n of by.get(pid) || []) { if (seen.has(n.id)) continue; seen.add(n.id); out.push({ depth: d, text: String(n.text || ''), note: String(n.note || '') }); walk(n.id, d + 1); } };
    walk('', 0);
    for (const n of mindNodes(map)) if (!seen.has(n.id)) { seen.add(n.id); out.push({ depth: 0, text: String(n.text || ''), note: String(n.note || '') }); walk(n.id, 1); }
    return out;
  }
  function mindFromOutline(rows, mkId) {                                          // rows are {depth, text, note} in reading order; whatever the columns were called, an outline is what came out of the other tool
    const nodes = [], stack = [];
    for (const r of rows || []) {
      const text = String((r && r.text) == null ? '' : r.text).trim(); if (!text) continue;
      const d = Math.max(0, Math.min(stack.length, Math.round(+r.depth) || 0));    // a file that jumps from level 1 to level 4 lands one level in, never in mid-air
      const n = { id: (mkId || id)(), text, parent: d ? stack[d - 1] : '' };
      if (r.note) n.note = String(r.note);
      nodes.push(n); stack.length = d; stack[d] = n.id;
    }
    return nodes;
  }
  function mindSVG(map, o = {}) {                                                 // one standalone file: no stylesheet, no script, no font from the network. It opens in a browser, drops into a document, and stays sharp on a wall.
    const L = mindLayout(map), ink = o.ink || '#15151a', bg = o.bg || '#ffffff';
    const W = Math.ceil(L.w), H = Math.ceil(L.h);
    const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">`, `<rect width="${W}" height="${H}" fill="${bg}"/>`];
    for (const e of L.edges) out.push(`<path d="${e.d}" fill="none" stroke="${e.tint}" stroke-width="2.5" stroke-linecap="round"/>`);
    for (const n of L.nodes) {
      out.push('<g>' + (n.note ? `<title>${esc(n.note)}</title>` : ''));
      out.push(`<rect x="${n.x}" y="${r1(n.y - n.h / 2)}" width="${n.w}" height="${n.h}" rx="10" fill="${n.tint}" fill-opacity="${n.root ? 1 : 0.16}" stroke="${n.tint}" stroke-width="1.5"/>`);
      out.push(`<text x="${r1(n.x + n.w / 2)}" y="${r1(n.y + 4.5)}" text-anchor="middle" font-size="${n.root ? 15 : 13}" font-weight="${n.root ? 700 : 500}" fill="${n.root ? '#121400' : ink}">${esc(mindCut(n.text, n.root))}</text>`);
      out.push('</g>');
    }
    out.push('</svg>');
    return out.join('\n') + '\n';
  }

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
  const unesc = s => String(s).replace(/&(?:amp|lt|gt|quot|#39);/g, c => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[c])); // exact inverse of esc(): a wiki link target is read back out of already-escaped text
  const WIKI_LINK = /\[\[([^\][|\n]+?)(?:\|([^\][\n]+?))?\]\]/g;
  const pageTitle = p => String(p.title || '').trim().toLowerCase();
  const pageByTitle = title => { const k = String(title).trim().toLowerCase(); return k ? live('pages').find(p => pageTitle(p) === k) : null; };
  function wikiAnchor(target, label) {
    const name = unesc(target).trim(), p = pageByTitle(name);
    return p ? `<a class="wl" href="wiki.html#${p.id}">${label}</a>`
      : `<a class="wl new" href="wiki.html#new=${encodeURIComponent(name)}" title="${esc(t('This page does not exist yet. Click to create it.'))}">${label}</a>`;
  }
  function backlinks(page) { // pages whose body links here with [[title]]
    const k = pageTitle(page || {}); if (!k) return [];
    return live('pages').filter(p => p.id !== page.id && [...String(p.body || '').matchAll(WIKI_LINK)].some(m => unesc(m[1]).trim().toLowerCase() === k));
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(nol:([\w-]+)\)/g, '<img data-nol="$2" alt="$1">') // an attachment of this record: the app swaps in a blob URL, so nothing is ever fetched from the network
      .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(WIKI_LINK, (m, tgt, label) => wikiAnchor(tgt, (label || tgt).trim()));
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

  /* ---------- HTML back to Markdown: Zendesk, Intercom and Confluence export article bodies as HTML, and this wiki stores Markdown.
     A parsed document is never laid out, so innerText there is textContent: every paragraph, heading and list item runs into one line. This walks the tree instead. ---------- */
  const MD_BLOCK = { P: '', H1: '# ', H2: '## ', H3: '### ', H4: '#### ', H5: '##### ', H6: '###### ', BLOCKQUOTE: '> ' };
  const MD_WRAP = { B: '**', STRONG: '**', I: '*', EM: '*', CODE: '`' };
  function htmlToMd(html) {
    if (typeof DOMParser === 'undefined') return String(html ?? ''); // Node: no DOM, nothing to convert
    const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
    doc.querySelectorAll('script,style,noscript').forEach(x => x.remove());
    const flat = s => String(s).replace(/\s+/g, ' ');
    function inline(n) {
      if (n.nodeType === 3) return flat(n.nodeValue);
      if (n.nodeType !== 1) return '';
      if (n.nodeName === 'BR') return '\n';
      if (n.nodeName === 'IMG') return `![${n.getAttribute('alt') || ''}](${n.getAttribute('src') || ''})`;
      const kids = [...n.childNodes].map(inline).join(''), body = kids.trim();
      if (n.nodeName === 'A') { const href = (n.getAttribute('href') || '').trim(); return href && body ? `[${body}](${href})` : kids; }
      const w = MD_WRAP[n.nodeName];
      return w && body ? w + body + w : kids;
    }
    const out = [];
    const line = n => inline(n).replace(/[ \t]+/g, ' ').trim();
    function block(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const s = flat(c.nodeValue).trim(); if (s) out.push(s); continue; }
        if (c.nodeType !== 1) continue;
        const tag = c.nodeName;
        if (tag === 'PRE') { out.push('```\n' + String(c.textContent || '').replace(/\s+$/, '') + '\n```'); continue; }
        if (tag === 'UL' || tag === 'OL') { const li = []; let i = 1; for (const x of c.children) if (x.nodeName === 'LI') { const s = line(x); if (s) li.push((tag === 'OL' ? i++ + '. ' : '- ') + s.replace(/\n+/g, ' ')); } if (li.length) out.push(li.join('\n')); continue; } // one block, not one paragraph per item: a blank line between them would close and reopen the list // ponytail: a nested list flattens onto its parent item; give it its own indent when someone imports a wiki that uses them
        if (tag === 'HR') { out.push('---'); continue; }
        if (tag === 'TR') { const cells = [...c.children].map(line).filter(Boolean); if (cells.length) out.push(cells.join(' · ')); continue; }
        if (tag in MD_BLOCK) { const s = line(c); if (s) out.push(MD_BLOCK[tag] + s); continue; }
        if (c.children.length && /^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|ASIDE|TABLE|THEAD|TBODY|TFOOT|FORM|FIGURE|DL|NAV)$/.test(tag)) { block(c); continue; }
        const s = line(c); if (s) out.push(s);
      }
    }
    block(doc.body);
    return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- help center: a public static site generated from wiki pages. The browser writes the files; there is no server and no build step. ---------- */
  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  function helpSlug(title, i, used) { // a file name a web server and a human can both read: Cyrillic is transliterated, never dropped into article-7
    let s = String(title || '').toLowerCase().replace(/[а-яё]/g, c => TRANSLIT[c] ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'article-' + (i + 1);
    if (used) { const base = s; for (let n = 2; used.has(s); n++) s = base + '-' + n; used.add(s); }
    return s;
  }
  const HELP_CSS = `*{box-sizing:border-box}
body{margin:0;background:#fff;color:#181a12;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:#3f7320}
.hc-top{background:#f6f8ee;border-bottom:1px solid #e4e7d8;padding:34px 0 28px}
.hc-wrap{max-width:820px;margin:0 auto;padding:0 20px}
.hc-top h1{margin:0;font-size:32px;letter-spacing:-.02em}
.hc-top h1 a{color:inherit;text-decoration:none}
.hc-top p{margin:8px 0 0;color:#5d6352}
#hcq{width:100%;margin-top:20px;padding:13px 16px;font-size:16px;border:1px solid #d5dac4;border-radius:10px;background:#fff;color:inherit}
#hcq:focus{outline:2px solid #b7d94a;outline-offset:-2px}
main{padding:8px 0 56px}
.hc-sec{margin-top:32px}
.hc-sec h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#7c8270;margin:0 0 2px}
ul.hc-arts{list-style:none;margin:0;padding:0}
ul.hc-arts li{border-bottom:1px solid #ebeee1}
ul.hc-arts a{display:block;padding:13px 2px;text-decoration:none;color:#181a12;font-weight:600}
ul.hc-arts a:hover{color:#3f7320}
ul.hc-arts span{display:block;font-weight:400;font-size:14px;color:#6b7160;margin-top:3px}
.hc-none{color:#6b7160}
.hc-back{display:inline-block;margin-top:26px;font-size:14px}
article h1{font-size:30px;letter-spacing:-.02em;margin:20px 0 14px}
article h2{font-size:22px;margin:30px 0 10px}
article h3{font-size:18px;margin:24px 0 8px}
article img{max-width:100%;height:auto}
article pre{background:#f4f6ea;border:1px solid #e4e7d8;border-radius:10px;padding:14px;overflow:auto}
article code{background:#f4f6ea;border-radius:5px;padding:2px 5px;font-size:.9em}
article pre code{background:none;padding:0}
article blockquote{border-left:3px solid #b7d94a;margin:0 0 14px;padding:2px 14px;color:#5d6352}
article hr{border:0;border-top:1px solid #ebeee1;margin:26px 0}
.hc-foot{border-top:1px solid #ebeee1;padding:22px 0 44px;color:#7c8270;font-size:13px}
`;
  // article text goes into a <script> as JSON: < is escaped so a body containing </script> cannot close the tag
  const jsSafe = v => JSON.stringify(v).replace(/[<\u2028\u2029]/g, c => ({ '<': '\\u003c', '\u2028': '\\u2028', '\u2029': '\\u2029' }[c]));

  function helpSite(articles, opts) {
    const o = Object.assign({ title: 'Help center', tagline: '', single: false }, opts || {});
    const used = new Set(['index', 'style', 'search']); // the file names the site already uses
    const arts = (articles || []).map((a, i) => {
      const slug = helpSlug(a.title, i, used);
      return { id: a.id, title: String(a.title || 'Untitled'), section: String(a.section || '').trim(), body: String(a.body || ''), slug, url: o.single ? '#' + slug : slug + '.html' };
    });
    const byId = new Map(arts.filter(a => a.id).map(a => [a.id, a]));
    let images = 0;
    for (const a of arts) {
      a.html = md(a.body)
        .replace(/<img data-nol="[^"]*"[^>]*>/g, () => { images++; return ''; }) // an attachment lives in the workspace, not on a public site
        .replace(/<a class="wl(?: new)?" href="wiki\.html#([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (m, target, label) => { const to = byId.get(target); return to ? `<a href="${to.url}">${label}</a>` : label; }); // a link to a page nobody published is plain text, never a dead link
      a.text = unesc(a.html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    }
    const secs = [];
    for (const a of arts) { const name = a.section || t('Articles'); let s = secs.find(x => x.name === name); if (!s) secs.push(s = { name, arts: [] }); s.arts.push(a); }

    const E = esc;
    const cut = (s, n) => s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + '…' : s;
    const list = as => '<ul class="hc-arts">' + as.map(a => `<li><a href="${E(a.url)}">${E(a.title)}<span>${E(cut(a.text, 110))}</span></a></li>`).join('') + '</ul>';
    const browse = secs.map(s => `<section class="hc-sec"><h2>${E(s.name)}</h2>${list(s.arts)}</section>`).join('\n');
    const head = (title, desc) => `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(title)}</title><meta name="description" content="${E(cut(desc, 155))}">`;
    const top = `<div class="hc-top"><div class="hc-wrap"><h1><a href="${o.single ? '#' : 'index.html'}">${E(o.title)}</a></h1>${o.tagline ? `<p>${E(o.tagline)}</p>` : ''}<input id="hcq" type="search" autocomplete="off" placeholder="${E(t('Search the help center…'))}"></div></div>`;
    const foot = `<div class="hc-foot"><div class="hc-wrap">${E(t('These pages are plain static files. No server, no cookies, no tracking.'))}</div></div>`;
    const body = (main, tail) => `<body>${top}<main class="hc-wrap">${main}</main>${foot}${tail}</body></html>`;
    const heading = a => /^#\s/m.test(a.body) ? '' : `<h1>${E(a.title)}</h1>`;

    const router = o.single ? `function route(){var hs=decodeURIComponent((location.hash||'').slice(1));q.value='';r.hidden=true;r.innerHTML='';b.hidden=false;
var A=document.querySelectorAll('article.hca');for(var i=0;i<A.length;i++)A[i].hidden=A[i].id!==hs;
var ix=document.getElementById('hci');if(ix)ix.hidden=!!hs;scrollTo(0,0)}
addEventListener('hashchange',route);route();` : 'run();';
    const js = `var HC=${jsSafe(arts.map(a => ({ t: a.title, u: a.url, x: a.text })))};
(function(){var q=document.getElementById('hcq'),r=document.getElementById('hcr'),b=document.getElementById('hcb');if(!q||!r)return;
function e(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function run(){var v=q.value.trim().toLowerCase();
if(!v){r.hidden=true;r.innerHTML='';if(b)b.hidden=false;return}
var o=[];for(var i=0;i<HC.length;i++){var a=HC[i],k=a.x.toLowerCase().indexOf(v),n=a.t.toLowerCase().indexOf(v);
if(k<0&&n<0)continue;var c=k<0?0:Math.max(0,k-50),s=a.x.slice(c,c+150);
o.push({n:n<0?1:0,h:'<li><a href="'+e(a.u)+'">'+e(a.t)+'<span>'+(c?'…':'')+e(s)+'…</span></a></li>'})}
o.sort(function(x,y){return x.n-y.n});
r.innerHTML=o.length?'<div class="hc-sec"><h2>'+${jsSafe(t('Search results'))}+'</h2><ul class="hc-arts">'+o.map(function(x){return x.h}).join('')+'</ul></div>':'<p class="hc-none">'+${jsSafe(t('Nothing found. Try another word.'))}+'</p>';
r.hidden=false;if(b)b.hidden=true}
q.addEventListener('input',run);
${router}})();`;

    const files = {};
    if (o.single) {
      files['help-center.html'] = head(o.title, o.tagline || arts.map(a => a.title).join(', ')) + `<style>${HELP_CSS}</style></head>` +
        body(`<div id="hcr" hidden></div><div id="hcb"><div id="hci">${browse}</div>` +
          arts.map(a => `<article class="hca" id="${E(a.slug)}" hidden>${heading(a)}${a.html}<p><a class="hc-back" href="#">${E(t('← All articles'))}</a></p></article>`).join('\n') +
          '</div>', `<script>${js}<\/script>`);
    } else {
      files['style.css'] = HELP_CSS;
      files['search.js'] = js;
      const page = (title, desc, main) => head(title, desc) + '<link rel="stylesheet" href="style.css"></head>' + body(main, '<script src="search.js"><\/script>');
      files['index.html'] = page(o.title, o.tagline || arts.map(a => a.title).join(', '), `<div id="hcr" hidden></div><div id="hcb">${browse}</div>`);
      for (const a of arts) files[a.slug + '.html'] = page(a.title + ' · ' + o.title, a.text || a.title,
        `<div id="hcr" hidden></div><div id="hcb"><article>${heading(a)}${a.html}</article><p><a class="hc-back" href="index.html">${E(t('← All articles'))}</a></p></div>`);
    }
    return { files, arts, sections: secs.length, images };
  }

  /* ---------- changelog: the published entries as one standalone HTML file. Everything is inlined — no stylesheet, no script, no font from the network — so the same file opens from a folder, an email attachment and GitHub Pages. ---------- */
  const CL_TAGS = ['Added', 'Improved', 'Fixed'];
  const clTags = e => (Array.isArray(e.tags) ? e.tags : String(e.tags || '').split(',')).map(t => String(t).trim()).filter(Boolean);
  const clPublished = e => e.status !== 'draft';                                  // a draft is the entry nobody has released yet: it never reaches the file
  const clSort = (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.created || '').localeCompare(String(a.created || ''));
  const CL_CSS = `:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0a0a0b;color:#f4f4f5;font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:56px 20px 80px}
header h1{margin:0;font-size:clamp(32px,6vw,56px);font-weight:800;letter-spacing:-.02em}
header p{margin:12px 0 0;color:#8b8b95;font-size:18px}
header{border-bottom:1px solid #26262b;padding-bottom:32px;margin-bottom:8px}
article{display:grid;grid-template-columns:170px 1fr;gap:24px;padding:32px 0;border-bottom:1px solid #26262b}
article:last-child{border-bottom:0}
.when{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.when time{color:#8b8b95;font-size:14px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.ver{display:inline-block;padding:2px 9px;border-radius:999px;background:#d9ff3d;color:#121400;font-size:12px;font-weight:700;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
h2{margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em}
.tags{margin:10px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.tag{padding:2px 9px;border-radius:999px;border:1px solid #333339;color:#8b8b95;font-size:12px;font-weight:600}
.body{margin-top:12px;overflow-wrap:break-word}
.body>:first-child{margin-top:0}.body>:last-child{margin-bottom:0}
.body p{margin:10px 0}.body ul,.body ol{margin:10px 0;padding-left:22px}.body li{margin:4px 0}
.body h1,.body h2,.body h3,.body h4{font-size:18px;margin:18px 0 6px;font-weight:600}
.body a{color:#d9ff3d}
.body code{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;background:#161618;padding:1px 5px;border-radius:5px}
.body pre{background:#161618;border:1px solid #26262b;border-radius:8px;padding:12px;overflow:auto}.body pre code{background:none;padding:0}
.body blockquote{border-left:3px solid #d9ff3d;margin:10px 0;padding:2px 12px;color:#8b8b95}
.body img{max-width:100%;height:auto;border-radius:8px}
.body hr{border:0;border-top:1px solid #26262b;margin:16px 0}
.none{color:#8b8b95}
@media (max-width:640px){article{grid-template-columns:1fr;gap:10px}.when{flex-direction:row;align-items:center;gap:10px}}
@media print{body{background:#fff;color:#111}.ver{background:#111;color:#fff}.body a{color:#111}article,header{border-color:#ddd}.body code,.body pre{background:#f4f4f5}}`;
  function changelogHtml(entries, opts) {
    const o = opts || {};
    const title = String(o.title || '').trim() || 'Changelog';
    const loc = o.lang === 'ru' ? 'ru-RU' : 'en-GB';
    const long = iso => { const t = Date.parse(String(iso || '') + 'T00:00:00Z'); return isNaN(t) ? String(iso || '') : new Date(t).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }; // a date typed as free text is printed as it was typed, never as Invalid Date
    const list = (entries || []).filter(e => e && clPublished(e)).sort(clSort);
    const art = e => {
      const tags = clTags(e);
      return `<article>\n<div class="when"><time datetime="${esc(e.date || '')}">${esc(long(e.date))}</time>${e.version ? `<span class="ver">${esc(e.version)}</span>` : ''}</div>\n`
        + `<div class="what"><h2>${esc(e.title || '')}</h2>`
        + (tags.length ? `<p class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : '')
        + `<div class="body">${md(e.body || '')}</div></div>\n</article>`;
    };
    return `<!doctype html>\n<html lang="${o.lang === 'ru' ? 'ru' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n`
      + `<title>${esc(title)}</title>\n<meta name="description" content="${esc(String(o.subtitle || title))}">\n`
      + `<style>\n${CL_CSS}\n</style></head>\n<body><div class="wrap">\n<header><h1>${esc(title)}</h1>`
      + (String(o.subtitle || '').trim() ? `<p>${esc(o.subtitle)}</p>` : '') + `</header>\n<main>\n`
      + (list.length ? list.map(art).join('\n') : `<p class="none">${esc(String(o.empty || 'Nothing published yet.'))}</p>`)
      + `\n</main>\n</div></body></html>\n`;
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
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) { // same contract as h(), but in the SVG namespace: charts are drawn, not styled with divs
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }
  function download(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const readFile = (f, as) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; as === 'dataurl' ? r.readAsDataURL(f) : r.readAsText(f); });
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
    root.NOL_LANG = root.NOL_LANG || {};
    root.NOL_LANG.add = (l, d) => { const t = root.NOL_LANG[l] = root.NOL_LANG[l] || { exact: {}, patterns: [], pages: {} }; Object.assign(t.exact, d.exact || {}); t.patterns.push(...(d.patterns || [])); for (const [k, v] of Object.entries(d.pages || {})) t.pages[k] = Object.assign(t.pages[k] || {}, v); };
    const v = src.includes('?') ? '?' + src.split('?')[1] : '';
    const page = (location.pathname.match(/apps\/([a-z0-9-]+)\.html/) || [, (location.pathname.split('/').pop() || 'index.html').replace('.html', '')])[1];
    const s = document.createElement('script'); s.src = base + 'assets/lang/' + lang() + '.js' + v;
    const start = () => {
      document.documentElement.lang = lang(); translateNode(document.body); const v = tr(document.title); if (v) document.title = v;
      new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') { seen.delete(m.target); translateNode(m.target); } else m.addedNodes.forEach(translateNode); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    // per-app dictionary (assets/lang/<lang>/<app>.js, optional): parallel agents add strings without touching the shared file
    s.onload = () => { const a = document.createElement('script'); a.src = base + 'assets/lang/' + lang() + '/' + page + '.js' + v; a.onload = start; a.onerror = start; document.head.append(a); };
    document.head.append(s);
  }
  const langButton = () => h('button', { class: 'btn sm ghost', title: 'Language / Язык', onclick: () => setLang(lang() === 'ru' ? 'en' : 'ru') }, lang() === 'ru' ? 'EN' : 'RU');

  // Sidebar order and grouping live here: add a new app to its section, APPS derives from it. '' = no header (Factory, Trash).
  const SECTIONS = [
    ['Overview', [['home', 'Home'], ['dashboard', 'Dashboard']]],
    ['Clients', [['crm', 'CRM'], ['desk', 'Desk'], ['status', 'Status']]],
    ['Work', [['tasks', 'Tasks'], ['goals', 'Goals'], ['wiki', 'Wiki'], ['mindmaps', 'Mind maps'], ['helpcenter', 'Help center'], ['meetings', 'Meetings'], ['standups', 'Standups'], ['retros', 'Retros'], ['feedback', 'Feedback'], ['roadmap', 'Roadmap'], ['changelog', 'Changelog']]],
    ['People', [['people', 'People'], ['orgchart', 'Org chart'], ['reviews', 'Reviews'], ['leave', 'Leave'], ['hiring', 'Hiring'], ['onboarding', 'Onboarding'], ['timesheets', 'Time']]],
    ['Money', [['invoices', 'Invoices'], ['expenses', 'Expenses'], ['cashflow', 'Cash flow'], ['subscriptions', 'Subscriptions'], ['contracts', 'Contracts'], ['quotes', 'Quotes'], ['purchase', 'Purchase orders'], ['captable', 'Cap table']]],
    ['Resources', [['inventory', 'Inventory'], ['assets', 'Assets']]],
    ['', [['factory', 'Factory'], ['trash-history', 'Trash']]],
  ];
  const APPS = SECTIONS.flatMap(([, apps]) => apps);
  const ICONS = {
    home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z',
    dashboard: 'M3 4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM13 4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1zM13 13a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1zM3 16a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
    crm: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    desk: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M4.9 19.1l4.2-4.2',
    people: 'M20 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM9 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 18a4 4 0 0 1 8 0M15 10h4M15 14h4',
    orgchart: 'M9 2h6v5H9zM2 17h6v5H2zM16 17h6v5h-6zM12 7v6M5 13h14M5 13v4M19 13v4',
    hiring: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M19 8v6M22 11h-6',
    onboarding: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM8 13l2.5 2.5L16 10',
    leave: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    wiki: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM9 7h7M9 11h5',
    helpcenter: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    meetings: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h3M8 18h6',
    tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    goals: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    quotes: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.8zM7.5 7.5h.01M11 11l4 4',
    standups: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5',
    retros: 'M3 4h18v16H3zM9 4v16M15 4v16M5.5 8h2M11.5 8h2M17.5 8h2M5.5 12h2M11.5 12h2',
    invoices: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    contracts: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM15 2v5h5M8 12h5M8 16c1.4-1.4 2.6.9 4 0s2-1.4 3-1',
    expenses: 'M2 7h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 11h20M6 16h4M2 7l2-3h16l2 3',
    cashflow: 'M3 3v16a2 2 0 0 0 2 2h16M7 15l4-5 3 3 5-7M19 6h2v2',
    inventory: 'M21 8.2v7.6a1 1 0 0 1-.5.9l-8 4.4a1 1 0 0 1-1 0l-8-4.4a1 1 0 0 1-.5-.9V8.2a1 1 0 0 1 .5-.9l8-4.4a1 1 0 0 1 1 0l8 4.4a1 1 0 0 1 .5.9zM3.3 7.7L12 12.5l8.7-4.8M12 21.9V12.5M7.5 5.1l8.8 4.8',
    subscriptions: 'M3 12a9 9 0 0 1 15.4-6.4M21 12a9 9 0 0 1-15.4 6.4M18.4 2.6v3h-3M5.6 21.4v-3h3M12 8v4.3l2.6 1.5',
    assets: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10H4zM2 19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1H2zM10 8h4',
    timesheets: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3.5 2',
    factory: 'M2 21h20M4 21V10l6 4V10l6 4V10l4 2.6V21M9 21v-4h3v4M7 7V3h2v4',
    'trash-history': 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
    status: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM3 12h4l2.5-5 4 10 2.5-5h5',
    roadmap: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
    reviews: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    changelog: 'M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM14.5 8.5a5 5 0 0 1 0 7M17.5 5.5a9 9 0 0 1 0 13',
    purchase: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    captable: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 2v10l8.7 5M12 12L4 8',
    feedback: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 13V7M9.5 9.5L12 7l2.5 2.5',
    mindmaps: 'M3 9h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM9 12h2a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2M9 12h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2M16 4h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM16 16h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  };
  const icon = k => svg('svg', { viewBox: '0 0 24 24' }, svg('path', { d: ICONS[k] || ICONS.home }));
  function wsButton() {
    const dot = h('i'), lbl = h('span'); const b = h('div', { class: 'ws', onclick: syncDialog }, dot, lbl);
    const paint = () => { if (!sync.on()) { dot.style.background = 'var(--dim)'; lbl.textContent = t('Local workspace · click to sync'); b.title = t('Share this workspace with your team through a private GitHub repository you own'); return; } dot.style.background = { ok: 'var(--ok)', syncing: 'var(--amber)', error: 'var(--red)' }[sync.status] || 'var(--dim)'; lbl.textContent = sync.cfg.repo; b.title = sync.err || (sync.last ? t('Synced') + ' ' + new Date(sync.last).toLocaleTimeString() : t('Connected')); };
    window.addEventListener('nol:sync', paint); paint(); return b;
  }
  const classicToken = v => /^ghp_/.test(v) || /^[0-9a-f]{40}$/.test(v); // github_pat_… = fine-grained; ghp_/40-hex = classic, account-wide
  function syncDialog() {
    let dlg = document.getElementById('nol-sync'); if (!dlg) { dlg = h('dialog', { id: 'nol-sync' }); document.body.append(dlg); }
    const join = (location.hash.match(/join=([^&]+)/) || [])[1] || '';
    if (!sync.on()) {
      const warn = h('p', { class: 'mute', style: 'font-size:13px;margin-top:6px;color:var(--amber);display:none' }, 'This looks like a classic token: its “repo” scope opens every repository your account can reach. It will work, but a fine-grained token limited to the workspace repository is safer.');
      const tok = h('input', { class: 'input', type: 'password', placeholder: 'github_pat_… paste the token here', autocomplete: 'off', oninput: () => { warn.style.display = classicToken(tok.value.trim()) ? '' : 'none'; } });
      const repo = h('input', { class: 'input', placeholder: 'owner/nol-data · leave empty to create one for you', value: join ? decodeURIComponent(join) : '' });
      const btn = h('button', { class: 'btn acid' }, 'Connect');
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: async e => { e.preventDefault(); if (!tok.value.trim()) return; btn.disabled = true; btn.textContent = 'Connecting…'; try { await sync.connect(tok.value, repo.value, !join); toast('Connected. This workspace now syncs through ' + sync.cfg.repo); dlg.close(); emit('nol:change'); } catch (err) { sync.cfg = null; sync.saveCfg(); alert(err.message); btn.disabled = false; btn.textContent = 'Connect'; } } },
        h('h3', {}, join ? 'Join your team workspace' : 'Team sync, through your own GitHub'),
        h('p', { class: 'mute', style: 'margin-bottom:14px' }, 'Your workspace becomes a private repository you own. Everyone you invite works on the same contacts, tickets, people, pages and tasks. History, backups and access control come from GitHub. Nothing passes through NOL. Free.'),
        h('div', { class: 'field' }, h('label', { class: 'f' }, '1 · GitHub token'),
          h('p', { class: 'mute', style: 'font-size:13px;margin-bottom:6px' }, h('a', { class: 'acid', href: 'https://github.com/settings/personal-access-tokens/new?name=NOL+team+sync&description=NOL+team+sync&contents=write', target: '_blank', rel: 'noopener' }, 'Create a fine-grained token on GitHub →'), ' It will only reach your workspace repository.'),
          h('ol', { class: 'mute', style: 'font-size:13px;margin:0 0 6px;padding-left:18px' },
            h('li', {}, 'Repository access: “Only select repositories” → your workspace repository. No repository yet? Create a private one on GitHub first.'),
            h('li', {}, 'Repository permissions: “Contents” is preselected to “Read and write”.'),
            h('li', {}, 'Generate, copy, paste the token below. It is stored only in this browser.')),
          tok, warn),
        h('div', { class: 'field' }, h('label', { class: 'f' }, '2 · Repository'), repo, join && h('p', { class: 'mute', style: 'font-size:13px;margin-top:6px' }, 'Your teammate invited you to this repository. Accept the GitHub invitation first if you have not.')),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => dlg.close() }, 'Cancel'), btn)));
    } else {
      const user = h('input', { class: 'input', placeholder: 'github username' });
      const revoke = 'https://github.com/settings/' + (classicToken(sync.cfg.token) ? 'tokens' : 'personal-access-tokens'); // where this token lives on GitHub
      dlg.replaceChildren(h('form', { method: 'dialog', onsubmit: e => e.preventDefault() },
        h('h3', {}, 'Team workspace'),
        h('p', { class: 'mute' }, 'Repository ', h('a', { class: 'acid', href: 'https://github.com/' + sync.cfg.repo, target: '_blank', rel: 'noopener' }, sync.cfg.repo), ' · signed in as ', h('b', {}, sync.cfg.user), h('br'), sync.err ? h('span', { style: 'color:var(--red)' }, sync.err) : sync.last ? 'Last sync ' + new Date(sync.last).toLocaleTimeString() : 'Connected'),
        classicToken(sync.cfg.token) && h('p', { class: 'mute', style: 'font-size:13px;margin-top:8px;color:var(--amber)' }, 'This connection uses a classic token, which is not limited to the workspace repository. It keeps working, but a fine-grained token with access to just this repository is safer: create one and reconnect.'),
        h('div', { class: 'field', style: 'margin-top:16px' }, h('label', { class: 'f' }, 'Invite a teammate'), h('div', { class: 'row' }, user, h('button', { type: 'button', class: 'btn', onclick: async () => { if (!user.value.trim()) return; try { await sync.invite(user.value); toast(`Invited ${user.value}. Send them the join link.`); user.value = ''; } catch (err) { alert(err.message); } } }, 'Invite'))),
        h('p', { class: 'mute', style: 'font-size:13px;margin-top:8px' }, 'They accept the GitHub invitation, open the join link, paste their own token. Done.'),
        h('div', { class: 'actions', style: 'justify-content:space-between' },
          h('button', { type: 'button', class: 'btn ghost danger', onclick: () => { if (!confirm(t('Disconnect? Local data stays in this browser.'))) return; sync.disconnect(); dlg.close(); if (confirm(t('Also revoke the token on GitHub? This opens the token settings page — delete the NOL token there.'))) window.open(revoke, '_blank', 'noopener'); } }, 'Disconnect'),
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
      SECTIONS.map(([label, apps]) => [
        label ? h('div', { class: 'sec' }, label) : null,
        apps.map(([k, n]) => h('a', { class: 'item' + (k === active ? ' on' : ''), href: base + 'apps/' + k + '.html' }, icon(k), h('span', {}, n))),
      ]),
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
    const main = document.querySelector('main.app'); // every app rebuilds main with replaceChildren on each render, so put the strip back whenever it is swept away
    if (main) { const strip = todayStrip(); main.prepend(strip); new MutationObserver(() => { if (strip.parentNode !== main) main.prepend(strip); }).observe(main, { childList: true }); }
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
  function bars(items, fmt = String, scale) { const max = Math.max(1, +scale || 0, ...items.map(i => +i.value || 0)); return h('div', { class: 'bars' }, items.map(i => h('div', { class: 'bar' }, h('span', { class: 'lbl', title: i.label }, i.label), h('div', { class: 'trk' }, h('div', { class: 'fil', style: `width:${Math.round((+i.value || 0) / max * 100)}%;background:${i.color || 'var(--acid)'}` })), h('span', { class: 'val' }, fmt(i.value || 0))))); }
  function cols(items, fmt = String) { const max = Math.max(1, ...items.map(i => +i.value || 0)); return h('div', { class: 'cols' }, items.map(i => h('div', { class: 'c', title: `${i.label}: ${fmt(i.value || 0)}` }, h('b', { class: i.dim ? 'dim' : '', style: `height:${Math.max(2, Math.round((+i.value || 0) / max * 100))}%` }), h('small', {}, i.label)))); }
  /* ---------- sparkline: a metric read as a shape. One reading is a flat line, a flat series runs through the middle, not along the floor ---------- */
  function sparkPath(values, w = 100, h = 28) {
    const v = (values || []).map(n => +n || 0);
    if (!v.length) return '';
    const lo = Math.min(...v), hi = Math.max(...v);
    const y = n => +(hi === lo ? h / 2 : h - (n - lo) / (hi - lo) * h).toFixed(2);
    if (v.length === 1) return `M0 ${y(v[0])}L${w} ${y(v[0])}`;                  // a single reading is a flat line: a lone point draws nothing
    const step = w / (v.length - 1);
    return v.map((n, i) => `${i ? 'L' : 'M'}${+(i * step).toFixed(2)} ${y(n)}`).join('');
  }
  function spark(values, o = {}) {
    const d = sparkPath(values, 100, 28);
    return svg('svg', { class: 'spark', viewBox: '0 0 100 28', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      d ? svg('path', { d, fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', style: 'stroke:' + (o.color || 'var(--acid)') }) : null); // non-scaling-stroke: the box is stretched to the card, the line keeps its weight
  }
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

  /* ---------- timeline: everything that happened around a contact or a company, newest first ---------- */
  const KINDS = { note: ['Note', ''], deal: ['Deal', 'blue'], ticket: ['Ticket', 'amber'], invoice: ['Invoice', 'ok'] };
  function timeline(coll, ref) {
    const evs = activity(coll, ref);
    return h('div', { class: 'tline' },
      h('label', { class: 'f' }, 'Timeline'),
      evs.length ? h('div', { class: 'lst' }, evs.map(e => {
        const [label, cls] = KINDS[e.kind];
        return h(e.url ? 'a' : 'div', Object.assign({ class: 'e' }, e.url ? { href: e.url } : {}),
          h('span', { class: 'badge ' + cls }, t(label)),
          h('b', {}, e.title || '—'),
          e.sub && h('span', { class: 'mute' }, e.sub), // a stage or a status stays its own text node, so the Russian dictionary still finds it
          e.amount ? h('span', { class: 'mute mono' }, money(e.amount, 0)) : null,
          h('span', { class: 'ts mono dim' }, fmtDate(e.t)));
      })) : h('p', { class: 'mute' }, 'Nothing yet. Notes, deals, tickets and invoices show up here.'));
  }

  /* ---------- files: attachments on any record, shared by every app. With Team sync the bytes live in the workspace repository under files/<collection>/<record id>/; without it, small files stay in this browser as data URLs. ---------- */
  const MAX_FILE = 25 * 1024 * 1024, MAX_LOCAL = 1024 * 1024;
  const fmtSize = n => { n = +n || 0; return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; };
  const safeName = n => String(n).replace(/[^\p{L}\p{N}.\-_]+/gu, '_').replace(/^[._]+/, '').slice(-80) || 'file';
  const filePath = (coll, ref, fid, name) => `files/${coll}/${ref}/${String(fid).slice(0, 8)}-${safeName(name)}`;
  const isImage = f => /^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name || '');
  const isPdf = f => (f.type || '') === 'application/pdf' || /\.pdf$/i.test(f.name || '');
  function b64ToBlob(b64, type) { const bin = atob(String(b64).replace(/\s+/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: type || 'application/octet-stream' }); }
  async function attach(coll, ref, file) {
    if (file.size > MAX_FILE) throw new Error(t('That file is larger than 25 MB. Attach a smaller one.'));
    if (!sync.on() && file.size > MAX_LOCAL) throw new Error(t('Without Team sync a file has to stay under 1 MB, because it is kept inside this browser. Turn on Team sync to attach files up to 25 MB.'));
    const b64 = (await readFile(file, 'dataurl')).split(',').pop();
    const meta = { id: id(), coll, ref, name: file.name, size: file.size, type: file.type || '' };
    if (!sync.on()) return store.add('files', Object.assign(meta, { data: 'data:' + (file.type || 'application/octet-stream') + ';base64,' + b64 }));
    const path = filePath(coll, ref, meta.id, file.name);
    const res = await sync.api('PUT', `/repos/${sync.cfg.repo}/contents/${path}`, { message: `nol: file ${safeName(file.name)}`, content: b64, branch: sync.cfg.branch });
    return store.add('files', Object.assign(meta, { path, sha: res.content.sha }));
  }
  async function fileBlob(f) {
    if (f.data) return b64ToBlob(String(f.data).split(',').pop(), f.type);
    if (!f.sha) throw new Error(t('This file has no content stored.'));
    if (!sync.on()) throw new Error(t('This file lives in the workspace repository. Turn on Team sync to open it.'));
    const r = await sync.api('GET', `/repos/${sync.cfg.repo}/git/blobs/${f.sha}`); // blob by sha: works for any size the contents API refuses to inline
    return b64ToBlob(r.content, f.type);
  }
  function previewDialog(f, blob) {
    let dlg = document.getElementById('nol-file');
    if (!dlg) { dlg = h('dialog', { id: 'nol-file', class: 'filedlg', onclick: e => { if (e.target === dlg) dlg.close(); } }); document.body.append(dlg); }
    const url = URL.createObjectURL(isImage(f) ? blob : new Blob([blob], { type: 'application/pdf' })); // a blob: URL runs in this origin, so the iframe never gets a file the browser would treat as HTML
    dlg.replaceChildren(h('div', { class: 'bd' },
      h('div', { class: 'row between' }, h('b', { 'data-notranslate': true }, f.name),
        h('span', { class: 'row' }, h('a', { class: 'btn sm', href: url, download: f.name }, 'Download'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => dlg.close() }, 'Close'))),
      isImage(f) ? h('img', { src: url, alt: f.name }) : h('iframe', { src: url, title: f.name })));
    dlg.addEventListener('close', () => URL.revokeObjectURL(url), { once: true });
    dlg.showModal();
  }
  async function openFile(f, forceDownload) {
    let blob; try { blob = await fileBlob(f); } catch (e) { alert(e.message); return; }
    if (!forceDownload && (isImage(f) || isPdf(f))) return previewDialog(f, blob);
    const url = URL.createObjectURL(blob); h('a', { href: url, download: f.name }).click(); setTimeout(() => URL.revokeObjectURL(url), 20000);
  }
  function filesPanel(coll, ref) {
    const wrap = h('div', { class: 'files', ondragover: e => { e.preventDefault(); wrap.classList.add('over'); }, ondragleave: () => wrap.classList.remove('over'), ondrop: e => { e.preventDefault(); wrap.classList.remove('over'); add([...e.dataTransfer.files]); } });
    const busy = h('span', { class: 'mute', style: 'font-size:13px' });
    const input = h('input', { type: 'file', multiple: true, class: 'hidden', onchange: () => { const fs = [...input.files]; input.value = ''; add(fs); } });
    async function add(list) {
      let ok = 0;
      for (const f of list) {
        busy.textContent = t('Attaching…');
        try { await attach(coll, ref, f); ok++; } catch (e) { alert(/quota/i.test(e.name + ' ' + e.message) ? t('This browser is out of storage. Turn on Team sync to keep files in your own repository instead.') : e.message); }
      }
      busy.textContent = ''; if (ok) toast(t('Attached.')); paint();
    }
    function paint() {
      const list = live('files').filter(f => f.coll === coll && f.ref === ref).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
      wrap.replaceChildren(
        h('label', { class: 'f' }, 'Files'),
        list.length ? h('div', { class: 'lst' }, list.map(f => h('div', { class: 'r' },
          h('span', { class: 'ic', 'data-notranslate': true }, isImage(f) ? 'IMG' : isPdf(f) ? 'PDF' : ((String(f.name).match(/\.([a-z0-9]{1,4})$/i) || [, '·'])[1]).toUpperCase()),
          h('button', { type: 'button', class: 'nm', 'data-notranslate': true, title: f.name, onclick: () => openFile(f) }, f.name),
          h('span', { class: 'm', 'data-notranslate': true }, fmtSize(f.size)),
          h('span', { class: 'ops' },
            h('button', { type: 'button', class: 'btn sm ghost', onclick: () => openFile(f, true) }, 'Download'),
            h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => { if (confirm(t('Remove this file from the record?'))) { store.remove('files', f.id); paint(); } } }, 'Remove'))))) // ponytail: tombstone only, so Trash can restore it; the blob stays in the repository, where git history would keep it anyway
          : h('p', { class: 'mute', style: 'font-size:13px' }, 'No files yet. Drop them here or attach them.'),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn sm', onclick: () => input.click() }, 'Attach files'), input, busy),
        h('p', { class: 'mute', style: 'font-size:12px;margin-top:6px' }, sync.on() ? 'Up to 25 MB per file, kept in your workspace repository.' : 'Up to 1 MB per file, kept in this browser only. Turn on Team sync for files up to 25 MB in your own repository.'));
    }
    paint(); return wrap;
  }

  /* ---------- standups: which answer is a blocker. "Nothing" written under the blockers question is not a blocker, and neither is an empty line. ---------- */
  const BLOCKER_Q = /block|impedim|stuck|in the way|need help|help needed|блок|мешает|мешало|застр|препятств|помощ/i;
  const NO_BLOCKER = /^(no|none|nope|nothing|n\/?a|nil|all good|all clear|nothing yet|-+|—+|нет|ничего|нету|всё ок|все ок|всё хорошо|без блокеров|нет блокеров)[.!]*$/i;
  function standupBlocker(questions, answers) {                                 // the text of the blocker, or '' when nobody is stuck
    const qs = questions || [], as = answers || [];
    for (let i = 0; i < qs.length; i++) {
      if (!BLOCKER_Q.test(String(qs[i] || ''))) continue;
      const a = String(as[i] ?? '').trim();
      if (a && !NO_BLOCKER.test(a)) return a;
    }
    return '';
  }

  /* ---------- status page: component states, incidents with a timeline, and one static file the whole world can read without NOL ---------- */
  const COMPONENT_STATES = ['operational', 'degraded', 'partial', 'major', 'maintenance'];
  const INCIDENT_STATES = ['investigating', 'identified', 'monitoring', 'resolved'];
  const INCIDENT_IMPACTS = ['none', 'minor', 'major', 'critical'];
  const STATUS_LABEL = { operational: 'Operational', degraded: 'Degraded performance', partial: 'Partial outage', major: 'Major outage', maintenance: 'Under maintenance', incident: 'Incident in progress', investigating: 'Investigating', identified: 'Identified', monitoring: 'Monitoring', resolved: 'Resolved' };
  const IMPACT_LABEL = { none: 'No impact', minor: 'Minor', major: 'Major', critical: 'Critical' }; // an incident of major impact is not the same sentence as a component in major outage: its own words, or Russian reads «crash» where it means «serious»
  const STATUS_TONE = { operational: 'ok', maintenance: 'blue', incident: 'amber', degraded: 'amber', partial: 'amber', major: 'red', investigating: 'red', identified: 'amber', monitoring: 'blue', resolved: 'ok' };
  const STATUS_RANK = { operational: 0, maintenance: 1, incident: 2, degraded: 3, partial: 4, major: 5 }; // planned maintenance is not an outage; an open incident nobody has mapped to a component still beats "all systems operational"
  const STATUS_BANNER = { operational: 'All systems operational', maintenance: 'Maintenance in progress', incident: 'Incident in progress', degraded: 'Degraded performance', partial: 'Partial outage', major: 'Major outage' };
  const incidentOpen = i => !!i && i.status !== 'resolved';
  function statusOverall(components, incidents) {
    let worst = 'operational';
    for (const c of components || []) if ((STATUS_RANK[c && c.status] || 0) > STATUS_RANK[worst]) worst = c.status;
    if (worst === 'operational' && (incidents || []).some(incidentOpen)) return 'incident';
    return worst;
  }
  const statusUpdates = i => (Array.isArray(i && i.updates) ? i.updates : []).slice().sort((a, b) => String(b.t || '').localeCompare(String(a.t || ''))); // newest first, the way a status page reads

  const STATUS_CSS = `:root{--bg:#0d0f0c;--card:#151812;--line:#252a20;--fg:#eef2e6;--mute:#9aa392;--acid:#d9ff3d;--ok:#3ddc84;--amber:#ffb84d;--red:#ff5a5f;--blue:#6aa7ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:40px 20px 64px}
h1{font-size:26px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--mute);margin:34px 0 12px}h3{font-size:17px;margin:0 0 4px}
.up{color:var(--mute);font-size:13px;margin:6px 0 0}
.banner{margin:22px 0 0;padding:18px 20px;border-radius:14px;border:1px solid var(--line);background:var(--card);font-size:20px;font-weight:600}
.banner.ok{border-color:rgba(61,220,132,.45);color:var(--ok)}.banner.amber{border-color:rgba(255,184,77,.45);color:var(--amber)}
.banner.red{border-color:rgba(255,90,95,.45);color:var(--red)}.banner.blue{border-color:rgba(106,167,255,.45);color:var(--blue)}
.grp{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:4px 18px;margin-bottom:12px}
.grp .gh{color:var(--mute);font-size:13px;padding:12px 0 4px;font-weight:600}
.c{display:flex;gap:14px;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--line)}
.c:last-child{border-bottom:0}.c .n{font-weight:600}.c .d{color:var(--mute);font-size:13px;flex:1}
.st{margin-left:auto;font-size:13px;font-weight:600;white-space:nowrap}
.st.ok{color:var(--ok)}.st.amber{color:var(--amber)}.st.red{color:var(--red)}.st.blue{color:var(--blue)}
.inc{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:18px;margin-bottom:12px}
.inc .meta{color:var(--mute);font-size:13px;margin:0 0 10px}
.tl{list-style:none;margin:0;padding:0;border-left:2px solid var(--line);padding-left:16px}
.tl li{margin-bottom:14px}.tl li:last-child{margin-bottom:0}
.tl b{color:var(--acid);font-size:13px;text-transform:uppercase;letter-spacing:.05em}
.tl time{color:var(--mute);font-size:13px;margin-left:8px}
.tl p{margin:4px 0 0;white-space:pre-wrap}
footer{margin-top:44px;color:var(--mute);font-size:13px;border-top:1px solid var(--line);padding-top:16px}
footer a{color:var(--acid)}`;

  // One file, no scripts, no requests: drop it in a repository and GitHub Pages serves your status page.
  function statusPage(opts) {
    const o = opts || {}, comps = o.components || [], incs = o.incidents || [];
    const ru = lang() === 'ru', loc = ru ? 'ru-RU' : 'en-GB';
    const when = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString(loc, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    const T = k => esc(t(STATUS_LABEL[k] || k || ''));
    const open = incs.filter(incidentOpen), past = incs.filter(i => !incidentOpen(i));
    const overall = statusOverall(comps, incs);
    const groups = [];
    for (const c of comps) { const g = String(c.group || ''); const f = groups.find(x => x[0] === g); f ? f[1].push(c) : groups.push([g, [c]]); }
    const inc = i => `<article class="inc"><h3>${esc(i.title || t('Incident'))}</h3>`
      + `<p class="meta">${T(i.status || 'investigating')}${i.impact && i.impact !== 'none' ? ' · ' + esc(t(IMPACT_LABEL[i.impact] || i.impact)) : ''}${i.started ? ' · ' + esc(when(i.started)) : ''}${(i.componentIds || []).length ? ' · ' + esc(comps.filter(c => (i.componentIds || []).includes(c.id)).map(c => c.name).join(', ')) : ''}</p>`
      + (statusUpdates(i).length ? `<ol class="tl">${statusUpdates(i).map(u => `<li><b>${T(u.status || i.status)}</b><time>${esc(when(u.t))}</time><p>${esc(u.text || '')}</p></li>`).join('')}</ol>` : '')
      + `</article>`;
    return `<!doctype html><html lang="${ru ? 'ru' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
      + `<title>${esc(o.title || t('Status'))}</title><meta name="description" content="${esc(t(STATUS_BANNER[overall]))}"><style>${STATUS_CSS}</style></head><body><div class="wrap">`
      + `<h1>${esc(o.title || t('Status'))}</h1><p class="up">${esc(t('Updated'))} ${esc(when(o.at || Date.now()))}</p>`
      + `<div class="banner ${STATUS_TONE[overall] || ''}">${esc(t(STATUS_BANNER[overall]))}</div>`
      + (open.length ? `<h2>${esc(t('Active incidents'))}</h2>${open.map(inc).join('')}` : '')
      + (comps.length ? `<h2>${esc(t('Components'))}</h2>` + groups.map(([g, list]) => `<div class="grp">${g ? `<div class="gh">${esc(g)}</div>` : ''}`
        + list.map(c => `<div class="c"><span class="n">${esc(c.name || '')}</span>${c.description ? `<span class="d">${esc(c.description)}</span>` : ''}<span class="st ${STATUS_TONE[c.status] || 'ok'}">${T(c.status || 'operational')}</span></div>`).join('') + `</div>`).join('') : '')
      + (past.length ? `<h2>${esc(t('Past incidents'))}</h2>${past.map(inc).join('')}` : '')
      + `<footer>${esc(t('This page is a single static file. No trackers, no scripts, no subscription.'))} <a href="https://github.com/murik0995-web/nol">NOL</a></footer>`
      + `</div></body></html>`;
  }

  /* ---------- reminders: what needs you today, computed from tasks, invoices and time off. No server: the open tab is the alarm clock. Snooze and "already told you" stay in this browser, like recents — what you dismissed is not the team's business. ---------- */
  const SNOOZE_KEY = 'nol.snooze', TOLD_KEY = 'nol.told';
  const day = (at = Date.now()) => new Date(at).toISOString().slice(0, 10); // the same day boundary every other app in NOL compares against
  const doneStatus = s => /done|complete|closed|shipped|finished|resolved/i.test(s || '');
  function reminders(at = Date.now()) {
    const t0 = day(at), out = [];
    for (const x of live('tasks')) {
      if (doneStatus(x.status) || !x.due || x.due > t0) continue;
      out.push({ key: 'task:' + x.id, tone: x.due < t0 ? 'red' : 'amber', label: x.due < t0 ? 'overdue' : 'today', title: x.title || 'Task', sub: x.assignee || '', url: 'tasks.html#open=' + x.id });
    }
    for (const x of live('invoices')) if (invOverdue(x, t0)) out.push({ key: 'invoice:' + x.id, tone: 'red', label: 'invoice', title: x.number || 'Invoice', sub: x.billto || '', url: 'invoices.html#open=' + x.id });
    for (const x of live('subscriptions')) if (x.status !== 'cancelled' && x.renewal === t0) out.push({ key: 'sub:' + x.id, tone: 'amber', label: 'renewal', title: x.tool || '', sub: x.owner || '', url: 'subscriptions.html#open=' + x.id });
    for (const x of live('contracts')) { const d = contractDue(x, t0); if (d) out.push({ key: 'contract:' + x.id + ':' + d, tone: d === 'expires' ? 'red' : 'amber', label: d, title: x.title || 'Contract', sub: (store.get('companies', x.counterpartyId) || {}).name || '', url: 'contracts.html#open=' + x.id }); }
    for (const x of live('assets')) if (x.status !== 'retired' && x.warranty === t0) out.push({ key: 'asset:' + x.id, tone: 'amber', label: 'warranty', title: x.name || x.tag || '', sub: x.person || '', url: 'assets.html#open=' + x.id });
    for (const x of live('cycles')) if (!x.closed && x.due === t0) out.push({ key: 'cycle:' + x.id, tone: 'amber', label: 'review', title: x.name || 'Review cycle', sub: '', url: 'reviews.html#cycle=' + x.id });
    for (const x of live('meetings')) if (x.date === t0) out.push({ key: 'meeting:' + x.id, tone: 'blue', label: 'meeting', title: x.title || '', sub: (x.attendees || []).join(', '), url: 'meetings.html#open=' + x.id });
    for (const x of live('timeoff')) if (x.status === 'approved' && x.from === t0) out.push({ key: 'timeoff:' + x.id, tone: 'blue', label: 'time off', title: x.person || '', sub: x.type || '', url: 'people.html#timeoff' });
    const rank = { red: 0, amber: 1, blue: 2 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }
  const kept = k => { try { const m = JSON.parse(localStorage.getItem(k) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } };
  function keep(k, key, t0) { const m = Object.fromEntries(Object.entries(kept(k)).filter(([, d]) => d >= t0)); m[key] = t0; try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) { } } // yesterday's entries are dropped on every write, so neither map grows
  const notifiable = () => typeof Notification !== 'undefined' && typeof window !== 'undefined';
  function notifyDue(list) {
    if (!notifiable() || Notification.permission !== 'granted' || !list.length) return;
    const t0 = day(), told = kept(TOLD_KEY), fresh = list.filter(r => told[r.key] !== t0);
    if (!fresh.length) return;
    for (const r of fresh) keep(TOLD_KEY, r.key, t0);
    const open = url => { window.focus(); location.href = activeBase + 'apps/' + url; };
    try {
      if (fresh.length > 3) { const n = new Notification(t(fresh.length + ' things need you today'), { body: fresh.slice(0, 3).map(r => r.title).join(' · '), tag: 'nol-today' }); n.onclick = () => open('home.html'); }
      else for (const r of fresh) { const n = new Notification(t(r.label) + ' · ' + r.title, { body: r.sub, tag: r.key }); n.onclick = () => open(r.url); }
    } catch (e) { } // some contexts refuse to construct one; the strip still shows everything
  }
  function todayStrip() {
    const box = h('div', { class: 'today' });
    function paint() {
      const t0 = day(), snoozed = kept(SNOOZE_KEY);
      const list = reminders().filter(r => snoozed[r.key] !== t0);
      notifyDue(list);
      box.hidden = !list.length; if (!list.length) return box.replaceChildren();
      const open = r => { const same = location.pathname.endsWith('/' + r.url.split('#')[0]); location.href = r.url; if (same) location.reload(); }; // the target page reads its hash on load, so a hash-only jump has to reload
      const kids = [h('span', { class: 'ttl' }, 'Today'),
        h('div', { class: 'items' }, list.slice(0, 6).map(r => h('span', { class: 'it' },
          h('span', { class: 'badge ' + r.tone }, r.label),
          h('a', { class: 'tt', href: r.url, title: r.sub || r.title, onclick: e => { e.preventDefault(); open(r); } }, r.title),
          h('button', { class: 'x', type: 'button', title: 'Hide until tomorrow', onclick: () => { keep(SNOOZE_KEY, r.key, t0); paint(); } }, '×'))))];
      if (list.length > 6) kids.push(h('a', { class: 'more', href: 'home.html' }, '+' + (list.length - 6) + ' more'));
      if (notifiable() && Notification.permission === 'default') kids.push(h('button', { class: 'btn sm ghost', type: 'button', title: 'Browser notifications for what is due. They arrive while a NOL tab is open — no server, no account.', onclick: () => { Notification.requestPermission().then(p => { if (p === 'granted') toast(t('Reminders on. They arrive while a NOL tab is open.')); paint(); }).catch(() => { }); } }, 'Notify me'));
      box.replaceChildren(...kids); // a plain append() would turn a null child into the text "null"
    }
    paint();
    window.addEventListener('nol:change', paint);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') paint(); }); // asleep since yesterday: repaint before the numbers are read
    setInterval(paint, 3e5); // ponytail: a 5 minute tick is enough for day-grained reminders; a timer to the next due date if minutes ever matter
    return box;
  }

  const CAPS = {
    crm: ['Contacts, companies and deals in one place', 'Deal pipeline with drag and drop and money per stage', 'Import from HubSpot, Pipedrive or Salesforce CSV', 'A requester in Desk and a client in Invoices are the same record', 'A client page per company: deals, tickets, invoices, tasks and notes together', 'Duplicate contacts found by email and phone, merged in one click', 'A timeline per contact and per company: notes, deals, tickets, invoices', 'Pipeline report: stage, owner, win rate, closed-won by month', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    desk: ['Tickets with threaded replies and internal notes', 'Priorities, statuses, assignees from People', 'Canned replies with variables, applied in one click', 'SLA targets per priority, breaches highlighted in red', 'Merge a duplicate ticket into the real one', 'Every ticket linked to its company page', 'Import from Zendesk or Freshdesk CSV', 'Files on any record: attachments in your own repository'],
    people: ['Reminders for what is due today, in your browser and nowhere else', 'Directory with teams and managers', 'Time-off requests approved in one click', 'Import from BambooHR, Gusto or Rippling CSV', 'Timestamped notes with @mentions on every record'],
    orgchart: ['The whole company as one chart, drawn from the Manager field in People', 'Collapse a branch to see the shape, expand it to see the names', 'Print the chart or save it as PDF, on one page', 'Everyone without a manager, with a manager nobody knows, or inside a loop, in one report', 'Search a name and see the line above and below it', 'Import from BambooHR, Gusto, Rippling, Pingboard, ChartHop, OrgChart Now or Organimi CSV', 'Export the reporting lines with a level and a headcount per person'],
    leave: ['A month calendar of who is off, built from the same time-off requests as People', 'Who is out today, above the month', 'Public holidays you keep yourself, marked on every calendar', 'Approve or decline a request without leaving the calendar', 'Export the whole year as .ics and subscribe in Google Calendar, Outlook or Apple Calendar', 'Import from Timetastic, Vacation Tracker, LeaveBoard or Calamari CSV', 'People come from People: one directory for the whole company'],
    onboarding: ['Checklist templates for new hires: a step, its owner and the day it is due', 'Due dates counted from the start date, so one template fits everybody', 'Progress per person: what is done, what is next, what is late', 'People come from People: their first day fills the start date by itself', 'Any open step becomes a real task in Tasks, with its owner and its date', 'Preparation before day one: a negative day is the week before they arrive', 'Import from Trainual, Enboarder, Sapling, Workable or Eddy CSV', 'Timestamped notes with @mentions on every onboarding'],
    hiring: ['Jobs and candidates in one place', 'Stage board with drag and drop, your own card order inside a column', 'Import from Greenhouse, Lever, Workable, Breezy HR, Recruitee or Teamtailor CSV', 'Stage names from your old ATS mapped onto the board automatically', 'Source on every candidate: where the hire came from', 'Resumes attached to the candidate, in your own repository', 'Timestamped notes with @mentions on every candidate', 'Hiring managers and recruiters come from People'],
    helpcenter: ['A public help center generated from your Wiki pages', 'Static HTML you can host anywhere: no server, no database, no build step', 'Search across every article, working from a file:// folder', 'Download the whole site as separate files, or as one self-contained HTML', 'Pick the Wiki folder to publish; subfolders become sections', 'Hide a draft page without deleting it', 'Links between wiki pages become links between articles', 'Import from Zendesk Guide, Help Scout Docs, HelpDocs or Intercom Articles CSV'],
    wiki: ['Markdown pages with folders and search', 'Internal links in double brackets, with autocomplete', 'Backlinks: every page that points here', 'A folder tree, drag a page to move it', 'Paste a screenshot straight into a page', 'Page history from your workspace repository', 'Import Notion or Confluence exports', 'Export everything as one file'],
    tasks: ['Reminders for what is due today, in your browser and nowhere else', 'Board and list, projects, assignees, due dates', 'Import Trello JSON or Asana, Jira, ClickUp, monday CSV', 'Overdue flags, drag between columns', 'Checklists inside a task, progress on the card', 'Your own card order inside a column, saved when you drag', 'Filter the board by assignee and by due date', 'Markdown in the description, with a live preview', 'Timeline: start and due dates as bars you drag to reschedule', 'Dependencies between tasks, drawn as arrows and flagged when one starts too early', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    meetings: ['An agenda before, Markdown notes during, decisions after', 'Attendees come from People', 'Every decision of every meeting in one log', 'Action items become real tasks in Tasks, with an owner and a due date', 'Import from Fellow, Hugo or Hypercontext CSV', 'Timestamped notes with @mentions on every meeting', 'Files on any record: attachments in your own repository'],
    goals: ['Objectives and key results, by quarter', 'Progress 0–100 on every key result, weighted rollup to the objective', 'On track, at risk or behind, against how much of the quarter is gone', 'Check-ins with a note, so the number has a reason', 'Owners come from People', 'Import from Perdoo, Weekdone, Profit.co, Quantive or Viva Goals CSV', 'Files on any record: attachments in your own repository'],
    quotes: ['Quotes and proposals built from your own price list', 'Line items, a discount in percent or in money, tax and totals', 'Statuses: draft, sent, accepted, declined, and expired on its own date', 'Every quote linked to its deal in CRM', 'An accepted quote becomes an invoice in one click', 'Print to PDF on the same paper as an invoice', 'Clients from CRM companies, workspace currency', 'Import from Qwilr, Proposify, Better Proposals, PandaDoc or Zoho CSV', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    standups: ['Async daily check-ins: your questions, answered when people have time', 'Who answered today and who is still to write, per standup', 'Blockers filter: only the people who are stuck, across every day', 'Full history by date and by person, searchable', 'Several standups at once, each with its own questions and participants', 'Participants come from People, blockers can become a task in Tasks', 'Import from Geekbot, Standuply, DailyBot, Range or Jell CSV', 'Timestamped notes with @mentions on every check-in'],
    retros: ['Retrospective boards: what went well, what to improve, what to do next', 'Votes on every card, so the loudest problem sorts to the top', 'Action items become real tasks in Tasks, with an owner from People', 'Archive a finished retro: every board you ever ran stays readable', 'Your own columns: a Start / Stop / Continue or Mad / Sad / Glad board keeps its own names', 'Import from Parabol, Retrium, EasyRetro, TeamRetro or Metro Retro CSV', 'Timestamped notes with @mentions on every card'],
    reviews: ['Performance review cycles with your own questions for the self review and for the manager', 'A rating on five steps, on both sides of the same form', 'Who has written and who is still to write, per cycle', 'History per person: every cycle, every rating, every 1:1', '1:1 notes in Markdown, kept as meetings so they sit in Meetings too', 'People, managers and participants come from People', 'Import from Lattice, 15Five, Culture Amp or Small Improvements CSV', 'Timestamped notes with @mentions on every review'],
    status: ['Components with a state each: operational, degraded, partial or major outage, maintenance', 'Incidents with a timeline: every update kept, newest first', 'One overall banner computed from the components and the open incidents', 'Generate a standalone status page: one static HTML file for GitHub Pages', 'The generated page carries no scripts, no trackers and no requests', 'Import from Statuspage, Instatus, Hund, Better Stack or Status.io CSV', 'Incident owners come from People', 'Timestamped notes with @mentions on every incident'],
    roadmap: ['Now, Next and Later on one board, dragged between lanes', 'Every item linked to a real task in Tasks, so a finished task ships the item', 'Publish a public roadmap as one static HTML file: no scripts, no tracking, upload it anywhere', 'Internal items stay internal: only what you tick is published', 'Themes and timeframes on every item, filtered in one click', 'Owners come from People', 'Import from ProductPlan, Roadmunk, Canny, airfocus or Productboard CSV', 'Timestamped notes with @mentions on every item', 'Files on any record: attachments in your own repository'],
    changelog: ['Product updates in Markdown, with a version and a date', 'Tags on every entry: Added, Improved, Fixed, or your own', 'Drafts stay private until you publish them', 'Publish a standalone HTML file: one file, no stylesheet, no scripts, nothing from the network', 'Drop that file on GitHub Pages or hand it to a customer as an attachment', 'Import from Headway, Beamer, LaunchNotes or AnnounceKit CSV', 'Timestamped notes with @mentions on every entry'],
    invoices: ['Reminders for what is due today, in your browser and nowhere else', 'Line items, tax, statuses, print to PDF', 'Payments, full or partial, with dates and method', 'Balance due on the paper, statuses follow the payments', 'Recurring invoices, monthly or quarterly, next draft on schedule', 'Bank details on the paper, numbering per year: 2026-0001', 'Clients from CRM companies, workspace currency', 'Import from FreshBooks, QuickBooks, Xero or Wave CSV', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    contracts: ['Reminders for what is due today, in your browser and nowhere else', 'Contract templates with {{placeholders}}, filled from CRM in one click', 'Counterparties are CRM companies, signatories are CRM contacts', 'Renewal and notice dates, flagged before the contract renews itself', 'Statuses: draft, sent, signed, terminated', 'The contract on paper: print it or save it as PDF', 'Import from PandaDoc, Concord, ContractSafe, Juro or DocuSign CLM CSV', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    cashflow: ['Recurring income and costs, one-off items, twelve months ahead', 'The runway: the month the cash runs out, and how far away it is', 'A chart of money in, money out and the balance after every month', 'Open invoices land in the month they are due, without typing them twice', 'Every subscription you pay for counted as a monthly cost', 'Clients and suppliers come from CRM, so a plan line knows who it is with', 'Import from Float, Pulse, Finmark, Agicap, Cashflow Frog or Dryrun CSV', 'Timestamped notes with @mentions on every plan line', 'Files on any record: attachments in your own repository'],
    expenses: ['Categories, merchants, payment methods, monthly totals', 'Bank or card statement CSV import', 'Refunds as negative amounts', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    inventory: ['Items with SKU, quantity, location and reorder level', 'Low-stock filter: everything at or below its reorder level, in one click', 'Every receipt, shipment and correction in a stock movements log', 'Import from Sortly, Zoho Inventory, inFlow, Katana or Cin7 Core CSV', 'Suppliers are CRM companies, people are People', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    assets: ['Every laptop, phone and monitor with its serial number and asset tag', 'Assigned to a person from People, checked back in when they leave it', 'Warranty end on every asset, expiring ones flagged 30 days ahead', 'Purchase date and cost, so the register doubles as a depreciation list', 'Import from Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory or Freshservice CSV', 'Suppliers are CRM companies, holders are People', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    subscriptions: ['Every tool you pay for: owner, seats, cost and renewal date', 'Renewals inside 30 days flagged before the money leaves', 'Monthly and yearly spend from any billing cycle, in one number', 'Paste a card statement and the tools in it are recognised', 'Import from Vendr, Zylo, Torii, Cledara, Spendflo or Sastrify CSV', 'Owners come from People, the NOL app that replaces a tool is one click away', 'Timestamped notes with @mentions on every record', 'Files on any record: attachments in your own repository'],
    timesheets: ['Start and stop a timer or add hours by hand', 'Weekly grid per person and project with day totals', 'Projects come from Tasks, people from People', 'Import from Toggl Track, Harvest or Clockify CSV'],
    dashboard: ['KPI tiles from every NOL app: pipeline, tickets, tasks, headcount, money', 'Pick the tiles you want, the choice is saved for the whole workspace', 'Metrics you keep by hand: a number a week, a sparkline of where it is going', 'Change against the previous reading, and against a target you set', 'Import from Databox, Geckoboard, Klipfolio, Grow, Cyfe or DashThis CSV', 'Owners come from People, every tile is one click from the app behind it', 'Timestamped notes with @mentions on every metric', 'Files on any record: attachments in your own repository'],
    factory: ['The conveyor live: agents at work, spend against today’s budget', 'The Factory board: queued, building, asking, review, done, blocked', 'Answer the conveyor’s question right on the card', 'QA reports from the tester agent on every shipped card', 'The public build journal, in your language'],
    captable: ['Every shareholder, share class and grant on one page', 'Ownership in percent, outstanding and fully diluted, recalculated as you type', 'The option pool: what is granted, what is still unallocated', 'Model the next round: pre-money, raise, pool top-up, price per share', 'Dilution per shareholder, before and after, before anybody signs', 'Save the modelled round and it becomes real holdings and a real round', 'Shareholders are People and CRM companies: one directory for the whole company', 'Import from Carta, Pulley, Ledgy, Cake Equity or Eqvista CSV', 'Timestamped notes with @mentions on every holding'],
    feedback: ['Every idea a customer asked for, sorted by how many asked', 'Votes recorded by the team: a number for the calls nobody wrote down, a name for the customers you know', 'Which customers are behind a request, so the loudest is not confused with the biggest', 'Statuses from open to planned, in progress, done or declined', 'An idea becomes a real task in Tasks and stays linked to it', 'Requesters are CRM contacts and companies: one directory for the whole company', 'Import from Canny, Nolt, Frill, Featurebase or UserVoice CSV', 'Timestamped notes with @mentions on every idea', 'Files on any record: attachments in your own repository'],
    purchase: ['Purchase orders to your vendors: line items, quantities and unit prices', 'An approval step before the money is committed: draft, pending, approved or rejected', 'Received quantities per line, so a part delivery is visible at a glance', 'Receiving a line raises the stock in Inventory and writes the movement itself', 'What is late: every approved order past its expected date, in red', 'Vendors are CRM companies, requesters and approvers are People', 'The order on paper: print it or save it as PDF and send it to the vendor', 'Import from Precoro, Procurify, Tradogram or Order.co CSV', 'Timestamped notes with @mentions on every order', 'Files on any record: attachments in your own repository'],
    mindmaps: ['A map that lays itself out: type a thought, press Tab, and the branches move over to make room', 'Enter for the next thought, Tab for one level in, Shift+Tab for one level out — the whole map from the keyboard', 'Drag a branch onto another node and the whole subtree moves with it', 'Collapse a branch to see the shape of the map, open it again to see the detail', 'Export the map as one SVG file: sharp at any size, no scripts, no fonts to fetch', 'A note on any node, for what does not fit on a branch', 'Any node becomes a real task in Tasks, in one click', 'Import an outline CSV from XMind, MindMeister, Coggle, MindManager or Mindomo', 'Timestamped notes with @mentions on every record'],
    'trash-history': ['Every deleted record from every app, in one place', 'Restore in one click, or purge forever', 'A change log for the whole workspace', 'Repository commits when Team sync is on'],
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
    candidates: { label: 'Candidate', title: r => r.name, sub: r => [r.stage, r.source].filter(Boolean).join(' · '), extra: r => [r.email, r.phone, r.source, r.stage, r.owner], url: r => 'hiring.html#open=' + r.id },
    jobs: { label: 'Job', title: r => r.title, sub: r => [r.dept, r.location].filter(Boolean).join(' · '), extra: r => [r.dept, r.location, r.owner, r.description], url: r => 'hiring.html#open=' + r.id },
    pages: { label: 'Page', title: r => r.title, sub: r => r.folder || '', extra: r => [r.folder, r.body], url: r => 'wiki.html#' + r.id },
    tasks: { label: 'Task', title: r => r.title, sub: r => [r.status, r.assignee].filter(Boolean).join(' · '), extra: r => [r.project, r.assignee, r.description], url: r => 'tasks.html#open=' + r.id },
    releases: { label: 'Update', title: r => r.title, sub: r => [r.version, r.status === 'draft' ? 'draft' : ''].filter(Boolean).join(' \u00b7 '), extra: r => [r.version, r.body, ...(Array.isArray(r.tags) ? r.tags : [])], url: r => 'changelog.html#open=' + r.id },
    mindmaps: { label: 'Mind map', title: r => r.title, sub: () => '', extra: r => mindNodes(r).map(n => n.text), url: r => 'mindmaps.html#open=' + r.id },
    quotes: { label: 'Quote', title: r => r.number || 'Quote', sub: r => [r.title, r.status].filter(Boolean).join(' · '), extra: r => [r.title, r.billto, r.status, r.notes], url: r => 'quotes.html#open=' + r.id },
    meetings: { label: 'Meeting', title: r => r.title, sub: r => [r.date, (r.attendees || []).join(', ')].filter(Boolean).join(' · '), extra: r => [(r.attendees || []).join(' '), r.agenda, r.notes, (r.decisions || []).join(' ')], url: r => 'meetings.html#open=' + r.id },
    invoices: { label: 'Invoice', title: r => r.number || 'Invoice', sub: r => [r.billto, r.status].filter(Boolean).join(' · '), extra: r => [r.billto, r.status], url: r => 'invoices.html#open=' + r.id },
    goals: { label: 'Goal', title: r => r.title, sub: r => [r.quarter, r.owner].filter(Boolean).join(' · '), extra: r => [r.owner, r.quarter, r.description], url: r => 'goals.html#open=' + r.id },
    items: { label: 'Item', title: r => r.name || r.sku, sub: r => [r.sku, r.location].filter(Boolean).join(' · '), extra: r => [r.sku, r.category, r.location, r.supplier], url: r => 'inventory.html#open=' + r.id },
    subscriptions: { label: 'Subscription', title: r => r.tool, sub: r => [r.cycle, r.owner].filter(Boolean).join(' · '), extra: r => [r.owner, r.cycle, r.notes], url: r => 'subscriptions.html#open=' + r.id },
    contracts: { label: 'Contract', title: r => r.title, sub: r => [r.status, (store.get('companies', r.counterpartyId) || {}).name].filter(Boolean).join(' · '), extra: r => [(store.get('companies', r.counterpartyId) || {}).name, r.status, r.owner, r.body], url: r => 'contracts.html#open=' + r.id },
    assets: { label: 'Asset', title: r => r.name || r.tag, sub: r => [r.serial, r.person].filter(Boolean).join(' · '), extra: r => [r.serial, r.tag, r.category, r.person, r.location, r.supplier], url: r => 'assets.html#open=' + r.id },
    checkins: { label: 'Check-in', title: r => r.person || 'Check-in', sub: r => [r.date, (store.get('standups', r.standupId) || {}).name].filter(Boolean).join(' · '), extra: r => [r.date, ...(r.answers || [])], url: r => 'standups.html#open=' + r.id },
    incidents: { label: 'Incident', title: r => r.title, sub: r => [STATUS_LABEL[r.status] || r.status, r.owner].filter(Boolean).join(' \u00b7 '), extra: r => [r.owner, r.impact, ...(Array.isArray(r.updates) ? r.updates.map(u => u.text) : [])], url: r => 'status.html#open=' + r.id },
    retrocards: { label: 'Retro card', title: r => r.text, sub: r => [r.col, (store.get('retros', r.retroId) || {}).name].filter(Boolean).join(' \u00b7 '), extra: r => [r.col, r.author, (store.get('retros', r.retroId) || {}).name], url: r => 'retros.html#open=' + r.id },
    reviews: { label: 'Review', title: r => r.person || 'Review', sub: r => [(store.get('cycles', r.cycleId) || {}).name, t(ratingLabel(r.rating))].filter(Boolean).join(' \u00b7 '), extra: r => [r.manager, ...(Array.isArray(r.self) ? r.self : []), ...(Array.isArray(r.mgr) ? r.mgr : [])], url: r => 'reviews.html#open=' + r.id },
    holdings: { label: 'Shareholder', title: r => r.holder, sub: r => [capClass(r.class), (store.get('rounds', r.roundId) || {}).name].filter(Boolean).join(' \u00b7 '), extra: r => [r.class, (store.get('rounds', r.roundId) || {}).name], url: r => 'captable.html#open=' + r.id },
    cashflow: { label: 'Cash flow', title: r => r.name, sub: r => [r.cycle, r.category].filter(Boolean).join(' \u00b7 '), extra: r => [r.category, r.party, r.notes], url: r => 'cashflow.html#open=' + r.id },
    roadmap: { label: 'Roadmap item', title: r => r.title, sub: r => [r.timeframe, r.area].filter(Boolean).join(' \u00b7 '), extra: r => [r.area, r.owner, r.timeframe, r.desc], url: r => 'roadmap.html#open=' + r.id },
    feedback: { label: 'Idea', title: r => r.title, sub: r => [FEEDBACK_LABEL[feedbackStatus(r.status)], r.area].filter(Boolean).join(' \u00b7 '), extra: r => [r.area, r.requester, r.company, r.desc, ...(Array.isArray(r.voters) ? r.voters : [])], url: r => 'feedback.html#open=' + r.id },
    metrics: { label: 'Metric', title: r => r.name, sub: r => [r.unit, r.owner].filter(Boolean).join(' \u00b7 '), extra: r => [r.owner, r.unit, r.target], url: r => 'dashboard.html#open=' + r.id },
    onboardings: { label: 'Onboarding', title: r => r.person, sub: r => [r.role, r.plan].filter(Boolean).join(' \u00b7 '), extra: r => [r.role, r.plan, ...(Array.isArray(r.items) ? r.items.map(x => x.title + ' ' + (x.owner || '')) : [])], url: r => 'onboarding.html#open=' + r.id },
    purchases: { label: 'Purchase order', title: r => r.number || 'Purchase order', sub: r => [(store.get('companies', r.vendorId) || {}).name, r.status].filter(Boolean).join(' \u00b7 '), extra: r => [(store.get('companies', r.vendorId) || {}).name, r.status, r.requester, r.approver, r.notes, ...(Array.isArray(r.items) ? r.items.map(i => [i.desc, i.sku].filter(Boolean).join(' ')) : [])], url: r => 'purchase.html#open=' + r.id },
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

  const NOL = { taskSpan, depClash, RATINGS, reviewRating, ratingLabel, CAP_CLASSES, capClass, capTable, dilute, changelogHtml, CL_TAGS, ical, outOn, COMPONENT_STATES, INCIDENT_STATES, INCIDENT_IMPACTS, STATUS_LABEL, IMPACT_LABEL, STATUS_TONE, STATUS_BANNER, statusOverall, statusUpdates, incidentOpen, statusPage, RETRO_COLUMNS, retroColumn, ROADMAP_LANES, LANE_NAME, roadmapLane, roadmapShipped, roadmapHTML, FEEDBACK_STATES, FEEDBACK_LABEL, feedbackStatus, feedbackVotes, MIND_TINTS, mindNodes, mindKids, mindLayout, mindOutline, mindFromOutline, mindSVG, mindWidth, standupBlocker, reminders, todayStrip, fillVars, varsIn, noticeDate, contractDue, contractWatch, goalProgress, keyResults, quarterOf, quarterRange, goalPace, goalStatus, invTotal, invPaid, invBalance, invOpen, invOverdue, addMonths, CASH_CYCLES, cashDue, cashPlan, cashOpening, nextInvoiceNumber, runRecurring, RECUR, QUOTE_STATUSES, discountAmt, quoteTotals, quoteOpen, quoteExpired, nextQuoteNumber, PO_STATUSES, poTotals, poReceived, poOpen, poLate, nextPONumber, lang, setLang, t, tr, translateNode, store, sync, classicToken, mergeColl, dupGroups, linked, activity, timeline, demo, avatar, who, bars, cols, spark, sparkPath, tile, icon, svg, parseCSV, csvToObjects, toCSV, mapHeaders, pick, fullName, norm, parseDuration, fmtDur, reorder, detectSaaS, monthlyCost, md, esc, HIRE_STAGES, hireStage, orgTree, backlinks, pageByTitle, helpSite, helpSlug, htmlToMd, mentions, SLA, slaState, notesPanel, filesPanel, attach, fileBlob, openFile, fmtSize, filePath, searchAll, searchDialog, h, download, readFile, pickFile, toast, fmtMoney, fmtDate, currency, setCurrency, money, currencySelect, CURRENCIES, topbar, syncDialog, empty, id, now, APPS };
  root.NOL = NOL;
  i18nStart();
  if (typeof module !== 'undefined' && module.exports) module.exports = NOL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
