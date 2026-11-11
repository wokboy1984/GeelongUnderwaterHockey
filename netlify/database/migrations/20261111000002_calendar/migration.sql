-- Club calendar (11 Nov 2026, Liam): game nights and club events. See
-- netlify/functions/_shared/calendar.mts, which also creates this table.
-- Seeds the rest of the 2026 season: game nights every Wednesday from
-- 11 November to the last game on 2 December, 6:00-7:45pm.

create table if not exists calendar_items (
  id serial primary key,
  item_date date not null,
  kind text not null,
  title text,
  start_time text,
  end_time text,
  location text,
  notes text,
  cancelled boolean not null default false,
  cancel_reason text,
  created_by text references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by text references members(id) on delete set null,
  updated_at timestamptz not null default now()
);
create unique index if not exists calendar_items_one_game_per_date on calendar_items (item_date) where kind = 'game';
create index if not exists calendar_items_date on calendar_items (item_date);

insert into calendar_items (item_date, kind, title, start_time, end_time, location)
values ('2026-11-11', 'game', 'Game night', '18:00', '19:45', 'Handbury Centre for Wellbeing'),
       ('2026-11-18', 'game', 'Game night', '18:00', '19:45', 'Handbury Centre for Wellbeing'),
       ('2026-11-25', 'game', 'Game night', '18:00', '19:45', 'Handbury Centre for Wellbeing'),
       ('2026-12-02', 'game', 'Last game for 2026', '18:00', '19:45', 'Handbury Centre for Wellbeing')
on conflict (item_date) where kind = 'game' do nothing;
