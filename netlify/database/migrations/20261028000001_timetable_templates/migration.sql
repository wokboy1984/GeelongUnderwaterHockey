-- Saved timetables (28 Oct 2026, Liam): A/B/C rounds and any timetable a
-- Game Coordinator saves by name, to load into a week in one go. Teams are
-- stored by name inside rows (jsonb). The A/B/C rounds themselves are
-- seeded by the app the first time this table is empty
-- (netlify/functions/_shared/timetable-templates.mts).
create table if not exists timetable_templates (
  id serial primary key,
  name text not null,
  rows jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
create unique index if not exists timetable_templates_name_lower on timetable_templates (lower(name));

-- Which saved timetable a week was last loaded from or saved as.
alter table sessions add column if not exists timetable_template text;
