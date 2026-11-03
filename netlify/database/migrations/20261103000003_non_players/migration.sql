-- Non-players (3 Nov 2026). Members who never play: booking them in counts
-- as volunteering and they're never charged a game fee. See
-- ensureNonPlayerColumn in _shared/roles.mts.
alter table members add column if not exists non_player boolean not null default false;
