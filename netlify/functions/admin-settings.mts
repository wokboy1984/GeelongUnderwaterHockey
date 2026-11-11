// Club-wide settings — currently just one: whether a player rostered onto
// a team can also be picked to referee that same game ("small club mode").
// Administrator-only (the 'manage_platform_settings' permission mapping
// already existed in _shared/roles.mts, unused until now).
//
// GET  /api/admin/settings -> { ok, allowPlayerReferees, season: { lastSession, returnDate } }
// POST /api/admin/settings { allowPlayerReferees?: boolean, season?: { lastSession, returnDate } } -> same shape
//   season (11 Nov 2026): the last game of the year and the first game back,
//   each a Wednesday "YYYY-MM-DD" or "" for none - see _shared/season.mts.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";
import { getSeason, isSeasonDate } from "./_shared/season.mts";

function bad(error: string) {
  return new Response(JSON.stringify({ ok: false, error }), { status: 400, headers: { "content-type": "application/json" } });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "manage_platform_settings")) {
    return forbidden("Only Administrators can change club settings");
  }

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // Only what was sent changes (a season save mustn't reset small club mode).
      if (typeof body.allowPlayerReferees === "boolean") {
        const allowPlayerReferees = body.allowPlayerReferees;
        await db.sql`
          update club_settings set allow_player_referees = ${allowPlayerReferees}, updated_by = ${caller.id}, updated_at = now()
          where id = true
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "club_settings_changed",
          resourceType: "club_settings", resourceId: "singleton",
          newValue: { allowPlayerReferees },
          note: `${caller.email} set "allow player referees" to ${allowPlayerReferees}`,
        });
      }
      if (body.season && typeof body.season === "object") {
        const lastSession = String(body.season.lastSession || "").trim() || null;
        const returnDate = String(body.season.returnDate || "").trim() || null;
        if (lastSession && !isSeasonDate(lastSession)) return bad("The last game of the year needs to be a Wednesday");
        if (returnDate && !isSeasonDate(returnDate)) return bad("The first game back needs to be a Wednesday");
        if (returnDate && !lastSession) return bad("Set the last game of the year as well as the first game back");
        if (lastSession && returnDate && returnDate <= lastSession) return bad("The first game back has to be after the last game of the year");
        const before = await getSeason(db);
        await db.sql`
          update club_settings set season_last_session = ${lastSession}::date, season_return = ${returnDate}::date, season_set = true,
            updated_by = ${caller.id}, updated_at = now()
          where id = true
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "club_settings_changed",
          resourceType: "club_settings", resourceId: "singleton",
          previousValue: before, newValue: { lastSession, returnDate },
          note: `${caller.email} set the season break: last game ${lastSession || "none"}, first game back ${returnDate || "to be announced"}`,
        });
      }
    }

    const season = await getSeason(db);
    const [row] = await db.sql`select allow_player_referees from club_settings where id = true`;
    return new Response(JSON.stringify({ ok: true, allowPlayerReferees: row ? !!row.allow_player_referees : true, season }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/admin/settings",
};
