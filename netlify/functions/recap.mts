// Last game recap for the member Dashboard (2 Oct 2026).
//
// GET /api/recap -> { ok, recap: null | { sessionDate, games[], mvp[], topScorers[] } }
//
// Looks at the most recent past session (before the upcoming Wednesday)
// that has anything worth showing: a recorded score, a goal, or an MVP
// nomination. If there's nothing recorded at all, recap is null and the
// Dashboard shows nothing (Cheongy's call: no empty recap card).
//
// Any logged-in member can read this - it's results, not private data.
// Names use nickname, else real name (memberDisplayName).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureNicknameColumn, getVerifiedUser, memberDisplayName, unauthorized } from "./_shared/roles.mts";
import { nextSessionDateISO } from "./_shared/attendance.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    await ensureNicknameColumn(db);
    const upcoming = nextSessionDateISO();

    // Most recent past session with any score, goal or MVP nomination.
    const [session] = await db.sql`
      select s.id, s.session_date::text as session_date
      from sessions s
      where s.session_date < ${upcoming}
        and (
          exists (
            select 1 from timetable_pool_games tpg join timetable_rows tr on tr.id = tpg.row_id
            where tr.session_id = s.id and tr.archived_at is null
              and (tpg.black_score is not null or tpg.white_score is not null)
          )
          or exists (
            select 1 from game_goals gg
            join timetable_pool_games tpg on tpg.id = gg.pool_game_id
            join timetable_rows tr on tr.id = tpg.row_id
            where tr.session_id = s.id and gg.goals > 0
          )
          or exists (select 1 from mvp_nominations mn where mn.session_id = s.id)
        )
      order by s.session_date desc
      limit 1
    `;
    if (!session) return json({ ok: true, recap: null });

    const gameRows = await db.sql`
      select tr.label, tr.start_min, tr.row_order, tpg.pool,
             bt.name as black_name, wt.name as white_name,
             tpg.black_score, tpg.white_score
      from timetable_pool_games tpg
      join timetable_rows tr on tr.id = tpg.row_id
      left join game_teams bt on bt.id = tpg.black_team_id
      left join game_teams wt on wt.id = tpg.white_team_id
      where tr.session_id = ${session.id} and tr.archived_at is null
        and tpg.black_score is not null and tpg.white_score is not null
      order by tr.row_order asc, tr.id asc, tpg.pool asc
    `;
    const games = gameRows.map((r: any) => ({
      label: r.label,
      pool: r.pool,
      black: { name: r.black_name || "Black", score: r.black_score },
      white: { name: r.white_name || "White", score: r.white_score },
    }));

    const scorerRows = await db.sql`
      select m.id, m.nickname, m.first_name, m.last_name, sum(gg.goals)::int as goals
      from game_goals gg
      join timetable_pool_games tpg on tpg.id = gg.pool_game_id
      join timetable_rows tr on tr.id = tpg.row_id
      join members m on m.id = gg.member_id
      where tr.session_id = ${session.id} and gg.goals > 0
      group by m.id, m.nickname, m.first_name, m.last_name
      order by goals desc, m.first_name asc
      limit 3
    `;
    const topScorers = scorerRows.map((r: any) => ({ id: r.id, name: memberDisplayName(r), goals: r.goals }));

    // MVP: whoever got the most referee nominations. Ties all shown.
    const mvpRows = await db.sql`
      select m.id, m.nickname, m.first_name, m.last_name, m.photo_version, count(*)::int as votes
      from mvp_nominations mn join members m on m.id = mn.nominee_id
      where mn.session_id = ${session.id}
      group by m.id, m.nickname, m.first_name, m.last_name, m.photo_version
      order by votes desc
    `;
    const topVotes = mvpRows.length ? mvpRows[0].votes : 0;
    const mvp = mvpRows
      .filter((r: any) => r.votes === topVotes)
      .map((r: any) => ({ id: r.id, name: memberDisplayName(r), photoVersion: r.photo_version || 0, votes: r.votes }));

    if (!games.length && !topScorers.length && !mvp.length) return json({ ok: true, recap: null });

    return json({ ok: true, recap: { sessionDate: session.session_date, games, mvp, topScorers } });
  } catch (err) {
    console.error("recap failed", err);
    return json({ ok: false, error: "Couldn't load last week's recap" }, 500);
  }
};

export const config: Config = {
  path: "/api/recap",
};
