-- One game or two games at once (12 Oct 2026, Cheongy).
--
-- A Game row in the timetable can now be either a single game or two
-- simultaneous games (Pool A + Pool B, the previous behaviour). game_count
-- is 1 or 2; every existing row keeps 2, so nothing published changes.
-- When a row is switched to 1, its Pool B game (teams, referees, any score)
-- is deleted by the builder - see coordinator-schedule.mts set_game_count.
--
-- coordinator-schedule.mts and game-board.mts also add this column
-- defensively (ensureGameCountColumn in _shared/roles.mts) because
-- migrations haven't always applied to production on this project.

alter table timetable_rows add column if not exists game_count smallint not null default 2;
