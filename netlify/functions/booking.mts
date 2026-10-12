// Real attendance/booking endpoint — the first feature wired to the live
// backend (Netlify Identity + Netlify DB) instead of the concept's
// localStorage demo data.
//
// GET  /api/booking  -> { sessionDate, inSession, confirmedCount, confirmed[], cutoffAt, bookingClosed }
// POST /api/booking  { in: boolean } -> same shape
//
// confirmed[] (2 Oct 2026): who's coming, for the Dashboard's Who's Coming
// list - id, display name (nickname, else real name), photo version. Only
// ever returned to a logged-in member. cutoffAt/bookingClosed: see
// bookingCutoffFor() in _shared/attendance.mts.
//
// Both require a logged-in Netlify Identity user (JWT in the Authorization
// header — the widget's user.jwt() handles this on the frontend).

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureNicknameColumn, getVerifiedUser, memberDisplayName } from "./_shared/roles.mts";
import { bookingCutoffFor, nextSessionDateISO } from "./_shared/attendance.mts";

function firstNameFrom(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(" ")[0];
  return email.split("@")[0];
}
function lastNameFrom(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

// Online waiver switched OFF (12 Oct 2026, Cheongy): the waiver is signed
// in person at the pool for now, so booking no longer checks
// waiver_accepted_at. Set to true (together with ONLINE_WAIVER_REQUIRED in
// js/app.js) to bring the online waiver back.
const ONLINE_WAIVER_REQUIRED = false;

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
    const sessionDate = nextSessionDateISO();
    const cutoffAt = bookingCutoffFor(sessionDate);
    const bookingClosed = Date.now() >= cutoffAt.getTime();
    await ensureNicknameColumn(db);

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

      // The client route already gates the whole portal behind the waiver
      // (see app.js's WAIVER_EXEMPT_PATHS check), but this is the one
      // self-service write a brand-new member could otherwise reach
      // directly — re-checked here server-side rather than trusted from
      // the client. Cancelling ("out") is always allowed regardless.
      // Past the cut-off: no new self-service bookings. Cancelling still
      // works, and a Game Coordinator can still add someone on the day.
      if (wantsIn && bookingClosed) {
        const [current] = await db.sql`select status from bookings where session_id = ${sessionId} and member_id = ${memberId}`;
        if (!current || current.status !== "in") {
          return new Response(JSON.stringify({ ok: false, error: "Bookings for this Wednesday have closed. Message the Game Coordinator if you can still make it." }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
      }

      if (wantsIn && ONLINE_WAIVER_REQUIRED) {
        const [waiver] = await db.sql`select waiver_accepted_at from members where id = ${memberId}`;
        if (!waiver || !waiver.waiver_accepted_at) {
          return new Response(JSON.stringify({ ok: false, error: "Please sign the club waiver before booking in — it's on your Dashboard." }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
      }

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
    const confirmedRows = await db.sql`
      select m.id, m.nickname, m.first_name, m.last_name, m.photo_version
      from bookings b join members m on m.id = b.member_id
      where b.session_id = ${sessionId} and b.status = 'in'
      order by b.created_at asc
    `;
    const confirmed = confirmedRows.map((r: any) => ({
      id: r.id,
      name: memberDisplayName(r),
      photoVersion: r.photo_version || 0,
    }));
    const count = confirmed.length;

    return new Response(
      JSON.stringify({
        ok: true,
        sessionDate,
        inSession: mine ? mine.status === "in" : false,
        confirmedCount: count,
        confirmed,
        cutoffAt: cutoffAt.toISOString(),
        bookingClosed,
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
