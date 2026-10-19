# Geelong Underwater Hockey — project status

Ask any chat to read this file first. It explains where things live and
how to get a current picture. Anything dated goes stale, so prefer the
commands in "How to check progress" over the summary below.

Last reviewed: 2026-10-20.

## What this project is

The club's website and member system. It is live and in real use.

- Live site: https://geelong-underwater-hockey.netlify.app (public)
- Repo: https://github.com/wokboy1984/GeelongUnderwaterHockey (branch `main`)
- Hosting: Netlify, auto-deploys on every push to `main`
- Backend: Netlify Functions, Netlify DB (Postgres), Netlify Identity

## How the code is laid out

No build step. `index.html` is a short loader with plain `<script>`
tags that pull React from a CDN and then load `js/`.

- `js/pages/*.js` — one file per screen
- `js/app.js` — routing and the nav, including which roles see what
- `js/identity.js` — login, via Netlify Identity
- `netlify/functions/*.mts` — the API, one file per endpoint, each
  declaring its own `/api/...` path
- `netlify/functions/_shared/` — shared logic. `roles.mts` is the
  permission model and is the file to read first
- `netlify/database/migrations/` — schema history, applied in order

Roles stack on top of a plain member: game coordinator, community
moderator, treasurer, administrator. Permissions are enforced
server-side in every function, never trusted from the browser.

## Who edits this

Alex works on it through Claude Cowork, which commits as "Cheongy" and
pushes to `main`. Cowork has force-pushed rewritten history before.

**The remote is the source of truth.** Treat the local folder
`~/Documents/Websites/geelong-uwh` as a read-only copy. Pull into it,
do not push from it, and never force-push over `main`.

## How to check progress

Run these rather than trusting any summary:

    git fetch origin main
    git log --oneline -20 origin/main
    git log --since="2 weeks ago" --format='%ad %s' --date=short origin/main

To see what is live versus what is local:

    git rev-list --left-right --count origin/main...HEAD

To see the feature surface:

    git ls-tree -r --name-only origin/main | grep -E '^js/pages/|^netlify/functions/'

## Roughly where things stand

Built and live: member login, profiles with photo and emergency
contact, dashboard, session booking, Bring a Mate with tracked invite
links, the "This Week's Game" board, coordinator tools for attendance,
teams, timetable and scores, a forum with moderation, finance and fees,
player stats, a waiver flow, family and kids records, free trial
signup, a beginners guide, and an admin area for roles and members.

The schema has grown steadily, which is the most reliable signal of
what is real. Listing `netlify/database/migrations/` in date order
gives a decent history of the work.

## Open items to be aware of

A public Victorian State Titles registration feature was built and then
dropped on purpose. Do not revive it from old branches or backups.

**The old prototype is kept** outside the repo at
`~/Documents/Websites/geelong-uwh-prototype-backup/`. It is a dead end,
not an earlier version of the live site.
