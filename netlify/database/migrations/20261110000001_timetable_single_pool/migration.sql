-- Which pool a one-game row is played in (10 Nov 2026, Liam).
--
-- A Game row is either two games at once (game_count 2: Pool A + Pool B)
-- or one game (game_count 1). Until now a one-game row was always Pool A;
-- single_pool lets it be Pool B instead. Every existing row keeps Pool A,
-- which is what its game is already stored as, so nothing changes.
--
-- Also added defensively by ensureGameCountColumn in _shared/roles.mts,
-- like game_count.

alter table timetable_rows add column if not exists single_pool text not null default 'Pool A';
