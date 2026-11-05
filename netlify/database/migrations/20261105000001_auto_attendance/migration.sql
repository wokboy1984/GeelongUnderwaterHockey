-- Attendance closes itself at 8pm (5 Nov 2026). Everyone booked in is
-- recorded as attended with no marked_by (automatic), and the night is
-- closed with no closed_by. attendance_autoclose_runs records each night
-- it has run for, so a night reopened by hand isn't closed again. See
-- autoCloseAttendance in _shared/attendance.mts.
create table if not exists attendance_autoclose_runs (
  session_date date primary key,
  ran_at timestamptz not null default now(),
  recorded integer not null default 0
);
alter table session_attendance alter column marked_by drop not null;
alter table session_attendance_history alter column marked_by drop not null;
alter table session_attendance_closeouts alter column closed_by drop not null;
