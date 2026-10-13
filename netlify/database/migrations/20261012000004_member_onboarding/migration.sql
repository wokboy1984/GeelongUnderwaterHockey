-- New member "Getting started" checklist (12 Oct 2026, Cheongy).
-- onboarding_seen: checklist steps the member has opened that can't be
-- worked out from other data (e.g. 'guide', 'board', 'forum').
-- onboarding_hidden_at: when they tapped Hide on the checklist.
-- Also added defensively by ensureOnboardingColumns() in _shared/roles.mts.
alter table members add column if not exists onboarding_seen text[] not null default '{}';
alter table members add column if not exists onboarding_hidden_at timestamptz;
