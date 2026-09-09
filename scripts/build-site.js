#!/usr/bin/env node
/* build-site.js — writes the Dynamic Connectome Lab pages into public/.
 *
 *   node scripts/build-site.js            # site pages + 404 + favicon + robots
 *   node scripts/build-site.js --demo     # also wires the site-pitch demo bar into every page
 *
 * The output is committed: public/ is the site, there is no build step on
 * Cloudflare. Re-run after editing src/. */
'use strict';
const fs = require('fs');
const path = require('path');
const { page, MARK } = require('../src/layout');
const A = require('../src/pages-a');
const B = require('../src/pages-b');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const DEMO = process.argv.includes('--demo');

const write = (rel, content) => {
  const file = path.join(PUB, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log('wrote', rel, `(${content.length} bytes)`);
};

const pages = [A.home, A.team, A.research, B.renderPublications(), B.resources, B.joinUs, B.contact, B.notFound];
for (const p of pages) {
  const html = page(p);
  const rel = p.path === '/' ? 'index.html' : p.path.endsWith('.html') ? p.path.slice(1) : p.path.slice(1) + 'index.html';
  write(rel, html);
}

write('assets/js/publications.js', B.PUB_JS);

// Favicon: the same network mark on Nottingham Blue.
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#10263B"/>${MARK.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`);

/* A pitch demo never reaches a search index. A shared link should still unfurl
   though, and the services that render a link preview read robots.txt like
   everyone else — so they are named, which gives each its own group in place of
   the blanket rule. Previewing is not indexing: every search crawler stays out. */
const UNFURLERS = ['Twitterbot', 'facebookexternalhit', 'Slackbot-LinkExpanding',
  'LinkedInBot', 'WhatsApp', 'Discordbot', 'TelegramBot'];
write('robots.txt', '# A pitch demo never reaches a search index.\nUser-agent: *\nDisallow: /\n' +
  '\n# Link previews are not indexing: these fetch a shared link to draw its card.\n' +
  UNFURLERS.map(a => `\nUser-agent: ${a}\nAllow: /\n`).join(''));

// Pitch tabs 2 and 3: the framed original and the offer (site-pitch stages 1 and 4).
write('original/index.html', fs.readFileSync(path.join(ROOT, 'src', 'original.html'), 'utf8'));
write('offer/index.html', fs.readFileSync(path.join(ROOT, 'src', 'offer.html'), 'utf8'));

// ── Demo wiring (site-pitch stage 5) ────────────────────────────────────
if (DEMO) {
  const barFile = path.join(ROOT, 'src', 'demo-bar.html');
  let bar = fs.readFileSync(barFile, 'utf8');
  // The bundled asset's instruction comment self-terminates (it quotes "<!-- DEMO-BAR -->"),
  // so take the fragment from its first real tag onward.
  bar = bar.slice(bar.indexOf('<style id="pitch-bar-css">'));
  // The site header is sticky at top:0; drop it under the 48px bar while the bar exists.
  bar += '\n<style id="pitch-bar-offset">.site-header{top:48px}.skip:focus{top:104px}</style>\n';
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (!e.name.endsWith('.html')) return;
    let html = fs.readFileSync(f, 'utf8');
    if (!html.includes('<!-- DEMO-BAR -->')) return;
    const rel = '/' + path.relative(PUB, f).replace(/\\/g, '/').replace(/index\.html$/, '');
    const own = rel.startsWith('/original/') ? '/original/' : rel.startsWith('/offer/') ? '/offer/' : '/';
    let b = bar;
    if (own === '/') b = b.replace('<a href="/">New site</a>', '<a href="/" aria-current="page">New site</a>');
    else b = b.replace(`<a href="${own}">`, `<a href="${own}" aria-current="page">`);
    html = html.replace('<!-- DEMO-BAR -->', b);
    fs.writeFileSync(f, html);
    console.log('demo bar →', rel);
  });
  walk(PUB);
}
