-- Returning players go back into last week's team (12 Oct 2026, Cheongy).
-- One row per player per week once the builder has tried to place them,
-- so a player the coordinator moves or removes isn't put back again.
-- placed_team_id is the team they were placed in (null = no matching team).
-- Also created defensively by _shared/carry-forward.mts.

create table if not exists team_autoplaced (
  session_id integer not null references sessions(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  placed_team_id integer references game_teams(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, member_id)
);
