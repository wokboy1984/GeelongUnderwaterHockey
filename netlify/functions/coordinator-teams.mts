// Game Coordinator team builder + publish — real data, backed by
// team_assignments and sessions.published. Deliberately simple (assign one
// member to one pool/cap via a dropdown-driven call from the frontend)
// rather than drag-and-drop; the real value here is real, persisted,
// server-enforced team assignment, not the interaction style.
//
// GET  /api/coordinator/teams -> full draft board (confirmed, assignments, unassigned, published)
// POST /api/coordinator/teams { action: "assign", memberEmail, pool, cap }
// POST /api/coordinator/teams { action: "unassign", memberEmail }
// POST /api/coordinator/teams { action: "publish", published }
//
// Requires 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

const POOLS = ["Pool A", "Pool B"];
const CAPS = ["White", "Black"];

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

  const assignedRows = await db.sql`
    select m.id, m.email, m.first_name, m.last_name, m.is_new, ta.pool, ta.cap_colour
    from team_assignments ta join members m on m.id = ta.member_id
    where ta.session_id = ${sessionId}
  `;

  const assignments: Record<string, Record<string, any[]>> = {
    "Pool A": { White: [], Black: [] },
    "Pool B": { White: [], Black: [] },
  };
  const assignedIds = new Set<string>();
  assignedRows.forEach((r: any) => {
    if (assignments[r.pool] && assignments[r.pool][r.cap_colour]) {
      assignments[r.pool][r.cap_colour].push(shapePlayer(r));
      assignedIds.add(r.id);
    }
  });

  const unassigned = confirmed.filter((p: any) => !assignedIds.has(p.id));

  return { ok: true, sessionDate, published, confirmed, assignments, unassigned };
}

export default async (req: Request, context: Context) => {
  const user = context.clientContext?.user;
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

      if (action === "assign") {
        const pool = String(body.pool || "");
        const cap = String(body.cap || "");
        if (!POOLS.includes(pool) || !CAPS.includes(cap)) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid pool or cap colour" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const [target] = await db.sql`select id, email from members where email = ${String(body.memberEmail || "").trim()}`;
        if (!target) {
          return new Response(JSON.stringify({ ok: false, error: "No member found with that email" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        await db.sql`
          insert into team_assignments (session_id, pool, cap_colour, member_id)
          values (${sessionId}, ${pool}, ${cap}, ${target.id})
          on conflict (session_id, member_id) do update set pool = excluded.pool, cap_colour = excluded.cap_colour
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "team_assignment_changed",
          resourceType: "team_assignment", resourceId: target.id,
          newValue: { sessionDate, pool, cap }, note: `${caller.email} assigned ${target.email} to ${pool} ${cap}`,
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
