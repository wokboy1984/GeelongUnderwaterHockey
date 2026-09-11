// Returns the logged-in member's real profile and roles. The frontend
// calls this right after login so nav and routing can be role-aware —
// roles always come from here (the database), never from anything the
// client stores or sends.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, unauthorized } from "./_shared/roles.mts";

export default async (req: Request, context: Context) => {
  const user = context.clientContext?.user;
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const member = await ensureMember(db, user);
    return new Response(JSON.stringify({ ok: true, member }), {
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
  path: "/api/me",
};
