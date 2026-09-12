// Administrator-only role management: search a member, see their current
// roles, grant or revoke a role. Every grant/revoke is written to
// audit_log — who did it, to whom, what changed, when, and why.
//
// GET    /api/admin/roles?q=<search>        -> { ok, members: [...] }
// POST   /api/admin/roles  { memberEmail, role, note } -> grant
// DELETE /api/admin/roles  { memberEmail, role, note } -> revoke
//
// All three require the caller to already hold the 'administrator' role
// (checked server-side against the database — never against anything the
// client sends). This is the only place roles can change; there is no
// client-side path that can grant a role to anyone, including yourself.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ageFromDOB, ensureMember, getVerifiedUser, hasRole, isRole, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";

const RESTRICTED_FOR_JUNIORS = new Set(["community_moderator", "treasurer", "administrator"]);

function shapeMember(row: any) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    age: ageFromDOB(row.date_of_birth),
    roles: (row.roles || []).filter(Boolean),
  };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasRole(caller.roles, "administrator")) {
    return forbidden("Only Administrators can manage roles");
  }

  try {
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams.get("q")?.trim() || "";
      // Walk-in players added via the coordinator's "Add Player" (no
      // account, no email) feature are placeholder members that can never
      // log in — they get a synthetic *@no-login.guwh email and have no
      // real identity to grant a role to, so they're excluded here.
      const rows = q
        ? await db.sql`
            select m.id, m.email, m.first_name, m.last_name, m.date_of_birth,
                   array_remove(array_agg(mr.role), null) as roles
            from members m
            left join member_roles mr on mr.member_id = m.id
            where m.email not like '%@no-login.guwh'
              and (m.email ilike ${"%" + q + "%"} or m.first_name ilike ${"%" + q + "%"} or m.last_name ilike ${"%" + q + "%"})
            group by m.id
            order by m.created_at desc
            limit 25
          `
        : await db.sql`
            select m.id, m.email, m.first_name, m.last_name, m.date_of_birth,
                   array_remove(array_agg(mr.role), null) as roles
            from members m
            left join member_roles mr on mr.member_id = m.id
            where m.email not like '%@no-login.guwh'
            group by m.id
            order by m.created_at desc
            limit 25
          `;
      return new Response(JSON.stringify({ ok: true, members: rows.map(shapeMember) }), {
        headers: { "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const memberEmail = String(body.memberEmail || "").trim();
    const role = String(body.role || "").trim();
    const note = body.note ? String(body.note).trim() : null;

    if (!memberEmail || !isRole(role)) {
      return new Response(JSON.stringify({ ok: false, error: "memberEmail and a valid role are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const [target] = await db.sql`select id, email, first_name, last_name, date_of_birth from members where email = ${memberEmail}`;
    if (!target || target.email.endsWith("@no-login.guwh")) {
      return new Response(
        JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const targetAge = ageFromDOB(target.date_of_birth);
    if (req.method === "POST") {
      if (RESTRICTED_FOR_JUNIORS.has(role) && typeof targetAge === "number" && targetAge < 18) {
        return new Response(JSON.stringify({ ok: false, error: "This role can't be assigned to a junior member" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      await db.sql`
        insert into member_roles (member_id, role, granted_by, note)
        values (${target.id}, ${role}, ${caller.id}, ${note})
        on conflict (member_id, role) do update set granted_by = excluded.granted_by, granted_at = now(), note = excluded.note
      `;
      await logAudit(db, {
        actorId: caller.id,
        actorEmail: caller.email,
        action: "role_granted",
        resourceType: "member_role",
        resourceId: target.id,
        newValue: { role, note },
        note: `Granted ${role} to ${target.email}`,
      });
    } else if (req.method === "DELETE") {
      await db.sql`delete from member_roles where member_id = ${target.id} and role = ${role}`;
      await logAudit(db, {
        actorId: caller.id,
        actorEmail: caller.email,
        action: "role_revoked",
        resourceType: "member_role",
        resourceId: target.id,
        previousValue: { role },
        note: `Revoked ${role} from ${target.email}`,
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }

    const roleRows = await db.sql`select role from member_roles where member_id = ${target.id}`;
    return new Response(
      JSON.stringify({ ok: true, member: shapeMember({ ...target, roles: roleRows.map((r: any) => r.role) }) }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/admin/roles",
};
