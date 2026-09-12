// Read-only "This Week's Game" for any logged-in member — shows the
// published timetable, or nothing if the Game Coordinator hasn't published
// yet. No permission beyond being a registered member is needed to view.
//
// GET /api/game-board -> { ok, sessionDate, published, rows? }
//
// Each row is either a non-game activity or a 'game' row with up to two
// simultaneous pool games (Pool A / Pool B), each carrying its own
// black-stick/white-stick teams and referees — the five-column public shape
// (Time, Pool A Black, Pool A White, Pool B Black, Pool B White) is built
// from this on the frontend; this endpoint just serves the ordered rows.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, unauthorized } from "./_shared/roles.mts";
import { POOLS, ROW_TYPE_LABELS } from "./_shared/timetable.mts";

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
    const teamNames: Record<number, string> = {};
    teamRows.forEach((t: any) => { teamNames[t.id] = t.name; });

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

    const rowRows = await db.sql`
      select id, row_order, row_type, label, start_min, duration_min, notes
      from timetable_rows
      where session_id = ${session.id} and archived_at is null
      order by row_order asc, id asc
    `;
    const rowIds = rowRows.map((r: any) => r.id);
    const poolGameRows = rowIds.length
      ? await db.sql`select id, row_id, pool, black_team_id, white_team_id from timetable_pool_games where row_id = any(${rowIds})`
      : [];
    const poolGameIds = poolGameRows.map((r: any) => r.id);
    const refRows = poolGameIds.length
      ? await db.sql`
          select tpr.pool_game_id, m.id, m.first_name, m.last_name, m.is_new
          from timetable_pool_referees tpr join members m on m.id = tpr.member_id
          where tpr.pool_game_id = any(${poolGameIds})
        `
      : [];
    const refsByPG: Record<number, any[]> = {};
    refRows.forEach((r: any) => {
      if (!refsByPG[r.pool_game_id]) refsByPG[r.pool_game_id] = [];
      refsByPG[r.pool_game_id].push(shapePlayer(r));
    });
    const pgsByRow: Record<number, any[]> = {};
    poolGameRows.forEach((pg: any) => {
      if (!pgsByRow[pg.row_id]) pgsByRow[pg.row_id] = [];
      pgsByRow[pg.row_id].push(pg);
    });

    const rows = rowRows.map((r: any) => {
      const pgs = pgsByRow[r.id] || [];
      const poolGames = POOLS.map((pool) => {
        const pg = pgs.find((x: any) => x.pool === pool);
        return {
          pool,
          blackTeamName: pg && pg.black_team_id != null ? teamNames[pg.black_team_id] || null : null,
          whiteTeamName: pg && pg.white_team_id != null ? teamNames[pg.white_team_id] || null : null,
          referees: pg ? refsByPG[pg.id] || [] : [],
        };
      });
      return {
        id: r.id,
        rowType: r.row_type,
        rowTypeLabel: ROW_TYPE_LABELS[r.row_type as keyof typeof ROW_TYPE_LABELS] || r.row_type,
        label: r.label,
        startMin: r.start_min,
        durationMin: r.duration_min,
        notes: r.notes,
        isGame: r.row_type === "game",
        poolGames,
      };
    });

    return new Response(JSON.stringify({ ok: true, sessionDate, published: true, teams, rows }), {
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
