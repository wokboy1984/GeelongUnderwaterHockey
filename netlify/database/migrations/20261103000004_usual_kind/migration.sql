-- How a member usually comes (3 Nov 2026): 'player', 'swim' or 'volunteer',
-- picked on Profile and used as the default when booking in. Null means
-- playing. See ensureUsualKindColumn in _shared/roles.mts.
alter table members add column if not exists usual_kind text;
