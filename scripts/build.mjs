// Generates the wall of alternatives (alt/<slug>/index.html), alt/index.html, sitemap.xml. Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const BASE = 'https://murik0995-web.github.io/nol/';
const cat = JSON.parse(readFileSync('data/saas.json', 'utf8'));
const APP = { crm: ['CRM', 'contacts, companies and a deal pipeline', 'Export your contacts and deals as CSV'], desk: ['Desk', 'tickets, replies, priorities and statuses', 'Export your tickets as CSV'], people: ['People', 'an employee directory, teams and time off', 'Export your employee directory as CSV'], wiki: ['Wiki', 'Markdown pages with folders and search', 'Export your pages as Markdown'], tasks: ['Tasks', 'boards, lists, assignees and due dates', 'Export your board or project as CSV'], invoices: ['Invoices', 'invoices with line items, tax, statuses and print-to-PDF', 'Export your invoices as CSV'] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%23d9ff3d'/><text x='32' y='45' font-family='monospace' font-weight='700' font-size='38' text-anchor='middle' fill='%23121400'>0</text></svg>`;
const head = (title, desc, depth) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="icon" href="${ICON}"><link rel="stylesheet" href="${depth}assets/nol.css"></head><body><div class="top"><div class="wrap"><a class="mark" href="${depth}"><b>0</b>NOL</a><nav class="tabs"><a href="${depth}#apps">Apps</a><a href="${depth}unsubscribe.html">Unsubscribe</a><a href="${depth}alt/" class="on">Alternatives</a><a href="${depth}factory.html">Factory</a><a href="${depth}charter.html">Charter</a></nav><div class="grow"></div><a class="btn sm acid" href="${depth}unsubscribe.html">Unsubscribe from everything</a></div></div>`;
const foot = depth => `<footer><div class="wrap stack"><p class="manifesto">Software rent existed because software was built by people. Software is now built by agents. <em>NOL is what happens next.</em></p><p>Product names belong to their owners; NOL is not affiliated with any of them. Prices are public list prices, approximate, for comparison, checked September 2026. <a href="https://github.com/murik0995-web/nol/issues/new" class="acid">Correct a price →</a></p><p><a href="${depth}">NOL</a> · <a href="${depth}alt/">All alternatives</a> · <a href="https://github.com/murik0995-web/nol">GitHub</a></p></div></footer></body></html>`;
const price = p => p.price === 0 ? 'free tier' : p.flat ? `$${p.price}/mo flat` : `$${p.price}/user/mo`;
const yearly = (p, n) => p.price === 0 ? 0 : p.flat ? p.price * 12 : p.price * n * 12;

rmSync('alt', { recursive: true, force: true }); mkdirSync('alt', { recursive: true });
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
<p><b>2.</b> Open <a class="acid" href="../../apps/${p.cat}.html">NOL ${app}</a> and click <b>Import</b>. Columns are matched automatically.</p>
<p><b>3.</b> Cancel ${esc(p.name)}. That is the whole migration.</p>
<p class="dim" style="font-size:13px">Missing a feature you need? <a class="acid" href="https://github.com/murik0995-web/nol/issues/new?template=request.yml">Ask the factory.</a> Requests are built in public.</p></div></div>
<section class="sec" style="padding-top:56px"><h2 style="font-size:26px">Also replaced by NOL ${app}</h2><div class="row" style="margin-top:14px">${others.map(o => `<a class="btn sm" href="../${o.slug}/">${esc(o.name)}</a>`).join('')}<a class="btn sm ghost" href="../">All ${cat.length} →</a></div></section>
</main>` + foot('../../');
  mkdirSync(`alt/${p.slug}`, { recursive: true }); writeFileSync(`alt/${p.slug}/index.html`, html);
}
const groups = Object.entries(APP).map(([k, [app, what]]) => `<section class="sec" style="padding:36px 0"><h2 style="font-size:26px">${app} <span class="mute" style="font-weight:500;font-size:16px">· ${what}</span></h2><div class="grid g3" style="margin-top:16px">${cat.filter(p => p.cat === k).sort((a, b) => a.name.localeCompare(b.name)).map(p => `<a class="card appcard" href="${p.slug}/"><h3>${esc(p.name)}</h3><p class="mute">${price(p)} · ${esc(p.tier)}</p><p class="rep acid">→ NOL ${app}, $0</p></a>`).join('')}</div></section>`).join('');
writeFileSync('alt/index.html', head(`${cat.length} subscriptions you can cancel today · NOL`, `Free, open-source alternatives to ${cat.length} business tools: CRM, help desk, HR, wiki and project management.`, '../') + `<main class="wrap app"><div class="hero" style="padding:48px 0 8px"><h1 style="font-size:clamp(34px,5.5vw,72px)">${cat.length} subscriptions<br>you can cancel today.</h1><p class="lead" style="margin-top:18px">Every tool below has a free open twin in NOL. Click one to see the yearly rent and the three-step move.</p><input class="input" id="q" placeholder="Search tools…" style="max-width:420px;margin-top:20px"></div>${groups}</main><script>document.getElementById('q').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.appcard').forEach(a=>a.style.display=a.textContent.toLowerCase().includes(q)?'':'none')}</script>` + foot('../'));
const urls = [BASE, BASE + 'unsubscribe.html', BASE + 'factory.html', BASE + 'alt/', BASE + 'charter.html', ...Object.keys(APP).map(k => BASE + `apps/${k}.html`), ...cat.map(p => BASE + `alt/${p.slug}/`)];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
console.log(`built ${cat.length} alternative pages + index + sitemap (${urls.length} urls)`);
