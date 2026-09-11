// Read-only "This Week's Game" for any logged-in member — shows the
// published team assignments, or nothing if the Game Coordinator hasn't
// published yet (mirrors the concept's "not yet finalised" behaviour).
// No permission beyond being a registered member is needed to view this.
//
// GET /api/game-board -> { ok, sessionDate, published, assignments? }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, unauthorized } from "./_shared/roles.mts";

function nextWednesdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  let add = (3 - day + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, isNew: r.is_new };
}

export default async (req: Request, context: Context) => {
  const user = context.clientContext?.user;
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    await ensureMember(db, user); // any registered member can view

    const sessionDate = nextWednesdayISO();
    const [session] = await db.sql`select id, published from sessions where session_date = ${sessionDate}`;

    if (!session || !session.published) {
      return new Response(JSON.stringify({ ok: true, sessionDate, published: false }), {
        headers: { "content-type": "application/json" },
      });
    }

    const rows = await db.sql`
      select m.id, m.first_name, m.last_name, m.is_new, ta.pool, ta.cap_colour
      from team_assignments ta join members m on m.id = ta.member_id
      where ta.session_id = ${session.id}
    `;
    const assignments: Record<string, Record<string, any[]>> = {
      "Pool A": { White: [], Black: [] },
      "Pool B": { White: [], Black: [] },
    };
    rows.forEach((r: any) => {
      if (assignments[r.pool] && assignments[r.pool][r.cap_colour]) assignments[r.pool][r.cap_colour].push(shapePlayer(r));
    });

    return new Response(JSON.stringify({ ok: true, sessionDate, published: true, assignments }), {
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
  path: "/api/game-board",
};
