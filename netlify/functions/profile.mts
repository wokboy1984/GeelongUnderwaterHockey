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

// The DB driver can hand back date_of_birth as either a plain "YYYY-MM-DD"
// string or a native Date object depending on how it's stored — and a raw
// Date serializes via JSON.stringify to a full ISO timestamp
// ("2001-05-04T00:00:00.000Z"), which an <input type="date"> silently
// refuses to display. Always normalize to a bare date string here so the
// profile form actually shows a DOB that's already on file.
function dobToInputString(dob: string | Date | null | undefined): string | null {
  if (!dob) return null;
  if (typeof dob === "string") return dob.length > 10 ? dob.slice(0, 10) : dob;
  return dob.toISOString().slice(0, 10);
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
    dateOfBirth: dobToInputString(row.date_of_birth),
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

      // Name, date of birth and an emergency contact are all safety- or
      // eligibility-critical (DOB gates the adults-only Members Forum;
      // emergency contact is needed poolside) — the form now requires them,
      // so the API does too, rather than trusting the client alone.
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const emergencyName = String(body.emergencyName || "").trim();
      const emergencyPhone = String(body.emergencyPhone || "").trim();
      const phone = String(body.phone || "").trim() || null;

      const missing: string[] = [];
      if (!firstName) missing.push("first name");
      if (!body.dateOfBirth) missing.push("date of birth");
      if (!emergencyName) missing.push("emergency contact name");
      if (!emergencyPhone) missing.push("emergency contact phone");
      if (missing.length) {
        return new Response(JSON.stringify({ ok: false, error: "Please fill in: " + missing.join(", ") }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const d = new Date(String(body.dateOfBirth) + "T00:00:00");
      if (Number.isNaN(d.getTime()) || d > new Date()) {
        return new Response(JSON.stringify({ ok: false, error: "That date of birth doesn't look right" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const dateOfBirth = String(body.dateOfBirth);

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
          first_name = ${firstName},
          last_name = ${lastName},
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
