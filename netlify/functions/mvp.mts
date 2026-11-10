// MVP votes — after the night's games, each referee votes for the game(s)
// they refereed (5 Nov 2026, Liam): junior male, junior female, senior male
// and senior female, each optional, from that game's players. See
// _shared/game-mvp.mts for the categories and whose ballot counts.
//
// Before 5 Nov 2026 a referee nominated one MVP for the whole night
// (mvp_nominations, one per referee per session); those nights still show
// their results here for coordinators, but can't be voted on any more.
//
// GET  /api/mvp[?date=YYYY-MM-DD]
//   -> { ok, sessionDate, published, canNominate, games: [{ poolGameId, label,
//        options: { category: [{ id, name }] }, myVotes: { category: id }, myNote }],
//        canViewResults, results?: [{ poolGameId, label, referees, winners, note }],
//        nightResults? }
// POST /api/mvp { sessionDate?, poolGameId, votes: { category: memberId | "" }, note? }
//   -> same shape as GET
//
// Week by week (2 Oct 2026): date/sessionDate picks which Wednesday (any
// past one, default the upcoming one), so a referee can still vote the
// morning after, or any day later.
//
// Voting requires being a referee of that pool game (checked server-side
// from timetable_pool_referees, never cached). Seeing every game's votes
// and which referees have voted requires 'arrange_teams' (game_coordinator
// or administrator).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { adminName, ensureMember, ensureNicknameColumn, getVerifiedUser, hasPermission, logAudit, shortName, unauthorized } from "./_shared/roles.mts";
import { requestedSessionDate } from "./_shared/attendance.mts";
import { ensureLineupChanges } from "./_shared/lineups.mts";
import { MVP_CATEGORIES, ensureGameMvp, gameMvpResults, gamePlayers, type MvpCategory } from "./_shared/game-mvp.mts";

const shortOf = (r: any) => shortName(r.nickname, r.first_name, r.last_name);
const fullOf = (r: any) => adminName(r.nickname, r.first_name, r.last_name);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Every pool game this night, in timetable order, with a label like
// "Game 2 · Pool B" (10 Nov 2026: the pool is named for one-game rows too).
async function sessionGames(db: any, sessionId: number) {
  const rows = await db.sql`
    select pg.id, pg.pool, tr.label, tr.row_order, tr.id as row_id
    from timetable_pool_games pg join timetable_rows tr on tr.id = pg.row_id
    where tr.session_id = ${sessionId} and tr.archived_at is null and tr.row_type = 'game'
    order by tr.row_order asc, tr.id asc, pg.pool asc`;
  return rows.map((r: any) => ({ poolGameId: r.id, label: r.label + " · " + r.pool }));
}

