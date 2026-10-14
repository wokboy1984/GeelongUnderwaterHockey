-- "My kids" (14 Oct 2026, Cheongy): a parent adds their children under
-- their own profile. Each child is a real players row (so teams, roll,
-- games played and goals all work) with no login of their own - same idea
-- as a walk-in, but linked to the parent. Game fees bill to the parent.
-- Also added defensively by ensureFamilyColumns() in _shared/roles.mts.
alter table members add column if not exists parent_id text references members(id);
alter table members add column if not exists dependant_removed_at timestamptz;
create index if not exists members_parent_idx on members(parent_id) where parent_id is not null;
