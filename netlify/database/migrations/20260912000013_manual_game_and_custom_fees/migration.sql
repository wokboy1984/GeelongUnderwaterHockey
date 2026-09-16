-- Lets the Treasurer add two kinds of manual charge that weren't possible
-- before: a retrospective "game" fee (for a game that happened but was
-- never checked in via the Coordinator's Attendance tab) and a free-form
-- "custom" fee (for anything not covered by the standard fee structure).

-- 'custom' is a new kind — widen the check constraint to allow it.
alter table finance_entries drop constraint finance_entries_kind_check;
alter table finance_entries add constraint finance_entries_kind_check check (kind in ('game','joining','annual','payment','custom'));

-- record_finance_entry() previously had 'game'-specific logic: it required
-- each new game entry's date to be strictly after the member's last one
-- (fine for real-time entry, useless for backfilling gaps out of order),
-- and it zeroed the amount for a trial-eligible member's first three game
-- entries by counting rows already in finance_entries. That counter was
-- never actually exercised in production — real game charges are computed
-- live from session_attendance (see finance.mts), with their own correct,
-- independent trial-window count — so leaving it active here would let a
-- retrospective entry silently grant an extra, uncoordinated "free game"
-- on top of the real ones. Manual game entries are simplified to work
-- exactly like joining/annual: always the account's full category rate,
-- any date, no forced ordering — finance.mts itself refuses a manual game
-- entry for any date that already has a real session_attendance record,
-- so the two sources can't collide or double-charge.
create or replace function record_finance_entry(p_id text,p_member text,p_kind text,p_date date,p_amount integer,p_note text,p_actor text)
returns text language plpgsql as $$
declare account finance_accounts%rowtype; saved text;
begin
 select * into account from finance_accounts where member_id=p_member for update;
 if not found then raise exception 'Finance account missing'; end if;
 if exists(select 1 from finance_entries where id=p_id and member_id=p_member) then return p_id; end if;
 insert into finance_entries(id,member_id,kind,entry_date,amount_cents,note,actor_id)
 values(p_id,p_member,p_kind,p_date,p_amount,p_note,p_actor)
 on conflict do nothing returning id into saved;
 return saved;
end;
$$;
