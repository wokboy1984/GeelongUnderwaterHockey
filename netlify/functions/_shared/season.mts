// Season break (11 Nov 2026, Liam): the last game of the year and the
// first game back. The club doesn't play over summer (last game 2 Dec 2026;
// first game back is usually early February and announced later), so no
// Wednesday in between is a game night: Try It Free doesn't offer those
// dates, members can't book in, and the 8pm auto-close skips them.
//
// Stored on the club_settings row (migration 20261111000001_season_break,
// also added here). An Administrator sets both dates in Administration.
// lastSession null = no break planned. returnDate null = back "to be
// announced": every Wednesday after lastSession is off until it's set.
//
// No imports from attendance.mts: it imports isBreakDate from here.

export type Season = { lastSession: string | null; returnDate: string | null };

const WEDNESDAY = /^\d{4}-\d{2}-\d{2}$/;
export function isSeasonDate(value: unknown): value is string {
  if (typeof value !== "string" || !WEDNESDAY.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 3 && d.toISOString().slice(0, 10) === value;
}

let ready = false;
export async function ensureSeasonColumns(db: any): Promise<void> {
  if (ready) return;
  await db.sql`create table if not exists club_settings (
    id boolean primary key default true,
    allow_player_referees boolean not null default true,
    updated_by text references members(id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint club_settings_singleton check (id)
  )`;
  await db.sql`insert into club_settings (id) values (true) on conflict (id) do nothing`;
  await db.sql`alter table club_settings add column if not exists season_last_session date`;
  await db.sql`alter table club_settings add column if not exists season_return date`;
  // Set once an Administrator saves the season; until then the 2026 break
  // (last game 2 Dec) applies, so it's right even before anyone visits
  // Administration.
  await db.sql`alter table club_settings add column if not exists season_set boolean not null default false`;
  await db.sql`update club_settings set season_last_session = '2026-12-02' where id = true and not season_set and season_last_session is null`;
  ready = true;
}

export async function getSeason(db: any): Promise<Season> {
  await ensureSeasonColumns(db);
  const [row] = await db.sql`
    select to_char(season_last_session, 'YYYY-MM-DD') as last_session, to_char(season_return, 'YYYY-MM-DD') as return_date
    from club_settings where id = true`;
  return { lastSession: row ? row.last_session || null : null, returnDate: row ? row.return_date || null : null };
}

// A Wednesday with no game because of the break.
export function isBreakDate(date: string, s: Season): boolean {
  if (!s.lastSession || date <= s.lastSession) return false;
  return !s.returnDate || date < s.returnDate;
}

// What pages need: the two dates and whether the upcoming Wednesday is off.
export function seasonInfo(s: Season, upcoming: string) {
  return { lastSession: s.lastSession, returnDate: s.returnDate, onBreak: isBreakDate(upcoming, s), upcoming };
}
