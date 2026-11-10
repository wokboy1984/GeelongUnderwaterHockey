import { getSeason, isBreakDate } from "./season.mts";
export function clubToday(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(name:string)=>parts.find(p=>p.type===name)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}

// The club's weekly cycle runs Thursday -> Wednesday, Melbourne time: as
// soon as it's Thursday in Geelong, the "active" session flips to next
// Wednesday, six days out, and members must confirm again. This must be
// computed from the calendar date Melbourne is actually on (clubToday()),
// never from the server's own wall-clock `new Date()` — a serverless
// function's clock is UTC, and naive `new Date().getDay()` math silently
// drifts a day around the Melbourne midnight boundary (worse again across
// the AEST/AEDT daylight-saving change, since the UTC offset itself
// moves). Building the target date from Y-M-D parts at UTC noon sidesteps
// both problems: noon is never near a DST transition, so date-only
// arithmetic (add N days) can't land on the wrong calendar day.
export function nextSessionDateISO(now = new Date()): string {
 const [y, m, d] = clubToday(now).split('-').map(Number);
 const today = Date.UTC(y, m - 1, d, 12); // noon UTC — clear of any DST edge
 const day = new Date(today).getUTCDay(); // 0 Sun ... 3 Wed ... 6 Sat
 const add = (3 - day + 7) % 7; // on Wednesday itself (add===0), STAY on today —
 // it's game day, not a week early. Found broken live on 16 Sept 2026 (an
 // actual Wednesday): this function still had "if(add===0) add=7", rolling
 // every read (Dashboard, This Week's Game, booking) forward to *next*
 // Wednesday on the one day it matters most, even though a game published
 // earlier in the week correctly targeted today. The doc had claimed this
 // was already fixed — it wasn't; this is the real fix.
 const next = new Date(today + add * 86400000);
 const pad = (n: number) => String(n).padStart(2, '0');
 return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// There is no booking cut-off any more (20 Oct 2026). Members can mark
// themselves in or out right up to the game, and the club asks them to do
// it by 5pm so the Game Coordinator has numbers to build teams and a
// timetable from. That 5pm is encouragement only — nothing enforces it,
// and no endpoint refuses a late change.
//
// History: a cut-off existed from 2 Oct 2026 (midday, then briefly 7:30pm
// on 20 Oct). Both shut people out who only found out late that they
// could make it, which cost the club players for no real gain. If a cut-
// off is ever wanted again, it belongs here as a Melbourne wall-clock
// time fed through melbourneToUTC(), with the refusal in booking.mts.

// Converts a Melbourne wall-clock date/time to a real UTC instant, DST-safe:
// guess the instant as if Melbourne were UTC, measure how far Melbourne's
// clock actually is from that guess, and correct by the difference.
export function melbourneToUTC(dateISO: string, hour: number, minute: number): Date {
 const [y, m, d] = dateISO.split('-').map(Number);
 const guess = Date.UTC(y, m - 1, d, hour, minute);
 const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
 const v = (n: string) => Number(parts.find((p) => p.type === n)!.value);
 const asMelb = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
 return new Date(guess - (asMelb - guess));
}


// Attendance closes itself at 8pm (5 Nov 2026, Liam): members book in
// ("I'm coming", before the night or at the pool), so the roll no longer
// needs ticking or closing. At 8pm Melbourne time on a game night, everyone
// booked in is recorded as attended, as whatever they booked for, which is
// what charges their game fee, and the night is closed. Anyone the
// coordinator already marked stays as they were. It runs once per night:
// a night someone reopens to fix by hand isn't closed again behind them.
// Nights before AUTO_CLOSE_FROM keep the old tick-and-save roll.
//
// Run by the scheduled attendance-autoclose function on Wednesday evenings,
// and on loading the Attendance and Finance pages, so a missed run catches
// up the next time anyone looks. Automatic rows have no marked_by/closed_by.
export const AUTO_CLOSE_FROM = '2026-11-11';
export const AUTO_CLOSE_HOUR = 20;
let autoCloseReady = false;
export async function ensureAutoClose(db: any): Promise<void> {
 if (autoCloseReady) return;
 await db.sql`create table if not exists attendance_autoclose_runs (
  session_date date primary key,
  ran_at timestamptz not null default now(),
  recorded integer not null default 0
 )`;
 await db.sql`create table if not exists session_attendance_closeouts (
  session_date date primary key,
  closed_at timestamptz not null default now(),
  closed_by text references members(id)
 )`;
 await db.sql`alter table session_attendance add column if not exists kind text not null default 'player'`;
 await db.sql`alter table session_attendance alter column marked_by drop not null`;
 await db.sql`alter table session_attendance_history alter column marked_by drop not null`;
 await db.sql`alter table session_attendance_closeouts alter column closed_by drop not null`;
 autoCloseReady = true;
}

export function autoCloseAt(sessionDate: string): Date {
 return melbourneToUTC(sessionDate, AUTO_CLOSE_HOUR, 0);
}

// Returns the nights it closed just now.
export async function autoCloseAttendance(db: any, now = new Date()): Promise<string[]> {
 await ensureAutoClose(db);
 const season = await getSeason(db);
 const today = clubToday(now);
 const due = await db.sql`
  select to_char(s.session_date, 'YYYY-MM-DD') as d from sessions s
  where s.session_date >= ${AUTO_CLOSE_FROM}::date and s.session_date <= ${today}::date
    and not exists (select 1 from attendance_autoclose_runs r where r.session_date = s.session_date)
  order by s.session_date`;
 const closed: string[] = [];
 for (const { d } of due) {
  if (now < autoCloseAt(d)) continue;
  if (isBreakDate(d, season)) continue; // summer break: no game that night
  // Claim the night first, so two runs at once can't both do it.
  const claimed = await db.sql`insert into attendance_autoclose_runs (session_date) values (${d}::date) on conflict do nothing returning session_date`;
  if (!claimed.length) continue;
  // Already closed by hand before 8pm: that roll is the coordinator's.
  const [already] = await db.sql`select 1 from session_attendance_closeouts where session_date = ${d}::date`;
  if (already) continue;
  const added = await db.sql`
   with added as (
    insert into session_attendance (session_date, member_id, attended, marked_by, kind)
    select ${d}::date, b.member_id, true, null, b.kind
    from bookings b join sessions s on s.id = b.session_id
    where s.session_date = ${d}::date and b.status = 'in'
    on conflict (session_date, member_id) do nothing
    returning session_date, member_id, attended, marked_by
   )
   insert into session_attendance_history (session_date, member_id, attended, marked_by)
   select session_date, member_id, attended, marked_by from added
   returning member_id`;
  await db.sql`insert into session_attendance_closeouts (session_date, closed_by) values (${d}::date, null) on conflict (session_date) do nothing`;
  await db.sql`update attendance_autoclose_runs set recorded = ${added.length} where session_date = ${d}::date`;
  closed.push(d);
 }
 return closed;
}

// Week-by-week browsing (2 Oct 2026). Game Board, Scores and MVP can now
// look at any past Wednesday instead of only "the upcoming one", which
// flipped to next week at midnight Wednesday. A requested date is only
// accepted if it's a real YYYY-MM-DD Wednesday no later than the upcoming
// session; anything else falls back to the upcoming session.
export function isWednesdayISO(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const [y, m, d] = value.split('-').map(Number);
 const dt = new Date(Date.UTC(y, m - 1, d, 12));
 return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && dt.getUTCDay() === 3;
}

export function requestedSessionDate(value: unknown, now = new Date()): string {
 const upcoming = nextSessionDateISO(now);
 if (isWednesdayISO(value) && value <= upcoming) return value;
 return upcoming;
}

// Which Wednesday the Attendance page opens on (12 Oct 2026). Thursday and
// Friday open on the game night just gone (catching up on the roll);
// every other day opens on the upcoming Wednesday (today, on a Wednesday).
// The page's Prev/Next can still move to any week.
export function defaultRollDateISO(now = new Date()): string {
 const [y, m, d] = clubToday(now).split('-').map(Number);
 const today = Date.UTC(y, m - 1, d, 12);
 const day = new Date(today).getUTCDay(); // 4 Thu, 5 Fri
 if (day === 4 || day === 5) {
  const last = new Date(today - (day - 3) * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
 }
 return nextSessionDateISO(now);
}

// What someone is actually coming for (20 Oct 2026). Not everyone who
// turns up on a Wednesday is playing: some lane swim, some come to help
// and may referee. Recorded against both the booking (what they said) and
// session_attendance (what the coordinator ticked), because fees are
// computed from the roll, not from intentions.
//
// 'player' is the default everywhere, so any row written before this
// existed — or by any path that forgets to set it — behaves exactly as it
// always did rather than silently becoming free.
export const ATTENDANCE_KINDS = ['player', 'swim', 'volunteer'] as const;
export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];

export function isAttendanceKind(value: unknown): value is AttendanceKind {
 return typeof value === 'string' && (ATTENDANCE_KINDS as readonly string[]).includes(value);
}

// Falls back to 'player' rather than rejecting, so a stale browser tab
// that posts no kind books someone in to play, which is what it meant
// before this feature existed.
export function toAttendanceKind(value: unknown): AttendanceKind {
 return isAttendanceKind(value) ? value : 'player';
}

export const ATTENDANCE_KIND_LABELS: Record<AttendanceKind, string> = {
 player: 'Playing',
 swim: 'Lane swim',
 volunteer: 'Volunteering',
};
