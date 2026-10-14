// "My kids" - a parent's children, kept under the parent's own profile.
// Each child is a real `members` row (so teams, the roll, games played and
// goals all just work) with a synthetic *@no-login.guwh email and
// parent_id pointing at the parent. They never log in. Booking them in
// happens in /api/booking (dependantId); game fees bill to the parent
// (see finance.mts).
//
// GET  /api/family                       -> { ok, kids: [...] }
// POST /api/family { action: "add", firstName, lastName?, dateOfBirth, position? }
// POST /api/family { action: "update", id, firstName, lastName, dateOfBirth, position }
// POST /api/family { action: "remove", id }   (hides the child, keeps their history)

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ageFromDOB, ensureFamilyColumns, ensureMember, getVerifiedUser, isPosition, logAudit, unauthorized } from "./_shared/roles.mts";
import { nextSessionDateISO } from "./_shared/attendance.mts";

const MAX_KIDS = 8;
const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function dobString(dob: string | Date | null | undefined): string | null {
  if (!dob) return null;
  if (typeof dob === "string") return dob.length > 10 ? dob.slice(0, 10) : dob;
  return dob.toISOString().slice(0, 10);
}

export async function listKids(db: any, parentId: string) {
  const rows = await db.sql`
    select m.id, m.first_name, m.last_name, m.date_of_birth, m.position,
      (select count(*)::int from bookings b join sessions s on s.id = b.session_id
        where b.member_id = m.id and b.status = 'in' and s.session_date < current_date) as games,
      (select coalesce(sum(gg.goals), 0)::int from game_goals gg where gg.member_id = m.id) as career_goals,
      (select coalesce(sum(gg.goals), 0)::int
        from game_goals gg
        join timetable_pool_games tpg on tpg.id = gg.pool_game_id
        join timetable_rows tr on tr.id = tpg.row_id
        join sessions s2 on s2.id = tr.session_id
        where gg.member_id = m.id and extract(year from s2.session_date) = extract(year from current_date)) as season_goals
    from members m
    where m.parent_id = ${parentId} and m.dependant_removed_at is null
    order by m.created_at asc, m.id
  `;
  return rows.map((r: any) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    dateOfBirth: dobString(r.date_of_birth),
    age: ageFromDOB(r.date_of_birth),
    position: r.position || "Unknown",
    gamesPlayed: r.games,
    careerGoals: r.career_goals,
    seasonGoals: r.season_goals,
  }));
}

function cleanFields(body: any): { error?: string; firstName?: string; lastName?: string; dateOfBirth?: string; position?: string } {
  const firstName = String(body.firstName || "").trim().slice(0, 60);
  const lastName = String(body.lastName || "").trim().slice(0, 60);
  if (!firstName) return { error: "Please enter your child's first name" };
  const dob = String(body.dateOfBirth || "");
  const d = new Date(dob + "T00:00:00");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(d.getTime()) || d > new Date()) return { error: "That date of birth doesn't look right" };
  const age = ageFromDOB(dob);
  if (age === null || age >= 18) return { error: "My kids is for children under 18. Anyone 18 or over needs their own account." };
  const rawPosition = String(body.position || "").trim();
  if (rawPosition && !isPosition(rawPosition)) return { error: "Not a valid position" };
  return { firstName, lastName, dateOfBirth: dob, position: rawPosition || "Unknown" };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();
  try {
    const db = getDatabase();
    await ensureFamilyColumns(db);
    const caller = await ensureMember(db, user);

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");

      if (action === "add") {
        const f = cleanFields(body);
        if (f.error) return json({ ok: false, error: f.error }, 400);
        const [{ n }] = await db.sql`select count(*)::int as n from members where parent_id = ${caller.id} and dependant_removed_at is null`;
        if (n >= MAX_KIDS) return json({ ok: false, error: "That's the most children we can keep on one profile. Message the Game Coordinator." }, 400);
        const [parent] = await db.sql`select last_name, emergency_name, emergency_phone, phone from members where id = ${caller.id}`;
        const kidId = `kid_${crypto.randomUUID()}`;
        await db.sql`
          insert into members (id, email, first_name, last_name, date_of_birth, position, grade, emergency_name, emergency_phone, phone, is_new, parent_id)
          values (${kidId}, ${kidId + "@no-login.guwh"}, ${f.firstName}, ${f.lastName || parent.last_name || ""}, ${f.dateOfBirth}, ${f.position}, 'Junior',
                  ${parent.emergency_name}, ${parent.emergency_phone}, ${parent.phone}, false, ${caller.id})
        `;
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "child_added", resourceType: "member", resourceId: kidId, newValue: { firstName: f.firstName }, note: `${caller.email} added child "${f.firstName}"` });
      } else if (action === "update" || action === "remove") {
        const id = String(body.id || "");
        const [kid] = await db.sql`select id, first_name from members where id = ${id} and parent_id = ${caller.id} and dependant_removed_at is null`;
        if (!kid) return json({ ok: false, error: "Child not found" }, 404);
        if (action === "update") {
          const f = cleanFields(body);
          if (f.error) return json({ ok: false, error: f.error }, 400);
          await db.sql`
            update members set first_name = ${f.firstName}, last_name = ${f.lastName}, date_of_birth = ${f.dateOfBirth}, position = ${f.position}
            where id = ${id}
          `;
        } else {
          // Hide, don't delete: their past games and goals stay on record.
          // Also takes them off the upcoming Wednesday.
          await db.sql`update members set dependant_removed_at = now() where id = ${id}`;
          await db.sql`
            update bookings set status = 'out'
            where member_id = ${id} and session_id in (select id from sessions where session_date = ${nextSessionDateISO()}::date)
          `;
          await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "child_removed", resourceType: "member", resourceId: id, note: `${caller.email} removed child "${kid.first_name}"` });
        }
      } else {
        return json({ ok: false, error: "Unknown action" }, 400);
      }
    }

    return json({ ok: true, kids: await listKids(db, caller.id) });
  } catch (err) {
    console.error("Family request failed", err);
    return json({ ok: false, error: "Couldn't load or save your children. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/family",
};
