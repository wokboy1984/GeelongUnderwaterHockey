// Club-wide settings — currently just one: whether a player rostered onto
// a team can also be picked to referee that same game ("small club mode").
// Administrator-only (the 'manage_platform_settings' permission mapping
// already existed in _shared/roles.mts, unused until now).
//
// GET  /api/admin/settings -> { ok, allowPlayerReferees }
// POST /api/admin/settings { allowPlayerReferees: boolean } -> same shape

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

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
      const allowPlayerReferees = !!body.allowPlayerReferees;
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

    const [row] = await db.sql`select allow_player_referees from club_settings where id = true`;
    return new Response(JSON.stringify({ ok: true, allowPlayerReferees: row ? !!row.allow_player_referees : true }), {
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
