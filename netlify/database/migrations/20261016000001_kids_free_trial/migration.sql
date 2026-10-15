-- Kids' free trial sessions are now a tick box (16 Oct 2026, Cheongy), not
-- an automatic assumption. The Treasurer ticks it per child on the Finance
-- page; until then a child's games are charged from the first one.
-- Also added defensively by ensureFamilyColumns() in _shared/roles.mts.
alter table members add column if not exists trial_free boolean not null default false;
