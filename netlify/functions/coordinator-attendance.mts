// Game Coordinator attendance tools: see who's confirmed for this
// Wednesday, add or cancel a real member's attendance on their behalf
// (e.g. someone calls in sick, or asks to be added at the pool), or add a
// walk-in player who has never logged in by name alone.
//
// GET  /api/coordinator/attendance -> { ok, sessionDate, players: [...], declined: [...], noReply }
// POST /api/coordinator/attendance { memberEmail, in } -> same shape
// POST /api/coordinator/attendance { guestName } -> adds a name-only walk-in
//   player (no account, no email) as confirmed for this session. Gives them
//   a real `members` row with a synthetic, unguessable placeholder email so
//   no schema change is needed and they behave like any other player for
//   Teams/Timetable — they just never log in.
//
// Requires the caller to hold 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureFamilyColumns, ensureMember, ensureNicknameColumn, getVerifiedUser, hasPermission, logAudit, shortName, unauthorized, forbidden } from "./_shared/roles.mts";
import { defaultRollDateISO, requestedSessionDate } from "./_shared/attendance.mts";

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || fullName.trim(), lastName: parts.slice(1).join(" ") };
}

async function playerList(db: any, sessionId: number) {
  const rows = await db.sql`
    select m.id, m.email, m.nickname, m.first_name, m.last_name, m.is_new, m.grade,
           nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') as parent_name
    from bookings b
    join members m on m.id = b.member_id
    left join members p on p.id = m.parent_id
    where b.session_id = ${sessionId} and b.status = 'in'
    order by b.created_at asc
  `;
  return rows.map((r: any) => ({ id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, displayName: shortName(r.nickname, r.first_name, r.last_name), isNew: r.is_new, grade: r.grade, parentName: r.parent_name || null }));
}

// Who said no (20 Oct 2026). Members can now decline explicitly, which is
// different information from never having answered — it's the difference
// between chasing two people and chasing twenty. Only the declines are
// listed; "no reply" is everyone else and is reported as a count, since a
// coordinator doesn't need a roll of the whole club to read it.
async function declinedList(db: any, sessionId: number) {
  const rows = await db.sql`
    select m.id, m.nickname, m.first_name, m.last_name
    from bookings b
    join members m on m.id = b.member_id
    where b.session_id = ${sessionId} and b.status = 'out'
    order by b.created_at asc
  `;
  return rows.map((r: any) => ({ id: r.id, displayName: shortName(r.nickname, r.first_name, r.last_name) }));
}

// Members who have a login and haven't answered either way this week.
async function noReplyCount(db: any, sessionId: number) {
  const [row] = await db.sql`
    select count(*)::int as n
    from members m
    where m.parent_id is null
      and m.dependant_removed_at is null
      and not exists (select 1 from bookings b where b.session_id = ${sessionId} and b.member_id = m.id)
  `;
  return row ? row.n : 0;
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  await ensureNicknameColumn(db);
  await ensureFamilyColumns(db);
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "manage_others_attendance")) {
    return forbidden("Only Game Coordinators and Administrators can manage attendance");
  }

  try {
    // Name-search typeahead for "add an existing member" — separate from
    // the rest of this endpoint (no session needed), so it can return fast
    // as the coordinator types. Walk-ins with a synthetic *@no-login.guwh
    // email are excluded — they're added by name via guestName instead.
    const q = new URL(req.url).searchParams.get("q");
    if (req.method === "GET" && q !== null) {
      const query = q.trim();
      if (query.length < 2) return new Response(JSON.stringify({ ok: true, matches: [] }), { headers: { "content-type": "application/json" } });
      const rows = await db.sql`
        select id, email, nickname, first_name, last_name
        from members
        where email not like '%@no-login.guwh'
          and (first_name ilike ${"%" + query + "%"} or last_name ilike ${"%" + query + "%"} or (first_name || ' ' || last_name) ilike ${"%" + query + "%"})
        order by first_name, last_name
        limit 8
      `;
      return new Response(
        JSON.stringify({ ok: true, matches: rows.map((r: any) => ({ id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, displayName: shortName(r.nickname, r.first_name, r.last_name) })) }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // Which Wednesday (12 Oct 2026): ?date= or body.sessionDate, so the
    // Attendance page can show and fix any week's confirmed list and roll.
    // Default matches coordinator-checkin.mts (defaultRollDateISO).
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const asked = req.method === "POST" ? body.sessionDate : new URL(req.url).searchParams.get("date");
    const sessionDate = asked ? requestedSessionDate(asked) : defaultRollDateISO();
    const [session] = await db.sql`
      insert into sessions (session_date)
      values (${sessionDate})
      on conflict (session_date) do update set session_date = excluded.session_date
      returning id
    `;
    const sessionId = session.id;

    if (req.method === "POST") {
      const guestName = String(body.guestName || "").trim();

      if (guestName) {
        const { firstName, lastName } = splitName(guestName);
        const guestId = `guest_${crypto.randomUUID()}`;
        const guestEmail = `${guestId}@no-login.guwh`;
        const [guest] = await db.sql`
          insert into members (id, email, first_name, last_name, is_new)
          values (${guestId}, ${guestEmail}, ${firstName}, ${lastName}, false)
          returning id, email
        `;
        await db.sql`
          insert into bookings (session_id, member_id, status)
          values (${sessionId}, ${guest.id}, 'in')
          on conflict (session_id, member_id) do update set status = excluded.status
        `;
        await logAudit(db, {
          actorId: caller.id,
          actorEmail: caller.email,
          action: "guest_player_added",
          resourceType: "booking",
          resourceId: guest.id,
          newValue: { sessionDate, name: guestName },
          note: `${caller.email} added walk-in player "${guestName}" for ${sessionDate}`,
        });
        return new Response(JSON.stringify({ ok: true, sessionDate, players: await playerList(db, sessionId), declined: await declinedList(db, sessionId), noReply: await noReplyCount(db, sessionId) }), {
          headers: { "content-type": "application/json" },
        });
      }

      const memberEmail = String(body.memberEmail || "").trim();
      const [target] = await db.sql`select id, email from members where email = ${memberEmail}`;
      if (!target) {
        return new Response(
          JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      // Grade is set on the Administrator's member page now, not here —
      // this endpoint only ever changes attendance.
      const wantsIn = !!body.in;
      await db.sql`
        insert into bookings (session_id, member_id, status)
        values (${sessionId}, ${target.id}, ${wantsIn ? "in" : "out"})
        on conflict (session_id, member_id) do update set status = excluded.status
      `;
      await logAudit(db, {
        actorId: caller.id,
        actorEmail: caller.email,
        action: "attendance_changed_by_coordinator",
        resourceType: "booking",
        resourceId: target.id,
        newValue: { sessionDate, in: wantsIn },
        note: `${caller.email} set ${target.email} to ${wantsIn ? "in" : "out"} for ${sessionDate}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, sessionDate, players: await playerList(db, sessionId), declined: await declinedList(db, sessionId), noReply: await noReplyCount(db, sessionId) }), {
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
  path: "/api/coordinator/attendance",
};
