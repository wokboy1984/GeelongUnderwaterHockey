-- Replaces the fixed "Pool A/B x White/Black" team model with coordinator-
-- created named teams, plus a real editable timetable (game slots) and
-- computed referees (any confirmed player not on either team playing a slot).

create table if not exists game_teams (
  id serial primary key,
  session_id integer not null references sessions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists game_slots (
  id serial primary key,
  session_id integer not null references sessions(id) on delete cascade,
  slot_order integer not null,
  label text not null,
  start_min integer,
  duration_min integer,
  team_a_id integer references game_teams(id) on delete set null,
  team_b_id integer references game_teams(id) on delete set null,
  created_at timestamptz not null default now()
);

-- team_assignments moves from a fixed pool/cap_colour pair to a team_id
-- pointing at a coordinator-created team. Only ever had one real row
-- (a test assignment made while verifying the old model), so it's safe to
-- clear rather than try to map old pool/cap values onto new teams.
delete from team_assignments;

alter table team_assignments add column if not exists team_id integer references game_teams(id) on delete cascade;
alter table team_assignments drop column if exists pool;
alter table team_assignments drop column if exists cap_colour;
alter table team_assignments alter column team_id set not null;
