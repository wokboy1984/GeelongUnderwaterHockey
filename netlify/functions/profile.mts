// Real Profile — a member's own details. Games played is never typed in;
// it's counted from real attendance history (confirmed bookings for
// sessions that have already happened), so it can't drift out of sync.
//
// GET  /api/profile -> { ok, member }
// POST /api/profile { dateOfBirth, emergencyName, emergencyPhone, position, grade, phone } -> { ok, member }
//
// Email is deliberately NOT editable here — it's the Netlify Identity login
// itself, changed via the widget's own update() call from the frontend
// (which Netlify emails a confirmation link for), not through this table.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ageFromDOB, getVerifiedUser, isGrade, isPosition, unauthorized } from "./_shared/roles.mts";

function firstNameFrom(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(" ")[0];
  return email.split("@")[0];
}
function lastNameFrom(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

async function shapeProfile(db: any, memberId: string) {
  const [row] = await db.sql`
    select id, email, first_name, last_name, date_of_birth, emergency_name, emergency_phone, position, grade, phone, photo_version, is_new
    from members where id = ${memberId}
  `;
  const [{ count }] = await db.sql`
    select count(*)::int as count
    from bookings b join sessions s on s.id = b.session_id
    where b.member_id = ${memberId} and b.status = 'in' and s.session_date < current_date
  `;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    age: ageFromDOB(row.date_of_birth),
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    phone: row.phone,
    position: row.position || "Unknown",
    grade: row.grade,
    photoVersion: row.photo_version || 0,
    gamesPlayed: count,
    isNew: row.is_new,
  };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const memberId: string = user.sub;
    const email: string = user.email;
    const fullName: string | undefined = user.user_metadata?.full_name;

    await db.sql`
      insert into members (id, email, first_name, last_name)
      values (${memberId}, ${email}, ${firstNameFrom(fullName, email)}, ${lastNameFrom(fullName)})
      on conflict (id) do update set email = excluded.email
    `;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      let dateOfBirth: string | null = null;
      if (body.dateOfBirth) {
        const d = new Date(String(body.dateOfBirth) + "T00:00:00");
        if (Number.isNaN(d.getTime()) || d > new Date()) {
          return new Response(JSON.stringify({ ok: false, error: "That date of birth doesn't look right" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        dateOfBirth = String(body.dateOfBirth);
      }

      const emergencyName = String(body.emergencyName || "").trim() || null;
      const emergencyPhone = String(body.emergencyPhone || "").trim() || null;
      const phone = String(body.phone || "").trim() || null;

      const rawPosition = String(body.position || "").trim();
      if (rawPosition && !isPosition(rawPosition)) {
        return new Response(JSON.stringify({ ok: false, error: "Not a valid position" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const position = rawPosition || "Unknown";

      const rawGrade = String(body.grade || "").trim();
      if (rawGrade && !isGrade(rawGrade)) {
        return new Response(JSON.stringify({ ok: false, error: "Not a valid grade" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const grade = rawGrade || null;

      await db.sql`
        update members set
          date_of_birth = ${dateOfBirth},
          emergency_name = ${emergencyName},
          emergency_phone = ${emergencyPhone},
          phone = ${phone},
          position = ${position},
          grade = ${grade}
        where id = ${memberId}
      `;
    }

    return new Response(JSON.stringify({ ok: true, member: await shapeProfile(db, memberId) }), {
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
  path: "/api/profile",
};
