# dynamicconnectomelab-web

A pitch demo for the **Dynamic Connectome Lab** (Marcus Kaiser, University of
Nottingham), built from their Google Site at
`sites.google.com/view/dynamicconnectomelab`. Three things live here, joined by
a demo bar:

| Route | What it is |
| --- | --- |
| `/` and the six sub-pages | The new site — Home, Team, Research, Publications, Resources, Join us, Contact |
| `/original/` | Their live site in a frame (a clean copy could not be made from the build environment) |
| `/offer/` | The offer — tale of the tape, prices, terms |

Every fact on the new site traces to `work/brief.json`; the page copy is the
lab's own, taken verbatim from the Google Site (typos fixed, PI's first-person
voice normalised to "the lab" in a few places). Unconfirmed facts — the email
and phone, which come from the university staff listing rather than the lab
site — carry a visible "To confirm" chip.

## Structure

```
public/                everything served — this is the site
  index.html           Home
  team/ research/ publications/ resources/ join-us/ contact/
  original/            framed live site (demo only)
  offer/               the offer (demo only)
  404.html
  assets/css/site.css  the stylesheet
  assets/js/publications.js
  fonts/               Fraunces 400/600/700 + Inter 400/500/600, self-hosted
  favicon.svg  robots.txt (disallow all — pitch demo)  _headers
src/
  layout.js            shared shell: head, header, nav, footer
  pages-a.js           Home, Team, Research
  pages-b.js           Publications (parsed from content/), Resources, Join us, Contact, 404
  content/             publications.txt and the verbatim page text the build reads
  offer.html original.html demo-bar.html
scripts/
  build-site.js        src → public   (node scripts/build-site.js --demo)
  verify-layout.js     the layout gate, 320→1920 with the real fonts
  shots.js             full-page screenshots of every route at 1440 and 390
  build-preview.js     one self-contained HTML of the whole demo for phones
  measure-font.js      fetch fonts from npm @fontsource
  render_check.py      the cloudflare-static-site render check
work/                  brief.json and the captured page text (provenance)
wrangler.jsonc         assets-only Worker config
```

## Local development

```bash
npm install
npm run build        # regenerate public/ from src/ (with the demo bar)
npm run dev          # wrangler dev
npm run shots        # screenshots into .shots/
```

## Verification — before every push to main

```bash
npx wrangler deploy --dry-run
rm -rf .verify-stage && mkdir .verify-stage && cp -r public/. .verify-stage/ && rm -rf .verify-stage/original
npm run verify                                        # authored routes, leak check against sites.google.com
node scripts/verify-layout.js --dir "$PWD/public" --routes "/original/"   # the frame, on its own
npm run shots && open .shots/                         # then look at them
```

`verify-layout.js` needs an absolute `--dir`; a relative one 403s every route.

## External resources

- `https://visualneuroscience.ai/tracts` — the interactive tractography model
  embedded on the home page (replaces the YouTube video on the Google Site).
- Publication PDFs, datasets and the PI's CV link out to
  `www.dynamic-connectome.org` and publisher sites, exactly as on the Google Site.
- Fonts are self-hosted; nothing loads from Google Fonts.

## On transfer

Remove the demo bar (`node scripts/build-site.js` without `--demo`), delete
`public/original/` and `public/offer/`, switch `robots.txt` to allow, and drop
in the lab's own headshots, the NeuroFUS photo and the VERTEX figures where the
monograms and schematics stand today.
