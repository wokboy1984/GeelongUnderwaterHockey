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
  mark_actual_attendance: ["game_coordinator", "treasurer", "community_moderator", "administrator"],
  manage_others_attendance: ["game_coordinator", "administrator"],
  arrange_teams: ["game_coordinator", "administrator"],
  manage_grades: ["game_coordinator", "administrator"],
  record_scores: ["game_coordinator", "administrator"],
  moderate_community: ["community_moderator", "administrator"],
  // Attaching images to forum posts (20 Oct 2026). Deliberately wider than
  // moderate_community — "moderators and committee", i.e. anyone holding an
  // operational role — but not every member. Because uploads are limited to
  // people the club has already trusted with a role, images go live with no
  // approval queue; an ordinary member can't put a picture in front of the
  // under-18s who can read the forum.
  post_forum_media: ["game_coordinator", "community_moderator", "treasurer", "administrator"],
  publish_news: ["community_moderator", "administrator"],
  manage_finances: ["treasurer", "administrator"],
  assign_roles: ["administrator"],
  manage_platform_settings: ["administrator"],
} as const satisfies Record<string, Role[]>;

// Playing position and grade are fixed lists shared by the Profile page (self
// set) and Game Coordinators/Administrators (can override grade after
// seeing someone play).
export const POSITIONS = ["Forward", "Back", "Wing", "Full Back", "Centre", "Unknown"] as const;
export type Position = (typeof POSITIONS)[number];
export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

export const GRADES = ["A", "B", "Casual", "Junior"] as const;
export type Grade = (typeof GRADES)[number];
export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

// Age is always computed from date_of_birth, never stored — a typed-in
// number goes stale the moment a birthday passes. Returns null if no DOB
// is on file yet.
export function ageFromDOB(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob + (dob.length <= 10 ? "T00:00:00" : "")) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

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

// Nickname support (2 Oct 2026). The column is added by migration
// 20261002000001_nickname_trials, but migrations haven't always applied to
// production on this project, so every function that reads it calls this
// first. Cheap: runs once per warm function instance.
let nicknameColumnReady = false;
export async function ensureNicknameColumn(db: any): Promise<void> {
  if (nicknameColumnReady) return;
  await db.sql`alter table members add column if not exists nickname text`;
  nicknameColumnReady = true;
}

// Getting started checklist (12 Oct 2026). Columns added by migration
// 20261012000004_member_onboarding; ensured here too, same reason as above.
let onboardingColumnsReady = false;
export async function ensureOnboardingColumns(db: any): Promise<void> {
  if (onboardingColumnsReady) return;
  await db.sql`alter table members add column if not exists onboarding_seen text[] not null default '{}'`;
  await db.sql`alter table members add column if not exists onboarding_hidden_at timestamptz`;
  onboardingColumnsReady = true;
}
export const ONBOARDING_STEPS = ["guide", "board", "forum"];

// "My kids" (14 Oct 2026). Columns added by migration
// 20261014000001_family_members; ensured here too, same reason as above.
let familyColumnsReady = false;
export async function ensureFamilyColumns(db: any): Promise<void> {
  if (familyColumnsReady) return;
  await db.sql`alter table members add column if not exists parent_id text references members(id)`;
  await db.sql`alter table members add column if not exists dependant_removed_at timestamptz`;
  await db.sql`alter table members add column if not exists trial_free boolean not null default false`;
  familyColumnsReady = true;
}

// Attendance kinds (20 Oct 2026). Columns added by migration
// 20261020000002_attendance_kinds; ensured here for the same reason as the
// ones above — and with better evidence than most, since the waived-fees
// table earlier today was in fact created by its guard rather than by its
// migration. Without this, booking in would fail outright on a database
// the migration hadn't reached.
let attendanceKindsReady = false;
export async function ensureAttendanceKinds(db: any): Promise<void> {
  if (attendanceKindsReady) return;
  await db.sql`alter table bookings add column if not exists kind text not null default 'player'`;
  await db.sql`alter table session_attendance add column if not exists kind text not null default 'player'`;
  attendanceKindsReady = true;
}

