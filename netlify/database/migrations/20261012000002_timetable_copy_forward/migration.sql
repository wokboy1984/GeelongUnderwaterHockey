-- Remember the timetable format from the previous week (12 Oct 2026,
-- Cheongy). The first time the Game Coordinator opens the timetable for a
-- new Wednesday and it's empty, the builder copies the row layout from the
-- most recent earlier Wednesday that had one (row types, labels, times,
-- durations, notes, one-or-two games) - never teams, referees or scores.
--
-- timetable_copied_at stamps that this check has run for the session, so
-- it only ever happens once: if the coordinator then clears the rows to
-- start fresh, they stay cleared. timetable_copied_from records which week
-- the layout came from, for the notice shown in the builder.
--
-- coordinator-schedule.mts also adds these defensively (same reason as the
-- other recent columns).

alter table sessions add column if not exists timetable_copied_at timestamptz;
alter table sessions add column if not exists timetable_copied_from date;
