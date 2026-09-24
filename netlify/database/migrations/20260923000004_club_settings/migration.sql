-- Club-wide settings — a singleton row (id is always `true`, enforced by
-- the primary key on a boolean column) so there's exactly one row to read
-- and update, rather than a key/value table for what's currently a single
-- flag.
--
-- allow_player_referees: with a small membership, the club currently
-- self-officiates — a player rostered onto a team can still be picked to
-- referee that same game (see the matching note in _shared/timetable.mts).
-- Defaults on, matching current practice; an Administrator can turn it off
-- later once the club has enough non-playing members to referee properly
-- (Cheongy's own words: "this may change in the future").

create table if not exists club_settings (
  id boolean primary key default true,
  allow_player_referees boolean not null default true,
  updated_by text references members(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint club_settings_singleton check (id)
);

insert into club_settings (id) values (true) on conflict (id) do nothing;
