// Game scores + per-player goals — entered by the Game Coordinator after a
// session's games are done (not live during play, not self-service for
// referees). One pool game = one final score plus zero or more scorers.
//
// GET  /api/coordinator/scores[?date=YYYY-MM-DD] -> { ok, sessionDate, upcoming, weeks, games, seasonLeaders }
// POST /api/coordinator/scores { sessionDate, poolGameId, blackScore, whiteScore, goals: { memberId: goals, ... } }
// POST /api/coordinator/scores { sessionDate, action: "lineup_add", poolGameId, memberId, teamId }
// POST /api/coordinator/scores { sessionDate, action: "lineup_remove", poolGameId, memberId }
// GET  /api/coordinator/scores?live=<poolGameId>  -> { ok, live: { whiteScore, blackScore, goals, clockEnd, serverNow } }
// POST /api/coordinator/scores { sessionDate, action: "clock", poolGameId, endAt: ms | null }
//      -> shared Scoreboard clock (3 Nov 2026): when this game now ends, or
//         null to go back to the timetable's times
// POST /api/coordinator/scores { sessionDate, action: "goal", poolGameId, side, memberId?, delta }
//      -> live scoring from the Scoreboard (3 Nov 2026): one goal on or off,
//         optionally credited to a player, applied atomically so a phone and
//         the pool-side tablet can both score the same game.
//      -> move or add a player for one game only (3 Nov 2026, see _shared/lineups.mts)
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
import { ensureMember, ensureNicknameColumn, getVerifiedUser, hasPermission, logAudit, adminName, unauthorized, forbidden } from "./_shared/roles.mts";
import { POOLS } from "./_shared/timetable.mts";
import { nextSessionDateISO, requestedSessionDate } from "./_shared/attendance.mts";
import { ensureGameClocks, ensureLineupChanges } from "./_shared/lineups.mts";

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, displayName: adminName(r.nickname, r.first_name, r.last_name) };
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

