// Shared role/permission/audit helpers for the real (live) backend.
// A leading underscore keeps this folder out of Netlify's function
// auto-registration — it's a shared module, not an endpoint.
//
// Design: one Member baseline (having a members row at all), with zero or
// more stackable operational roles on top. Permissions are centrally
// defined here and checked server-side on every privileged endpoint —
// never inferred from anything the client sends.

export const SUPER_ADMIN_EMAIL = "wokboy@gmail.com";

export const ROLES = ["game_coordinator", "community_moderator", "treasurer", "administrator"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// Central permission map. Some of these (e.g. manage_finances) have no
// backend behind them yet — the mapping exists now so the structure is
// ready when that feature gets built, without a future migration.
export const PERMISSIONS = {
  manage_others_attendance: ["game_coordinator", "administrator"],
  arrange_teams: ["game_coordinator", "administrator"],
  record_scores: ["game_coordinator", "administrator"],
  moderate_community: ["community_moderator", "administrator"],
  publish_news: ["community_moderator", "administrator"],
  manage_finances: ["treasurer", "administrator"],
  assign_roles: ["administrator"],
  manage_platform_settings: ["administrator"],
} as const satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roles: string[], permission: Permission): boolean {
  const allowed: readonly string[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}

export function hasRole(roles: string[], role: Role): boolean {
  return roles.includes(role);
}

export function firstNameFrom(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(" ")[0];
  return email.split("@")[0];
}
export function lastNameFrom(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

export type Member = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number | null;
  roles: Role[];
};

// Upserts the member row for whoever just authenticated, bootstraps the
// super admin's Administrator role on first sight, and returns their
// current profile + real roles (from member_roles, never from anything
// client-supplied).
export async function ensureMember(db: any, user: any): Promise<Member> {
  const memberId: string = user.sub;
  const email: string = user.email;
  const fullName: string | undefined = user.user_metadata?.full_name;

  const [row] = await db.sql`
    insert into members (id, email, first_name, last_name)
    values (${memberId}, ${email}, ${firstNameFrom(fullName, email)}, ${lastNameFrom(fullName)})
    on conflict (id) do update set email = excluded.email
    returning id, email, first_name, last_name, age
  `;

  if (email === SUPER_ADMIN_EMAIL) {
    await db.sql`
      insert into member_roles (member_id, role, granted_by, note)
      values (${memberId}, 'administrator', 'system', 'Super admin bootstrap')
      on conflict (member_id, role) do nothing
    `;
  }

  const roleRows = await db.sql`select role from member_roles where member_id = ${memberId}`;
  const roles = roleRows.map((r: any) => r.role).filter(isRole);

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age,
    roles,
  };
}

export async function logAudit(
  db: any,
  entry: {
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    previousValue?: unknown;
    newValue?: unknown;
    note?: string | null;
  }
) {
  await db.sql`
    insert into audit_log (actor_id, actor_email, action, resource_type, resource_id, previous_value, new_value, note)
    values (
      ${entry.actorId},
      ${entry.actorEmail},
      ${entry.action},
      ${entry.resourceType},
      ${entry.resourceId},
      ${entry.previousValue === undefined ? null : JSON.stringify(entry.previousValue)},
      ${entry.newValue === undefined ? null : JSON.stringify(entry.newValue)},
      ${entry.note ?? null}
    )
  `;
}

export function unauthorized(message = "Not logged in") {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function forbidden(message = "Not allowed") {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