async function buildResponse(db: any, sessionId: number, sessionDate: string, caller: { id: string; roles: string[] }) {
  const games = await sessionGames(db, sessionId);
  const ids = games.map((g: any) => g.poolGameId);
  const mine = ids.length
    ? await db.sql`select pool_game_id from timetable_pool_referees where member_id = ${caller.id} and pool_game_id = any(${ids})`
    : [];
  const myGameIds = new Set<number>(mine.map((r: any) => r.pool_game_id));

  const myVotes = myGameIds.size
    ? await db.sql`select pool_game_id, category, nominee_id from mvp_game_votes where nominator_id = ${caller.id} and pool_game_id = any(${[...myGameIds]})`
    : [];
  const myNotes = myGameIds.size
    ? await db.sql`select pool_game_id, note from mvp_game_ballots where nominator_id = ${caller.id} and pool_game_id = any(${[...myGameIds]})`
    : [];

  // The voting lists are member-facing, so only short names leave the server.
  const voteGames = [];
  for (const g of games.filter((x: any) => myGameIds.has(x.poolGameId))) {
    const players = (await gamePlayers(db, g.poolGameId, sessionDate, shortOf)).filter((p) => p.id !== caller.id);
    const options: Record<string, { id: string; name: string }[]> = {};
    MVP_CATEGORIES.forEach((c) => { options[c] = players.filter((p) => p.categories.includes(c)).map((p) => ({ id: p.id, name: p.name })); });
    const votes: Record<string, string> = {};
    myVotes.filter((v: any) => v.pool_game_id === g.poolGameId).forEach((v: any) => { votes[v.category] = v.nominee_id; });
    voteGames.push({ poolGameId: g.poolGameId, label: g.label, options, myVotes: votes, myNote: (myNotes.find((n: any) => n.pool_game_id === g.poolGameId) || {}).note || "" });
  }

  const canViewResults = hasPermission(caller.roles, "arrange_teams");
  const out: any = { ok: true, sessionDate, published: true, canNominate: voteGames.length > 0, games: voteGames, canViewResults };

  if (canViewResults) {
    const results = await gameMvpResults(db, ids, fullOf);
    out.results = games.map((g: any) => Object.assign({ poolGameId: g.poolGameId, label: g.label }, results[g.poolGameId]));
    // Nights before per-game voting: the old one-per-referee tally.
    const old = await db.sql`
      select nm.nickname as nominee_nick, nm.first_name as nominee_first, nm.last_name as nominee_last, mn.nominee_id,
             rm.nickname as ref_nick, rm.first_name as ref_first, rm.last_name as ref_last, mn.note
      from mvp_nominations mn join members nm on nm.id = mn.nominee_id join members rm on rm.id = mn.nominator_id
      where mn.session_id = ${sessionId} order by mn.created_at asc`;
    if (old.length) {
      const byNominee: Record<string, any> = {};
      old.forEach((r: any) => {
        const n = byNominee[r.nominee_id] || (byNominee[r.nominee_id] = { nomineeId: r.nominee_id, name: adminName(r.nominee_nick, r.nominee_first, r.nominee_last), votes: 0, notes: [] });
        n.votes += 1;
        n.notes.push({ by: adminName(r.ref_nick, r.ref_first, r.ref_last), note: r.note });
      });
      out.nightResults = Object.values(byNominee).sort((a: any, b: any) => b.votes - a.votes);
    }
  }
  return out;
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    await ensureNicknameColumn(db);
    await ensureLineupChanges(db);
    await ensureGameMvp(db);
    const caller = await ensureMember(db, user);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sessionDate = requestedSessionDate(req.method === "POST" ? body.sessionDate : new URL(req.url).searchParams.get("date"));
    const [session] = await db.sql`select id, published from sessions where session_date = ${sessionDate}`;

    if (!session || !session.published) return json({ ok: true, sessionDate, published: false });

    if (req.method === "POST") {
      const poolGameId = Number(body.poolGameId);
      const [game] = await db.sql`
        select pg.id from timetable_pool_games pg join timetable_rows tr on tr.id = pg.row_id
        where pg.id = ${poolGameId} and tr.session_id = ${session.id} and tr.archived_at is null`;
      if (!game) return json({ ok: false, error: "That game isn't part of this session" }, 400);
      const [isRef] = await db.sql`select 1 from timetable_pool_referees where pool_game_id = ${poolGameId} and member_id = ${caller.id}`;
      if (!isRef) return json({ ok: false, error: "Only that game's referees can vote for its MVPs" }, 403);

      // Each category is optional; a nominee must be in that game and fit the category.
      const players = await gamePlayers(db, poolGameId, sessionDate, fullOf);
      const raw = body.votes && typeof body.votes === "object" ? body.votes : {};
      const picks: { category: MvpCategory; nomineeId: string; name: string }[] = [];
      for (const c of MVP_CATEGORIES) {
        const id = String(raw[c] || "").trim();
        if (!id) continue;
        const p = players.find((x) => x.id === id);
        if (!p || id === caller.id || !p.categories.includes(c)) return json({ ok: false, error: "One of those players can't be picked for that category" }, 400);
        picks.push({ category: c, nomineeId: id, name: p.name });
      }
      const note = body.note ? String(body.note).trim().slice(0, 280) : null;

      await db.sql`delete from mvp_game_votes where pool_game_id = ${poolGameId} and nominator_id = ${caller.id}`;
      for (const p of picks) {
        await db.sql`insert into mvp_game_votes (pool_game_id, nominator_id, category, nominee_id) values (${poolGameId}, ${caller.id}, ${p.category}, ${p.nomineeId})`;
      }
      if (picks.length) {
        await db.sql`
          insert into mvp_game_ballots (pool_game_id, nominator_id, note) values (${poolGameId}, ${caller.id}, ${note})
          on conflict (pool_game_id, nominator_id) do update set note = excluded.note, updated_at = now()`;
      } else {
        await db.sql`delete from mvp_game_ballots where pool_game_id = ${poolGameId} and nominator_id = ${caller.id}`;
      }
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "mvp_voted",
        resourceType: "timetable_pool_game", resourceId: String(poolGameId),
        newValue: { sessionDate, votes: picks.map((p) => ({ category: p.category, nomineeId: p.nomineeId })), note },
        note: `${caller.email} voted MVPs for a game on ${sessionDate}: ${picks.map((p) => p.category + " " + p.name).join(", ") || "none"}`,
      });
    }

    return json(await buildResponse(db, session.id, sessionDate, caller));
  } catch (err) {
    console.error("mvp request failed", err);
    return json({ ok: false, error: "Couldn't load or save MVP votes. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/mvp",
};
