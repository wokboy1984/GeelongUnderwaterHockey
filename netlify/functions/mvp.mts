// MVP nominations — after the night's games are done, whoever refereed a
// pool game in this session's timetable can nominate one confirmed player
// (never themselves) as tonight's MVP, with an optional note. One
// nomination per referee per session; nominating again just changes it.
//
// "Refereed this session" is computed fresh from timetable_pool_referees
// every call — never cached — so it always matches the real, current
// timetable (same principle as _shared/timetable.mts's eligibility checks).
//
// GET  /api/mvp[?date=YYYY-MM-DD] -> { ok, sessionDate, published, isReferee, nominees,
//                     myNomination, canViewResults, results? }
// POST /api/mvp { sessionDate?, nomineeId, note? } -> same shape as GET
//
// Week by week (2 Oct 2026): date/sessionDate picks which Wednesday (any
// past one, default the upcoming one) - so a referee can still nominate
// the morning after, when the "upcoming" Wednesday has already moved on.
//
// Nominating requires having refereed this session (checked server-side,
// not a stackable role — see _shared/roles.mts's note on Member baseline +
// stackable roles; this is neither, it's a per-night fact). Viewing the
// aggregated results requires 'arrange_teams' (game_coordinator or
// administrator) — the same audience that manages Teams/Timetable.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized } from "./_shared/roles.mts";
import { requestedSessionDate } from "./_shared/attendance.mts";

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name };
}

async function refereeIdsForSession(db: any, sessionId: number): Promise<Set<string>> {
  const rows = await db.sql`
    select distinct tpr.member_id
    from timetable_pool_referees tpr
    join timetable_pool_games tpg on tpg.id = tpr.pool_game_id
    join timetable_rows tr on tr.id = tpg.row_id
    where tr.session_id = ${sessionId} and tr.archived_at is null
  `;
  return new Set<string>(rows.map((r: any) => r.member_id));
}

async function confirmedPlayers(db: any, sessionId: number) {
  const rows = await db.sql`
    select m.id, m.first_name, m.last_name
    from bookings b join members m on m.id = b.member_id
    where b.session_id = ${sessionId} and b.status = 'in'
    order by b.created_at asc
  `;
  return rows.map(shapePlayer);
}

async function buildResponse(db: any, sessionId: number, sessionDate: string, caller: { id: string; roles: string[] }) {
  const [refereeIds, nominees, myRow] = await Promise.all([
    refereeIdsForSession(db, sessionId),
    confirmedPlayers(db, sessionId),
    db.sql`select nominee_id, note from mvp_nominations where session_id = ${sessionId} and nominator_id = ${caller.id}`,
  ]);

  const isReferee = refereeIds.has(caller.id);
  const canViewResults = hasPermission(caller.roles, "arrange_teams");

  const out: any = {
    ok: true,
    sessionDate,
    published: true,
    isReferee,
    canNominate: isReferee,
    nominees: nominees.filter((p: any) => p.id !== caller.id),
    myNomination: myRow[0] ? { nomineeId: myRow[0].nominee_id, note: myRow[0].note } : null,
    canViewResults,
  };

  if (canViewResults) {
    const detailRows = await db.sql`
      select mn.nominee_id, nm.first_name as nominee_first, nm.last_name as nominee_last,
             rm.first_name as ref_first, rm.last_name as ref_last, mn.note, mn.created_at
      from mvp_nominations mn
      join members nm on nm.id = mn.nominee_id
      join members rm on rm.id = mn.nominator_id
      where mn.session_id = ${sessionId}
      order by mn.created_at asc
    `;
    const byNominee: Record<string, { nomineeId: string; name: string; votes: number; notes: { by: string; note: string | null }[] }> = {};
    detailRows.forEach((r: any) => {
      if (!byNominee[r.nominee_id]) {
        byNominee[r.nominee_id] = { nomineeId: r.nominee_id, name: `${r.nominee_first} ${r.nominee_last}`, votes: 0, notes: [] };
      }
      byNominee[r.nominee_id].votes += 1;
      byNominee[r.nominee_id].notes.push({ by: `${r.ref_first} ${r.ref_last}`, note: r.note });
    });
    out.results = Object.values(byNominee).sort((a, b) => b.votes - a.votes);
  }

  return out;
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const caller = await ensureMember(db, user);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sessionDate = requestedSessionDate(req.method === "POST" ? body.sessionDate : new URL(req.url).searchParams.get("date"));
    const [session] = await db.sql`select id, published from sessions where session_date = ${sessionDate}`;

    if (!session || !session.published) {
      return new Response(JSON.stringify({ ok: true, sessionDate, published: false }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const nomineeId = String(body.nomineeId || "").trim();

      const refereeIds = await refereeIdsForSession(db, session.id);
      if (!refereeIds.has(caller.id)) {
        return new Response(JSON.stringify({ ok: false, error: "Only someone who refereed this session can nominate an MVP" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }

      if (!nomineeId || nomineeId === caller.id) {
        return new Response(JSON.stringify({ ok: false, error: "Pick a confirmed player other than yourself" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const nominees = await confirmedPlayers(db, session.id);
      const nominee = nominees.find((p: any) => p.id === nomineeId);
      if (!nominee) {
        return new Response(JSON.stringify({ ok: false, error: "That player isn't confirmed for this session" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const note = body.note ? String(body.note).trim().slice(0, 280) : null;

      await db.sql`
        insert into mvp_nominations (session_id, nominator_id, nominee_id, note)
        values (${session.id}, ${caller.id}, ${nomineeId}, ${note})
        on conflict (session_id, nominator_id) do update set nominee_id = excluded.nominee_id, note = excluded.note, updated_at = now()
      `;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "mvp_nominated",
        resourceType: "session", resourceId: String(session.id),
        newValue: { sessionDate, nomineeId, note },
        note: `${caller.email} nominated ${nominee.firstName} ${nominee.lastName} for MVP (${sessionDate})`,
      });
    }

    return new Response(JSON.stringify(await buildResponse(db, session.id, sessionDate, caller)), {
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
  path: "/api/mvp",
};
