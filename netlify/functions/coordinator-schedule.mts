// Game Coordinator timetable — add/edit/remove game slots for the night and
// assign two of this session's teams to each slot.
//
// GET  /api/coordinator/schedule -> { ok, sessionDate, teams, slots }
// POST /api/coordinator/schedule { action: "add_slot", label, startMin, durationMin, pool }
// POST /api/coordinator/schedule { action: "update_slot", slotId, label, startMin, durationMin, teamAId, teamBId, pool }
// POST /api/coordinator/schedule { action: "remove_slot", slotId }
// POST /api/coordinator/schedule { action: "assign_referee", slotId, memberId }
// POST /api/coordinator/schedule { action: "unassign_referee", slotId, memberId }
//
// update_slot always overwrites every field — the frontend resends the
// slot's full current state plus whatever changed, rather than patching
// one field at a time, so a team pick can never silently blank the time.
//
// pool is optional and just a label ("Pool A" / "Pool B" / not set) for
// when two games run side by side at the same time — it doesn't affect
// which teams or referees are picked for the slot.
//
// Referees are a real, coordinator-picked assignment (game_slot_referees),
// not an auto-computed "everyone not playing" list — each slot response
// includes both the confirmed `referees` and the `eligible` pool the
// frontend should offer in a dropdown (anyone confirmed who isn't on
// either team playing that slot and isn't already a ref for it).
//
// Requires 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

const POOLS = ["Pool A", "Pool B"];
function cleanPool(value: unknown): string | null {
  const p = String(value || "").trim();
  return POOLS.includes(p) ? p : null;
}

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
    select id, slot_order, label, start_min, duration_min, team_a_id, team_b_id, pool
    from game_slots where session_id = ${sessionId} order by slot_order asc
  `;

  const refRows = await db.sql`
    select gsr.slot_id, m.id, m.first_name, m.last_name, m.is_new
    from game_slot_referees gsr join members m on m.id = gsr.member_id
    where gsr.slot_id in (select id from game_slots where session_id = ${sessionId})
  `;
  const refsBySlot: Record<number, any[]> = {};
  refRows.forEach((r: any) => {
    if (!refsBySlot[r.slot_id]) refsBySlot[r.slot_id] = [];
    refsBySlot[r.slot_id].push(shapePlayer(r));
  });

  const teamName = (id: number | null) => (id ? (teams.find((t: any) => t.id === id) || {}).name || null : null);

  const slots = slotRows.map((s: any) => {
    const referees = refsBySlot[s.id] || [];
    const refereeIds = new Set(referees.map((r: any) => r.id));
    // Anyone confirmed for the night who isn't on either team playing this
    // slot, and isn't already picked as a ref for it, is a candidate the
    // coordinator can choose from.
    const eligible = confirmedRows
      .filter((p: any) => p.team_id !== s.team_a_id && p.team_id !== s.team_b_id && !refereeIds.has(p.id))
      .map(shapePlayer);
    return {
      id: s.id,
      order: s.slot_order,
      label: s.label,
      startMin: s.start_min,
      durationMin: s.duration_min,
      pool: s.pool,
      teamAId: s.team_a_id,
      teamAName: teamName(s.team_a_id),
      teamBId: s.team_b_id,
      teamBName: teamName(s.team_b_id),
      referees,
      eligible,
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
        const pool = cleanPool(body.pool);
        const [{ next }] = await db.sql`
          select coalesce(max(slot_order), 0) + 1 as next from game_slots where session_id = ${sessionId}
        `;
        const [slot] = await db.sql`
          insert into game_slots (session_id, slot_order, label, start_min, duration_min, pool)
          values (${sessionId}, ${next}, ${label}, ${startMin}, ${durationMin}, ${pool})
          returning id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "schedule_slot_added",
          resourceType: "game_slot", resourceId: String(slot.id),
          newValue: { sessionDate, label, pool }, note: `${caller.email} added "${label}" to the timetable`,
        });
      } else if (action === "update_slot") {
        const slotId = Number(body.slotId);
        if (slotId) {
          // Always overwrites every field — the frontend resends the
          // slot's full current state, so this can never silently blank
          // one field (e.g. the time) while only meaning to change another.
          const label = String(body.label || "").trim() || "Game";
          const startMin = body.startMin === "" || body.startMin == null ? null : Number(body.startMin);
          const durationMin = body.durationMin === "" || body.durationMin == null ? null : Number(body.durationMin);
          const teamAId = body.teamAId === "" || body.teamAId == null ? null : Number(body.teamAId);
          const teamBId = body.teamBId === "" || body.teamBId == null ? null : Number(body.teamBId);
          const pool = cleanPool(body.pool);
          await db.sql`
            update game_slots set
              label = ${label},
              start_min = ${startMin},
              duration_min = ${durationMin},
              team_a_id = ${teamAId},
              team_b_id = ${teamBId},
              pool = ${pool}
            where id = ${slotId} and session_id = ${sessionId}
          `;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "schedule_slot_updated",
            resourceType: "game_slot", resourceId: String(slotId),
            newValue: { teamAId, teamBId, startMin, durationMin, pool }, note: `${caller.email} updated a timetable slot`,
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
      } else if (action === "assign_referee") {
        const slotId = Number(body.slotId);
        const memberId = String(body.memberId || "").trim();
        const [slot] = await db.sql`select id, team_a_id, team_b_id from game_slots where id = ${slotId} and session_id = ${sessionId}`;
        if (!slot) {
          return new Response(JSON.stringify({ ok: false, error: "That game isn't part of this session" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const [target] = await db.sql`select id, email from members where id = ${memberId}`;
        if (!target) {
          return new Response(JSON.stringify({ ok: false, error: "No such member" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        const [assignment] = await db.sql`select team_id from team_assignments where session_id = ${sessionId} and member_id = ${memberId}`;
        const playingTeamId = assignment ? assignment.team_id : null;
        if (playingTeamId && (playingTeamId === slot.team_a_id || playingTeamId === slot.team_b_id)) {
          return new Response(JSON.stringify({ ok: false, error: "That player is on one of the teams playing this game" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        await db.sql`
          insert into game_slot_referees (slot_id, member_id) values (${slotId}, ${memberId})
          on conflict (slot_id, member_id) do nothing
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "referee_assigned",
          resourceType: "game_slot", resourceId: String(slotId),
          newValue: { memberId }, note: `${caller.email} added ${target.email} as a referee`,
        });
      } else if (action === "unassign_referee") {
        const slotId = Number(body.slotId);
        const memberId = String(body.memberId || "").trim();
        await db.sql`delete from game_slot_referees where slot_id = ${slotId} and member_id = ${memberId}`;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "referee_unassigned",
          resourceType: "game_slot", resourceId: String(slotId),
          note: `${caller.email} removed a referee from a game`,
        });
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
