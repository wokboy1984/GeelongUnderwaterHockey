// Real Bring a Mate endpoint — invites a member has sent, backed by the
// `invites` table instead of the concept's localStorage demo data.
//
// GET   /api/invites              -> { ok, invites: [{ id, guestName, guestEmail, status, createdAt }] }
// GET   /api/invites?scope=all    -> club-wide, registered guests from the last 10 days only,
//                                     with inviterName — for the coordinator's "New Players Today".
//                                     Requires 'manage_others_attendance' (game_coordinator/administrator).
// POST  /api/invites   { guestName, guestEmail } -> same shape, invite added
// PATCH /api/invites   { id, status: "registered" } -> same shape, one invite updated
//
// All require a logged-in Netlify Identity user (JWT in the Authorization
// header — the widget's user.jwt() handles this on the frontend).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission } from "./_shared/roles.mts";

function firstNameFrom(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(" ")[0];
  return email.split("@")[0];
}
function lastNameFrom(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function shape(row: any) {
  return {
    id: row.id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    status: row.status,
    createdAt: row.created_at,
  };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Not logged in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const db = getDatabase();
    const memberId: string = user.sub;
    const email: string = user.email;
    const fullName: string | undefined = user.user_metadata?.full_name;

    // Make sure this member exists (same pattern as /api/booking).
    await db.sql`
      insert into members (id, email, first_name, last_name)
      values (${memberId}, ${email}, ${firstNameFrom(fullName, email)}, ${lastNameFrom(fullName)})
      on conflict (id) do nothing
    `;

    // Club-wide view for the Attendance tab's "New Players Today" —
    // recently registered Bring a Mate guests, regardless of who invited
    // them. Read-only, separate from the per-member GET below, and gated
    // to the same permission as managing attendance.
    if (req.method === "GET" && new URL(req.url).searchParams.get("scope") === "all") {
      const caller = await ensureMember(db, user);
      if (!hasPermission(caller.roles, "manage_others_attendance")) {
        return new Response(JSON.stringify({ ok: false, error: "Only Game Coordinators and Administrators can see this" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      const rows = await db.sql`
        select i.id, i.guest_name, i.guest_email, i.status, i.created_at, m.first_name as inviter_first_name, m.last_name as inviter_last_name
        from invites i join members m on m.id = i.inviter_id
        where i.status = 'registered' and i.created_at > now() - interval '10 days'
        order by i.created_at desc
        limit 25
      `;
      return new Response(
        JSON.stringify({
          ok: true,
          invites: rows.map((r: any) => ({
            id: r.id,
            guestName: r.guest_name,
            guestEmail: r.guest_email,
            status: r.status,
            createdAt: r.created_at,
            inviterName: (r.inviter_first_name + " " + r.inviter_last_name).trim(),
          })),
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const guestName = String(body.guestName || "").trim();
      const guestEmail = body.guestEmail ? String(body.guestEmail).trim() : null;
      if (!guestName) {
        return new Response(JSON.stringify({ ok: false, error: "Their name is required" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      await db.sql`
        insert into invites (inviter_id, guest_name, guest_email)
        values (${memberId}, ${guestName}, ${guestEmail})
      `;
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      const status = body.status === "registered" ? "registered" : "invited";
      if (id) {
        // Scoped to this member's own invites — can't touch anyone else's.
        await db.sql`
          update invites set status = ${status} where id = ${id} and inviter_id = ${memberId}
        `;
      }
    }

    const rows = await db.sql`
      select id, guest_name, guest_email, status, created_at
      from invites
      where inviter_id = ${memberId}
      order by created_at desc
    `;

    return new Response(JSON.stringify({ ok: true, invites: rows.map(shape) }), {
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
  path: "/api/invites",
};
