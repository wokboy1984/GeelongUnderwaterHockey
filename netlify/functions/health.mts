// Proof-of-life endpoint for the live build's backend foundation.
// Confirms the Function layer can reach the real Netlify DB (Postgres/Neon).
// Visit /api/health once deployed — real players/organisers never see this.
import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    const [{ now }] = await db.sql`select now() as now`;
    const [{ count }] = await db.sql`select count(*)::int as count from members`;
    return new Response(
      JSON.stringify({ ok: true, dbTime: now, members: count }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/health",
};
