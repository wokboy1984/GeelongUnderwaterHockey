// Club join code for new signups (12 Oct 2026, Cheongy: "keep signup open
// to anyone, but password protected").
//
// Netlify Identity calls this function automatically whenever someone
// tries to sign up, BEFORE the account is created (the file name
// "identity-validate" is what wires it up - don't rename it). It only lets
// the signup through if the club join code they typed matches the
// CLUB_JOIN_CODE environment variable set in Netlify (Project
// configuration > Environment variables). The code never lives in this
// repo. Comparison ignores case and spaces at either end.
//
// The site's own signup form (js/pages/portal-login.js) sends the code as
// user metadata "join_code". The old Netlify pop-up signup has no code
// field, so any signup through it is refused too.
//
// Fails closed: if CLUB_JOIN_CODE isn't set, every signup is refused
// (existing members can still log in - this only runs on signup).
//
// Uses the classic `handler` format on purpose: Netlify's documented,
// long-standing shape for identity event functions.

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event: { body: string | null }) => {
  const expected = String(process.env.CLUB_JOIN_CODE || "").trim().toLowerCase();
  if (!expected) {
    console.error("identity-validate: CLUB_JOIN_CODE is not set - refusing signup");
    return json(403, { msg: "Signups are closed right now. Please contact the club." });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { msg: "Bad signup request" });
  }

  const meta = (payload.user && payload.user.user_metadata) || {};
  const given = String(meta.join_code || "").trim().toLowerCase();
  if (!given || given !== expected) {
    return json(403, { msg: "That club code isn't right." });
  }

  // Allowed. Empty 200 = let Netlify create the account unchanged.
  return { statusCode: 200, body: "" };
};
