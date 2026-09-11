# Geelong Underwater Hockey — live club website

Deployed on Netlify, auto-deploys from `main`. Real backend: Netlify DB
(Postgres via Neon) + Netlify Functions + Netlify Identity.

## This repo has exactly one live site: the `js/` app

`index.html` at the repo root loads the app from `js/` (React via CDN,
no build step — plain `<script>` tags, see the list inside
`index.html`). This is the real, current site: home, about, new player,
news, portal (login/dashboard/booking/bring-a-mate/profile), organiser
tools, and the live attendance feature (`js/pages/live-attendance.js`,
backed by `netlify/functions/booking.mts` and Netlify Identity).

**There is no second "real" site.** If `index.html` is ever found to be
a large (~1MB+) single self-contained file instead of the short
script-tag loader described above, that is a mistake from an earlier
session that misidentified an old prototype export as canonical — it
should be replaced with the script-tag loader version, never the other
way around. Do not "clean up" by removing `js/`, `styles.css`, or
`images/` — they are load-bearing, not stale.

`artifact-entry.html` is a separate thing entirely: the concept/demo
entry point used only inside a Claude Artifact preview (loads the same
`js/` app via CDN React/Tailwind, for design iteration). It is never
served as part of the live site and should be left alone.

`test/` holds manual QA scripts, not part of the deployed site.

## Deployment

- `netlify.toml`: `publish = "."`, functions from `netlify/functions`,
  plus a catch-all SPA redirect (`/*` → `/index.html`, 200) — required
  because the app is a client-side router with no per-path static
  files. Function routes (declared via each function's own
  `config.path`) take priority over this redirect automatically.
- Site: https://geelong-underwater-hockey.netlify.app
- Known issue (as of 11 Sept 2026): the Netlify project has
  "require team login" turned on for all visitors, which blocks real
  club members from viewing the site. This needs to be turned off in
  Netlify project settings before go-live — it is not something to fix
  by changing code here.
- `netlify/functions/health.mts` and the DB migration under
  `netlify/database/` are real and load-bearing — not experiments.

## Local environment notes

- Node and Python are not installed on this machine. There is no way
  to run a local static server, and `npm install` will not work.
- The terminal is Windows PowerShell 5.1. `&&` is a syntax error
  there — chain commands with `;`, or run them as separate commands.
