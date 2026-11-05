-- MVP per game (5 Nov 2026): each referee votes for the game(s) they
-- refereed in four optional categories (junior/senior x male/female). Only
-- the first-listed referee's ballot counts when more than one votes. Gender
-- is optional and only used for these categories. See _shared/game-mvp.mts.
alter table members add column if not exists gender text;
create table if not exists mvp_game_ballots (
  pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
  nominator_id text not null references members(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now(),
  primary key (pool_game_id, nominator_id)
);
create table if not exists mvp_game_votes (
  pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
  nominator_id text not null references members(id) on delete cascade,
  category text not null,
  nominee_id text not null references members(id) on delete cascade,
  primary key (pool_game_id, nominator_id, category)
);
