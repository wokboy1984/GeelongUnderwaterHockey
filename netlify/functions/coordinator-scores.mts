// Game scores + per-player goals — entered by the Game Coordinator after a
// session's games are done (not live during play, not self-service for
// referees). One pool game = one final score plus zero or more scorers.
//
// GET  /api/coordinator/scores[?date=YYYY-MM-DD] -> { ok, sessionDate, upcoming, weeks, games, seasonLeaders }
// POST /api/coordinator/scores { sessionDate, poolGameId, blackScore, whiteScore, goals: { memberId: goals, ... } }
//
// Week by week (2 Oct 2026): scores used to be tied to "the upcoming
// Wednesday", which flips to next week at midnight Wednesday - so the
// night after a game there was no way to enter its scores. Now any week up
// to the upcoming one can be opened and scored. With no ?date, it opens
// the most recent week that has games in its timetable (so on a Thursday
// you land on last night, not an empty next week). `weeks` lists every
// week with games, newest first, plus the upcoming one.
//
// Requires 'record_scores' (game_coordinator or administrator).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, ensureNicknameColumn, getVerifiedUser, hasPermission, logAudit, shortName, unauthorized, forbidden } from "./_shared/roles.mts";
import { POOLS } from "./_shared/timetable.mts";
import { nextSessionDateISO, requestedSessionDate } from "./_shared/attendance.mts";

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, displayName: shortName(r.nickname, r.first_name, r.last_name) };
}

// Weeks that have at least one game row, newest first, up to the upcoming
// Wednesday (always included so the coordinator can get back to it).
async function weeksWithGames(db: any, upcoming: string): Promise<string[]> {
  const rows = await db.sql`
    select distinct s.session_date::text as d
    from sessions s join timetable_rows tr on tr.session_id = s.id
    where tr.row_type = 'game' and tr.archived_at is null and s.session_date <= ${upcoming}
    order by d desc
    limit 104
  `;
  const weeks: string[] = rows.map((r: any) => r.d);
  if (!weeks.includes(upcoming)) weeks.unshift(upcoming);
  return weeks.sort().reverse();
}

