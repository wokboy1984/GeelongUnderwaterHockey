-- Lets any referee assigned to a pool game in this session's timetable
-- nominate a confirmed player as tonight's MVP, once the games are done.
-- One nomination per referee per session (they can change their mind —
-- nominating again just updates it, via the unique constraint below), never
-- for themselves. Nominee is re-validated server-side against confirmed
-- attendance on every write; nothing here is trusted from the client.

create table if not exists mvp_nominations (
  id serial primary key,
  session_id integer not null references sessions(id) on delete cascade,
  nominator_id text not null references members(id) on delete cascade,
  nominee_id text not null references members(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, nominator_id)
);
