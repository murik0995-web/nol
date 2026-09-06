// Generates the wall of alternatives (alt/<slug>/index.html), alt/index.html, sitemap.xml. Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
// Output goes to dist/ (gitignored). GitHub Pages deploys dist/ through .github/workflows/pages.yml; sources in git never carry generated files, so parallel agents do not fight over them.
const OUT = 'dist';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
for (const f of readdirSync('.')) { if (['dist', 'node_modules', '.git', '.github', 'factory', 'scripts', 'test', 'journal', 'package.json', 'package-lock.json', 'conveyor.json', 'README.md', 'LICENSE'].includes(f) || f.startsWith('.')) continue; cpSync(f, `${OUT}/${f}`, { recursive: true }); }
mkdirSync(`${OUT}/journal`, { recursive: true });
// journal: one file per event in journal/events/ merged with the frozen base, sorted by time → dist/journal/events.json
const base = existsSync('journal/base.json') ? JSON.parse(readFileSync('journal/base.json', 'utf8')) : [];
const extra = existsSync('journal/events') ? readdirSync('journal/events').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`journal/events/${f}`, 'utf8'))).flat() : [];
const events = [...base, ...extra].sort((a, b) => String(a.t).localeCompare(String(b.t)));
writeFileSync(`${OUT}/journal/events.json`, JSON.stringify(events, null, 0));
try { writeFileSync(`${OUT}/version.txt`, execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() + '\n'); } catch (e) { writeFileSync(`${OUT}/version.txt`, 'local\n'); }
const BASE = 'https://murik0995-web.github.io/nol/';
const cat = JSON.parse(readFileSync('data/saas.json', 'utf8'));
const APP = { crm: ['CRM', 'contacts, companies and a deal pipeline', 'Export your contacts and deals as CSV'], desk: ['Desk', 'tickets, replies, priorities and statuses', 'Export your tickets as CSV'], people: ['People', 'an employee directory, teams and time off', 'Export your employee directory as CSV'], wiki: ['Wiki', 'Markdown pages with folders and search', 'Export your pages as Markdown'], tasks: ['Tasks', 'boards, lists, assignees and due dates', 'Export your board or project as CSV'], invoices: ['Invoices', 'invoices with line items, tax, statuses and print-to-PDF', 'Export your invoices as CSV'], expenses: ['Expenses', 'an expense log with categories, merchants, monthly totals and bank imports', 'Export your expenses as CSV'], timesheets: ['Time', 'timers, a weekly timesheet grid and per-person totals', 'Export your detailed time report as CSV'] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%23d9ff3d'/><text x='32' y='45' font-family='monospace' font-weight='700' font-size='38' text-anchor='middle' fill='%23121400'>0</text></svg>`;
const head = (title, desc, depth) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="icon" href="${ICON}"><link rel="stylesheet" href="${depth}assets/nol.css?v=${Date.now().toString(36)}"></head><body><div class="top"><div class="wrap"><a class="mark" href="${depth}"><b>0</b>NOL</a><nav class="tabs"><a href="${depth}#apps">Apps</a><a href="${depth}unsubscribe.html">Unsubscribe</a><a href="${depth}alt/" class="on">Alternatives</a><a href="${depth}factory.html">Factory</a><a href="${depth}charter.html">Charter</a></nav><div class="grow"></div><button class="btn sm ghost" onclick="NOL.setLang(NOL.lang()==='ru'?'en':'ru')" title="Language / Язык">RU / EN</button><a class="btn sm acid" href="${depth}unsubscribe.html">Unsubscribe from everything</a></div></div>`;
const foot = depth => `<footer><div class="wrap stack"><p class="manifesto">Software rent existed because software was built by people. Software is now built by agents. <em>NOL is what happens next.</em></p><p>Product names belong to their owners; NOL is not affiliated with any of them. Prices are public list prices, approximate, for comparison, checked September 2026. <a href="https://github.com/murik0995-web/nol/issues/new" class="acid">Correct a price →</a></p><p><a href="${depth}">NOL</a> · <a href="${depth}alt/">All alternatives</a> · <a href="https://github.com/murik0995-web/nol">GitHub</a></p></div></footer><script src="${depth}assets/nol.js?v=${Date.now().toString(36)}"></script></body></html>`;
const price = p => p.price === 0 ? 'free tier' : p.flat ? `$${p.price}/mo flat` : `$${p.price}/user/mo`;
const yearly = (p, n) => p.price === 0 ? 0 : p.flat ? p.price * 12 : p.price * n * 12;

rmSync(`${OUT}/alt`, { recursive: true, force: true }); mkdirSync(`${OUT}/alt`, { recursive: true });
for (const p of cat) {
  const [app, what, exp] = APP[p.cat];
  const others = cat.filter(x => x.cat === p.cat && x.slug !== p.slug).slice(0, 8);
  const y25 = yearly(p, 25), y100 = yearly(p, 100);
  const html = head(`${p.name} alternative, free and open source · NOL ${app}`, `${p.name} costs ${price(p)} (${p.tier}). NOL ${app} does ${what} for $0, open source, in your browser. Import your ${p.name} export in one click.`, '../../') + `
<main class="wrap app">
<div class="hero" style="padding:48px 0 24px"><span class="badge">${esc(app)} · ${esc(p.tier)}</span>
<h1 style="font-size:clamp(34px,5.5vw,72px);margin-top:18px">${esc(p.name)},<br>but free.</h1>
<p class="lead" style="margin-top:18px">${esc(p.name)} lists at <b>${price(p)}</b>. NOL ${app} gives you ${what} for <b class="acid">$0</b>, open source, running in your browser today. Your data stays yours.</p>
<div class="row" style="margin-top:26px"><a class="btn lg acid" href="../../apps/${p.cat}.html">Open NOL ${app}</a><a class="btn lg" href="../../unsubscribe.html#${encodeURIComponent(p.name)}">Add to my unsubscribe list</a></div></div>
<div class="grid g3" style="margin-bottom:32px">
<div class="card"><div class="kpi">${p.price === 0 ? '$0' : '$' + y25.toLocaleString('en-US')}<small>${esc(p.name)}, 25 people, per year</small></div></div>
<div class="card"><div class="kpi">${p.price === 0 ? '$0' : '$' + y100.toLocaleString('en-US')}<small>${esc(p.name)}, 100 people, per year</small></div></div>
<div class="card"><div class="kpi acid">$0<small>NOL ${app}, any team size, forever</small></div></div></div>
<div class="grid g2" style="align-items:start">
<div class="card pad0"><table class="cmp"><thead><tr><th></th><th>${esc(p.name)}</th><th>NOL ${app}</th></tr></thead><tbody>
<tr><td>Price</td><td>${price(p)}</td><td>$0</td></tr>
<tr><td>Per-seat tax</td><td>${p.flat ? 'tiered' : 'yes'}</td><td>none</td></tr>
<tr><td>Source code</td><td>closed</td><td>open, MIT</td></tr>
<tr><td>Your data</td><td>on their servers</td><td>in your browser, export any time</td></tr>
<tr><td>Leaving</td><td>export what they allow</td><td>one click, everything</td></tr>
<tr><td>Built by</td><td>people</td><td>agents, in public</td></tr></tbody></table></div>
<div class="card stack"><h3>Move from ${esc(p.name)} in three steps</h3>
<p><b>1.</b> ${esc(p.imp || exp + '.')}</p>
<p><b>2.</b> Go to <a class="acid" href="../../apps/${p.cat}.html">NOL ${app}</a> and click <b>Import</b>. Columns are matched automatically.</p>
<p><b>3.</b> Cancel ${esc(p.name)}. That is the whole migration.</p>
<p class="dim" style="font-size:13px">Missing a feature you need? <a class="acid" href="https://github.com/murik0995-web/nol/issues/new?template=request.yml">Ask the factory.</a> Requests are built in public.</p></div></div>
<section class="sec" style="padding-top:56px"><h2 style="font-size:26px">Also replaced by NOL ${app}</h2><div class="row" style="margin-top:14px">${others.map(o => `<a class="btn sm" href="../${o.slug}/">${esc(o.name)}</a>`).join('')}<a class="btn sm ghost" href="../">All ${cat.length} →</a></div></section>
</main>` + foot('../../');
  mkdirSync(`${OUT}/alt/${p.slug}`, { recursive: true }); writeFileSync(`${OUT}/alt/${p.slug}/index.html`, html);
}
const groups = Object.entries(APP).map(([k, [app, what]]) => `<section class="sec" style="padding:36px 0"><h2 style="font-size:26px">${app} <span class="mute" style="font-weight:500;font-size:16px">· ${what}</span></h2><div class="grid g3" style="margin-top:16px">${cat.filter(p => p.cat === k).sort((a, b) => a.name.localeCompare(b.name)).map(p => `<a class="card appcard" href="${p.slug}/"><h3>${esc(p.name)}</h3><p class="mute">${price(p)} · ${esc(p.tier)}</p><p class="rep acid">→ NOL ${app}, $0</p></a>`).join('')}</div></section>`).join('');
writeFileSync(`${OUT}/alt/index.html`, head(`${cat.length} subscriptions you can cancel today · NOL`, `Free, open-source alternatives to ${cat.length} business tools: CRM, help desk, HR, wiki and project management.`, '../') + `<main class="wrap app"><div class="hero" style="padding:48px 0 8px"><h1 style="font-size:clamp(34px,5.5vw,72px)">${cat.length} subscriptions<br>you can cancel today.</h1><p class="lead" style="margin-top:18px">Every tool below has a free open twin in NOL. Click one to see the yearly rent and the three-step move.</p><input class="input" id="q" placeholder="Search tools…" style="max-width:420px;margin-top:20px"></div>${groups}</main><script>document.getElementById('q').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.appcard').forEach(a=>a.style.display=a.textContent.toLowerCase().includes(q)?'':'none')}</script>` + foot('../'));
const urls = [BASE, BASE + 'unsubscribe.html', BASE + 'factory.html', BASE + 'alt/', BASE + 'charter.html', ...Object.keys(APP).map(k => BASE + `apps/${k}.html`), ...cat.map(p => BASE + `alt/${p.slug}/`)];
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
// cache-busting: stamp every static reference to nol.js / nol.css with the build time (GitHub Pages caches 10 min, Safari longer)
const V = Date.now().toString(36);
for (const f of ['index.html', 'unsubscribe.html', 'factory.html', 'charter.html', ...readdirSync('apps').filter(x => x.endsWith('.html')).map(x => 'apps/' + x)]) {
  const p = `${OUT}/${f}`; const src = readFileSync(p, 'utf8'); const out = src.replace(/assets\/(nol\.js|nol\.css)(\?v=[a-z0-9]+)?/g, `assets/$1?v=${V}`); if (out !== src) writeFileSync(p, out);
}
console.log(`dist/: ${events.length} journal events, ${cat.length} alternative pages + index + sitemap (${urls.length} urls)`);
