// Season break, public (11 Nov 2026): the last game of the year and the
// first game back, for the home page, Contacts and Try It Free. See
// _shared/season.mts. Nothing private here, so no login needed; it's set
// by an Administrator through /api/admin/settings.
//
// GET /api/season -> { ok, lastSession, returnDate, onBreak, upcoming }

import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { nextSessionDateISO } from "./_shared/attendance.mts";
import { getSeason, seasonInfo } from "./_shared/season.mts";

export default async () => {
  try {
    const db = getDatabase();
    const season = await getSeason(db);
    return new Response(JSON.stringify(Object.assign({ ok: true }, seasonInfo(season, nextSessionDateISO()))), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("season request failed", err);
    return new Response(JSON.stringify({ ok: false, error: "Couldn't load the season dates" }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = {
  path: "/api/season",
};
