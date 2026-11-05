-- Family sign-up (5 Nov 2026): a newcomer bringing children signs them all
-- up in one go. See _shared/family-signup.mts.
alter table invites add column if not exists children jsonb;
alter table trial_signups add column if not exists children jsonb;
alter table trial_signups add column if not exists parent_playing boolean not null default true;
alter table trial_signups add column if not exists added_member_id text;
