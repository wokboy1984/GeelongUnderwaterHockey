// Free trial ("Book your first session") signups - 2 Oct 2026.
//
// Before this, the public /new-player form only wrote to the demo
// localStorage store, so on the live site nothing was saved and nobody at
// the club knew a newcomer was coming.
//
// GET  /api/trial-signup[?ref=TOKEN]
//        -> { ok, dates: ["YYYY-MM-DD" x4], invite? }  the next four Wednesdays (public);
//           with a Bring a Mate ref, invite = { inviterName, guestName } for the
//           "Kev invited you" banner and a pre-filled name (13 Oct 2026)
// GET  /api/trial-signup?scope=alerts
//        -> { ok, pending[] }  in-app alert (11 Nov 2026, Liam): free-trial
//                              bookings nobody has added yet, from two weeks
//                              back (missed: true) to any future Wednesday.
//                              Game Coordinator / Administrator; anyone else
//                              gets an empty list.
// POST /api/trial-signup { action: "dismiss" | "undismiss", id }
//        -> { ok }   "Didn't come" (11 Nov 2026): takes a booking off the
//                    trial alerts. Game Coordinator / Administrator.
// GET  /api/trial-signup?scope=coordinator
//        -> { ok, sessionDate, signups[] }     newcomers booked for the upcoming
//                                              Wednesday, with gear + emergency
//                                              details. Game Coordinator /
//                                              Administrator only.
// POST /api/trial-signup { firstName, lastName, age, finSize, handed,
//                          emergencyName, emergencyPhone, phone, email,
//                          sessionDate, heardAbout, website, ref,
//                          children?: [{ firstName, age, finSize }], parentPlaying? }
//        children (5 Nov 2026): a parent booking their kids in too
//        -> { ok, signup }                     public, no login. signup.invitedBy =
//                                              the member's name when a valid ref came in
//
// `website` is a honeypot: a hidden field real people never fill in. If it
// has anything in it, the request is treated as a bot and quietly dropped.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, ensureNicknameColumn, getVerifiedUser, adminName, hasPermission, unauthorized, forbidden } from "./_shared/roles.mts";
import { cleanRef, ensureInviteColumns, newToken, resolveRef } from "./_shared/invite-links.mts";
import { nextSessionDateISO, requestedSessionDate } from "./_shared/attendance.mts";
import { getSeason, isBreakDate, seasonInfo, type Season } from "./_shared/season.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// The next four game nights, starting with the upcoming Wednesday (which
// is today on a Wednesday - same rule as the rest of the site). Wednesdays
// in the summer break are skipped (11 Nov 2026); with the first game back
// not set yet, nothing after the last game is offered, so the list can be
// short or empty. Looks no more than 16 weeks ahead.
function nextFourWednesdays(season: Season): string[] {
  const first = nextSessionDateISO();
  const [y, m, d] = first.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let i = 0; i < 16 && out.length < 4; i++) {
    const dt = new Date(base + i * 7 * 86400000);
    const iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    if (!isBreakDate(iso, season)) out.push(iso);
  }
  return out;
}

// Same table as migration 20261002000001_nickname_trials - created here too
// because migrations haven't always applied to production on this project.
let tableReady = false;
async function ensureTable(db: any) {
  if (tableReady) return;
  await db.sql`
    create table if not exists trial_signups (
      id serial primary key,
      session_date date not null,
      first_name text not null,
      last_name text not null,
      email text not null,
      phone text,
      age integer,
      fin_size text,
      handed text,
      emergency_name text not null,
      emergency_phone text not null,
      heard_from text,
      created_at timestamptz not null default now()
    )
  `;
  await db.sql`alter table trial_signups add column if not exists invited_by text`;
  // Family sign-up (5 Nov 2026): children coming too, and the member the
  // coordinator made from this signup ("Add to tonight").
  await db.sql`alter table trial_signups add column if not exists children jsonb`;
  await db.sql`alter table trial_signups add column if not exists parent_playing boolean not null default true`;
  await db.sql`alter table trial_signups add column if not exists added_member_id text`;
  // "Didn't come" (11 Nov 2026), migration 20261111000003_trial_dismissed.
  await db.sql`alter table trial_signups add column if not exists dismissed_at timestamptz`;
  await db.sql`alter table trial_signups add column if not exists dismissed_by text`;
  await ensureNicknameColumn(db);
  await ensureInviteColumns(db);
  tableReady = true;
}

