// Public, unauthenticated stats for the marketing homepage — just an
// aggregate count, no member data, so no login is required (unlike
// booking.mts, which needs a real member to book or check their own
// status). Keep this endpoint to safe-to-publish numbers only.
//
// GET /api/public-stats -> { ok, sessionDate, confirmedCount }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { nextSessionDateISO } from "./_shared/attendance.mts";

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    const sessionDate = nextSessionDateISO();
    const [session] = await db.sql`select id from sessions where session_date = ${sessionDate}`;
    const confirmedCount = session
      ? (await db.sql`select count(*)::int as count from bookings where session_id = ${session.id} and status = 'in'`)[0].count
      : 0;

    return new Response(JSON.stringify({ ok: true, sessionDate, confirmedCount }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/public-stats",
};