// Forum image attachments (20 Oct 2026). The table comes from migration
// 20260912000011_forum, which predates this feature — it was designed then
// and only wired up now. Guarded here for the same reason as the columns
// above: migrations haven't always reached production on this project, and
// a missing table would fail the upload rather than degrade.
let forumAttachmentsReady = false;
export async function ensureForumAttachments(db: any): Promise<void> {
  if (forumAttachmentsReady) return;
  await db.sql`
    create table if not exists forum_attachments (
      id serial primary key,
      post_id integer references forum_posts(id) on delete cascade,
      kind text not null,
      blob_key text,
      url text,
      file_name text,
      content_type text,
      size_bytes integer,
      approved_at timestamptz,
      approved_by text references members(id) on delete set null,
      created_by text references members(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `;
  // post_id is nullable here on purpose: an image is uploaded from the
  // composer before the post it belongs to exists. The original migration
  // declared it not null, so relax it where that version already ran.
  await db.sql`alter table forum_attachments alter column post_id drop not null`;
  forumAttachmentsReady = true;
}

// Development teams (27 Oct 2026). Added by migration
// 20261027000001_development_teams; ensured here too, same reason as the
// columns above. A player may be in one development team and one main team
// on the same night, never two of the same kind.
let developmentTeamsReady = false;
export async function ensureDevelopmentTeams(db: any): Promise<void> {
  if (developmentTeamsReady) return;
  await db.sql`alter table game_teams add column if not exists is_development boolean not null default false`;
  await db.sql`alter table team_assignments add column if not exists is_development boolean not null default false`;
  await db.sql`alter table team_assignments drop constraint if exists team_assignments_session_member_unique`;
  await db.sql`create unique index if not exists team_assignments_session_member_kind on team_assignments (session_id, member_id, is_development)`;
  developmentTeamsReady = true;
}

// One-or-two-games timetable rows (12 Oct 2026). Column added by migration
// 20261012000001_timetable_game_count; ensured here too, same reason as
// the nickname column above.
let gameCountColumnReady = false;
export async function ensureGameCountColumn(db: any): Promise<void> {
  if (gameCountColumnReady) return;
  await db.sql`alter table timetable_rows add column if not exists game_count smallint not null default 2`;
  gameCountColumnReady = true;
}

// The name shown for a member anywhere on the site (16 Oct 2026, Cheongy):
// their nickname if they have one, otherwise first name + the first letter of
// their last name ("Sam T."). Full names only appear on the Administration
// member page. Admins can change a nickname there (e.g. an offensive one).
export function shortName(nickname: string | null | undefined, first: string | null | undefined, last: string | null | undefined): string {
  const nick = (nickname || "").trim();
  if (nick) return nick;
  const f = (first || "").trim();
  const initial = (last || "").trim().charAt(0).toUpperCase();
  if (!f) return "Member";
  return initial ? `${f} ${initial}.` : f;
}
export function memberDisplayName(row: { nickname?: string | null; first_name?: string | null; last_name?: string | null }): string {
  return shortName(row.nickname, row.first_name, row.last_name);
}

// The name shown on every staff page (27 Oct 2026, Liam): full name, with
// the nickname in brackets ("Sam Taylor (Tayls)"), so whoever is running
// things always knows who they're dealing with. Use it in endpoints only
// staff can call (Administration, Finance, Game Coordination, Attendance,
// forum moderation); anything an ordinary member sees uses shortName. The
// brackets are left off when the nickname is just the first or full name.
export function adminName(nickname: string | null | undefined, first: string | null | undefined, last: string | null | undefined): string {
  const full = [(first || "").trim(), (last || "").trim()].filter(Boolean).join(" ");
  const nick = (nickname || "").trim();
  if (!full) return nick || "Member";
  const same = (a: string) => a.toLowerCase() === nick.toLowerCase();
  return nick && !same(full) && !same((first || "").trim()) ? `${full} (${nick})` : full;
}