const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    await ensureTable(db);
    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("scope") === "alerts") {
      const user = await getVerifiedUser(req);
      if (!user) return unauthorized();
      const caller = await ensureMember(db, user);
      if (!hasPermission(caller.roles, "manage_others_attendance")) return json({ ok: true, pending: [] });
      const upcoming = nextSessionDateISO();
      const rows = await db.sql`
        select id, first_name, last_name, phone, children, parent_playing, to_char(session_date, 'YYYY-MM-DD') as session_date
        from trial_signups
        where added_member_id is null and dismissed_at is null and session_date >= ${upcoming}::date - 14
        order by session_date asc, created_at asc
        limit 30
      `;
      return json({
        ok: true,
        upcoming,
        pending: rows.map((r: any) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          phone: r.phone,
          sessionDate: r.session_date,
          kids: Array.isArray(r.children) ? r.children.length : 0,
          parentPlaying: r.parent_playing !== false,
          missed: r.session_date < upcoming,
        })),
      });
    }

    if (req.method === "GET" && url.searchParams.get("scope") === "coordinator") {
      const user = await getVerifiedUser(req);
      if (!user) return unauthorized();
      const caller = await ensureMember(db, user);
      if (!hasPermission(caller.roles, "manage_others_attendance")) {
        return forbidden("Only Game Coordinators and Administrators can see trial signups");
      }
      const askedDate = url.searchParams.get("date");
      const sessionDate = askedDate ? requestedSessionDate(askedDate) : nextSessionDateISO();
      // This week's list (11 Nov 2026) also carries bookings from the last
      // two weeks that were never added or marked "Didn't come", so they
      // can be added to tonight without retyping their details.
      const thisWeek = sessionDate === nextSessionDateISO();
      const rows = await db.sql`
        select to_char(t.session_date, 'YYYY-MM-DD') as booked_for, t.id, t.first_name, t.last_name, t.email, t.phone, t.age, t.fin_size, t.handed, t.emergency_name, t.emergency_phone, t.heard_from, t.created_at,
               t.children, t.parent_playing, t.added_member_id, t.dismissed_at,
               m.nickname as inv_nickname, m.first_name as inv_first_name, m.last_name as inv_last_name
        from trial_signups t
        left join members m on m.id = t.invited_by
        where t.session_date = ${sessionDate}
           or (${thisWeek} and t.session_date < ${sessionDate}::date and t.session_date >= ${sessionDate}::date - 14
               and t.added_member_id is null and t.dismissed_at is null)
        order by t.session_date desc, t.created_at asc
      `;
      return json({
        ok: true,
        sessionDate,
        signups: rows.map((r: any) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          firstName: r.first_name,
          lastName: r.last_name,
          children: Array.isArray(r.children) ? r.children : [],
          parentPlaying: r.parent_playing !== false,
          added: !!r.added_member_id,
          dismissed: !!r.dismissed_at,
          bookedFor: r.booked_for,
          earlier: r.booked_for !== sessionDate,
          email: r.email,
          phone: r.phone,
          age: r.age,
          finSize: r.fin_size,
          handed: r.handed,
          emergencyName: r.emergency_name,
          emergencyPhone: r.emergency_phone,
          heardFrom: r.heard_from,
          invitedBy: r.inv_first_name || r.inv_nickname ? adminName(r.inv_nickname, r.inv_first_name, r.inv_last_name) : null,
          createdAt: r.created_at,
        })),
      });
    }

    if (req.method === "GET") {
      const r = await resolveRef(db, cleanRef(url.searchParams.get("ref")));
      const season = await getSeason(db);
      return json({ ok: true, dates: nextFourWednesdays(season), season: seasonInfo(season, nextSessionDateISO()), invite: r ? { inviterName: r.inviterName, guestName: r.guestName, children: r.children || [] } : null });
    }

    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));

    // "Didn't come" / undo, from the coordinators' trial alerts (11 Nov 2026).
    if (body.action === "dismiss" || body.action === "undismiss") {
      const user = await getVerifiedUser(req);
      if (!user) return unauthorized();
      const caller = await ensureMember(db, user);
      if (!hasPermission(caller.roles, "manage_others_attendance")) return forbidden("Only Game Coordinators and Administrators can change trial bookings");
      const id = Number(body.id);
      if (body.action === "dismiss") await db.sql`update trial_signups set dismissed_at = now(), dismissed_by = ${caller.id} where id = ${id}`;
      else await db.sql`update trial_signups set dismissed_at = null, dismissed_by = null where id = ${id}`;
      return json({ ok: true });
    }

    if (clean(body.website)) return json({ ok: true, signup: null }); // honeypot - drop silently

    const firstName = clean(body.firstName, 60);
    const lastName = clean(body.lastName, 60);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 40) || null;
    const age = Number(body.age);
    const finSize = clean(body.finSize, 20);
    const handed = body.handed === "Left" ? "Left" : "Right";
    const emergencyName = clean(body.emergencyName, 120);
    const emergencyPhone = clean(body.emergencyPhone, 40);
    const heardFrom = clean(body.heardAbout, 80) || null;
    const sessionDate = clean(body.sessionDate, 10);

    const missing: string[] = [];
    if (!firstName) missing.push("first name");
    if (!lastName) missing.push("last name");
    if (!Number.isFinite(age) || age < 5 || age > 99) missing.push("age");
    // Not needed from a parent who's only bringing the kids (5 Nov 2026).
    const bringingOnly = Array.isArray(body.children) && body.children.length > 0 && body.parentPlaying === false;
    if (!finSize && !bringingOnly) missing.push("fin / shoe size");
    if (!emergencyName) missing.push("emergency contact name");
    if (!emergencyPhone) missing.push("emergency contact phone");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push("a valid email");
    if (missing.length) return json({ ok: false, error: "Please fill in: " + missing.join(", ") }, 400);

    // Children coming too (5 Nov 2026).
    const rawKids = Array.isArray(body.children) ? body.children.filter((c: any) => c && clean(c.firstName)) : [];
    if (rawKids.length > 8) return json({ ok: false, error: "That's more than 8 children - message the club and we'll sort it out." }, 400);
    const children = [];
    for (const c of rawKids) {
      const kidAge = Number(c.age);
      if (!Number.isFinite(kidAge) || kidAge < 1 || kidAge > 17) return json({ ok: false, error: "Please enter an age (under 18) for " + clean(c.firstName, 60) + "." }, 400);
      children.push({ firstName: clean(c.firstName, 60), age: Math.floor(kidAge), finSize: clean(c.finSize, 20) || null });
    }
    const parentPlaying = !(children.length && body.parentPlaying === false);

    if (!nextFourWednesdays(await getSeason(db)).includes(sessionDate)) {
      return json({ ok: false, error: "Please pick one of the Wednesdays in the list." }, 400);
    }

    // Same person, same Wednesday: update rather than double up.
    const [existing] = await db.sql`
      select id from trial_signups where session_date = ${sessionDate} and lower(email) = ${email}
    `;
    let row;
    if (existing) {
      [row] = await db.sql`
        update trial_signups set
          first_name = ${firstName}, last_name = ${lastName}, phone = ${phone}, age = ${Math.floor(age)},
          fin_size = ${finSize}, handed = ${handed}, emergency_name = ${emergencyName},
          emergency_phone = ${emergencyPhone}, heard_from = ${heardFrom},
          children = ${JSON.stringify(children)}::jsonb, parent_playing = ${parentPlaying}
        where id = ${existing.id}
        returning id, session_date::text as session_date, first_name
      `;
    } else {
      [row] = await db.sql`
        insert into trial_signups (session_date, first_name, last_name, email, phone, age, fin_size, handed, emergency_name, emergency_phone, heard_from, children, parent_playing)
        values (${sessionDate}, ${firstName}, ${lastName}, ${email}, ${phone}, ${Math.floor(age)}, ${finSize}, ${handed}, ${emergencyName}, ${emergencyPhone}, ${heardFrom}, ${JSON.stringify(children)}::jsonb, ${parentPlaying})
        returning id, session_date::text as session_date, first_name
      `;
    }

    // Bring a Mate link (13 Oct 2026): record who brought them and move
    // the member's invite to "booked" - or, for a general share link,
    // create the invite now. One invite per signup, so re-submitting the
    // form doesn't double up.
    let invitedBy: string | null = null;
    const ref = await resolveRef(db, cleanRef(body.ref));
    if (ref) {
      invitedBy = ref.inviterName;
      await db.sql`update trial_signups set invited_by = ${ref.inviterId} where id = ${row.id}`;
      // Same person booking again (same email, maybe a different
      // Wednesday): keep their one invite and move it to the new date.
      const [already] = await db.sql`
        select i.id from invites i join trial_signups t on t.id = i.trial_signup_id
        where i.inviter_id = ${ref.inviterId} and lower(t.email) = ${email}
        order by i.id desc limit 1
      `;
      if (already) {
        await db.sql`update invites set booked_for = ${row.session_date}, trial_signup_id = ${row.id} where id = ${already.id}`;
      } else {
        // A named invite is used once; if that link gets passed on to
        // someone else, they get an invite of their own.
        const claimed = ref.inviteId
          ? await db.sql`
              update invites set status = case when status = 'registered' then status else 'booked' end,
                     trial_signup_id = ${row.id}, booked_for = ${row.session_date}
              where id = ${ref.inviteId} and trial_signup_id is null
              returning id
            `
          : [];
        if (!claimed.length) {
          await db.sql`
          insert into invites (inviter_id, guest_name, guest_email, status, token, trial_signup_id, booked_for)
          values (${ref.inviterId}, ${firstName + " " + lastName}, ${email}, 'booked', ${newToken()}, ${row.id}, ${row.session_date})
        `;
        }
      }
    }

    return json({ ok: true, signup: { id: row.id, sessionDate: row.session_date, firstName: row.first_name, invitedBy } });
  } catch (err) {
    console.error("trial-signup failed", err);
    return json({ ok: false, error: "Something went wrong saving your booking. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/trial-signup",
};
