-- Timetable-first builder.
--
-- Replaces the old model (one game_slots row = one game, in one pool, added
-- after the fact) with an ordered sequence of timetable_rows that the
-- organiser builds first. A row is either a non-game activity (Set Up, Warm
-- Up, Game Briefing, Game Changeover, Skills Development, Pack Up, Custom)
-- or a 'game' row, which can hold up to two simultaneous pool games — Pool A
-- and Pool B each run their own black-stick/white-stick matchup and their
-- own referees within the same time slot.
--
-- game_slots and game_slot_referees are superseded, not dropped — same
-- pattern as members.age/role from the very first migration — so this is
-- not a destructive change and old data stays inspectable.

create table if not exists timetable_rows (
  id serial primary key,
  session_id integer not null references sessions(id) on delete cascade,
  row_order integer not null,
  row_type text not null,      -- 'set_up' | 'warm_up' | 'game_briefing' | 'game' |
                                -- 'game_changeover' | 'skills_development' | 'pack_up' | 'custom'
  label text not null,
  start_min integer,
  duration_min integer,
  notes text,
  published_at timestamptz,    -- first time this row went out in a publish; null = never published
  archived_at timestamptz,     -- soft-hidden after having been published; null = active
  created_by text references members(id) on delete set null,
  updated_by text references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists timetable_pool_games (
  id serial primary key,
  row_id integer not null references timetable_rows(id) on delete cascade,
  pool text not null,          -- 'Pool A' | 'Pool B'
  black_team_id integer references game_teams(id) on delete set null,
  white_team_id integer references game_teams(id) on delete set null,
  unique (row_id, pool)
);

create table if not exists timetable_pool_referees (
  id serial primary key,
  pool_game_id integer not null references timetable_pool_games(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  unique (pool_game_id, member_id)
);

-- Migrate existing game_slots into the new shape. Where a Pool A slot and a
-- Pool B slot share the same session/start/duration, they were effectively
-- one simultaneous timetable row under the old model — fold them into a
-- single 'game' row with two pool games. Any other slot (including ones
-- with no pool set — under the old model that just meant "the only game
-- happening then") becomes its own 'game' row, defaulting to Pool A.
do $$
declare
  slot_a record;
  b_id integer;
  b_team_a integer;
  b_team_b integer;
  new_row_id integer;
  pool_game_id integer;
  matched_ids integer[] := '{}';
  sess_published boolean;
begin
  for slot_a in
    select * from game_slots
    where pool = 'Pool A' or pool is null
    order by session_id, slot_order
  loop
    if slot_a.id = any(matched_ids) then
      continue;
    end if;

    b_id := null; b_team_a := null; b_team_b := null;
    select id, team_a_id, team_b_id into b_id, b_team_a, b_team_b
      from game_slots
      where session_id = slot_a.session_id
        and pool = 'Pool B'
        and coalesce(start_min, -1) = coalesce(slot_a.start_min, -1)
        and coalesce(duration_min, -1) = coalesce(slot_a.duration_min, -1)
        and not (id = any(matched_ids))
      limit 1;

    select published into sess_published from sessions where id = slot_a.session_id;

    insert into timetable_rows (session_id, row_order, row_type, label, start_min, duration_min, published_at, created_at, updated_at)
    values (
      slot_a.session_id, slot_a.slot_order, 'game', slot_a.label, slot_a.start_min, slot_a.duration_min,
      case when sess_published then slot_a.created_at else null end,
      slot_a.created_at, now()
    )
    returning id into new_row_id;

    insert into timetable_pool_games (row_id, pool, black_team_id, white_team_id)
    values (new_row_id, 'Pool A', slot_a.team_a_id, slot_a.team_b_id)
    returning id into pool_game_id;

    insert into timetable_pool_referees (pool_game_id, member_id)
    select pool_game_id, member_id from game_slot_referees where slot_id = slot_a.id
    on conflict do nothing;

    matched_ids := matched_ids || slot_a.id;

    if b_id is not null then
      insert into timetable_pool_games (row_id, pool, black_team_id, white_team_id)
      values (new_row_id, 'Pool B', b_team_a, b_team_b)
      returning id into pool_game_id;

      insert into timetable_pool_referees (pool_game_id, member_id)
      select pool_game_id, member_id from game_slot_referees where slot_id = b_id
      on conflict do nothing;

      matched_ids := matched_ids || b_id;
    end if;
  end loop;

  -- Any leftover Pool B slot that never found a Pool A partner (it was the
  -- only game running at its time and happened to be tagged Pool B).
  for slot_a in
    select * from game_slots
    where pool = 'Pool B' and not (id = any(matched_ids))
    order by session_id, slot_order
  loop
    select published into sess_published from sessions where id = slot_a.session_id;

    insert into timetable_rows (session_id, row_order, row_type, label, start_min, duration_min, published_at, created_at, updated_at)
    values (
      slot_a.session_id, slot_a.slot_order, 'game', slot_a.label, slot_a.start_min, slot_a.duration_min,
      case when sess_published then slot_a.created_at else null end,
      slot_a.created_at, now()
    )
    returning id into new_row_id;

    insert into timetable_pool_games (row_id, pool, black_team_id, white_team_id)
    values (new_row_id, 'Pool B', slot_a.team_a_id, slot_a.team_b_id)
    returning id into pool_game_id;

    insert into timetable_pool_referees (pool_game_id, member_id)
    select pool_game_id, member_id from game_slot_referees where slot_id = slot_a.id
    on conflict do nothing;
  end loop;
end $$;

-- Tidy row_order into a clean, gapless sequence per session now that some
-- pairs were folded together.
with ranked as (
  select id, row_number() over (partition by session_id order by start_min nulls last, id) as rn
  from timetable_rows
)
update timetable_rows t set row_order = ranked.rn
from ranked where ranked.id = t.id;
