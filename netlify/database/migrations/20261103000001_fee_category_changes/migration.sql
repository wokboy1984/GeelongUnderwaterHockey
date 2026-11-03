-- Fee category changes (3 Nov 2026). A member can move between waged and
-- unwaged from a date on: games before it keep the old rate, games from it
-- use the new one (see ensureCategoryChanges in _shared/finance.mts).
-- finance_accounts.category stays as the category the account started with.
create table if not exists finance_category_changes (
 id serial primary key,
 member_id text not null references finance_accounts(member_id) on delete cascade,
 category text not null check (category in ('waged','unwaged')),
 effective_from date not null,
 created_by text,
 created_at timestamptz not null default now()
);
create unique index if not exists finance_category_changes_member_date on finance_category_changes (member_id, effective_from);
