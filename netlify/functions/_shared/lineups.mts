// Per-game line-up changes (3 Nov 2026, Liam). Teams for the night come
// from Game Coordination -> Teams (team_assignments), but on the night a
// player sometimes jumps into a game they weren't rostered for, or swaps to
// the other side when a game is one-sided. A row here says: in this pool
// game, this member played for this team. It overrides their usual team for
// that one game only, so their goals there are credited to the right side
// and every other game is untouched.
// Shared Scoreboard clock (3 Nov 2026, Liam): a game's clock runs from the
// timetable unless someone on a Scoreboard presses "Start full game" or
// +/- 1 min. That's saved here as when the game now ends, so every device
// showing the game (the scorekeeper's phone, the tablet facing the pool)
// follows it. No row = the timetable's times, as before.
let clocksReady = false;
export async function ensureGameClocks(db: any): Promise<void> {
 if (clocksReady) return;
 await db.sql`create table if not exists game_clocks (
 pool_game_id integer primary key references timetable_pool_games(id) on delete cascade,
 ends_at timestamptz not null,
 updated_by text,
 updated_at timestamptz not null default now()
)`;
 clocksReady = true;
}

let ready = false;
export async function ensureLineupChanges(db: any): Promise<void> {
 if (ready) return;
 await db.sql`create table if not exists game_lineup_changes (
 pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
 member_id text not null references members(id) on delete cascade,
 team_id integer not null references game_teams(id) on delete cascade,
 created_by text,
 created_at timestamptz not null default now(),
 primary key (pool_game_id, member_id)
)`;
 ready = true;
}
