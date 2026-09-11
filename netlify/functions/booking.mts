// Real attendance/booking endpoint — the first feature wired to the live
// backend (Netlify Identity + Netlify DB) instead of the concept's
// localStorage demo data.
//
// GET  /api/booking  -> { sessionDate, inSession, confirmedCount }
// POST /api/booking  { in: boolean } -> { sessionDate, inSession, confirmedCount }
//
// Both require a logged-in Netlify Identity user (JWT in the Authorization
// header — the widget's user.jwt() handles this on the frontend).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

function nextWednesdayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun ... 3 Wed ... 6 Sat
  let add = (3 - day + 7) % 7;
  if (add === 0) add = 7; // mirrors the concept's rule: on Wednesday itself, roll to next week
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function firstNameFrom(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(" ")[0];
  return email.split("@")[0];
}
function lastNameFrom(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

export default async (req: Request, context: Context) => {
  const user = context.clientContext?.user;
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
    const sessionDate = nextWednesdayISO();

    // Make sure this member and this week's session both exist.
    await db.sql`
      insert into members (id, email, first_name, last_name)
      values (${memberId}, ${email}, ${firstNameFrom(fullName, email)}, ${lastNameFrom(fullName)})
      on conflict (id) do nothing
    `;
    const [session] = await db.sql`
      insert into sessions (session_date)
      values (${sessionDate})
      on conflict (session_date) do update set session_date = excluded.session_date
      returning id
    `;
    const sessionId = session.id;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const wantsIn = !!body.in;
      await db.sql`
        insert into bookings (session_id, member_id, status)
        values (${sessionId}, ${memberId}, ${wantsIn ? "in" : "out"})
        on conflict (session_id, member_id)
        do update set status = excluded.status
      `;
    }

    const [mine] = await db.sql`
      select status from bookings where session_id = ${sessionId} and member_id = ${memberId}
    `;
    const [{ count }] = await db.sql`
      select count(*)::int as count from bookings where session_id = ${sessionId} and status = 'in'
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        sessionDate,
        inSession: mine ? mine.status === "in" : false,
        confirmedCount: count,
      }),
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
  path: "/api/booking",
};
