-- A Game Coordinator "closes out" a session date once everyone who showed
-- up has been marked attended. This is a soft, reversible marker — not a
-- permanent lock — so a mistake found later can always be reopened by any
-- coordinator or administrator. Keyed on session_date directly (not
-- sessions.id) because coordinator-checkin.mts works entirely off
-- clubToday()/session_attendance.session_date and never touches the
-- `sessions` table, so this avoids depending on a sessions row existing.
create table if not exists session_attendance_closeouts (
  session_date date primary key,
  closed_at timestamptz not null default now(),
  closed_by text not null references members(id)
);