export type Member = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number | null;
  roles: Role[];
  waiverAccepted: boolean;
};

// Upserts the member row for whoever just authenticated, bootstraps the
// super admin's Administrator role on first sight, and returns their
// current profile + real roles (from member_roles, never from anything
// client-supplied).
export async function ensureMember(db: any, user: any): Promise<Member> {
  const memberId: string = user.sub;
  const email: string = user.email;
  const fullName: string | undefined = user.user_metadata?.full_name;

  // Find the member this login belongs to (21 Oct 2026).
  //
  // By id first, which is the ordinary case and also what keeps the
  // "change my email" feature working: the id is stable, the email isn't.
  //
  // Then by email, for a row that exists before the person has ever logged
  // in — a walk-in the coordinator added, or someone added by name and
  // email and then invited. members.email is unique, so without this the
  // insert below would collide the first time they signed in and lock them
  // out, with their bookings and attendance stranded on the older row.
  //
  // We adopt that row as-is rather than re-keying it to the Identity id:
  // 53 foreign keys reference members(id) and none are declared ON UPDATE
  // CASCADE, so changing it would be rejected outright. Everything
  // downstream uses the id this function returns, so an id that isn't the
  // Identity id is already normal here — every walk-in has one.
  let [row] = await db.sql`
    select id, email, first_name, last_name, date_of_birth, waiver_accepted_at
    from members where id = ${memberId}
  `;
  if (row) {
    if (row.email !== email) {
      await db.sql`update members set email = ${email} where id = ${memberId}`;
      row.email = email;
    }
  } else {
    [row] = await db.sql`
      select id, email, first_name, last_name, date_of_birth, waiver_accepted_at
      from members where email = ${email}
    `;
  }
  if (!row) {
    [row] = await db.sql`
      insert into members (id, email, first_name, last_name)
      values (${memberId}, ${email}, ${firstNameFrom(fullName, email)}, ${lastNameFrom(fullName)})
      on conflict (id) do update set email = excluded.email
      returning id, email, first_name, last_name, date_of_birth, waiver_accepted_at
    `;
  }

  // From here on, the member's OWN id — usually the Identity id, but the
  // adopted row's id when this login was matched by email instead.
  const resolvedId: string = row.id;

  if (email === SUPER_ADMIN_EMAIL) {
    await db.sql`
      insert into member_roles (member_id, role, granted_by, note)
      values (${resolvedId}, 'administrator', 'system', 'Super admin bootstrap')
      on conflict (member_id, role) do nothing
    `;
  }

  const roleRows = await db.sql`select role from member_roles where member_id = ${resolvedId}`;
  const roles = roleRows.map((r: any) => r.role).filter(isRole);

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    age: ageFromDOB(row.date_of_birth),
    roles,
    waiverAccepted: !!row.waiver_accepted_at,
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

// Verifies the caller's Netlify Identity JWT by asking Netlify's own
// Identity endpoint (GoTrue), rather than trusting context.clientContext.user
// — which is not reliably populated for functions declared with a custom
// config.path (every function in this project uses one). Returns the same
// shape (sub, email, user_metadata) the rest of this codebase already
// expects from context.clientContext.user, so callers don't need to change.
export async function getVerifiedUser(
  req: Request
): Promise<{ sub: string; email: string; user_metadata?: { full_name?: string } } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(origin + "/.netlify/identity/user", {
      headers: { authorization: authHeader },
    });
    if (!res.ok) return null;
    const gotrueUser: any = await res.json();
    if (!gotrueUser || !gotrueUser.id) return null;
    return {
      sub: gotrueUser.id,
      email: gotrueUser.email,
      user_metadata: gotrueUser.user_metadata,
    };
  } catch {
    return null;
  }
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
