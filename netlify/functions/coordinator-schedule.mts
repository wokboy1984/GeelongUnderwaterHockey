// Game Coordinator timetable — add/edit/remove game slots for the night and
// assign two of this session's teams to each slot. Referees for a slot are
// computed, not stored: any confirmed player who isn't on either team
// playing that slot is shown as a possible referee for it.
//
// GET  /api/coordinator/schedule -> { ok, sessionDate, teams, slots }
// POST /api/coordinator/schedule { action: "add_slot", label, startMin, durationMin }
// POST /api/coordinator/schedule { action: "update_slot", slotId, label, startMin, durationMin, teamAId, teamBId }
// POST /api/coordinator/schedule { action: "remove_slot", slotId }
//
// Requires 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

function nextWednesdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  let add = (3 - day + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, isNew: r.is_new };
}

async function fullSchedule(db: any, sessionId: number, sessionDate: string) {
  const teamRows = await db.sql`select id, name from game_teams where session_id = ${sessionId} order by created_at asc`;
  const teams = teamRows.map((t: any) => ({ id: t.id, name: t.name }));

  const confirmedRows = await db.sql`
    select m.id, m.first_name, m.last_name, m.is_new, ta.team_id
    from bookings b
    join members m on m.id = b.member_id
    left join team_assignments ta on ta.member_id = m.id and ta.session_id = b.session_id
    where b.session_id = ${sessionId} and b.status = 'in'
  `;

  const slotRows = await db.sql`
    select id, slot_order, label, start_min, duration_min, team_a_id, team_b_id
    from game_slots where session_id = ${sessionId} order by slot_order asc
  `;

  const teamName = (id: number | null) => (id ? (teams.find((t: any) => t.id === id) || {}).name || null : null);

  const slots = slotRows.map((s: any) => {
    // Anyone confirmed for the night who isn't on either team playing this
    // slot is a possible referee for it — includes players on other teams
    // and players not yet assigned to any team.
    const referees = confirmedRows
      .filter((p: any) => p.team_id !== s.team_a_id && p.team_id !== s.team_b_id)
      .map(shapePlayer);
    return {
      id: s.id,
      order: s.slot_order,
      label: s.label,
      startMin: s.start_min,
      durationMin: s.duration_min,
      teamAId: s.team_a_id,
      teamAName: teamName(s.team_a_id),
      teamBId: s.team_b_id,
      teamBName: teamName(s.team_b_id),
      referees,
    };
  });

  return { ok: true, sessionDate, teams, slots };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "arrange_teams")) {
    return forbidden("Only Game Coordinators and Administrators can arrange the timetable");
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
      const action = String(body.action || "");

      if (action === "add_slot") {
        const label = String(body.label || "").trim() || "Game";
        const startMin = body.startMin === "" || body.startMin == null ? null : Number(body.startMin);
        const durationMin = body.durationMin === "" || body.durationMin == null ? null : Number(body.durationMin);
        const [{ next }] = await db.sql`
          select coalesce(max(slot_order), 0) + 1 as next from game_slots where session_id = ${sessionId}
        `;
        const [slot] = await db.sql`
          insert into game_slots (session_id, slot_order, label, start_min, duration_min)
          values (${sessionId}, ${next}, ${label}, ${startMin}, ${durationMin})
          returning id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "schedule_slot_added",
          resourceType: "game_slot", resourceId: String(slot.id),
          newValue: { sessionDate, label }, note: `${caller.email} added "${label}" to the timetable`,
        });
      } else if (action === "update_slot") {
        const slotId = Number(body.slotId);
        if (slotId) {
          const label = body.label != null ? String(body.label).trim() : null;
          const startMin = body.startMin === "" || body.startMin == null ? null : Number(body.startMin);
          const durationMin = body.durationMin === "" || body.durationMin == null ? null : Number(body.durationMin);
          const teamAId = body.teamAId === "" || body.teamAId == null ? null : Number(body.teamAId);
          const teamBId = body.teamBId === "" || body.teamBId == null ? null : Number(body.teamBId);
          await db.sql`
            update game_slots set
              label = coalesce(${label}, label),
              start_min = ${startMin},
              duration_min = ${durationMin},
              team_a_id = ${teamAId},
              team_b_id = ${teamBId}
            where id = ${slotId} and session_id = ${sessionId}
          `;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "schedule_slot_updated",
            resourceType: "game_slot", resourceId: String(slotId),
            newValue: { teamAId, teamBId, startMin, durationMin }, note: `${caller.email} updated a timetable slot`,
          });
        }
      } else if (action === "remove_slot") {
        const slotId = Number(body.slotId);
        if (slotId) {
          await db.sql`delete from game_slots where id = ${slotId} and session_id = ${sessionId}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "schedule_slot_removed",
            resourceType: "game_slot", resourceId: String(slotId),
            note: `${caller.email} removed a timetable slot`,
          });
        }
      }
    }

    return new Response(JSON.stringify(await fullSchedule(db, sessionId, sessionDate)), {
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
  path: "/api/coordinator/schedule",
};
