#!/usr/bin/env node
/* build-preview.js — one self-contained HTML file of the whole demo for viewing
 * offline or on a phone: every page inlined (CSS, fonts, scripts, favicon),
 * internal links routed inside the file. External links open normally.
 *   node scripts/build-preview.js [--out dynamicconnectomelab-preview.html] */
'use strict';
const fs = require('fs');
const path = require('path');

const PUB = path.resolve('public');
const OUT = path.resolve((() => { const i = process.argv.indexOf('--out'); return i > -1 ? process.argv[i + 1] : 'dynamicconnectomelab-preview.html'; })());
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const read = rel => fs.readFileSync(path.join(PUB, rel));
const dataUri = rel => `data:${MIME[path.extname(rel)] || 'application/octet-stream'};base64,${read(rel).toString('base64')}`;

// discover routes
const routes = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const f = path.join(d, e.name);
  if (e.isDirectory()) return walk(f);
  if (e.name.endsWith('.html')) {
    const rel = '/' + path.relative(PUB, f).replace(/\\/g, '/');
    routes.push(rel.endsWith('/index.html') ? rel.replace(/index\.html$/, '') : rel);
  }
});
walk(PUB);
const ORDER = ['/', '/team/', '/research/', '/publications/', '/resources/', '/join-us/', '/contact/', '/original/', '/offer/', '/404.html'];
routes.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

function inlineCss(css, baseDir) {
  return css.replace(/url\(\s*["']?([^"')]+?)["']?\s*\)/g, (m, u) => {
    if (/^(data:|https?:)/.test(u)) return m;
    const rel = u.startsWith('/') ? u : path.posix.join(baseDir, u);
    try { return `url("${dataUri(rel)}")`; } catch { return m; }
  });
}

function inlinePage(route) {
  const file = route.endsWith('/') ? route + 'index.html' : route;
  let html = read(file).toString('utf8');
  // stylesheets
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (m, href) => {
    if (/^https?:/.test(href)) return m;
    const css = inlineCss(read(href).toString('utf8'), path.posix.dirname(href));
    return `<style>${css}</style>`;
  });
  // scripts
  html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g, (m, src) => /^https?:/.test(src) ? m : `<script>document.addEventListener('DOMContentLoaded',function(){\n${read(src).toString('utf8')}\n});</script>`);
  // the tractogram needs its 6 MB of streamlines: point the offline copy at a message instead
  html = html.replace(/data-tract="[^"]+"/, 'data-tract="offline"');
  // favicon
  html = html.replace(/<link rel="icon" href="\/favicon\.svg"[^>]*>/, `<link rel="icon" href="${dataUri('/favicon.svg')}" type="image/svg+xml">`);
  // internal links → postMessage to the shell
  html = html.replace(/<a\s([^>]*?)href="(\/[^"#]*)(#[^"]*)?"/g, (m, attrs, href, hash) => `<a ${attrs}href="${href}${hash || ''}" data-route="${href}" onclick="parent.postMessage({route:'${href}',hash:'${hash || ''}'},'*');return false;"`);
  return html;
}

const pages = {};
for (const r of routes) pages[r] = inlinePage(r);

const labels = { '/': 'Home', '/team/': 'Team', '/research/': 'Research', '/publications/': 'Publications', '/resources/': 'Resources', '/join-us/': 'Join us', '/contact/': 'Contact', '/offer/': 'The offer', '/original/': 'Current site', '/404.html': '404' };

const shell = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Dynamic Connectome Lab — demo preview</title>
<link rel="icon" href="${dataUri('/favicon.svg')}" type="image/svg+xml">
<style>
  html,body{margin:0;height:100%;background:#0c0c0c;font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eee}
  body{display:flex;flex-direction:column}
  .bar{display:flex;gap:4px;align-items:center;padding:6px 8px;overflow-x:auto;border-bottom:1px solid #333;flex:none;-webkit-overflow-scrolling:touch}
  .bar span{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;background:#DEB406;color:#0c0c0c;padding:4px 7px;border-radius:3px;margin-right:4px;white-space:nowrap}
  .bar button{background:none;border:1px solid transparent;color:#bbb;padding:8px 10px;border-radius:4px;font:inherit;cursor:pointer;white-space:nowrap}
  .bar button[aria-current]{color:#fff;border-color:#555;background:#1c1c1c}
  iframe{flex:1;border:0;width:100%;background:#fff}
</style>
</head>
<body>
<div class="bar"><span>Offline preview</span>${routes.filter(r => r !== '/404.html').map(r => `<button data-route="${r}">${labels[r] || r}</button>`).join('')}</div>
<iframe id="view" title="Preview"></iframe>
<script>
  var PAGES = ${JSON.stringify(pages).replace(/<\//g, '<\\/')};
  var view = document.getElementById('view');
  function go(route, hash) {
    if (!PAGES[route]) route = '/404.html';
    view.srcdoc = PAGES[route];
    document.querySelectorAll('.bar button').forEach(function (b) { if (b.dataset.route === route) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (hash) view.addEventListener('load', function h() { view.removeEventListener('load', h); try { var el = view.contentDocument.querySelector(hash); if (el) el.scrollIntoView(); } catch (e) {} });
  }
  document.querySelectorAll('.bar button').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.route, ''); }); });
  window.addEventListener('message', function (e) { if (e.data && e.data.route) go(e.data.route, e.data.hash || ''); });
  go('/', '');
</script>
</body>
</html>
`;
fs.writeFileSync(OUT, shell);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(shell.length / 1024 / 1024).toFixed(2)} MB, ${routes.length} pages)`);
