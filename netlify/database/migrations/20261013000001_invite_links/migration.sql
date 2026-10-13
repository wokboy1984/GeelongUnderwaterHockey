-- Tracked Bring a Mate links (13 Oct 2026, Cheongy).
-- invites.token: each invite's own link (#/new-player?ref=<token>).
-- invites.trial_signup_id / booked_for: set when the mate books a free session.
-- invites.status gains 'booked' (was 'invited' | 'registered').
-- members.invite_code: a member's general share link, for when they share
--   without naming someone first; a booking through it creates an invite.
-- trial_signups.invited_by: member id of whoever brought them.
-- Also added defensively by ensureInviteColumns() in _shared/invite-links.mts.
alter table invites add column if not exists token text;
create unique index if not exists invites_token_key on invites (token);
alter table invites add column if not exists trial_signup_id integer;
alter table invites add column if not exists booked_for date;
alter table members add column if not exists invite_code text;
create unique index if not exists members_invite_code_key on members (invite_code);
alter table trial_signups add column if not exists invited_by text;
