-- `phone` already existed on members from the initial schema (unused until
-- now). Only new thing needed is a cheap version counter for profile
-- photos, which are stored in Netlify Blobs (not Postgres) — this lets the
-- frontend cache-bust the photo URL after an upload/removal without an
-- extra blob lookup on every profile read.

alter table members add column if not exists photo_version integer not null default 0;
