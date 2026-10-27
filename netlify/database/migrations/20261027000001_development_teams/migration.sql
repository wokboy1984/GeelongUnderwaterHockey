-- Development teams (27 Oct 2026, Liam).
--
-- The development game (6:15-6:43pm) is played by Dev Team 1 v Dev Team 2,
-- and the same players then play the later games in one of the main
-- teams. So a player can now be in one development team AND one main team
-- on the same night, but still never two of the same kind.
--
-- The flag lives on the team, and is copied onto each assignment so the
-- database itself can enforce "one of each kind" with a unique index. A
-- team's flag is only ever set when the team is created, so the two can't
-- drift apart.
alter table game_teams add column if not exists is_development boolean not null default false;
alter table team_assignments add column if not exists is_development boolean not null default false;
alter table team_assignments drop constraint if exists team_assignments_session_member_unique;
create unique index if not exists team_assignments_session_member_kind
  on team_assignments (session_id, member_id, is_development);