// One game's score and goals, for the Scoreboard to poll.
async function liveState(db: any, poolGameId: number) {
  const [pg] = await db.sql`select white_score, black_score from timetable_pool_games where id = ${poolGameId}`;
  if (!pg) return null;
  const rows = await db.sql`select member_id, goals from game_goals where pool_game_id = ${poolGameId} and goals > 0`;
  const goals: Record<string, number> = {};
  rows.forEach((r: any) => { goals[r.member_id] = r.goals; });
  // clockEnd: null means the timetable's times. serverNow lets each device
  // allow for its own clock being a little out.
  const [clock] = await db.sql`select ends_at from game_clocks where pool_game_id = ${poolGameId}`;
  return {
    whiteScore: pg.white_score, blackScore: pg.black_score, goals,
    clockEnd: clock ? new Date(clock.ends_at).getTime() : null,
    serverNow: Date.now(),
  };
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
    select id, row_order, label, start_min, duration_min
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
  // Per-game line-up changes: pool game -> member -> team they played for.
  const lineupRows = pgIds.length
    ? await db.sql`
        select glc.pool_game_id, glc.team_id, m.id, m.nickname, m.first_name, m.last_name
        from game_lineup_changes glc join members m on m.id = glc.member_id
        where glc.pool_game_id = any(${pgIds})
      `
    : [];
  const lineupByPG: Record<number, Record<string, number>> = {};
  const lineupPlayer: Record<string, any> = {};
  lineupRows.forEach((r: any) => {
    if (!lineupByPG[r.pool_game_id]) lineupByPG[r.pool_game_id] = {};
    lineupByPG[r.pool_game_id][r.id] = r.team_id;
    lineupPlayer[r.id] = shapePlayer(r);
  });
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

  // A side's players for one game: the team's roster for the night, less
  // anyone moved to the other side for this game, plus anyone moved or
  // added to this side for this game (marked swapped).
  function teamSide(teamId: number | null, pgId: number | null) {
    if (teamId == null) return null;
    const goals = pgId != null ? goalsByPG[pgId] || {} : {};
    const moves = pgId != null ? lineupByPG[pgId] || {} : {};
    const roster = (rosterByTeam[teamId] || []).filter((p) => moves[p.id] == null || moves[p.id] === teamId);
    const extra = Object.keys(moves)
      .filter((id) => moves[id] === teamId && !roster.some((p) => p.id === id))
      .map((id) => Object.assign({}, lineupPlayer[id], { swapped: true }));
    return {
      id: teamId,
      name: teamNames[teamId] || "Unknown team",
      players: roster.concat(extra).map((p) => Object.assign({}, p, { goals: goals[p.id] || 0 })),
    };
  }

  const games = rowRows.map((row: any) => {
    const pgs = pgsByRow[row.id] || [];
    return {
      rowId: row.id,
      label: row.label,
      startMin: row.start_min,
      durationMin: row.duration_min,
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
  const seasonLeaders = seasonRows.map((r: any) => ({ memberId: r.member_id, name: adminName(r.nickname, r.first_name, r.last_name), totalGoals: r.total_goals }));

  // Everyone who was there that night, for "Add or move a player": on a
  // team, booked in to play, or ticked on the roll.
  const nightRows = await db.sql`
    select m.id, m.nickname, m.first_name, m.last_name from members m
    where m.id in (select member_id from team_assignments where session_id = ${sessionId})
       or m.id in (select member_id from bookings where session_id = ${sessionId} and status = 'in' and coalesce(kind, 'player') = 'player')
       or m.id in (select member_id from session_attendance where session_date = ${sessionDate}::date and attended = true and coalesce(kind, 'player') = 'player')
    order by lower(m.first_name), lower(m.last_name)
  `;
  const nightPlayers = nightRows.map((r: any) => Object.assign(shapePlayer(r), {
    teams: Object.keys(rosterByTeam).filter((t) => rosterByTeam[Number(t)].some((p) => p.id === r.id)).map((t) => teamNames[Number(t)]).filter(Boolean),
  }));

  return { ok: true, sessionDate, upcoming, weeks, games, seasonLeaders, nightPlayers };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  await ensureNicknameColumn(db);
  await ensureLineupChanges(db);
  await ensureGameClocks(db);
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "record_scores")) {
    return forbidden("Only Game Coordinators and Administrators can record scores");
  }

  try {
    const liveId = req.method === "GET" ? Number(new URL(req.url).searchParams.get("live") || 0) : 0;
    if (liveId) {
      const live = await liveState(db, liveId);
      return new Response(JSON.stringify(live ? { ok: true, live } : { ok: false, error: "Game not found" }), {
        status: live ? 200 : 404,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
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

      // Shared clock (3 Nov 2026): see ensureGameClocks.
      if (body.action === "clock") {
        const endAt = body.endAt == null ? null : Number(body.endAt);
        if (endAt != null && (!Number.isFinite(endAt) || Math.abs(endAt - Date.now()) > 24 * 3600000)) {
          return new Response(JSON.stringify({ ok: false, error: "That game time doesn't look right" }), { status: 400, headers: { "content-type": "application/json" } });
        }
        if (endAt == null) {
          await db.sql`delete from game_clocks where pool_game_id = ${poolGameId}`;
        } else {
          await db.sql`
            insert into game_clocks (pool_game_id, ends_at, updated_by) values (${poolGameId}, to_timestamp(${endAt / 1000}), ${caller.id})
            on conflict (pool_game_id) do update set ends_at = excluded.ends_at, updated_by = excluded.updated_by, updated_at = now()`;
        }
        return new Response(JSON.stringify({ ok: true, live: await liveState(db, poolGameId) }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Live scoring (3 Nov 2026): +1 or -1 on one side, optionally for a
      // player. Done in the database (score = score + 1), not as "set the
      // score to N", so two devices scoring at once never undo each other.
      if (body.action === "goal") {
        const side = body.side === "white" ? "white" : body.side === "black" ? "black" : null;
        const delta = Number(body.delta) === -1 ? -1 : 1;
        if (!side) {
          return new Response(JSON.stringify({ ok: false, error: "Choose white or black" }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const memberId = body.memberId ? String(body.memberId) : null;
        if (memberId) {
          const [onSheet] = await db.sql`
            select 1 from team_assignments where member_id = ${memberId} and team_id = any(${[pg.black_team_id, pg.white_team_id].filter((x) => x != null)})
            union
            select 1 from game_lineup_changes where pool_game_id = ${poolGameId} and member_id = ${memberId}`;
          if (!onSheet) {
            return new Response(JSON.stringify({ ok: false, error: "That player isn't in this game" }), { status: 400, headers: { "content-type": "application/json" } });
          }
        }
        if (side === "white") {
          await db.sql`update timetable_pool_games set white_score = greatest(0, coalesce(white_score, 0) + ${delta}), black_score = coalesce(black_score, 0), scored_by = ${caller.id}, scored_at = now() where id = ${poolGameId}`;
        } else {
          await db.sql`update timetable_pool_games set black_score = greatest(0, coalesce(black_score, 0) + ${delta}), white_score = coalesce(white_score, 0), scored_by = ${caller.id}, scored_at = now() where id = ${poolGameId}`;
        }
        if (memberId && delta > 0) {
          await db.sql`
            insert into game_goals (pool_game_id, member_id, goals) values (${poolGameId}, ${memberId}, 1)
            on conflict (pool_game_id, member_id) do update set goals = game_goals.goals + 1, updated_at = now()`;
        } else if (memberId) {
          await db.sql`update game_goals set goals = greatest(0, goals - 1), updated_at = now() where pool_game_id = ${poolGameId} and member_id = ${memberId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: delta > 0 ? "live_goal_added" : "live_goal_removed",
          resourceType: "timetable_pool_game", resourceId: String(poolGameId),
          newValue: { sessionDate, side, memberId, delta },
          note: `${caller.email} ${delta > 0 ? "added a goal for" : "took a goal off"} ${side} on ${sessionDate}`,
        });
        return new Response(JSON.stringify({ ok: true, live: await liveState(db, poolGameId) }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Move or add a player for this one game (3 Nov 2026).
      if (body.action === "lineup_add" || body.action === "lineup_remove") {
        const memberId = String(body.memberId || "");
        const [member] = await db.sql`select id, first_name, last_name from members where id = ${memberId}`;
        if (!member) {
          return new Response(JSON.stringify({ ok: false, error: "Player not found" }), { status: 404, headers: { "content-type": "application/json" } });
        }
        const gameTeams = [pg.black_team_id, pg.white_team_id].filter((x) => x != null);
        const rostered = await db.sql`select team_id from team_assignments where member_id = ${memberId} and team_id = any(${gameTeams})`;
        const rosteredOn = rostered.map((r: any) => r.team_id);
        if (body.action === "lineup_add") {
          const teamId = Number(body.teamId);
          if (!gameTeams.includes(teamId)) {
            return new Response(JSON.stringify({ ok: false, error: "That team isn't playing in this game" }), { status: 400, headers: { "content-type": "application/json" } });
          }
          // Back on their own team: no change needed for this game.
          if (rosteredOn.length === 1 && rosteredOn[0] === teamId) {
            await db.sql`delete from game_lineup_changes where pool_game_id = ${poolGameId} and member_id = ${memberId}`;
          } else {
            await db.sql`
              insert into game_lineup_changes (pool_game_id, member_id, team_id, created_by)
              values (${poolGameId}, ${memberId}, ${teamId}, ${caller.id})
              on conflict (pool_game_id, member_id) do update set team_id = excluded.team_id, created_by = excluded.created_by, created_at = now()
            `;
          }
        } else {
          await db.sql`delete from game_lineup_changes where pool_game_id = ${poolGameId} and member_id = ${memberId}`;
          // Not on either team any more, so off this game's sheet: their
          // goals in it go too, rather than lingering unseen in the totals.
          if (rosteredOn.length === 0) await db.sql`delete from game_goals where pool_game_id = ${poolGameId} and member_id = ${memberId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: body.action === "lineup_add" ? "game_lineup_changed" : "game_lineup_change_removed",
          resourceType: "timetable_pool_game", resourceId: String(poolGameId),
          newValue: { sessionDate, memberId, teamId: body.action === "lineup_add" ? Number(body.teamId) : null },
          note: `${caller.email} ${body.action === "lineup_add" ? "moved" : "undid the move of"} ${member.first_name} ${member.last_name} for one game on ${sessionDate}`,
        });
        return new Response(JSON.stringify(await buildResponse(db, sessionId, sessionDate, upcoming)), {
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

      // Only players actually on one of this pool game's two teams (or
      // moved/added into this game) can be credited with a goal —
      // re-validated here, never trusted as-is.
      const rosterRows = await db.sql`
        select member_id from team_assignments
        where team_id = any(${[pg.black_team_id, pg.white_team_id].filter((x) => x != null)})
        union
        select member_id from game_lineup_changes where pool_game_id = ${poolGameId}
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
