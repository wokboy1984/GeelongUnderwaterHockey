// Game Coordinator attendance tools: see who's confirmed for this
// Wednesday, and add or cancel a real member's attendance on their behalf
// (e.g. someone calls in sick, or asks to be added at the pool). Scoped to
// registered members only for now — walk-in guests with no account aren't
// covered here yet (Bring a Mate invites exist, but there's no attendance
// record for a guest until they have their own login).
//
// GET  /api/coordinator/attendance -> { ok, sessionDate, players: [...] }
// POST /api/coordinator/attendance { memberEmail, in } -> same shape
//
// Requires the caller to hold 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, isGrade, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

function nextWednesdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  let add = (3 - day + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function playerList(db: any, sessionId: number) {
  const rows = await db.sql`
    select m.id, m.email, m.first_name, m.last_name, m.is_new, m.grade
    from bookings b
    join members m on m.id = b.member_id
    where b.session_id = ${sessionId} and b.status = 'in'
    order by b.created_at asc
  `;
  return rows.map((r: any) => ({ id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, isNew: r.is_new, grade: r.grade }));
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "manage_others_attendance")) {
    return forbidden("Only Game Coordinators and Administrators can manage attendance");
  }

  try {
    const sessionDate = nextWednesdayISO();
    const [session] = await db.sql`
      insert into sessions (session_date)
      values (${sessionDate})
      on conflict (session_date) do update set session_date = excluded.session_date
      returning id
    `;
    const sessionId = session.id;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const memberEmail = String(body.memberEmail || "").trim();
      const [target] = await db.sql`select id, email from members where email = ${memberEmail}`;
      if (!target) {
        return new Response(
          JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      if (body.grade !== undefined) {
        // Grade override — a coordinator/admin correcting or setting a
        // player's grade after seeing them play, separate from attendance.
        const rawGrade = String(body.grade || "").trim();
        if (rawGrade && !isGrade(rawGrade)) {
          return new Response(JSON.stringify({ ok: false, error: "Not a valid grade" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const grade = rawGrade || null;
        await db.sql`update members set grade = ${grade} where id = ${target.id}`;
        await logAudit(db, {
          actorId: caller.id,
          actorEmail: caller.email,
          action: "grade_overridden",
          resourceType: "member",
          resourceId: target.id,
          newValue: { grade },
          note: `${caller.email} set ${target.email}'s grade to ${grade || "(unset)"}`,
        });
      } else {
        const wantsIn = !!body.in;
        await db.sql`
          insert into bookings (session_id, member_id, status)
          values (${sessionId}, ${target.id}, ${wantsIn ? "in" : "out"})
          on conflict (session_id, member_id) do update set status = excluded.status
        `;
        await logAudit(db, {
          actorId: caller.id,
          actorEmail: caller.email,
          action: "attendance_changed_by_coordinator",
          resourceType: "booking",
          resourceId: target.id,
          newValue: { sessionDate, in: wantsIn },
          note: `${caller.email} set ${target.email} to ${wantsIn ? "in" : "out"} for ${sessionDate}`,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, sessionDate, players: await playerList(db, sessionId) }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/coordinator/attendance",
};
