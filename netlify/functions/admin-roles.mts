// Administrator-only role management: search a member, see their current
// roles, grant or revoke a role. Every grant/revoke is written to
// audit_log — who did it, to whom, what changed, when, and why.
//
// GET    /api/admin/roles?q=<search>        -> { ok, members: [...] }
// POST   /api/admin/roles  { memberEmail, role, note } -> grant
// DELETE /api/admin/roles  { memberEmail, role, note } -> revoke
// POST   /api/admin/roles  { action: "grade", memberEmail, grade }
// POST   /api/admin/roles  { action: "set_position", memberId, position }
// POST   /api/admin/roles  { action: "family_add", memberId, otherId }
// POST   /api/admin/roles  { action: "family_remove", memberId, viewId? }
//        -> put login accounts in one family, or take one out (28 Oct 2026)
// POST   /api/admin/roles  { action: "waiver", memberEmail, signed } -> record
//        (or clear) a waiver signed in person at the pool (12 Oct 2026)
//
// POST   /api/admin/roles  { action: "delete_member", memberEmail, confirm: true }
//        -> permanently deletes a member (14 Oct 2026, Cheongy). Refused if
//        they have attendance or fee history (see historyBlockers below).
//
// All three require the caller to already hold the 'administrator' role
// (checked server-side against the database — never against anything the
// client sends). This is the only place roles can change; there is no
// client-side path that can grant a role to anyone, including yourself.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { SUPER_ADMIN_EMAIL, adminName, ageFromDOB, ensureFamilyColumns, familyMembers, familyOf, ensureMember, ensureNicknameColumn, getVerifiedUser, hasRole, isGrade, isPosition, isRole, logAudit, shortName, unauthorized, forbidden } from "./_shared/roles.mts";
import { byDate, gameFeeEntries, totals } from "./_shared/finance.mts";

const RESTRICTED_FOR_JUNIORS = new Set(["community_moderator", "treasurer", "administrator"]);

function shapeMember(row: any) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname || "",
    displayName: shortName(row.nickname, row.first_name, row.last_name),
    adminName: adminName(row.nickname, row.first_name, row.last_name),
    age: ageFromDOB(row.date_of_birth),
    grade: row.grade,
    roles: (row.roles || []).filter(Boolean),
    waiverSigned: !!row.waiver_accepted_at,
  };
}


// Why a member can't be deleted (14 Oct 2026). Most of what hangs off a
// member is removed with them by the database (bookings, roles, goals,
// forum settings...) or just loses its author link (forum posts). Attendance
// and fee records are different: they are the club's history and the money
// trail, so a member who has any - or who recorded attendance or fees for
// others - is not deleted. Returns a list of reasons; empty means safe.
async function historyBlockers(db: any, id: string): Promise<string[]> {
  await db.sql`create table if not exists session_attendance_closeouts(
    session_date date primary key,
    closed_at timestamptz not null default now(),
    closed_by text not null references members(id)
  )`;
  // own_hist and marked_hist are split deliberately (20 Oct 2026). Both
  // used to be counted as "attendance rolls they have taken or changed",
  // but session_attendance_history.member_id is the player the row is
  // ABOUT, not the person who wrote it — so an ordinary member whose own
  // attendance had been edited was told they'd been taking rolls. That
  // reads like the wrong account is being deleted.
  const [c] = await db.sql`
    select
      (select count(*)::int from session_attendance where member_id = ${id}) as attended,
      (select count(*)::int from session_attendance where marked_by = ${id}) as marked,
      (select count(*)::int from session_attendance_history where member_id = ${id}) as own_hist,
      (select count(*)::int from session_attendance_history where marked_by = ${id}) as marked_hist,
      (select count(*)::int from finance_entries where member_id = ${id} or actor_id = ${id}) as fees,
      (select count(*)::int from session_attendance_closeouts where closed_by = ${id}) as closeouts
  `;
  const reasons: string[] = [];
  if (c.attended > 0) reasons.push(`${c.attended} recorded game${c.attended === 1 ? "" : "s"}`);
  // Only mention their own past attendance separately when it isn't already
  // covered by the recorded-games count above, so one fact isn't listed twice.
  else if (c.own_hist > 0) reasons.push("past attendance records");
  if (c.marked > 0 || c.marked_hist > 0 || c.closeouts > 0) reasons.push("attendance rolls they have taken or changed");
  if (c.fees > 0) reasons.push(`${c.fees} fee or payment record${c.fees === 1 ? "" : "s"}`);
  return reasons;
}

