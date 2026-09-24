-- Digital club waiver — scope decided as "new registrations only": going
-- forward, anyone who registers is required to accept the waiver online
-- before using the portal, but existing members aren't retroactively
-- forced to re-sign. That's implemented by backfilling every member who
-- exists as of this migration as already-accepted (grandfathered) — only a
-- member created *after* this migration runs will ever see
-- waiver_accepted_at is null, which is exactly what gates them.
--
-- Signature format (Cheongy's call): typed full name + a checkbox + a
-- timestamp, not a drawn signature. waiver_wwcc_status and
-- waiver_guardian_name mirror the two other declarations on the club's
-- paper Player Registration form (WWCC/VIT status, and a
-- parent/guardian's name when signing on behalf of an under-18).

alter table members add column if not exists waiver_accepted_at timestamptz;
alter table members add column if not exists waiver_signed_name text;
alter table members add column if not exists waiver_wwcc_status text; -- 'have' | 'will_apply'
alter table members add column if not exists waiver_guardian_name text;

update members
set waiver_accepted_at = now(),
    waiver_signed_name = coalesce(nullif(trim(first_name || ' ' || last_name), ''), email)
where waiver_accepted_at is null;
