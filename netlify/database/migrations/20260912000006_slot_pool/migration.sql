-- Lets a timetable slot say which pool it's played in (e.g. Pool A and
-- Pool B running the same game number at the same time, side by side) —
-- optional, since a club night doesn't have to run two pools at once.

alter table game_slots add column if not exists pool text;
