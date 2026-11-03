-- Shared Scoreboard clock (3 Nov 2026): when a game now ends, if someone
-- started it early or added/took off time. No row = the timetable's times.
-- See ensureGameClocks in _shared/lineups.mts.
create table if not exists game_clocks (
  pool_game_id integer primary key references timetable_pool_games(id) on delete cascade,
  ends_at timestamptz not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
