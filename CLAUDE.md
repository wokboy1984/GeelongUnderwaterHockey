# Geelong Underwater Hockey — live club website

Deployed on Netlify, auto-deploys from `main`. Real backend: Netlify DB
(Postgres via Neon) + Netlify Functions + Netlify Identity.

## This repo has exactly one live site: the `js/` app

`index.html` at the repo root loads the app from `js/` (React via CDN,
no build step — plain `<script>` tags, see the list inside
`index.html`). This is the real, current site: home, about, new player,
news, portal (login/dashboard/booking/bring-a-mate/profile), organiser
tools, and the live attendance feature (members book in from the
dashboard, `js/pages/portal-dashboard.js`; the roll call is in
`js/pages/coordinator.js`; backed by `netlify/functions/booking.mts`,
`coordinator-attendance.mts` and Netlify Identity).

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
- "Require team login" was turned off before go-live (Oct 2026). The site
  is public; only the member portal sits behind Netlify Identity.
- `netlify/functions/health.mts` and the DB migration under
  `netlify/database/` are real and load-bearing — not experiments.

## Before you push

Run `npm run build-check` and `npm test`. CI runs both on every push, and
`main` won't accept a merge unless they pass.

`build-check` bundles the functions with esbuild, the same thing Netlify
uses. It exists because `node --check` only verifies syntax: in Oct 2026 a
reassigned `const` passed `node --check`, failed Netlify's build, and
Netlify reported nothing but "exit code 2". Four days of work sat on main
undeployed before anyone noticed. Don't rely on `node --check` alone.

## Never edit an applied migration

Netlify checksums every migration that has already run, including
comments and whitespace. Changing or deleting one fails the deploy with
"has been modified after being applied", which blocked deploys for hours
in Oct 2026. Add a new migration instead. The unused
`finance_waived_games` table is left in place for exactly this reason.

## Two people work on this

Alex (wokboy1984) and Liam (UWHCookie) both push to `main`, both using
Claude. Pull before starting and push small changes often — the trouble
comes from two people sitting on a week of unpushed work in the same
files. Force-pushing and deleting `main` are blocked, so a conflict is
always recoverable: git will refuse the push and ask you to pull first.

## Local environment notes

- Node is installed and used for `netlify dev`, `npm run build-check`,
  and running `netlify database migrations apply` against the local dev
  Postgres. Run `npm ci` first — `build-check` needs esbuild from
  devDependencies.
- The terminal is Windows PowerShell 5.1. `&&` is a syntax error
  there — chain commands with `;`, or run them as separate commands.
