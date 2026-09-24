-- Victorian State Titles interest — a PUBLIC form (main nav, no login
-- required, 24 Sept 2026 change from the original members-only version).
-- Since a visitor may not have an account at all, the row carries its own
-- name/email/phone rather than only a member_id — member_id is now just an
-- optional link back to a real account when the visitor happens to be
-- logged in (used to prefill the form and to show the "you're already
-- registered" state), not the row's identity.
--
-- This migration was rewritten in place rather than superseded by a new
-- one — it was never applied to any database (local or production) under
-- its original members-only shape, so there's no live data to migrate.
--
-- Dedup/update key is the email address (case-insensitive), which works
-- whether or not the person is logged in: resubmitting the same email
-- updates their existing entry rather than creating a duplicate.
create table if not exists state_titles_registrations (
  id serial primary key,
  member_id text references members(id) on delete set null,
  event_key text not null default '2026-vic-state-titles',
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  grade text not null,
  is_member boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists state_titles_registrations_event_email_idx
  on state_titles_registrations (event_key, lower(email));

create index if not exists state_titles_registrations_event_idx
  on state_titles_registrations (event_key);
