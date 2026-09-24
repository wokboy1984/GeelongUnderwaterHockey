// Victorian State Titles interest — a PUBLIC form (main nav, no login
// required — 24 Sept 2026 change; was members-only until then). Anyone can
// register interest in representing Geelong, whether or not they have an
// account. Being logged in is a bonus, not a requirement: it prefills your
// name/email, shows your existing registration, and — for Game
// Coordinators/Administrators — shows the full roster.
//
// The event details (date, venue, blurb) are hardcoded here for now, same
// pattern as nextSessionDateISO's own constants elsewhere — there's only
// ever one "next" State Titles worth showing. When the next one comes
// around, update CURRENT_EVENT (a new key starts a fresh roster; keep the
// same key to reuse one).
//
// GET  /api/state-titles[?email=...] -> { ok, event, grades, prefill, registration, canViewRoster, roster? }
// POST /api/state-titles { action: "register", firstName, lastName, email, phone, grade, isMember, notes }
// POST /api/state-titles { action: "withdraw", email }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit } from "./_shared/roles.mts";

const CURRENT_EVENT = {
  key: "2026-vic-state-titles",
  label: "Victorian State Titles",
  dateLabel: "Sunday, 18th October",
  venue: "Caufield Aquatic Centre",
  blurb:
    "Get ready for an action-packed day of great hockey, exciting competition, and the chance to catch up with players from across Victoria.",
};

const STATE_TITLES_GRADES = ["A Grade", "B Grade", "U18", "U14"] as const;
type StateTitlesGrade = (typeof STATE_TITLES_GRADES)[number];
function isStateTitlesGrade(v: string): v is StateTitlesGrade {
  return (STATE_TITLES_GRADES as readonly string[]).includes(v);
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();

    // Optional auth — a valid token gets you prefill/roster perks, but
    // nothing here requires one. getVerifiedUser() returns null for no/bad
    // token rather than throwing, so an anonymous visitor sails through.
    const user = await getVerifiedUser(req);
    const caller = user ? await ensureMember(db, user) : null;
    const canViewRoster = !!caller && hasPermission(caller.roles, "arrange_teams");

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "register");

      if (action === "withdraw") {
        const email = String(body.email || caller?.email || "").trim().toLowerCase();
        if (!email) return badRequest("Enter the email address you registered with.");
        await db.sql`
          delete from state_titles_registrations where event_key = ${CURRENT_EVENT.key} and lower(email) = ${email}
        `;
        await logAudit(db, {
          actorId: caller?.id ?? null, actorEmail: caller?.email ?? email, action: "state_titles_withdrawn",
          resourceType: "state_titles_registration", resourceId: email,
          note: `${caller?.email ?? email} withdrew their State Titles registration`,
        });
      } else {
        const firstName = String(body.firstName || "").trim();
        const lastName = String(body.lastName || "").trim();
        const email = String(body.email || "").trim();
        const phone = String(body.phone || "").trim();
        const grade = String(body.grade || "").trim();
        const isMember = !!body.isMember;
        const notes = String(body.notes || "").trim();

        const missing: string[] = [];
        if (!firstName) missing.push("your first name");
        if (!lastName) missing.push("your last name");
        if (!email || !email.includes("@")) missing.push("a valid email address");
        if (!isStateTitlesGrade(grade)) missing.push("a grade (A Grade, B Grade, U18 or U14)");
        if (missing.length) return badRequest("Please provide: " + missing.join(", "));

        await db.sql`
          insert into state_titles_registrations (member_id, event_key, first_name, last_name, email, phone, grade, is_member, notes)
          values (${caller?.id ?? null}, ${CURRENT_EVENT.key}, ${firstName}, ${lastName}, ${email}, ${phone || null}, ${grade}, ${isMember}, ${notes || null})
          on conflict (event_key, lower(email)) do update set
            member_id = coalesce(excluded.member_id, state_titles_registrations.member_id),
            first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone,
            grade = excluded.grade, is_member = excluded.is_member, notes = excluded.notes, updated_at = now()
        `;
        await logAudit(db, {
          actorId: caller?.id ?? null, actorEmail: caller?.email ?? email, action: "state_titles_registered",
          resourceType: "state_titles_registration", resourceId: email,
          newValue: { firstName, lastName, email, grade, isMember },
          note: `${caller?.email ?? email} registered interest for State Titles (${grade})`,
        });
      }
    }

    // "Is this visitor already registered" — only resolvable by email, so
    // only shown for a logged-in member (using their account email) or a
    // request that just posted one. Fine either way: a fresh anonymous GET
    // (page load, not logged in) just shows a blank form, no lookup needed.
    const lookupEmail = (caller?.email || "").trim().toLowerCase();
    let registration: { firstName: string; lastName: string; email: string; phone: string | null; grade: string; isMember: boolean; notes: string | null } | null = null;
    if (lookupEmail) {
      const [regRow] = await db.sql`
        select first_name, last_name, email, phone, grade, is_member, notes
        from state_titles_registrations where event_key = ${CURRENT_EVENT.key} and lower(email) = ${lookupEmail}
      `;
      if (regRow) {
        registration = {
          firstName: regRow.first_name, lastName: regRow.last_name, email: regRow.email,
          phone: regRow.phone, grade: regRow.grade, isMember: !!regRow.is_member, notes: regRow.notes,
        };
      }
    }

    let roster: { id: number; firstName: string; lastName: string; email: string; phone: string | null; grade: string; isMember: boolean; registeredAt: string }[] | undefined;
    if (canViewRoster) {
      const rosterRows = await db.sql`
        select id, first_name, last_name, email, phone, grade, is_member, created_at
        from state_titles_registrations
        where event_key = ${CURRENT_EVENT.key}
        order by grade asc, first_name asc
      `;
      roster = rosterRows.map((r: any) => ({
        id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
        grade: r.grade, isMember: !!r.is_member, registeredAt: r.created_at,
      }));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        event: CURRENT_EVENT,
        grades: STATE_TITLES_GRADES,
        prefill: caller ? { firstName: caller.firstName, lastName: caller.lastName, email: caller.email, isMember: true } : null,
        registration,
        canViewRoster,
        roster,
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
  path: "/api/state-titles",
};
