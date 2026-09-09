# CLAUDE.md

Standing policy for this repository. Read it before making any change here.

## What this repo is

A Cloudflare Workers static-assets site. Everything served lives in `public/`
and there is no build step on Cloudflare - the files in that directory are the
site. `public/` is generated from `src/` by `node scripts/build-site.js --demo`
and the output is committed; edit `src/` and rebuild rather than editing
`public/` by hand. The repo is connected to Cloudflare Workers Builds, so
**every push to `main` deploys to production**.

```
public/            everything served (generated, committed)
  index.html + team/ research/ publications/ resources/ join-us/ contact/
  original/ offer/ demo-only tabs
  404.html
  assets/css|js    stylesheet, publications search, tractogram viewer (NiiVue), research figures
  assets/tracts    hcp1065.trx — the real HCP1065 streamlines (6.2 MB), same file visualneuroscience.ai serves
  fonts/           self-hosted Fraunces + Inter
  _headers         security + caching headers
  robots.txt       disallow all while this is a pitch demo
src/               page sources, content, offer and frame pages
scripts/           build, verify, screenshots, offline preview
work/brief.json    every fact on the site, with its source and date
wrangler.jsonc     assets-only config, no Worker script
package.json       wrangler + playwright-core devDependencies
```

## Local development

```bash
npm install
npm run build        # src → public (with the demo bar)
npm run dev          # wrangler dev
```

## Verification - before every push to main

1. `npx wrangler deploy --dry-run`
2. `node scripts/verify-layout.js` on a staged copy of `public/` without
   `original/`, with `--original-host sites.google.com`; then `/original/`
   alone without it. Absolute `--dir` only.
3. `npm run shots`, then look at the screenshots: fonts loaded, layout intact,
   nothing collapsed to unstyled text. On a machine without a GPU the phone
   capture of `/` can stall (software GL and the tube mesh); the script logs it
   as `MISSED` and carries on — check that one in a real browser instead.

Never leave pushed work unverified or half-finished. Work in small, complete
batches: implement, verify, commit, push.

## Git and release workflow

- Before committing: `git config user.name "Fid" && git config user.email "fid_kk@proton.me"`
- Develop on the working branch and push there first. Release verified work by
  fast-forwarding `main` onto it and pushing `main`.
- Every push to `main` is a release. Versions are an ascending `vMAJOR.MINOR`
  sequence starting at `v1.0`; every push bumps the minor regardless of size. A
  major bump is reserved for a ground-up overhaul.
- With every push to `main`, provide release-tag text in the reply, in exactly
  this shape. The owner creates the GitHub release manually - **never push tags**:

  ```
  Tag: v<next>  —  Title: <five to nine words, plain and evocative>
  Description: <one to three sentences of editorial prose describing what changed
  from the owner's point of view — outcomes, not implementation. No bullet lists,
  no jargon, no file names.>
  ```

- Append the release line to the ledger below as part of the same push.
- Commit messages: descriptive imperative first line (what the change does, not
  "update X"), then a short prose body; dash bullets are fine there. One commit
  per coherent piece of work; several may share a push, but each push gets
  exactly one version entry.
- Never include model names, AI attribution trailers, session links, or other
  tooling identifiers in commit messages, titles, or code.

## The pages themselves

Content is the lab's own, taken from their Google Site and recorded with source
and date in `work/brief.json`. Nothing goes on a page that the brief cannot
prove; a missing fact becomes a question for the client, never a guess. The
two unconfirmed facts (email, phone) keep their "To confirm" chip until the lab
confirms them. Design tokens are the University of Nottingham palette; the
typography laws in `public/assets/css/site.css` (single-word headings never
split, headings never capped at a reading measure, card grids use
`minmax(min(300px,100%),1fr)`) are enforced by the verify gate.

## Release ledger

| Version | Title | Description |
| --- | --- | --- |
| v1.0 | The lab's site, rebuilt across all seven pages | A new home for the Dynamic Connectome Lab: every page of the Google Site rebuilt in the University's colours, the publications list made searchable, an interactive brain-wiring model on the home page, with the current site and the offer alongside for comparison. |
| v1.1 | The brain on the page, and figures you can play with | The home page now draws the brain's wiring itself on the site's own blue — spin it, drag it, one switch — instead of framing another website. The four research figures have become interactive models with sliders: stimulate tissue, move a classifier threshold, grow a network, watch activity spread. |
| v1.2 | The whole brain, not a single bundle | The home page now carries the complete population-average wiring of the human brain in place of the stand-in bundle it launched with — every tract drawn on the site's blue, turning slowly from the moment the page opens. |
| v1.3 | The site gets a home that publishes it | The demo now lives in its own repository and publishes itself: every change pushed to the main branch goes straight to Cloudflare, so what the lab is shown is always the current version. Nothing on the pages themselves has changed. |
