// Family sign-up (5 Nov 2026, Liam: a newcomer arriving with two children
// meant adding all three separately, and the kids have no email anyway).
//
// Children are added under the parent the same way "My kids" on Profile
// adds them (see family.mts): no login of their own, a placeholder
// @no-login.guwh address, billed to the parent at the child rate. Because
// they're new to the club they get the first three sessions free
// (trial_free). A child already on that parent's profile with the same
// first name is reused rather than added twice.
//
// Used by the Attendance page's "Add a player or family" and its
// "Add to tonight" button on a free-trial signup.

import { ageFromDOB, ensureFamilyColumns, ensureUsualKindColumn } from "./roles.mts";
import { isAttendanceKind, type AttendanceKind } from "./attendance.mts";
import { ensureGameMvp, isGender } from "./game-mvp.mts";

export const MAX_FAMILY_CHILDREN = 8;

export type ChildIn = { firstName: string; lastName: string; dateOfBirth: string | null; kind: AttendanceKind; gender: "male" | "female" | null };

// What the person arriving is here for. 'none' = only bringing the kids:
// they get an account (the kids are billed to it) but aren't booked in.
export type AdultKind = AttendanceKind | "none";
export function toAdultKind(value: unknown): AdultKind {
  return value === "none" ? "none" : isAttendanceKind(value) ? value : "player";
}

// Checks the children sent from a form. Last name and date of birth are
// optional (date of birth isn't always known at the pool); with none, the
// child counts as a junior.
export function cleanChildren(raw: unknown): { children: ChildIn[]; error?: string } {
  if (raw == null) return { children: [] };
  if (!Array.isArray(raw)) return { children: [], error: "Couldn't read the children" };
  const rows = raw.filter((c: any) => c && String(c.firstName || "").trim());
  if (rows.length > MAX_FAMILY_CHILDREN) return { children: [], error: `That's more than ${MAX_FAMILY_CHILDREN} children - add the rest separately.` };
  const children: ChildIn[] = [];
  for (const c of rows as any[]) {
    const firstName = String(c.firstName).trim().slice(0, 60);
    const lastName = String(c.lastName || "").trim().slice(0, 60);
    let dateOfBirth: string | null = String(c.dateOfBirth || "").trim() || null;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth + "T00:00:00");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(d.getTime()) || d > new Date()) {
        return { children: [], error: `${firstName}'s date of birth doesn't look right` };
      }
      const age = ageFromDOB(dateOfBirth);
      if (age !== null && age >= 18) return { children: [], error: `${firstName} is 18 or over, so needs their own account rather than being added as a child.` };
    }
    children.push({ firstName, lastName, dateOfBirth, kind: isAttendanceKind(c.kind) ? c.kind : "player", gender: isGender(c.gender) ? c.gender : null });
  }
  return { children };
}

// Adds (or finds) each child under parentId and, with a sessionId, books
// them in. Returns the children's member ids.
export async function addChildren(db: any, parentId: string, children: ChildIn[], sessionId: number | null): Promise<string[]> {
  if (!children.length) return [];
  await ensureFamilyColumns(db);
  await ensureUsualKindColumn(db);
  await ensureGameMvp(db);
  const [parent] = await db.sql`select last_name, emergency_name, emergency_phone, phone from members where id = ${parentId}`;
  const ids: string[] = [];
  for (const c of children) {
    const [existing] = await db.sql`
      select id from members
      where parent_id = ${parentId} and dependant_removed_at is null and lower(first_name) = lower(${c.firstName})
      limit 1`;
    let id: string;
    if (existing) {
      id = existing.id;
      if (c.dateOfBirth) await db.sql`update members set date_of_birth = ${c.dateOfBirth}::date where id = ${id} and date_of_birth is null`;
    } else {
      id = `kid_${crypto.randomUUID()}`;
      await db.sql`
        insert into members (id, email, first_name, last_name, date_of_birth, position, grade, emergency_name, emergency_phone, phone, is_new, parent_id, trial_free)
        values (${id}, ${id + "@no-login.guwh"}, ${c.firstName}, ${c.lastName || (parent && parent.last_name) || ""}, ${c.dateOfBirth}::date, 'Unknown', 'Junior',
                ${parent ? parent.emergency_name : null}, ${parent ? parent.emergency_phone : null}, ${parent ? parent.phone : null}, true, ${parentId}, true)
      `;
    }
    if (c.gender) await db.sql`update members set gender = ${c.gender} where id = ${id}`;
    // How they usually come, same as choosing it in Teams.
    await db.sql`update members set usual_kind = ${c.kind === "player" ? null : c.kind} where id = ${id}`;
    if (sessionId != null) {
      await db.sql`
        insert into bookings (session_id, member_id, status, kind)
        values (${sessionId}, ${id}, 'in', ${c.kind})
        on conflict (session_id, member_id) do update set status = 'in', kind = excluded.kind
      `;
    }
    ids.push(id);
  }
  return ids;
}
