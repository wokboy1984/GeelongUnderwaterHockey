-- "Didn't come" on a free-trial booking (11 Nov 2026, Liam): clears a
-- no-show (or a test booking) from the coordinators' trial alerts. Also
-- added by ensureTable in netlify/functions/trial-signup.mts.

alter table trial_signups add column if not exists dismissed_at timestamptz;
alter table trial_signups add column if not exists dismissed_by text;
