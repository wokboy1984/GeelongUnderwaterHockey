// Closes the night's attendance at 8pm Melbourne time (5 Nov 2026) - see
// autoCloseAttendance in _shared/attendance.mts for what it does.
//
// Netlify schedules are in UTC and Melbourne's offset moves with daylight
// saving, so this runs at 9, 10 and 11 UTC on Wednesdays (7-11pm in
// Melbourne either way) and only acts once it's actually past 8pm there.
// Each night is only ever done once, so the extra runs do nothing.

import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { autoCloseAttendance } from "./_shared/attendance.mts";

export default async () => {
  try {
    const closed = await autoCloseAttendance(getDatabase());
    if (closed.length) console.log("attendance-autoclose: closed " + closed.join(", "));
  } catch (err) {
    console.error("attendance-autoclose failed", err);
  }
};

export const config: Config = {
  schedule: "0 9,10,11 * * 3",
};
