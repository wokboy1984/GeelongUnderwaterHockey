-- Family partners (28 Oct 2026, committee decision on family pricing).
--
-- An Administrator links two adults as partners. Together with the
-- children under either of them (members.parent_id) they are one family:
-- each partner can book the other and the children in or out, and a
-- family's game fees on a night are capped (see _shared/finance.mts). Set
-- on both members; cleared automatically if either is deleted.
alter table members add column if not exists partner_id text references members(id) on delete set null;
