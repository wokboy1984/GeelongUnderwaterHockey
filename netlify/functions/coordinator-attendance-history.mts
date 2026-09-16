// Administrator-only look-back over past closed-out attendance days.
// A day only appears here once a Game Coordinator has closed it out via
// /api/coordinator/checkin — this is a history/audit view, not a live
// working list.
//
// GET /api/coordinator/attendance-history            -> { ok, days: [{ sessionDate, closedAt, closedByName, attendedCount }] }
// GET /api/coordinator/attendance-history?date=YYYY-MM-DD
//   -> { ok, sessionDate, closedAt, closedByName, players: [{ firstName, lastName, emergencyName, emergencyPhone }] }
//
// Administrators only, per the club's decision that this look-back is an
// admin tool rather than something every coordinator needs day to day.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasRole, unauthorized, forbidden } from "./_shared/roles.mts";

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// The DB driver can hand a `date` column back as either a plain
// "YYYY-MM-DD" string or a native Date, depending on the value — and a raw
// Date serializes to a full ISO timestamp, which shifts a day either side
// of UTC midnight. Always normalize before it goes in the response.
function dateToString(value: string | Date): string {
  if (typeof value === "string") return value.length > 10 ? value.slice(0, 10) : value;
  return value.toISOString().slice(0, 10);
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const caller = await ensureMember(db, user);
    if (!hasRole(caller.roles, "administrator")) return forbidden("Only Administrators can view attendance history");

    // Defensive, idempotent — see the matching note in coordinator-checkin.mts.
    // This table's real migration (20260912000012_attendance_closeout) wasn't
    // actually applied against the live database, which is what surfaced
    // this bug in the first place (13 Sept 2026).
    await db.sql`create table if not exists session_attendance_closeouts(
      session_date date primary key,
      closed_at timestamptz not null default now(),
      closed_by text not null references members(id)
    )`;

    const date = new URL(req.url).searchParams.get("date");

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: "Invalid date" }, 400);
      const [closeout] = await db.sql`
        select c.closed_at, m.first_name, m.last_name
        from session_attendance_closeouts c join members m on m.id = c.closed_by
        where c.session_date = ${date}::date
      `;
      if (!closeout) return json({ ok: false, error: "That day hasn't been closed out" }, 404);
      const players = await db.sql`
        select m.first_name, m.last_name, m.emergency_name, m.emergency_phone
        from session_attendance sa join members m on m.id = sa.member_id
        where sa.session_date = ${date}::date and sa.attended = true
        order by m.first_name, m.last_name
      `;
      return json({
        ok: true,
        sessionDate: date,
        closedAt: closeout.closed_at,
        closedByName: (closeout.first_name + " " + closeout.last_name).trim(),
        players: players.map((p: any) => ({
          firstName: p.first_name,
          lastName: p.last_name,
          emergencyName: p.emergency_name,
          emergencyPhone: p.emergency_phone,
        })),
      });
    }

    const days = await db.sql`
      select c.session_date, c.closed_at, m.first_name, m.last_name,
        (select count(*)::int from session_attendance sa where sa.session_date = c.session_date and sa.attended = true) as attended_count
      from session_attendance_closeouts c join members m on m.id = c.closed_by
      order by c.session_date desc
      limit 60
    `;
    return json({
      ok: true,
      days: days.map((d: any) => ({
        sessionDate: dateToString(d.session_date),
        closedAt: d.closed_at,
        closedByName: (d.first_name + " " + d.last_name).trim(),
        attendedCount: d.attended_count,
      })),
    });
  } catch (err) {
    // Was returning the raw driver error (String(err)) straight to the
    // client — that's what exposed the bare SQL/params text in the UI.
    // Log the real error server-side and give the client a plain message,
    // matching every other function in this project (13 Sept 2026).
    console.error("Attendance history request failed", err);
    return json({ ok: false, error: "Could not load attendance history. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/coordinator/attendance-history",
};
