// Carry last week forward (12 Oct 2026, Cheongy).
//
// 1. copyForwardWeek() - once per session, the first time a Game
//    Coordinator opens Teams or the Timetable for a new Wednesday, copy
//    from the most recent earlier Wednesday that had any:
//      - team names (if this week has no teams yet)
//      - timetable rows: type, label, time, duration, notes, one/two games
//        (if this week has no rows yet)
//      - which team plays which in each game slot (matched by team name)
//    Never referees, scores or MVP. Stamped on sessions.timetable_copied_at
//    either way, so clearing things afterwards sticks.
//
// 2. autoPlaceReturningPlayers() - while the board isn't published, any
//    confirmed player who isn't on a team yet goes back into the team of
//    the same name they were last on. Each player is only tried once per
//    week (team_autoplaced), so if the coordinator moves or removes them,
//    they stay where the coordinator put them. Development teams carry
//    over the same way, separately from the main team (27 Oct 2026).
//
// Both only ever touch the upcoming session. Everything here can be
// changed by the coordinator before publishing.

import { ensureDevelopmentTeams } from "./roles.mts";

let columnsReady = false;
export async function ensureCarryForwardColumns(db: any): Promise<void> {
  await ensureDevelopmentTeams(db);
  if (columnsReady) return;
  await db.sql`alter table sessions add column if not exists timetable_copied_at timestamptz`;
  await db.sql`alter table sessions add column if not exists timetable_copied_from date`;
  await db.sql`alter table timetable_rows add column if not exists game_count smallint not null default 2`;
  await db.sql`
    create table if not exists team_autoplaced (
      session_id integer not null references sessions(id) on delete cascade,
      member_id text not null references members(id) on delete cascade,
      placed_team_id integer references game_teams(id) on delete set null,
      created_at timestamptz not null default now(),
      primary key (session_id, member_id)
    )
  `;
  columnsReady = true;
}

export async function copyForwardWeek(
  db: any,
  sessionId: number,
  sessionDate: string,
  callerId: string
): Promise<void> {
  await ensureCarryForwardColumns(db);
  const [s] = await db.sql`select timetable_copied_at from sessions where id = ${sessionId}`;
  if (!s || s.timetable_copied_at) return;

  const [prev] = await db.sql`
    select s.id, s.session_date::text as session_date
    from sessions s
    where s.session_date < ${sessionDate}
      and (
        exists (select 1 from timetable_rows tr where tr.session_id = s.id and tr.archived_at is null)
        or exists (select 1 from game_teams gt where gt.session_id = s.id)
      )
    order by s.session_date desc
    limit 1
  `;
  // Claim first so two coordinators opening at the same moment can't both copy.
  const claimed = await db.sql`
    update sessions set timetable_copied_at = now(), timetable_copied_from = ${prev ? prev.session_date : null}
    where id = ${sessionId} and timetable_copied_at is null
    returning id
  `;
  if (!claimed.length || !prev) return;

  // Teams (names only) - if this week has none yet.
  const teamMap: Record<number, number> = {}; // last week's team id -> this week's
  const [{ teamCount }] = await db.sql`select count(*)::int as "teamCount" from game_teams where session_id = ${sessionId}`;
  const thisWeekTeams = await db.sql`select id, name from game_teams where session_id = ${sessionId}`;
  const prevTeams = await db.sql`select id, name, is_development from game_teams where session_id = ${prev.id} order by created_at asc, id asc`;
  if (teamCount === 0) {
    for (const t of prevTeams) {
      const [nt] = await db.sql`insert into game_teams (session_id, name, is_development) values (${sessionId}, ${t.name}, ${!!t.is_development}) returning id`;
      teamMap[t.id] = nt.id;
    }
  } else {
    // Teams already exist this week: still match slots by name where possible.
    for (const t of prevTeams) {
      const same = thisWeekTeams.find((x: any) => x.name.trim().toLowerCase() === t.name.trim().toLowerCase());
      if (same) teamMap[t.id] = same.id;
    }
  }

  // Timetable rows (+ which team in which slot) - if this week has none yet.
  const [{ rowCount }] = await db.sql`select count(*)::int as "rowCount" from timetable_rows where session_id = ${sessionId}`;
  let copiedRows = 0;
  if (rowCount === 0) {
    const rows = await db.sql`
      select id, row_order, row_type, label, start_min, duration_min, notes, game_count
      from timetable_rows
      where session_id = ${prev.id} and archived_at is null
      order by row_order asc, id asc
    `;
    for (const r of rows) {
      const [row] = await db.sql`
        insert into timetable_rows (session_id, row_order, row_type, label, start_min, duration_min, notes, created_by, updated_by, game_count)
        values (${sessionId}, ${r.row_order}, ${r.row_type}, ${r.label}, ${r.start_min}, ${r.duration_min}, ${r.notes}, ${callerId}, ${callerId}, ${Number(r.game_count) === 1 ? 1 : 2})
        returning id
      `;
      copiedRows++;
      if (r.row_type !== "game") continue;
      // Same pool games the builder would create: Pool A, plus Pool B for
      // a two-games-at-once row.
      for (const pool of Number(r.game_count) === 1 ? ["Pool A"] : ["Pool A", "Pool B"]) {
        await db.sql`insert into timetable_pool_games (row_id, pool) values (${row.id}, ${pool}) on conflict (row_id, pool) do nothing`;
      }
      const pgs = await db.sql`select pool, black_team_id, white_team_id from timetable_pool_games where row_id = ${r.id}`;
      for (const pg of pgs) {
        const black = pg.black_team_id != null ? teamMap[pg.black_team_id] ?? null : null;
        const white = pg.white_team_id != null ? teamMap[pg.white_team_id] ?? null : null;
        if (black == null && white == null) continue;
        await db.sql`
          update timetable_pool_games set black_team_id = ${black}, white_team_id = ${white}
          where row_id = ${row.id} and pool = ${pg.pool}
        `;
      }
    }
  }

  await db.sql`
    insert into audit_log (actor_id, actor_email, action, resource_type, resource_id, new_value, note)
    values (${callerId}, null, 'week_carried_forward', 'session', ${String(sessionId)},
            ${JSON.stringify({ sessionDate, copiedFrom: prev.session_date, teams: Object.keys(teamMap).length, rows: copiedRows })},
            ${`Teams and timetable for ${sessionDate} carried forward from ${prev.session_date}`})
  `;
}

