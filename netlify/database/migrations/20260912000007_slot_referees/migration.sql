-- Referees move from an auto-computed "everyone not playing" list to a
-- real, coordinator-picked assignment per game slot — a table rather than
-- a column since more than one referee can be assigned to the same game.

create table if not exists game_slot_referees (
  slot_id integer not null references game_slots(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slot_id, member_id)
);
