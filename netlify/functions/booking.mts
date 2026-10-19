// Real attendance/booking endpoint — the first feature wired to the live
// backend (Netlify Identity + Netlify DB) instead of the concept's
// localStorage demo data.
//
// GET  /api/booking  -> { sessionDate, inSession, confirmedCount, confirmed[], cutoffAt, bookingClosed }
// POST /api/booking  { in: boolean } -> same shape
//
// POST { in, dependantId? } (14 Oct 2026): with dependantId, books/cancels
// one of the caller's own children instead of the caller. Response also
// carries family[]: the caller's children with inSession for this Wednesday.
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
import { ensureFamilyColumns, ensureNicknameColumn, getVerifiedUser, memberDisplayName } from "./_shared/roles.mts";
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
    await ensureFamilyColumns(db);

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

      // Booking one of the caller's own children (14 Oct 2026, "My kids").
      // Same cut-off rules as booking yourself; the child must belong to
      // the caller and not be removed.
      let targetId = memberId;
      if (body.dependantId) {
        const [kid] = await db.sql`
          select id from members where id = ${String(body.dependantId)} and parent_id = ${memberId} and dependant_removed_at is null
        `;
        if (!kid) {
          return new Response(JSON.stringify({ ok: false, error: "Child not found on your profile." }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        targetId = kid.id;
      }

      // Past the cut-off the roll is locked in both directions (20 Oct
      // 2026): no self-service booking in and no self-service cancelling,
      // so the numbers the Game Coordinator builds teams from at 7:30pm
      // can't move underneath them. Only a Game Coordinator can change
      // anyone after that, via coordinator-attendance.mts.
      //
      // Re-asserting a status you already hold is still allowed, so a
      // double-tap or a stale tab can't produce a confusing error.
      if (bookingClosed) {
        const [current] = await db.sql`select status from bookings where session_id = ${sessionId} and member_id = ${targetId}`;
        const currentStatus = current ? current.status : null;
        if (currentStatus !== (wantsIn ? "in" : "out")) {
          return new Response(JSON.stringify({ ok: false, error: "The roll closed at 7:30pm. Message the Game Coordinator if you need to be added or taken off." }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // The client route already gates the whole portal behind the waiver
      // (see app.js's WAIVER_EXEMPT_PATHS check), but this is the one
      // self-service write a brand-new member could otherwise reach
      // directly — re-checked here server-side rather than trusted from
      // the client. Cancelling ("out") never needs a waiver.
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
        values (${sessionId}, ${targetId}, ${wantsIn ? "in" : "out"})
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

    // The caller's children and whether each is booked in for this session.
    const familyRows = await db.sql`
      select m.id, m.first_name, m.last_name,
        coalesce((select b.status = 'in' from bookings b where b.session_id = ${sessionId} and b.member_id = m.id), false) as booked
      from members m
      where m.parent_id = ${memberId} and m.dependant_removed_at is null
      order by m.created_at asc, m.id
    `;
    const family = familyRows.map((r: any) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(" ").trim(),
      firstName: r.first_name,
      inSession: !!r.booked,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        sessionDate,
        inSession: mine ? mine.status === "in" : false,
        confirmedCount: count,
        confirmed,
        family,
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
