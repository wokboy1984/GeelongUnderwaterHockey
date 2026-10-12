// Member email lists for the "Email players" panel on the Game
// Coordination > Publish tab (2 Oct 2026).
//
// The site doesn't send email itself. The panel builds a Gmail compose
// link (everyone in BCC, message pre-written) and the coordinator sends it
// from their own Gmail, so nothing here touches Netlify's email limits.
//
// GET /api/coordinator/emails
//   -> { ok, sessionDate, published, allEmails[], confirmedEmails[] }
//
// allEmails: every member with a real login email (walk-ins added on the
// night have a placeholder *@no-login.guwh address and are left out).
// confirmedEmails: members booked "in" for the upcoming Wednesday.
//
// Requires 'manage_others_attendance' (game_coordinator / administrator).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, unauthorized, forbidden } from "./_shared/roles.mts";
import { nextSessionDateISO } from "./_shared/attendance.mts";

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const caller = await ensureMember(db, user);
    if (!hasPermission(caller.roles, "manage_others_attendance")) {
      return forbidden("Only Game Coordinators and Administrators can email players");
    }

    const sessionDate = nextSessionDateISO();
    const all = await db.sql`
      select email from members
      where email not like '%@no-login.guwh'
      order by lower(email)
    `;
    const [session] = await db.sql`select id, published from sessions where session_date = ${sessionDate}`;
    const confirmed = session
      ? await db.sql`
          select m.email from bookings b join members m on m.id = b.member_id
          where b.session_id = ${session.id} and b.status = 'in' and m.email not like '%@no-login.guwh'
          order by lower(m.email)
        `
      : [];

    return new Response(
      JSON.stringify({
        ok: true,
        sessionDate,
        published: !!(session && session.published),
        allEmails: all.map((r: any) => r.email),
        confirmedEmails: confirmed.map((r: any) => r.email),
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    console.error("coordinator-emails failed", err);
    return new Response(JSON.stringify({ ok: false, error: "Couldn't load member emails" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/coordinator/emails",
};
