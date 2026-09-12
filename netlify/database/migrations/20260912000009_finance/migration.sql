create table finance_accounts (
 member_id text primary key references members(id),
 category text not null check(category in ('waged','unwaged')),
 trial_eligible boolean not null default false,
 trial_evidence text not null default ''
);
create table finance_entries (
 id text primary key,
 member_id text not null references finance_accounts(member_id),
 kind text not null check(kind in ('game','joining','annual','payment')),
 entry_date date not null,
 amount_cents integer not null check(amount_cents >= 0),
 note text not null default '',
 actor_id text not null references members(id),
 created_at timestamptz not null default now()
);
create unique index finance_game_once on finance_entries(member_id,entry_date) where kind='game';
create unique index finance_joining_once on finance_entries(member_id) where kind='joining';
create unique index finance_annual_once on finance_entries(member_id,extract(year from entry_date)) where kind='annual';

create function record_finance_entry(p_id text,p_member text,p_kind text,p_date date,p_amount integer,p_note text,p_actor text)
returns text language plpgsql as $$
declare account finance_accounts%rowtype; n integer; last_date date; saved text;
begin
 select * into account from finance_accounts where member_id=p_member for update;
 if not found then raise exception 'Finance account missing'; end if;
 if exists(select 1 from finance_entries where id=p_id and member_id=p_member) then return p_id; end if;
 if p_kind='game' then
  select count(*),max(entry_date) into n,last_date from finance_entries where member_id=p_member and kind='game';
  if last_date is not null and p_date<=last_date then return null; end if;
  if account.trial_eligible and n<3 then p_amount=0; end if;
 end if;
 insert into finance_entries(id,member_id,kind,entry_date,amount_cents,note,actor_id)
 values(p_id,p_member,p_kind,p_date,p_amount,p_note,p_actor)
 on conflict do nothing returning id into saved;
 return saved;
end;
$$;
