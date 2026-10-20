// Inviting someone to create an account (21 Oct 2026).
//
// Used by the Game Coordinator's "Add a player" flow: the coordinator
// enters a name and email, the person is added to this week's schedule,
// and Netlify Identity emails them an invitation to set a password.
//
// Authentication is the awkward part. Netlify injects an admin token into
// a function's clientContext for Identity-enabled sites, which needs no
// stored secret, but that is documented for v1 functions and ours are v2.
// So read it defensively and fall back to NETLIFY_IDENTITY_ADMIN_TOKEN.
//
// Everything here reports failure rather than throwing. Adding a player to
// the schedule must never fail because email is unavailable — the roll is
// the thing the coordinator actually needs on the night.

export type InviteResult =
  | { ok: true; userId: string | null }
  | { ok: false; reason: string };

function adminCredentials(context: any): { url: string; token: string } | null {
  const identity = context && context.clientContext && context.clientContext.identity;
  if (identity && identity.url && identity.token) {
    return { url: String(identity.url), token: String(identity.token) };
  }
  const token = String(process.env.NETLIFY_IDENTITY_ADMIN_TOKEN || "").trim();
  const site = String(process.env.URL || "").trim();
  if (token && site) return { url: `${site}/.netlify/identity`, token };
  return null;
}

export async function inviteMember(context: any, email: string, fullName: string): Promise<InviteResult> {
  const creds = adminCredentials(context);
  if (!creds) {
    return {
      ok: false,
      reason:
        "No Identity admin access. Set NETLIFY_IDENTITY_ADMIN_TOKEN in the Netlify project so invitations can be sent.",
    };
  }
  try {
    const res = await fetch(`${creds.url}/admin/users`, {
      method: "POST",
      headers: { authorization: `Bearer ${creds.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        email,
        // Netlify emails an invitation rather than creating a usable
        // account outright; they choose their own password from the link.
        invite: true,
        confirm: true,
        user_metadata: { full_name: fullName },
        // Marks them as vouched for by the club, which is what lets
        // identity-validate.mts accept a signup with no club code.
        app_metadata: { invited_by_club: true },
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: String(body.msg || body.error_description || body.error || `Identity returned ${res.status}`) };
    }
    return { ok: true, userId: body && body.id ? String(body.id) : null };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
