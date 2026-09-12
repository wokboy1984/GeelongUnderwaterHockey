-- Actual presence is independent of bookings and team assignments.
create table session_attendance (
 session_date date not null,
 member_id text not null references members(id),
 attended boolean not null default true,
 marked_by text not null references members(id),
 marked_at timestamptz not null default now(),
 primary key(session_date,member_id)
);
create table session_attendance_history (
 id bigint generated always as identity primary key,
 session_date date not null,
 member_id text not null references members(id),
 attended boolean not null,
 marked_by text not null references members(id),
 marked_at timestamptz not null default now()
);
