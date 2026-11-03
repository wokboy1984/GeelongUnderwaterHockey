-- Per-game line-up changes (3 Nov 2026). In one pool game, a member played
-- for this team instead of (or as well as not being on) their usual team
-- for the night. See _shared/lineups.mts.
create table if not exists game_lineup_changes (
 pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
 member_id text not null references members(id) on delete cascade,
 team_id integer not null references game_teams(id) on delete cascade,
 created_by text,
 created_at timestamptz not null default now(),
 primary key (pool_game_id, member_id)
);
