// Game Coordinator team builder — coordinator creates any number of named
// teams for the night, assigns confirmed players to them, and publishes.
// Real data, backed by game_teams + team_assignments.
//
// GET  /api/coordinator/teams -> { ok, sessionDate, published, confirmed, teams, unassigned }
// POST /api/coordinator/teams { action: "create_team", name }
// POST /api/coordinator/teams { action: "rename_team", teamId, name }
// POST /api/coordinator/teams { action: "delete_team", teamId }
// POST /api/coordinator/teams { action: "assign", memberEmail, teamId }
// POST /api/coordinator/teams { action: "unassign", memberEmail }
// POST /api/coordinator/teams { action: "publish", published }
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
  return { id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, isNew: r.is_new };
}

async function fullBoard(db: any, sessionId: number, published: boolean, sessionDate: string) {
  const confirmedRows = await db.sql`
    select m.id, m.email, m.first_name, m.last_name, m.is_new
    from bookings b join members m on m.id = b.member_id
    where b.session_id = ${sessionId} and b.status = 'in'
    order by b.created_at asc
  `;
  const confirmed = confirmedRows.map(shapePlayer);

  const teamRows = await db.sql`
    select id, name from game_teams where session_id = ${sessionId} order by created_at asc
  `;

  const assignedRows = await db.sql`
    select m.id, m.email, m.first_name, m.last_name, m.is_new, ta.team_id
    from team_assignments ta join members m on m.id = ta.member_id
    where ta.session_id = ${sessionId}
  `;
  const byTeam: Record<number, any[]> = {};
  const assignedIds = new Set<string>();
  assignedRows.forEach((r: any) => {
    if (!byTeam[r.team_id]) byTeam[r.team_id] = [];
    byTeam[r.team_id].push(shapePlayer(r));
    assignedIds.add(r.id);
  });

  const teams = teamRows.map((t: any) => ({ id: t.id, name: t.name, players: byTeam[t.id] || [] }));
  const unassigned = confirmed.filter((p: any) => !assignedIds.has(p.id));

  return { ok: true, sessionDate, published, confirmed, teams, unassigned };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "arrange_teams")) {
    return forbidden("Only Game Coordinators and Administrators can arrange teams");
  }

  try {
    const sessionDate = nextWednesdayISO();
    const [session] = await db.sql`
      insert into sessions (session_date)
      values (${sessionDate})
      on conflict (session_date) do update set session_date = excluded.session_date
      returning id, published
    `;
    const sessionId = session.id;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");

      if (action === "create_team") {
        const name = String(body.name || "").trim();
        if (!name) {
          return new Response(JSON.stringify({ ok: false, error: "Team name is required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const [team] = await db.sql`
          insert into game_teams (session_id, name) values (${sessionId}, ${name}) returning id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "team_created",
          resourceType: "game_team", resourceId: String(team.id),
          newValue: { sessionDate, name }, note: `${caller.email} created team "${name}"`,
        });
      } else if (action === "rename_team") {
        const teamId = Number(body.teamId);
        const name = String(body.name || "").trim();
        if (teamId && name) {
          await db.sql`update game_teams set name = ${name} where id = ${teamId} and session_id = ${sessionId}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "team_renamed",
            resourceType: "game_team", resourceId: String(teamId),
            newValue: { name }, note: `${caller.email} renamed a team to "${name}"`,
          });
        }
      } else if (action === "delete_team") {
        const teamId = Number(body.teamId);
        if (teamId) {
          await db.sql`delete from game_teams where id = ${teamId} and session_id = ${sessionId}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "team_deleted",
            resourceType: "game_team", resourceId: String(teamId),
            note: `${caller.email} deleted a team`,
          });
        }
      } else if (action === "assign") {
        const teamId = Number(body.teamId);
        const [target] = await db.sql`select id, email from members where email = ${String(body.memberEmail || "").trim()}`;
        if (!target) {
          return new Response(JSON.stringify({ ok: false, error: "No member found with that email" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        const [team] = await db.sql`select id from game_teams where id = ${teamId} and session_id = ${sessionId}`;
        if (!team) {
          return new Response(JSON.stringify({ ok: false, error: "That team doesn't exist for this session" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        await db.sql`
          insert into team_assignments (session_id, team_id, member_id)
          values (${sessionId}, ${teamId}, ${target.id})
          on conflict (session_id, member_id) do update set team_id = excluded.team_id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "team_assignment_changed",
          resourceType: "team_assignment", resourceId: target.id,
          newValue: { sessionDate, teamId }, note: `${caller.email} assigned ${target.email} to a team`,
        });
      } else if (action === "unassign") {
        const [target] = await db.sql`select id, email from members where email = ${String(body.memberEmail || "").trim()}`;
        if (target) {
          await db.sql`delete from team_assignments where session_id = ${sessionId} and member_id = ${target.id}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "team_assignment_changed",
            resourceType: "team_assignment", resourceId: target.id,
            previousValue: { sessionDate }, note: `${caller.email} unassigned ${target.email}`,
          });
        }
      } else if (action === "publish") {
        const published = !!body.published;
        await db.sql`update sessions set published = ${published} where id = ${sessionId}`;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email,
          action: published ? "game_board_published" : "game_board_unpublished",
          resourceType: "session", resourceId: String(sessionId),
          newValue: { sessionDate, published }, note: `${caller.email} ${published ? "published" : "unpublished"} the board for ${sessionDate}`,
        });
      }
    }

    const [freshSession] = await db.sql`select published from sessions where id = ${sessionId}`;
    return new Response(JSON.stringify(await fullBoard(db, sessionId, freshSession.published, sessionDate)), {
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
  path: "/api/coordinator/teams",
};
