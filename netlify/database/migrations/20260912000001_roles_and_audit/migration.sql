-- Multi-role permission system. A member can hold zero or more of these
-- roles at once, stacked on top of the implicit baseline "member" access
-- that comes from having a members row at all. members.role ('player' |
-- 'organiser') from the initial migration is superseded by this table and
-- is no longer written to by real-mode code — left in place, unused,
-- rather than dropped, to avoid a destructive schema change.

create table if not exists member_roles (
  member_id text not null references members(id) on delete cascade,
  role text not null,          -- 'game_coordinator' | 'community_moderator' | 'treasurer' | 'administrator'
  granted_by text not null,    -- member_id of the admin who granted it, or 'system' for the super-admin bootstrap
  granted_at timestamptz not null default now(),
  note text,
  primary key (member_id, role)
);

-- Every privileged action (role grants/revokes to start with) gets a
-- permanent, unchangeable record. Application code never updates or
-- deletes rows here.
create table if not exists audit_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor_id text,                -- member_id who performed the action (null = system)
  actor_email text,
  action text not null,         -- e.g. 'role_granted', 'role_revoked'
  resource_type text not null,  -- e.g. 'member_role'
  resource_id text,             -- e.g. the affected member's id
  previous_value text,          -- JSON, as text (kept simple rather than jsonb)
  new_value text,                -- JSON, as text
  note text
);
