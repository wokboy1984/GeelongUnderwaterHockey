-- Initial schema for the live Geelong Underwater Hockey site.
-- Mirrors the shape of the concept's localStorage demo data, so migrating
-- each feature across later is a like-for-like swap, not a redesign.

create table if not exists members (
  id text primary key,               -- Netlify Identity user id
  email text unique not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'player',      -- 'player' | 'organiser'
  age int,
  grade text,
  position text,
  fin_size text,
  handed text,
  phone text,
  emergency_name text,
  emergency_phone text,
  photo_emoji text,
  is_new boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id serial primary key,
  session_date date unique not null,
  published boolean not null default false,
  social_plan text,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  status text not null default 'in',        -- 'in' | 'out'
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table if not exists team_assignments (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  pool text not null,                       -- 'Pool A' | 'Pool B'
  cap_colour text not null,                 -- 'White' | 'Black'
  team_name text,
  member_id text not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists invites (
  id serial primary key,
  inviter_id text not null references members(id) on delete cascade,
  guest_name text not null,
  guest_email text,
  status text not null default 'invited',   -- 'invited' | 'registered'
  created_at timestamptz not null default now()
);
