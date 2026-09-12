-- Members Forum.
--
-- A recency-focused, WhatsApp-group-like members forum, not a traditional
-- documentation forum. Access is gated to adult members (18+, from
-- members.date_of_birth — no separate junior flag exists yet, see
-- forum_participation.opted_in below for how eligibility + opt-in combine)
-- who have opted in. Everything here is additive; no existing table is
-- altered or dropped.
--
-- Layout: forum_categories -> forum_topics -> forum_posts (self-referencing
-- via parent_post_id for threaded replies — the opening post of a topic is
-- just the post with is_opening_post = true and parent_post_id null).

create table if not exists forum_categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  posting_rule text not null default 'members',   -- 'members' | 'moderators_only'
  archived_at timestamptz,
  created_by text references members(id) on delete set null,
  updated_by text references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists forum_topics (
  id serial primary key,
  category_id integer not null references forum_categories(id) on delete restrict,
  title text not null,
  author_id text references members(id) on delete set null,
  pinned boolean not null default false,
  locked boolean not null default false,
  archived_at timestamptz,
  is_announcement boolean not null default false,
  important boolean not null default false,
  allow_replies boolean not null default true,
  expires_at timestamptz,                          -- announcements only; loses priority once past, stays visible until archived
  linked_session_id integer references sessions(id) on delete set null,   -- "Discuss this Wednesday's game"
  linked_news_label text,                           -- no real News/Events DB tables exist yet — lightweight label+url link
  linked_news_url text,
  linked_event_label text,
  linked_event_url text,
  merged_into_id integer references forum_topics(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_forum_topics_category on forum_topics(category_id);
create index if not exists idx_forum_topics_activity on forum_topics(last_activity_at desc);

create table if not exists forum_posts (
  id serial primary key,
  topic_id integer not null references forum_topics(id) on delete cascade,
  parent_post_id integer references forum_posts(id) on delete set null,
  author_id text references members(id) on delete set null,
  body_html text not null,
  is_opening_post boolean not null default false,
  edited_at timestamptz,
  edited_by_moderator boolean not null default false,
  moderator_edit_reason text,
  hidden_at timestamptz,
  hidden_by text references members(id) on delete set null,
  hidden_reason text,
  removed_at timestamptz,
  removed_by text references members(id) on delete set null,
  removed_reason text,
  deleted_by_author_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_forum_posts_topic on forum_posts(topic_id);
create index if not exists idx_forum_posts_parent on forum_posts(parent_post_id);

-- Previous content kept whenever a post is edited (by its author or by a
-- Moderator) — "preserve previous version" for moderator edits, and a plain
-- edit trail generally.
create table if not exists forum_post_revisions (
  id serial primary key,
  post_id integer not null references forum_posts(id) on delete cascade,
  body_html text not null,
  edited_by text references members(id) on delete set null,
  edited_by_moderator boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_post_revisions_post on forum_post_revisions(post_id);

create table if not exists forum_attachments (
  id serial primary key,
  post_id integer not null references forum_posts(id) on delete cascade,
  kind text not null,                               -- 'image' | 'video' | 'document' | 'youtube' | 'link'
  blob_key text,                                     -- Netlify Blobs key, for image/video/document
  url text,                                          -- for 'youtube' / 'link'
  file_name text,
  content_type text,
  size_bytes integer,
  approved_at timestamptz,                           -- media approval; null = pending (images/video/docs require it)
  approved_by text references members(id) on delete set null,
  created_by text references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_attachments_post on forum_attachments(post_id);

create table if not exists forum_reactions (
  id serial primary key,
  post_id integer not null references forum_posts(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  reaction text not null,                            -- 'like' | 'helpful' | 'funny' | 'interested'
  created_at timestamptz not null default now(),
  unique (post_id, member_id, reaction)
);
create index if not exists idx_forum_reactions_post on forum_reactions(post_id);

create table if not exists forum_polls (
  id serial primary key,
  topic_id integer not null unique references forum_topics(id) on delete cascade,
  question text not null,
  allow_multiple boolean not null default false,
  closes_at timestamptz,
  results_visible text not null default 'after_vote', -- 'before_vote' | 'after_vote' | 'after_close'
  anonymous boolean not null default false,
  created_by text references members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists forum_poll_options (
  id serial primary key,
  poll_id integer not null references forum_polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);
create index if not exists idx_forum_poll_options_poll on forum_poll_options(poll_id);

create table if not exists forum_poll_responses (
  id serial primary key,
  poll_id integer not null references forum_polls(id) on delete cascade,
  option_id integer not null references forum_poll_options(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, member_id)
);
create index if not exists idx_forum_poll_responses_poll on forum_poll_responses(poll_id, member_id);

create table if not exists forum_topic_followers (
  id serial primary key,
  topic_id integer not null references forum_topics(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  state text not null default 'following',           -- 'following' | 'muted'
  notify text not null default 'default',            -- 'in_app_email' | 'in_app_only' | 'none' | 'default' (inherit)
  created_at timestamptz not null default now(),
  unique (topic_id, member_id)
);

create table if not exists forum_category_followers (
  id serial primary key,
  category_id integer not null references forum_categories(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  state text not null default 'following',
  notify text not null default 'default',
  created_at timestamptz not null default now(),
  unique (category_id, member_id)
);

-- One row per member: their forum-wide notification defaults. Per-topic /
-- per-category overrides live in the *_followers tables above.
create table if not exists forum_notification_prefs (
  member_id text primary key references members(id) on delete cascade,
  default_notify text not null default 'in_app_only',   -- 'in_app_email' | 'in_app_only' | 'none'
  mentions_notify text not null default 'in_app_email',
  announcements_notify text not null default 'in_app_email',
  moderator_notify text not null default 'in_app_only',
  updated_at timestamptz not null default now()
);

-- One row per member: whether they've opted into the forum at all, their
-- display-privacy choices, guideline acceptance, and any posting
-- restriction/suspension a Moderator has placed on them. A member with no
-- row here (or opted_in = false) has no forum access, full stop.
create table if not exists forum_participation (
  member_id text primary key references members(id) on delete cascade,
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  show_photo boolean not null default true,
  show_grade boolean not null default false,
  show_badges boolean not null default true,
  guidelines_version text,
  guidelines_accepted_at timestamptz,
  restricted_at timestamptz,
  restricted_reason text,
  restricted_by text references members(id) on delete set null,
  suspended_at timestamptz,
  suspended_until timestamptz,
  suspended_reason text,
  suspended_by text references members(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Versioned guideline text, so "guidelines materially changed" can be
-- detected by comparing forum_participation.guidelines_version to the
-- current row here.
create table if not exists forum_guidelines (
  version text primary key,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists forum_mentions (
  id serial primary key,
  post_id integer not null references forum_posts(id) on delete cascade,
  mentioned_member_id text not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_mentions_member on forum_mentions(mentioned_member_id);

-- In-app notification inbox. Email delivery (when a provider is connected)
-- reads from the same rows; nothing here assumes email exists.
create table if not exists forum_notifications (
  id serial primary key,
  member_id text not null references members(id) on delete cascade,
  kind text not null,           -- 'reply' | 'reply_to_comment' | 'mention' | 'announcement' |
                                 -- 'poll_closing' | 'suggestion_approved' | 'suggestion_declined' | 'moderation_action'
  topic_id integer references forum_topics(id) on delete cascade,
  post_id integer references forum_posts(id) on delete cascade,
  actor_id text references members(id) on delete set null,
  summary text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_notifications_member on forum_notifications(member_id, read_at);

create table if not exists forum_reports (
  id serial primary key,
  target_type text not null,     -- 'topic' | 'post' | 'attachment'
  target_id integer not null,
  reporter_id text not null references members(id) on delete cascade,
  reason text not null,          -- 'harassment' | 'unsafe_advice' | 'privacy' | 'spam' | 'inappropriate_media' | 'off_topic' | 'other'
  explanation text,
  status text not null default 'open',   -- 'open' | 'in_review' | 'resolved' | 'dismissed'
  assigned_moderator_id text references members(id) on delete set null,
  resolution text,
  resolved_by text references members(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_reports_status on forum_reports(status);

-- Free-form moderator notes, either against a specific report or a general
-- note about a member's forum conduct (both nullable — exactly one is set).
create table if not exists forum_moderation_notes (
  id serial primary key,
  report_id integer references forum_reports(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  moderator_id text references members(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists forum_suggestions (
  id serial primary key,
  suggested_by text not null references members(id) on delete cascade,
  suggested_title text not null,
  suggested_category_id integer references forum_categories(id) on delete set null,
  explanation text not null,
  opening_content text,
  status text not null default 'pending',   -- 'pending' | 'approved' | 'declined'
  decline_reason text,
  reviewed_by text references members(id) on delete set null,
  reviewed_at timestamptz,
  published_topic_id integer references forum_topics(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_forum_suggestions_status on forum_suggestions(status);

-- Seed the four initial categories and guidelines v1 — safe to re-run.
insert into forum_categories (slug, name, description, sort_order)
values
  ('announcements', 'Announcements', 'Official club news and updates from Moderators and Administrators.', 0),
  ('wednesday-games', 'Wednesday Games', 'Talk about this week''s game, teams, and how it went.', 1),
  ('gear', 'Gear', 'Buy, sell, borrow and get advice on masks, fins, snorkels and sticks.', 2),
  ('upcoming-events', 'Upcoming Events', 'Socials, comps, and anything else coming up for the club.', 3)
on conflict (slug) do nothing;

insert into forum_guidelines (version, content)
values ('v1', E'Treat other Members with respect.\nNo harassment, bullying or discriminatory abuse.\nDo not share another person’s private information.\nDo not post private club or member information outside the forum.\nDo not present unsafe diving or breath-hold advice as risk-free.\nDo not encourage solo freediving or unsafe underwater practices.\nNo commercial spam.\nKeep Buy/Sell content within relevant approved discussions.\nFollow Moderator directions.\nReport concerns rather than escalating arguments.')
on conflict (version) do nothing;
