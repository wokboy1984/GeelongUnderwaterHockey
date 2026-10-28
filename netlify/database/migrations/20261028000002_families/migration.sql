-- Families (28 Oct 2026, committee decision on family pricing).
--
-- An Administrator puts any login accounts into one family: partners, and
-- juniors who have their own login. Members sharing a family_id are one
-- family, together with the children under any of them (members.parent_id
-- - those have no login and follow their parent). Anyone in a family can
-- book the others in or out, and a family's game fees on a night are
-- capped (see _shared/finance.mts). No family_id means a family of one.
alter table members add column if not exists family_id text;
create index if not exists members_family_id on members (family_id);
