// Digital club waiver — new members only (existing members were
// grandfathered as already-accepted by the migration that added this).
// Typed full name + a checkbox + a server timestamp is the signature
// (Cheongy's call, not a drawn signature) — mirrors the club's paper
// Player Registration form's liability/Model Rules declaration and its
// WWCC/VIT declaration.
//
// GET  /api/waiver -> { ok, accepted, acceptedAt, signedName, wwccStatus }
// POST /api/waiver { signedName, agreeWaiver, wwccStatus, signingAsGuardian, guardianName }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";

const WWCC_STATUSES = ["have", "will_apply"] as const;
type WwccStatus = (typeof WWCC_STATUSES)[number];
function isWwccStatus(v: string): v is WwccStatus {
  return (WWCC_STATUSES as readonly string[]).includes(v);
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  try {
    const db = getDatabase();
    const caller = await ensureMember(db, user);

    if (req.method === "POST" && !caller.waiverAccepted) {
      const body = await req.json().catch(() => ({}));
      const signedName = String(body.signedName || "").trim();
      const wwccStatus = String(body.wwccStatus || "").trim();
      const signingAsGuardian = !!body.signingAsGuardian;
      const guardianName = String(body.guardianName || "").trim();

      const missing: string[] = [];
      if (!signedName) missing.push("your full name as a signature");
      if (!body.agreeWaiver) missing.push("agreement to the waiver");
      if (!wwccStatus || !isWwccStatus(wwccStatus)) missing.push("a Working With Children Check status");
      if (signingAsGuardian && !guardianName) missing.push("the parent/guardian's name");
      if (missing.length) {
        return new Response(JSON.stringify({ ok: false, error: "Please provide: " + missing.join(", ") }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      await db.sql`
        update members set
          waiver_accepted_at = now(),
          waiver_signed_name = ${signedName},
          waiver_wwcc_status = ${wwccStatus},
          waiver_guardian_name = ${signingAsGuardian ? guardianName : null}
        where id = ${caller.id}
      `;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "waiver_accepted",
        resourceType: "member", resourceId: caller.id,
        newValue: { signedName, wwccStatus, signingAsGuardian, guardianName: signingAsGuardian ? guardianName : null },
        note: `${caller.email} accepted the club waiver`,
      });
    }

    const [row] = await db.sql`
      select waiver_accepted_at, waiver_signed_name, waiver_wwcc_status
      from members where id = ${caller.id}
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        accepted: !!row.waiver_accepted_at,
        acceptedAt: row.waiver_accepted_at,
        signedName: row.waiver_signed_name,
        wwccStatus: row.waiver_wwcc_status,
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
  path: "/api/waiver",
};
