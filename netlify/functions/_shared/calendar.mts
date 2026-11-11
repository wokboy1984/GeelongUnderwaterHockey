// Club calendar (11 Nov 2026, Liam): game nights and club events, shown on
// the member Calendar tab and as a phone calendar feed. Administrators
// add and change them; anyone can read them (dates,
// times and places only - never names).
//
// Step 1 of 2: for now the calendar sits alongside the rest of the site.
// Booking, Try It Free and the 8pm auto-close still use "every Wednesday"
// plus the summer break setting (_shared/season.mts). Step 2 will make them
// follow the calendar's game nights instead.
//
// Table calendar_items (migration 20261111000002_calendar, also created
// here). kind 'game' = a game night (one per date); 'event' = anything
// else (AGM, BBQ, state titles). A cancelled item stays, crossed out, with
// its reason.

export type CalendarKind = "game" | "event";
export const CLUB_VENUE = "Handbury Centre for Wellbeing";

let ready = false;
export async function ensureCalendar(db: any): Promise<void> {
  if (ready) return;
  await db.sql`create table if not exists calendar_items (
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
  )`;
  await db.sql`create unique index if not exists calendar_items_one_game_per_date on calendar_items (item_date) where kind = 'game'`;
  await db.sql`create index if not exists calendar_items_date on calendar_items (item_date)`;
  ready = true;
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// Every date from `from` to `to` (inclusive) that falls on `weekday`
// (0 Sun ... 3 Wed ... 6 Sat), less any in `skip`. At most 60, so a typo in
// the year can't create hundreds of nights.
export function seasonDates(from: string, to: string, weekday: number, skip: string[] = []): string[] {
  if (!isISODate(from) || !isISODate(to) || to < from) return [];
  const skipSet = new Set(skip);
  const out: string[] = [];
  const start = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z").getTime();
  // Step to the first matching weekday, then a week at a time.
  start.setUTCDate(start.getUTCDate() + ((weekday - start.getUTCDay() + 7) % 7));
  for (let t = start.getTime(); t <= end && out.length < 60; t += 7 * 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (!skipSet.has(iso)) out.push(iso);
  }
  return out;
}

export type CalendarItem = {
  id: number; date: string; kind: CalendarKind; title: string; startTime: string | null; endTime: string | null;
  location: string | null; notes: string | null; cancelled: boolean; cancelReason: string | null;
};

export function shapeItem(r: any): CalendarItem {
  return {
    id: r.id,
    date: r.item_date,
    kind: r.kind === "game" ? "game" : "event",
    title: r.title || (r.kind === "game" ? "Game night" : "Club event"),
    startTime: r.start_time || null,
    endTime: r.end_time || null,
    location: r.location || null,
    notes: r.notes || null,
    cancelled: !!r.cancelled,
    cancelReason: r.cancel_reason || null,
  };
}

export async function listItems(db: any, from: string, to: string): Promise<CalendarItem[]> {
  await ensureCalendar(db);
  const rows = await db.sql`
    select id, to_char(item_date, 'YYYY-MM-DD') as item_date, kind, title, start_time, end_time, location, notes, cancelled, cancel_reason
    from calendar_items
    where item_date >= ${from}::date and item_date <= ${to}::date
    order by item_date asc, (kind = 'game') desc, start_time asc nulls last, id asc`;
  return rows.map(shapeItem);
}

// ---- iCalendar feed (phone calendars) -------------------------------------
// Times are written in UTC, converted from Melbourne time with the same
// helper the 8pm auto-close uses, so daylight saving is handled.

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
// Long lines are folded at 75 octets, as the format requires.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}

export function buildICS(items: CalendarItem[], toUTC: (date: string, h: number, m: number) => Date, host: string, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Geelong Underwater Hockey//Club calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Geelong Underwater Hockey",
    "X-WR-TIMEZONE:Australia/Melbourne",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const it of items) {
    lines.push("BEGIN:VEVENT");
    lines.push("UID:guwh-calendar-" + it.id + "@" + host);
    lines.push("DTSTAMP:" + icsStamp(now));
    if (it.startTime) {
      const [sh, sm] = it.startTime.split(":").map(Number);
      const start = toUTC(it.date, sh, sm);
      let end: Date;
      if (it.endTime) { const [eh, em] = it.endTime.split(":").map(Number); end = toUTC(it.date, eh, em); }
      else end = new Date(start.getTime() + 2 * 3600000);
      lines.push("DTSTART:" + icsStamp(start));
      lines.push("DTEND:" + icsStamp(end > start ? end : new Date(start.getTime() + 3600000)));
    } else {
      // All-day: the end date is the day after.
      const next = new Date(it.date + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      lines.push("DTSTART;VALUE=DATE:" + it.date.replace(/-/g, ""));
      lines.push("DTEND;VALUE=DATE:" + next.toISOString().slice(0, 10).replace(/-/g, ""));
    }
    lines.push(fold("SUMMARY:" + icsText((it.cancelled ? "Cancelled: " : "") + (it.kind === "game" ? "Underwater hockey" + (it.title && it.title !== "Game night" ? " - " + it.title : "") : it.title))));
    if (it.location) lines.push(fold("LOCATION:" + icsText(it.location)));
    const desc = [it.cancelled && it.cancelReason ? "Cancelled: " + it.cancelReason : "", it.notes || ""].filter(Boolean).join("\n");
    if (desc) lines.push(fold("DESCRIPTION:" + icsText(desc)));
    if (it.cancelled) lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
