-- Game scores + per-player goal tallies, entered by the Game Coordinator
-- after a session's games are done (decided approach — not live during
-- play, not self-service for referees).
--
-- The final score lives directly on timetable_pool_games (one pool game =
-- one final score, same place its teams already live). Per-player goals
-- get their own table since a game can have any number of scorers, and a
-- season/career total is just SUM(goals) grouped by member — no separate
-- "season" concept needed, same pattern coordinator-schedule.mts already
-- uses for season referee counts (extract(year from session_date)).

alter table timetable_pool_games add column if not exists black_score integer;
alter table timetable_pool_games add column if not exists white_score integer;
alter table timetable_pool_games add column if not exists scored_by text references members(id) on delete set null;
alter table timetable_pool_games add column if not exists scored_at timestamptz;

create table if not exists game_goals (
  id serial primary key,
  pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_game_id, member_id)
);
