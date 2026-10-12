-- 2 Oct 2026 player-review fixes.
--
-- 1. Nickname: optional, self-set on the Profile page. Wherever the site
--    shows a member's name to other members (Dashboard greeting, Who's
--    Coming, last game recap) it uses the nickname when set, otherwise the
--    real first + last name.
-- 2. Position "Goalie" renamed to "Full Back" (underwater hockey has no
--    goalie) - existing rows moved across so nobody is left on a value the
--    Profile dropdown no longer offers.
-- 3. trial_signups: the public "Book your first session" form on
--    /new-player previously saved nothing on the live site (it only wrote
--    to the demo localStorage store). Each signup is now a real row,
--    tied to one of the next four Wednesdays.
--
-- The functions that use these also run the same "if not exists"
-- statements defensively (see _shared/roles.mts ensureNicknameColumn and
-- trial-signup.mts), because declarative migrations have not always
-- applied to production on this project (see live-build-setup doc).

alter table members add column if not exists nickname text;

update members set position = 'Full Back' where position = 'Goalie';

create table if not exists trial_signups (
  id serial primary key,
  session_date date not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  age integer,
  fin_size text,
  handed text,
  emergency_name text not null,
  emergency_phone text not null,
  heard_from text,
  created_at timestamptz not null default now()
);

create index if not exists trial_signups_session_date_idx on trial_signups (session_date);
