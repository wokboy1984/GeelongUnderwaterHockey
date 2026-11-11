// Phone calendar feed (11 Nov 2026): the club calendar as an iCalendar
// subscription for Apple Calendar, Google Calendar and Outlook. Public -
// dates, times and places only. Phones re-check it every few hours (Google
// can take up to a day), so a cancellation reaches them on its own.
//
// GET /api/calendar.ics   two months back to 18 months ahead

import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { clubToday, melbourneToUTC } from "./_shared/attendance.mts";
import { buildICS, listItems } from "./_shared/calendar.mts";

export default async (req: Request) => {
  try {
    const db = getDatabase();
    const today = clubToday();
    const [y, m] = today.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(y, m + 17, 28)).toISOString().slice(0, 10);
    const items = await listItems(db, from, to);
    const host = new URL(req.url).host;
    return new Response(buildICS(items, melbourneToUTC, host), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="geelong-underwater-hockey.ics"',
        "cache-control": "public, max-age=900",
      },
    });
  } catch (err) {
    console.error("calendar feed failed", err);
    return new Response("Calendar unavailable", { status: 500 });
  }
};

export const config: Config = {
  path: "/api/calendar.ics",
};