async function buildResponse(db: any, sessionId: number | null, sessionDate: string, upcoming: string) {
  const weeks = await weeksWithGames(db, upcoming);
  if (sessionId == null) {
    return { ok: true, sessionDate, upcoming, weeks, games: [], seasonLeaders: [] };
  }
  const teamRows = await db.sql`select id, name from game_teams where session_id = ${sessionId} order by created_at asc`;
  const teamNames: Record<number, string> = {};
  teamRows.forEach((t: any) => { teamNames[t.id] = t.name; });

  const assignedRows = await db.sql`
    select ta.team_id, m.id, m.nickname, m.first_name, m.last_name
    from team_assignments ta join members m on m.id = ta.member_id
    where ta.session_id = ${sessionId}
  `;
  const rosterByTeam: Record<number, any[]> = {};
  assignedRows.forEach((r: any) => {
    if (!rosterByTeam[r.team_id]) rosterByTeam[r.team_id] = [];
    rosterByTeam[r.team_id].push(shapePlayer(r));
  });

  const rowRows = await db.sql`
    select id, row_order, label, start_min
    from timetable_rows
    where session_id = ${sessionId} and row_type = 'game' and archived_at is null
    order by row_order asc, id asc
  `;
  const rowIds = rowRows.map((r: any) => r.id);
  const pgRows = rowIds.length
    ? await db.sql`
        select id, row_id, pool, black_team_id, white_team_id, black_score, white_score
        from timetable_pool_games where row_id = any(${rowIds})
      `
    : [];
  const pgIds = pgRows.map((r: any) => r.id);
  const goalRows = pgIds.length
    ? await db.sql`select pool_game_id, member_id, goals from game_goals where pool_game_id = any(${pgIds})`
    : [];
  const goalsByPG: Record<number, Record<string, number>> = {};
  goalRows.forEach((r: any) => {
    if (!goalsByPG[r.pool_game_id]) goalsByPG[r.pool_game_id] = {};
    goalsByPG[r.pool_game_id][r.member_id] = r.goals;
  });
  const pgsByRow: Record<number, any[]> = {};
  pgRows.forEach((pg: any) => {
    if (!pgsByRow[pg.row_id]) pgsByRow[pg.row_id] = [];
    pgsByRow[pg.row_id].push(pg);
  });

  function teamSide(teamId: number | null, pgId: number | null) {
    if (teamId == null) return null;
    const goals = pgId != null ? goalsByPG[pgId] || {} : {};
    return {
      id: teamId,
      name: teamNames[teamId] || "Unknown team",
      players: (rosterByTeam[teamId] || []).map((p) => Object.assign({}, p, { goals: goals[p.id] || 0 })),
    };
  }

  const games = rowRows.map((row: any) => {
    const pgs = pgsByRow[row.id] || [];
    return {
      rowId: row.id,
      label: row.label,
      startMin: row.start_min,
      poolGames: POOLS.map((pool) => {
        const pg = pgs.find((x: any) => x.pool === pool);
        return {
          id: pg ? pg.id : null,
          pool,
          black: pg ? teamSide(pg.black_team_id, pg.id) : null,
          white: pg ? teamSide(pg.white_team_id, pg.id) : null,
          blackScore: pg ? pg.black_score : null,
          whiteScore: pg ? pg.white_score : null,
        };
      }).filter((pg) => pg.black || pg.white),
    };
  });

  const seasonYear = new Date(sessionDate + "T00:00:00").getFullYear();
  const seasonRows = await db.sql`
    select gg.member_id, m.nickname, m.first_name, m.last_name, sum(gg.goals)::int as total_goals
    from game_goals gg
    join timetable_pool_games tpg on tpg.id = gg.pool_game_id
    join timetable_rows tr on tr.id = tpg.row_id
    join sessions s on s.id = tr.session_id
    join members m on m.id = gg.member_id
    where extract(year from s.session_date) = ${seasonYear} and gg.goals > 0
    group by gg.member_id, m.nickname, m.first_name, m.last_name
    order by total_goals desc
    limit 20
  `;
  const seasonLeaders = seasonRows.map((r: any) => ({ memberId: r.member_id, name: shortName(r.nickname, r.first_name, r.last_name), totalGoals: r.total_goals }));

  return { ok: true, sessionDate, upcoming, weeks, games, seasonLeaders };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  await ensureNicknameColumn(db);
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "record_scores")) {
    return forbidden("Only Game Coordinators and Administrators can record scores");
  }

  try {
    const upcoming = nextSessionDateISO();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const asked = req.method === "POST" ? body.sessionDate : new URL(req.url).searchParams.get("date");

    let sessionDate: string;
    if (asked) {
      sessionDate = requestedSessionDate(asked);
    } else {
      // No week asked for: open the most recent week with games.
      const weeks = await weeksWithGames(db, upcoming);
      const [latest] = await db.sql`
        select s.session_date::text as d
        from sessions s join timetable_rows tr on tr.session_id = s.id
        where tr.row_type = 'game' and tr.archived_at is null and s.session_date <= ${upcoming}
        order by s.session_date desc
        limit 1
      `;
      sessionDate = latest ? latest.d : weeks[0];
    }

    const [session] = await db.sql`select id from sessions where session_date = ${sessionDate}`;
    const sessionId: number | null = session ? session.id : null;

    if (req.method === "POST") {
      if (sessionId == null) {
        return new Response(JSON.stringify({ ok: false, error: "There's no game recorded for that week" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const poolGameId = Number(body.poolGameId);

      // Confirm this pool game actually belongs to tonight's session before
      // touching it — never trust an id from the client on its own.
      const [pg] = await db.sql`
        select tpg.id, tpg.black_team_id, tpg.white_team_id
        from timetable_pool_games tpg
        join timetable_rows tr on tr.id = tpg.row_id
        where tpg.id = ${poolGameId} and tr.session_id = ${sessionId}
      `;
      if (!pg) {
        return new Response(JSON.stringify({ ok: false, error: "That game isn't part of this week's session" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const blackScore = body.blackScore === null || body.blackScore === "" ? null : Number(body.blackScore);
      const whiteScore = body.whiteScore === null || body.whiteScore === "" ? null : Number(body.whiteScore);
      if ((blackScore != null && (!Number.isFinite(blackScore) || blackScore < 0)) || (whiteScore != null && (!Number.isFinite(whiteScore) || whiteScore < 0))) {
        return new Response(JSON.stringify({ ok: false, error: "Scores need to be zero or a positive number" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      await db.sql`
        update timetable_pool_games
        set black_score = ${blackScore}, white_score = ${whiteScore}, scored_by = ${caller.id}, scored_at = now()
        where id = ${poolGameId}
      `;

      // Only players actually on one of this pool game's two teams can be
      // credited with a goal — re-validated here, never trusted as-is.
      const rosterRows = await db.sql`
        select member_id from team_assignments
        where team_id = any(${[pg.black_team_id, pg.white_team_id].filter((x) => x != null)})
      `;
      const rosterIds = new Set<string>(rosterRows.map((r: any) => r.member_id));

      const goals = body.goals && typeof body.goals === "object" ? body.goals : {};
      for (const memberId of Object.keys(goals)) {
        if (!rosterIds.has(memberId)) continue;
        const n = Number(goals[memberId]);
        const safeN = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
        await db.sql`
          insert into game_goals (pool_game_id, member_id, goals)
          values (${poolGameId}, ${memberId}, ${safeN})
          on conflict (pool_game_id, member_id) do update set goals = excluded.goals, updated_at = now()
        `;
      }

      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "game_score_recorded",
        resourceType: "timetable_pool_game", resourceId: String(poolGameId),
        newValue: { sessionDate, blackScore, whiteScore, goals },
        note: `${caller.email} recorded a score for ${sessionDate}`,
      });
    }

    return new Response(JSON.stringify(await buildResponse(db, sessionId, sessionDate, upcoming)), {
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
  path: "/api/coordinator/scores",
};
