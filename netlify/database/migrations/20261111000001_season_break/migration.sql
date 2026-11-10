-- Season break (11 Nov 2026, Liam): the last game of the year and the
-- first game back. No game on any Wednesday in between. See
-- netlify/functions/_shared/season.mts, which also adds these columns.
-- season_set: an Administrator has saved the dates; until then the 2026
-- break (last game Wednesday 2 December) applies.

alter table club_settings add column if not exists season_last_session date;
alter table club_settings add column if not exists season_return date;
alter table club_settings add column if not exists season_set boolean not null default false;
update club_settings set season_last_session = '2026-12-02' where id = true and not season_set and season_last_session is null;