export async function autoPlaceReturningPlayers(db: any, sessionId: number, sessionDate: string): Promise<void> {
  await ensureCarryForwardColumns(db);
  const [s] = await db.sql`select published from sessions where id = ${sessionId}`;
  if (!s || s.published) return;

  // Confirmed and not already tried this week.
  const candidates = await db.sql`
    select b.member_id
    from bookings b
    where b.session_id = ${sessionId} and b.status = 'in'
      and not exists (select 1 from team_autoplaced tp where tp.session_id = ${sessionId} and tp.member_id = b.member_id)
  `;
  if (!candidates.length) return;
  const teams = await db.sql`select id, name, is_development from game_teams where session_id = ${sessionId}`;

  for (const c of candidates) {
    // Main team and development team are placed separately (27 Oct 2026):
    // each goes back to the last team of that kind they were in, unless
    // they're already in one of that kind this week.
    let placed: number | null = null;
    for (const dev of [false, true]) {
      const [already] = await db.sql`
        select 1 from team_assignments where session_id = ${sessionId} and member_id = ${c.member_id} and is_development = ${dev}
      `;
      if (already) continue;
      const [last] = await db.sql`
        select gt.name
        from team_assignments ta
        join game_teams gt on gt.id = ta.team_id
        join sessions s on s.id = ta.session_id
        where ta.member_id = ${c.member_id} and s.session_date < ${sessionDate} and gt.is_development = ${dev}
        order by s.session_date desc
        limit 1
      `;
      const match = last
        ? teams.find((t: any) => !!t.is_development === dev && t.name.trim().toLowerCase() === String(last.name).trim().toLowerCase())
        : null;
      if (!match) continue;
      await db.sql`
        insert into team_assignments (session_id, member_id, team_id, is_development)
        values (${sessionId}, ${c.member_id}, ${match.id}, ${dev})
        on conflict do nothing
      `;
      if (placed == null) placed = match.id;
    }
    await db.sql`
      insert into team_autoplaced (session_id, member_id, placed_team_id)
      values (${sessionId}, ${c.member_id}, ${placed})
      on conflict do nothing
    `;
  }
}
