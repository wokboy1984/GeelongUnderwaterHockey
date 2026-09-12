// Read-only "This Week's Game" for any logged-in member — shows the
// published teams and timetable, or nothing if the Game Coordinator hasn't
// published yet. No permission beyond being a registered member is needed
// to view this.
//
// GET /api/game-board -> { ok, sessionDate, published, teams?, slots? }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, unauthorized } from "./_shared/roles.mts";

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

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    await ensureMember(db, user); // any registered member can view

    const sessionDate = nextWednesdayISO();
    const [session] = await db.sql`select id, published from sessions where session_date = ${sessionDate}`;

    if (!session || !session.published) {
      return new Response(JSON.stringify({ ok: true, sessionDate, published: false }), {
        headers: { "content-type": "application/json" },
      });
    }

    const teamRows = await db.sql`select id, name from game_teams where session_id = ${session.id} order by created_at asc`;
    const assignedRows = await db.sql`
      select m.id, m.first_name, m.last_name, m.is_new, ta.team_id
      from team_assignments ta join members m on m.id = ta.member_id
      where ta.session_id = ${session.id}
    `;
    const byTeam: Record<number, any[]> = {};
    assignedRows.forEach((r: any) => {
      if (!byTeam[r.team_id]) byTeam[r.team_id] = [];
      byTeam[r.team_id].push(shapePlayer(r));
    });
    const teams = teamRows.map((t: any) => ({ id: t.id, name: t.name, players: byTeam[t.id] || [] }));

    const confirmedRows = await db.sql`
      select m.id, m.first_name, m.last_name, m.is_new, ta.team_id
      from bookings b
      join members m on m.id = b.member_id
      left join team_assignments ta on ta.member_id = m.id and ta.session_id = b.session_id
      where b.session_id = ${session.id} and b.status = 'in'
    `;

    const slotRows = await db.sql`
      select id, slot_order, label, start_min, duration_min, team_a_id, team_b_id
      from game_slots where session_id = ${session.id} order by slot_order asc
    `;
    const teamName = (id: number | null) => (id ? (teams.find((t: any) => t.id === id) || {}).name || null : null);
    const slots = slotRows.map((s: any) => ({
      id: s.id,
      label: s.label,
      startMin: s.start_min,
      durationMin: s.duration_min,
      teamAName: teamName(s.team_a_id),
      teamBName: teamName(s.team_b_id),
      referees: confirmedRows
        .filter((p: any) => p.team_id !== s.team_a_id && p.team_id !== s.team_b_id)
        .map(shapePlayer),
    }));

    return new Response(JSON.stringify({ ok: true, sessionDate, published: true, teams, slots }), {
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
  path: "/api/game-board",
};
