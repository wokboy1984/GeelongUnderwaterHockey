// Proof-of-life endpoint for the live build's backend foundation.
// Confirms the Function layer can reach the real Netlify DB (Postgres/Neon).
// Visit /api/health once deployed — real players/organisers never see this.
import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

// Every table any migration has ever created. Used by ?schema=1 below to
// check which ones actually exist on the live database — added 13 Sept
// 2026 after discovering session_attendance_closeouts' migration
// (20260912000012_attendance_closeout) had been committed but never
// actually applied against production, which took down the whole
// Attendance tab with a bare 500. There's no way to run `netlify db
// migrate` or inspect the live DB directly from this build process, so
// this is the fastest way to see, from a browser, which migrations
// actually landed versus which only exist as files in the repo.
const EXPECTED_TABLES = [
  "members", "sessions", "bookings", "game_teams", "team_assignments",
  "timetable_rows", "timetable_pool_games", "timetable_pool_referees",
  "game_slots", "game_slot_referees", "invites", "member_roles", "audit_log",
  "session_attendance", "session_attendance_history", "session_attendance_closeouts",
  "finance_accounts", "finance_entries",
];

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    const [{ now }] = await db.sql`select now() as now`;
    const [{ count }] = await db.sql`select count(*)::int as count from members`;
    const body: any = { ok: true, dbTime: now, members: count };

    if (new URL(req.url).searchParams.get("schema")) {
      const found = await db.sql`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any(${EXPECTED_TABLES})
      `;
      const foundNames = new Set(found.map((r: any) => r.table_name));
      body.tables = {
        present: EXPECTED_TABLES.filter((t) => foundNames.has(t)),
        missing: EXPECTED_TABLES.filter((t) => !foundNames.has(t)),
      };
      try {
        const [constraint] = await db.sql`
          select pg_get_constraintdef(oid) as def from pg_constraint
          where conrelid = 'finance_entries'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%'
        `;
        body.financeEntriesKindConstraint = constraint ? constraint.def : null;
      } catch (e) {
        body.financeEntriesKindConstraint = `error: ${String(e)}`;
      }
    }

    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/health",
};