// One member's full page for Administrators (16 Oct 2026): real name,
// nickname, contact and emergency details, roles, waiver, family, games
// and goals, and their fee statement. Fees mirror /api/finance?self=1:
// games are worked out from session_attendance, a child's games bill to
// their parent, and none of it counts unless the person being billed has a
// finance account (set up by the Treasurer) - `unbilledGames` flags that gap.
async function memberDetail(db: any, id: string) {
  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const [m] = await db.sql`
    select m.id, m.email, m.nickname, m.first_name, m.last_name, m.date_of_birth, m.grade, m.position, m.phone,
           m.emergency_name, m.emergency_phone, m.waiver_accepted_at, m.waiver_signed_name, m.created_at,
           m.parent_id, m.dependant_removed_at,
           array_remove(array_agg(mr.role), null) as roles
    from members m left join member_roles mr on mr.member_id = m.id
    where m.id = ${id}
    group by m.id
  `;
  if (!m) return json({ ok: false, error: "Member not found" }, 404);

  const [parent] = m.parent_id
    ? await db.sql`select id, nickname, first_name, last_name, email from members where id = ${m.parent_id}`
    : [];
  const kids = await db.sql`
    select id, nickname, first_name, last_name, date_of_birth, dependant_removed_at
    from members where parent_id = ${m.id} order by created_at asc, id
  `;
  // The rest of their family: other logins, and children under them
  // (this member's own children are listed under kids already).
  const family = (await familyMembers(db, await familyOf(db, m.id))).filter((f: any) => f.id !== m.id && f.parent_id !== m.id && f.id !== m.parent_id);

  const [games] = await db.sql`select count(*)::int as n from session_attendance where member_id = ${m.id} and attended = true`;
  const [lastGame] = await db.sql`select to_char(max(session_date), 'YYYY-MM-DD') as d from session_attendance where member_id = ${m.id} and attended = true`;
  const [{ career }] = await db.sql`select coalesce(sum(goals), 0)::int as career from game_goals where member_id = ${m.id}`;
  const [{ season }] = await db.sql`
    select coalesce(sum(gg.goals), 0)::int as season
    from game_goals gg
    join timetable_pool_games tpg on tpg.id = gg.pool_game_id
    join timetable_rows tr on tr.id = tpg.row_id
    join sessions s on s.id = tr.session_id
    where gg.member_id = ${m.id} and extract(year from s.session_date) = ${new Date().getFullYear()}
  `;

  // Fees are billed to this person's own account, so a child has none.
  let finance: any = null;
  if (!m.parent_id) {
    const [account] = await db.sql`select category, trial_eligible, trial_evidence from finance_accounts where member_id = ${m.id}`;
    const month = new Date().toISOString().slice(0, 7);
    // Same game fees as the Finance page (shared, with the family cap).
    const entries = account
      ? [
          ...(await gameFeeEntries(db, m.id)),
          ...(await db.sql`select kind, to_char(entry_date, 'YYYY-MM-DD') as entry_date, amount_cents, note, created_at from finance_entries where member_id = ${m.id}`),
        ].sort(byDate).reverse()
      : [];
    const charged = entries.filter((e: any) => e.kind !== "payment").reduce((a: number, e: any) => a + Number(e.amount_cents), 0);
    const paid = entries.filter((e: any) => e.kind === "payment").reduce((a: number, e: any) => a + Number(e.amount_cents), 0);
    // Games that would bill to this person but can't, because they have no account.
    const [{ unbilled }] = account
      ? [{ unbilled: 0 }]
      : await db.sql`
          select count(*)::int as unbilled
          from session_attendance sa join members mm on mm.id = sa.member_id
          where sa.attended = true and coalesce(mm.parent_id, sa.member_id) = ${m.id}
        `;
    finance = {
      hasAccount: !!account,
      category: account ? account.category : null,
      trialEligible: account ? account.trial_eligible : false,
      month,
      thisMonth: totals(entries, month),
      chargedCents: charged,
      paidCents: paid,
      balanceCents: charged - paid,
      unbilledGames: unbilled,
      entries: entries.slice(0, 60).map((e: any) => ({ kind: e.kind, date: e.entry_date, amountCents: Number(e.amount_cents), note: e.note })),
    };
  }

  return json({
    ok: true,
    member: {
      id: m.id,
      email: m.email.endsWith("@no-login.guwh") ? null : m.email,
      firstName: m.first_name,
      lastName: m.last_name,
      nickname: m.nickname || "",
      displayName: shortName(m.nickname, m.first_name, m.last_name),
      adminName: adminName(m.nickname, m.first_name, m.last_name),
      age: ageFromDOB(m.date_of_birth),
      dateOfBirth: m.date_of_birth ? new Date(m.date_of_birth).toISOString().slice(0, 10) : null,
      grade: m.grade,
      position: m.position || null,
      phone: m.phone || null,
      emergencyName: m.emergency_name || null,
      emergencyPhone: m.emergency_phone || null,
      roles: (m.roles || []).filter(Boolean),
      waiverSigned: !!m.waiver_accepted_at,
      waiverNote: m.waiver_signed_name || null,
      joined: m.created_at,
      removedChild: !!m.dependant_removed_at,
      parent: parent ? { id: parent.id, displayName: shortName(parent.nickname, parent.first_name, parent.last_name), fullName: [parent.first_name, parent.last_name].filter(Boolean).join(" "), adminName: adminName(parent.nickname, parent.first_name, parent.last_name) } : null,
      family: family.map((f: any) => ({ id: f.id, adminName: adminName(f.nickname, f.first_name, f.last_name), isChild: !!f.parent_id, age: ageFromDOB(f.date_of_birth) })),
      kids: kids.map((k: any) => ({ id: k.id, displayName: shortName(k.nickname, k.first_name, k.last_name), fullName: [k.first_name, k.last_name].filter(Boolean).join(" "), adminName: adminName(k.nickname, k.first_name, k.last_name), age: ageFromDOB(k.date_of_birth), removed: !!k.dependant_removed_at })),
      gamesPlayed: games.n,
      lastGame: lastGame.d || null,
      seasonGoals: season,
      careerGoals: career,
      finance,
    },
  });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  await ensureNicknameColumn(db);
  await ensureFamilyColumns(db);
  const caller = await ensureMember(db, user);
  if (!hasRole(caller.roles, "administrator")) {
    return forbidden("Only Administrators can manage roles");
  }

  try {
    if (req.method === "GET" && new URL(req.url).searchParams.get("id")) {
      return await memberDetail(db, new URL(req.url).searchParams.get("id") as string);
    }

    if (req.method === "GET") {
      const q = new URL(req.url).searchParams.get("q")?.trim() || "";
      // Walk-in players added via the coordinator's "Add Player" (no
      // account, no email) feature are placeholder members that can never
      // log in — they get a synthetic *@no-login.guwh email and have no
      // real identity to grant a role to, so they're excluded here.
      //
      // Sorted by first name, then last name, matching the full names this
      // page shows (27 Oct 2026, Liam). It used to be newest first
      // with a limit of 25, which with 22 members was about to start
      // silently hiding the longest-standing ones; the full list is now
      // capped at 500 instead.
      const rows = q
        ? await db.sql`
            select m.id, m.email, m.nickname, m.first_name, m.last_name, m.date_of_birth, m.grade, m.waiver_accepted_at,
                   array_remove(array_agg(mr.role), null) as roles
            from members m
            left join member_roles mr on mr.member_id = m.id
            where m.email not like '%@no-login.guwh'
              and (m.email ilike ${"%" + q + "%"} or m.nickname ilike ${"%" + q + "%"} or m.first_name ilike ${"%" + q + "%"} or m.last_name ilike ${"%" + q + "%"})
            group by m.id
            order by lower(m.first_name), lower(m.last_name)
            limit 25
          `
        : await db.sql`
            select m.id, m.email, m.nickname, m.first_name, m.last_name, m.date_of_birth, m.grade, m.waiver_accepted_at,
                   array_remove(array_agg(mr.role), null) as roles
            from members m
            left join member_roles mr on mr.member_id = m.id
            where m.email not like '%@no-login.guwh'
            group by m.id
            order by lower(m.first_name), lower(m.last_name)
            limit 500
          `;
      return new Response(JSON.stringify({ ok: true, members: rows.map(shapeMember) }), {
        headers: { "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const memberEmail = String(body.memberEmail || "").trim();
    const note = body.note ? String(body.note).trim() : null;

    // Nickname (16 Oct 2026, Cheongy): members set their own on Profile; an
    // Administrator can change or clear it here (e.g. one that's offensive).
    // Clearing it puts the person back to "First L." everywhere.
    if (req.method === "POST" && body.action === "set_nickname") {
      const id = String(body.memberId || "").trim();
      const nickname = String(body.nickname || "").trim().slice(0, 30) || null;
      const [target] = await db.sql`select id, email, nickname, first_name, last_name from members where id = ${id}`;
      if (!target) {
        return new Response(JSON.stringify({ ok: false, error: "Member not found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      await db.sql`update members set nickname = ${nickname} where id = ${target.id}`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "nickname_changed",
        resourceType: "member", resourceId: target.id,
        previousValue: { nickname: target.nickname || null }, newValue: { nickname },
        note: `${caller.email} changed ${target.email}'s nickname from "${target.nickname || ""}" to "${nickname || ""}"`,
      });
      return await memberDetail(db, target.id);
    }

    // Position (27 Oct 2026, Liam): members pick their own on Profile; an
    // Administrator can correct it here. Works by id so children (who have
    // no login email) can be changed too.
    if (req.method === "POST" && body.action === "set_position") {
      const id = String(body.memberId || "").trim();
      const position = String(body.position || "").trim() || "Unknown";
      if (!isPosition(position)) {
        return new Response(JSON.stringify({ ok: false, error: "Not a valid position" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      const [target] = await db.sql`select id, email, position from members where id = ${id}`;
      if (!target) {
        return new Response(JSON.stringify({ ok: false, error: "Member not found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      await db.sql`update members set position = ${position} where id = ${target.id}`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "position_changed",
        resourceType: "member", resourceId: target.id,
        previousValue: { position: target.position || null }, newValue: { position },
        note: `${caller.email} changed ${target.email}'s position from "${target.position || ""}" to "${position}"`,
      });
      return await memberDetail(db, target.id);
    }

    // Families (28 Oct 2026, committee decision on family pricing): an
    // Administrator puts login accounts - partners, juniors with their own
    // login - into one family. Children under a parent follow the parent.
    // Anyone in a family can book the others in, and the family's game
    // fees are capped per night (_shared/finance.mts). Joining two people
    // who are each already in a different family is refused, so a mistake
    // is undone by removing someone first rather than merging families.
    if (req.method === "POST" && (body.action === "family_add" || body.action === "family_remove")) {
      const fail = (error: string, status = 400) =>
        new Response(JSON.stringify({ ok: false, error }), { status, headers: { "content-type": "application/json" } });
      const [target] = await db.sql`select id, email, parent_id, family_id from members where id = ${String(body.memberId || "")}`;
      if (!target) return fail("Member not found", 404);
      if (target.parent_id) return fail("A child under a parent's profile is always in their parent's family - add or remove the parent instead");

      if (body.action === "family_remove") {
        if (target.family_id) {
          await db.sql`update members set family_id = null where id = ${target.id}`;
          // A family of one is no family: clear the last member too.
          const left = await db.sql`select id from members where family_id = ${target.family_id}`;
          if (left.length === 1) await db.sql`update members set family_id = null where id = ${left[0].id}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "family_member_removed",
            resourceType: "member", resourceId: target.id, previousValue: { familyId: target.family_id },
            note: `${caller.email} took ${target.email} out of their family`,
          });
        }
        return await memberDetail(db, String(body.viewId || target.id));
      }

      const [other] = await db.sql`select id, email, parent_id, family_id from members where id = ${String(body.otherId || "")}`;
      if (!other) return fail("That member wasn't found", 404);
      if (other.id === target.id) return fail("Pick someone else");
      if (other.parent_id) return fail("A child under a parent's profile is already in their parent's family - add the parent instead");
      if (target.family_id && other.family_id && target.family_id !== other.family_id) {
        return fail("They're each already in a different family - take one of them out of theirs first");
      }
      const familyId = target.family_id || other.family_id || `family_${crypto.randomUUID()}`;
      await db.sql`update members set family_id = ${familyId} where id in (${target.id}, ${other.id})`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "family_member_added",
        resourceType: "member", resourceId: other.id, newValue: { familyId, with: target.id },
        note: `${caller.email} put ${other.email} in the same family as ${target.email}`,
      });
      return await memberDetail(db, target.id);
    }

    if (req.method === "POST" && body.action === "grade") {
      if (!memberEmail) {
        return new Response(JSON.stringify({ ok: false, error: "memberEmail is required" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      const rawGrade = String(body.grade || "").trim();
      if (rawGrade && !isGrade(rawGrade)) {
        return new Response(JSON.stringify({ ok: false, error: "Not a valid grade" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      const grade = rawGrade || null;
      const [target] = await db.sql`select id, email, nickname, first_name, last_name, date_of_birth, waiver_accepted_at from members where email = ${memberEmail}`;
      if (!target || target.email.endsWith("@no-login.guwh")) {
        return new Response(
          JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }
      await db.sql`update members set grade = ${grade} where id = ${target.id}`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "grade_overridden",
        resourceType: "member", resourceId: target.id, newValue: { grade },
        note: `${caller.email} set ${target.email}'s grade to ${grade || "(unset)"}`,
      });
      const roleRows = await db.sql`select role from member_roles where member_id = ${target.id}`;
      return new Response(
        JSON.stringify({ ok: true, member: shapeMember({ ...target, grade, roles: roleRows.map((r: any) => r.role) }) }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // In-person waiver (12 Oct 2026, Cheongy): the waiver is signed on paper
    // at the pool for now, so an Administrator records it here. Marking it
    // signed stamps waiver_accepted_at with now and notes who recorded it;
    // "Undo" clears it again for a mis-click. Audit-logged either way.
    if (req.method === "POST" && body.action === "waiver") {
      if (!memberEmail) {
        return new Response(JSON.stringify({ ok: false, error: "memberEmail is required" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      const signed = !!body.signed;
      const [target] = await db.sql`select id, email, nickname, first_name, last_name, date_of_birth, grade from members where email = ${memberEmail}`;
      if (!target || target.email.endsWith("@no-login.guwh")) {
        return new Response(
          JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }
      const recordedBy = "Signed in person - recorded by " + caller.email;
      const [updated] = signed
        ? await db.sql`
            update members set waiver_accepted_at = now(), waiver_signed_name = ${recordedBy}
            where id = ${target.id}
            returning waiver_accepted_at
          `
        : await db.sql`
            update members set waiver_accepted_at = null, waiver_signed_name = null
            where id = ${target.id}
            returning waiver_accepted_at
          `;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: signed ? "waiver_recorded_in_person" : "waiver_cleared",
        resourceType: "member", resourceId: target.id, newValue: { signed },
        note: `${caller.email} ${signed ? "recorded an in-person waiver for" : "cleared the waiver for"} ${target.email}`,
      });
      const roleRows = await db.sql`select role from member_roles where member_id = ${target.id}`;
      return new Response(
        JSON.stringify({ ok: true, member: shapeMember({ ...target, waiver_accepted_at: updated.waiver_accepted_at, roles: roleRows.map((r: any) => r.role) }) }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // Delete a member for good (14 Oct 2026, Cheongy: "give admin authority to
    // delete people"). Double-confirmed in the UI; `confirm: true` is also
    // required here. Never yourself, never the super admin. Their children
    // (My kids) go with them, and only if the children have no history either.
    // This removes the club record only - the person's Netlify Identity login
    // is separate and stays until it is deleted in Netlify.
    if (req.method === "POST" && body.action === "delete_member") {
      const fail = (error: string, status = 400) =>
        new Response(JSON.stringify({ ok: false, error }), { status, headers: { "content-type": "application/json" } });
      if (!memberEmail || body.confirm !== true) return fail("memberEmail and confirm are required");
      await ensureFamilyColumns(db);
      const [target] = await db.sql`select id, email, first_name, last_name from members where email = ${memberEmail}`;
      if (!target || target.email.endsWith("@no-login.guwh")) return fail("No member found with that email", 404);
      if (target.id === caller.id) return fail("You can't delete your own account.");
      if (target.email === SUPER_ADMIN_EMAIL) return fail("The main administrator account can't be deleted.");

      const name = (target.first_name + " " + target.last_name).trim();
      const kids = await db.sql`select id, first_name from members where parent_id = ${target.id}`;
      const own = await historyBlockers(db, target.id);
      if (own.length) return fail(`${name} can't be deleted because they have ${own.join(" and ")}. Deleting them would wipe that club history.`, 409);
      for (const k of kids) {
        const kr = await historyBlockers(db, k.id);
        if (kr.length) return fail(`${name} can't be deleted because their child ${k.first_name} has ${kr.join(" and ")}.`, 409);
      }

      for (const k of kids) {
        await db.sql`delete from finance_accounts where member_id = ${k.id}`;
        await db.sql`delete from members where id = ${k.id}`;
      }
      await db.sql`delete from finance_accounts where member_id = ${target.id}`;
      await db.sql`delete from members where id = ${target.id}`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "member_deleted",
        resourceType: "member", resourceId: target.id,
        previousValue: { email: target.email, name, children: kids.length },
        note: `${caller.email} deleted member ${target.email}${kids.length ? ` and ${kids.length} child record${kids.length === 1 ? "" : "s"}` : ""}`,
      });
      return new Response(JSON.stringify({ ok: true, deleted: target.id }), { headers: { "content-type": "application/json" } });
    }

    const role = String(body.role || "").trim();

    if (!memberEmail || !isRole(role)) {
      return new Response(JSON.stringify({ ok: false, error: "memberEmail and a valid role are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const [target] = await db.sql`select id, email, nickname, first_name, last_name, date_of_birth, grade, waiver_accepted_at from members where email = ${memberEmail}`;
    if (!target || target.email.endsWith("@no-login.guwh")) {
      return new Response(
        JSON.stringify({ ok: false, error: "No member found with that email — they need to log in at least once first" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const targetAge = ageFromDOB(target.date_of_birth);
    if (req.method === "POST") {
      if (RESTRICTED_FOR_JUNIORS.has(role) && typeof targetAge === "number" && targetAge < 18) {
        return new Response(JSON.stringify({ ok: false, error: "This role can't be assigned to a junior member" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      await db.sql`
        insert into member_roles (member_id, role, granted_by, note)
        values (${target.id}, ${role}, ${caller.id}, ${note})
        on conflict (member_id, role) do update set granted_by = excluded.granted_by, granted_at = now(), note = excluded.note
      `;
      await logAudit(db, {
        actorId: caller.id,
        actorEmail: caller.email,
        action: "role_granted",
        resourceType: "member_role",
        resourceId: target.id,
        newValue: { role, note },
        note: `Granted ${role} to ${target.email}`,
      });
    } else if (req.method === "DELETE") {
      await db.sql`delete from member_roles where member_id = ${target.id} and role = ${role}`;
      await logAudit(db, {
        actorId: caller.id,
        actorEmail: caller.email,
        action: "role_revoked",
        resourceType: "member_role",
        resourceId: target.id,
        previousValue: { role },
        note: `Revoked ${role} from ${target.email}`,
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }

    const roleRows = await db.sql`select role from member_roles where member_id = ${target.id}`;
    return new Response(
      JSON.stringify({ ok: true, member: shapeMember({ ...target, roles: roleRows.map((r: any) => r.role) }) }),
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
  path: "/api/admin/roles",
};
