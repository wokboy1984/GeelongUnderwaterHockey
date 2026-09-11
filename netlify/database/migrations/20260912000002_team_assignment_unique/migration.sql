-- A member should only ever be in one pool/cap for a given session. This
-- lets the team-assignment endpoint use a single upsert instead of a
-- delete-then-insert.
alter table team_assignments add constraint team_assignments_session_member_unique unique (session_id, member_id);
