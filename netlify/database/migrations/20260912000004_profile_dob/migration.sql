-- Real Profile page needs an actual date of birth rather than a static
-- "age" number typed in once (which goes stale) — age is now always
-- computed from this on read. grade, position, emergency_name and
-- emergency_phone columns already existed on members from the initial
-- schema, unused until now.

alter table members add column if not exists date_of_birth date;
