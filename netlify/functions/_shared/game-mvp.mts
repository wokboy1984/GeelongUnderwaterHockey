// MVP per game (5 Nov 2026, Liam). Each referee votes for the game(s) they
// refereed, in four categories - junior male, junior female, senior male,
// senior female - each optional (a game may have no junior girls), choosing
// only from players in that game. Junior = under 19 on the night, from date
// of birth; with no date of birth, a child under a parent is a junior and
// anyone else a senior. A player with no gender recorded is listed under
// both male and female, so they can still be voted for.
//
// Which vote counts: when more than one of a game's referees votes, only
// the first-listed referee's ballot counts (all four categories together);
// if only one votes, theirs counts wherever they are in the list. "First
// listed" is the order they were added to the game in the Timetable.
//
// Nights before this kept one MVP vote per referee for the whole night
// (mvp_nominations); those are left as they were.

export const MVP_CATEGORIES = ["junior_male", "junior_female", "senior_male", "senior_female"] as const;
export type MvpCategory = (typeof MVP_CATEGORIES)[number];
export const MVP_CATEGORY_LABELS: Record<MvpCategory, string> = {
  junior_male: "Junior male",
  junior_female: "Junior female",
  senior_male: "Senior male",
  senior_female: "Senior female",
};
export const JUNIOR_UNDER = 19;

let ready = false;
export async function ensureGameMvp(db: any): Promise<void> {
  if (ready) return;
  await db.sql`alter table members add column if not exists gender text`;
  await db.sql`create table if not exists mvp_game_ballots (
    pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
    nominator_id text not null references members(id) on delete cascade,
    note text,
    updated_at timestamptz not null default now(),
    primary key (pool_game_id, nominator_id)
  )`;
  await db.sql`create table if not exists mvp_game_votes (
    pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
    nominator_id text not null references members(id) on delete cascade,
    category text not null,
    nominee_id text not null references members(id) on delete cascade,
    primary key (pool_game_id, nominator_id, category)
  )`;
  ready = true;
}

export function isGender(value: unknown): value is "male" | "female" {
  return value === "male" || value === "female";
}

// Age in whole years on a given YYYY-MM-DD.
export function ageOn(dob: unknown, dateISO: string): number | null {
  if (!dob) return null;
  const s = typeof dob === "string" ? dob.slice(0, 10) : (dob as Date).toISOString().slice(0, 10);
  const [by, bm, bd] = s.split("-").map(Number);
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!by) return null;
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export type GamePlayer = { id: string; name: string; categories: MvpCategory[] };

// Everyone in a pool game: both teams, plus anyone moved or added for that
// one game (game_lineup_changes), with the MVP categories they fit.
export async function gamePlayers(db: any, poolGameId: number, sessionDate: string, displayName: (r: any) => string): Promise<GamePlayer[]> {
  const rows = await db.sql`
    select m.id, m.nickname, m.first_name, m.last_name, m.gender, m.date_of_birth, m.parent_id
    from members m
    where m.id in (
      select ta.member_id from team_assignments ta
      join timetable_pool_games pg on pg.id = ${poolGameId}
      join timetable_rows tr on tr.id = pg.row_id
      where ta.session_id = tr.session_id and ta.team_id in (pg.black_team_id, pg.white_team_id)
      union
      select glc.member_id from game_lineup_changes glc where glc.pool_game_id = ${poolGameId}
    )
    order by lower(m.first_name), lower(m.last_name)`;
  return rows.map((r: any) => {
    const age = ageOn(r.date_of_birth, sessionDate);
    const junior = age != null ? age < JUNIOR_UNDER : !!r.parent_id;
    const group = junior ? "junior" : "senior";
    const genders = isGender(r.gender) ? [r.gender] : ["male", "female"];
    return { id: r.id, name: displayName(r), categories: genders.map((g) => `${group}_${g}` as MvpCategory) };
  });
}

// A game's referees in Timetable order.
export async function gameReferees(db: any, poolGameId: number): Promise<any[]> {
  return db.sql`
    select m.id, m.nickname, m.first_name, m.last_name
    from timetable_pool_referees tpr join members m on m.id = tpr.member_id
    where tpr.pool_game_id = ${poolGameId}
    order by tpr.id asc`;
}

// For each game: the referees (in order, whether each has voted, and whose
// ballot counts) and the winners from the ballot that counts.
export async function gameMvpResults(db: any, poolGameIds: number[], displayName: (r: any) => string) {
  const out: Record<number, { referees: { id: string; name: string; voted: boolean; counts: boolean }[]; winners: { category: MvpCategory; label: string; name: string }[]; note: string | null }> = {};
  if (!poolGameIds.length) return out;
  await ensureGameMvp(db);
  const refs = await db.sql`
    select tpr.pool_game_id, m.id, m.nickname, m.first_name, m.last_name
    from timetable_pool_referees tpr join members m on m.id = tpr.member_id
    where tpr.pool_game_id = any(${poolGameIds})
    order by tpr.id asc`;
  const votes = await db.sql`
    select v.pool_game_id, v.nominator_id, v.category, m.nickname, m.first_name, m.last_name
    from mvp_game_votes v join members m on m.id = v.nominee_id
    where v.pool_game_id = any(${poolGameIds})`;
  const notes = await db.sql`select pool_game_id, nominator_id, note from mvp_game_ballots where pool_game_id = any(${poolGameIds})`;
  for (const id of poolGameIds) {
    const gameRefs = refs.filter((r: any) => r.pool_game_id === id);
    const gameVotes = votes.filter((v: any) => v.pool_game_id === id);
    const voted = new Set(gameVotes.map((v: any) => v.nominator_id));
    const counting = gameRefs.find((r: any) => voted.has(r.id));
    const winners = counting
      ? MVP_CATEGORIES.flatMap((c) => {
          const v = gameVotes.find((x: any) => x.nominator_id === counting.id && x.category === c);
          return v ? [{ category: c, label: MVP_CATEGORY_LABELS[c], name: displayName(v) }] : [];
        })
      : [];
    const note = counting ? (notes.find((n: any) => n.pool_game_id === id && n.nominator_id === counting.id) || {}).note || null : null;
    out[id] = {
      referees: gameRefs.map((r: any) => ({ id: r.id, name: displayName(r), voted: voted.has(r.id), counts: !!counting && counting.id === r.id })),
      winners,
      note,
    };
  }
  return out;
}
