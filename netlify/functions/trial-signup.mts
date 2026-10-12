// Free trial ("Book your first session") signups - 2 Oct 2026.
//
// Before this, the public /new-player form only wrote to the demo
// localStorage store, so on the live site nothing was saved and nobody at
// the club knew a newcomer was coming.
//
// GET  /api/trial-signup
//        -> { ok, dates: ["YYYY-MM-DD" x4] }   the next four Wednesdays (public)
// GET  /api/trial-signup?scope=coordinator
//        -> { ok, sessionDate, signups[] }     newcomers booked for the upcoming
//                                              Wednesday, with gear + emergency
//                                              details. Game Coordinator /
//                                              Administrator only.
// POST /api/trial-signup { firstName, lastName, age, finSize, handed,
//                          emergencyName, emergencyPhone, phone, email,
//                          sessionDate, heardAbout, website }
//        -> { ok, signup }                     public, no login
//
// `website` is a honeypot: a hidden field real people never fill in. If it
// has anything in it, the request is treated as a bot and quietly dropped.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, unauthorized, forbidden } from "./_shared/roles.mts";
import { nextSessionDateISO } from "./_shared/attendance.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// The next four Wednesdays, starting with the upcoming one (which is today
// on a Wednesday - same rule as the rest of the site).
function nextFourWednesdays(): string[] {
  const first = nextSessionDateISO();
  const [y, m, d] = first.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [0, 1, 2, 3].map((i) => {
    const dt = new Date(base + i * 7 * 86400000);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  });
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
  tableReady = true;
}

const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    await ensureTable(db);
    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("scope") === "coordinator") {
      const user = await getVerifiedUser(req);
      if (!user) return unauthorized();
      const caller = await ensureMember(db, user);
      if (!hasPermission(caller.roles, "manage_others_attendance")) {
        return forbidden("Only Game Coordinators and Administrators can see trial signups");
      }
      const sessionDate = nextSessionDateISO();
      const rows = await db.sql`
        select id, first_name, last_name, email, phone, age, fin_size, handed, emergency_name, emergency_phone, heard_from, created_at
        from trial_signups
        where session_date = ${sessionDate}
        order by created_at asc
      `;
      return json({
        ok: true,
        sessionDate,
        signups: rows.map((r: any) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          email: r.email,
          phone: r.phone,
          age: r.age,
          finSize: r.fin_size,
          handed: r.handed,
          emergencyName: r.emergency_name,
          emergencyPhone: r.emergency_phone,
          heardFrom: r.heard_from,
          createdAt: r.created_at,
        })),
      });
    }

    if (req.method === "GET") {
      return json({ ok: true, dates: nextFourWednesdays() });
    }

    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
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
    if (!finSize) missing.push("fin / shoe size");
    if (!emergencyName) missing.push("emergency contact name");
    if (!emergencyPhone) missing.push("emergency contact phone");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push("a valid email");
    if (missing.length) return json({ ok: false, error: "Please fill in: " + missing.join(", ") }, 400);

    if (!nextFourWednesdays().includes(sessionDate)) {
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
          emergency_phone = ${emergencyPhone}, heard_from = ${heardFrom}
        where id = ${existing.id}
        returning id, session_date::text as session_date, first_name
      `;
    } else {
      [row] = await db.sql`
        insert into trial_signups (session_date, first_name, last_name, email, phone, age, fin_size, handed, emergency_name, emergency_phone, heard_from)
        values (${sessionDate}, ${firstName}, ${lastName}, ${email}, ${phone}, ${Math.floor(age)}, ${finSize}, ${handed}, ${emergencyName}, ${emergencyPhone}, ${heardFrom})
        returning id, session_date::text as session_date, first_name
      `;
    }

    return json({ ok: true, signup: { id: row.id, sessionDate: row.session_date, firstName: row.first_name } });
  } catch (err) {
    console.error("trial-signup failed", err);
    return json({ ok: false, error: "Something went wrong saving your booking. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/trial-signup",
};
