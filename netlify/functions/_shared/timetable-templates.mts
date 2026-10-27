// Saved timetables (28 Oct 2026, Liam). The club rotates through three
// formats - A round one week, B the next, then C, then back to A - so a
// Game Coordinator can load a whole night's timetable in one go instead of
// re-picking every matchup, and save the current timetable under a name
// to load again later (formats change).
//
// A saved timetable is a list of rows, with teams stored by NAME (teams
// are recreated every week, so ids don't carry over) and referees by
// member id. Loading one is done in coordinator-schedule.mts
// (apply_template).
//
// A, B and C rounds are seeded the first time the table is empty, from
// the club's printed sheets. The team that isn't playing referees / runs
// drills / coaches; the app's referees are people, not teams, so that's
// kept in the row notes.

export type TemplateGame = { pool: string; white: string | null; black: string | null; refereeIds: string[] };
export type TemplateRow = {
  rowType: string;
  label: string;
  startMin: number | null;
  durationMin: number | null;
  notes: string | null;
  gameCount: number;
  games: TemplateGame[];
};

let ready = false;
export async function ensureTimetableTemplates(db: any): Promise<void> {
  if (ready) return;
  await db.sql`
    create table if not exists timetable_templates (
      id serial primary key,
      name text not null,
      rows jsonb not null,
      created_by text,
      created_at timestamptz not null default now(),
      updated_by text,
      updated_at timestamptz not null default now()
    )
  `;
  await db.sql`create unique index if not exists timetable_templates_name_lower on timetable_templates (lower(name))`;
  await db.sql`alter table sessions add column if not exists timetable_template text`;
  const [{ n }] = await db.sql`select count(*)::int as n from timetable_templates`;
  if (n === 0) await seedRounds(db);
  ready = true;
}

export function parseRows(value: unknown): TemplateRow[] {
  const rows = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(rows) ? (rows as TemplateRow[]) : [];
}

// The night as printed on the club's A/B/C round sheets. Times are minutes
// after 6:00pm, like timetable_rows.start_min.
const ROUNDS: Record<string, [string, string, string][]> = {
  // [white, black, ref / drills / coach] for Game 1, 2, 3
  "A round": [["Dolphins", "Crays", "Sharks"], ["Dolphins", "Sharks", "Crays"], ["Crays", "Sharks", "Dolphins"]],
  "B round": [["Crays", "Sharks", "Dolphins"], ["Crays", "Dolphins", "Sharks"], ["Sharks", "Dolphins", "Crays"]],
  "C round": [["Sharks", "Dolphins", "Crays"], ["Sharks", "Crays", "Dolphins"], ["Dolphins", "Crays", "Sharks"]],
};

export function roundRows(games: [string, string, string][], devRefereeIds: string[]): TemplateRow[] {
  const one = (white: string | null, black: string | null, refereeIds: string[] = []): TemplateGame[] => [{ pool: "Pool A", white, black, refereeIds }];
  return [
    { rowType: "set_up", label: "Set Up", startMin: 0, durationMin: 15, notes: null, gameCount: 2, games: [] },
    {
      rowType: "game", label: "Development", startMin: 15, durationMin: 28,
      notes: "Development game and warm-up. Junior focus", gameCount: 1,
      games: one("Stingrays", "Seahorses", devRefereeIds),
    },
    ...games.map(([white, black, ref], i) => ({
      rowType: "game", label: "Game " + (i + 1), startMin: 44 + i * 19, durationMin: 18,
      notes: "Ref / drills / coach: " + ref + (i === 2 ? ". Juniors +/-" : ""), gameCount: 1,
      games: one(white, black),
    })),
  ];
}

async function seedRounds(db: any): Promise<void> {
  // The development game's referees on the sheet: Cookie and Stu. Matched
  // by name once, here; skipped if that name isn't exactly one member.
  const devRefereeIds: string[] = [];
  for (const [first, last] of [["Liam", "Cooke"], ["Stuart", "McCallum"]]) {
    const found = await db.sql`select id from members where lower(first_name) = lower(${first}) and lower(last_name) = lower(${last})`;
    if (found.length === 1) devRefereeIds.push(found[0].id);
  }
  for (const [name, games] of Object.entries(ROUNDS)) {
    await db.sql`
      insert into timetable_templates (name, rows) values (${name}, ${JSON.stringify(roundRows(games, devRefereeIds))}::jsonb)
      on conflict do nothing
    `;
  }
}
