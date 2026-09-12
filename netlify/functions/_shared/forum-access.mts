// DB-touching forum access gate, kept separate from the pure _shared/forum.mts
// so that module stays fully unit-testable without a database. Every forum
// endpoint calls requireForumAccess() first — access is enforced here, on
// the server, never inferred from anything the client claims.

import { hasPermission, forbidden } from "./roles.mts";
import { ADULT_AGE } from "./forum.mts";

export type ForumParticipation = {
  member_id: string;
  opted_in: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
  show_photo: boolean;
  show_grade: boolean;
  show_badges: boolean;
  guidelines_version: string | null;
  guidelines_accepted_at: string | null;
  restricted_at: string | null;
  restricted_reason: string | null;
  suspended_at: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
} | null;

export async function loadForumParticipation(db: any, memberId: string): Promise<ForumParticipation> {
  const [row] = await db.sql`select * from forum_participation where member_id = ${memberId}`;
  return row || null;
}

export function isSuspended(p: ForumParticipation, now: Date = new Date()): boolean {
  if (!p || !p.suspended_at) return false;
  if (!p.suspended_until) return true; // indefinite suspension
  return now.getTime() < new Date(p.suspended_until).getTime();
}

export function isRestricted(p: ForumParticipation): boolean {
  return !!(p && p.restricted_at);
}

type AccessResult =
  | { ok: true; participation: ForumParticipation; isModerator: boolean }
  | { ok: false; response: Response };

// caller is the ensureMember() Member (caller.age is already derived from
// date_of_birth server-side — never trust a client-sent age/DOB anywhere).
// Moderators/Administrators can always read (they need to see everything
// for oversight) but still go through the adult/opt-in/suspension gate for
// POSTING as a participant, same as anyone else — moderating and
// participating are different things.
export async function requireForumAccess(
  db: any,
  caller: { id: string; roles: string[]; age: number | null },
  opts: { forPosting?: boolean } = {}
): Promise<AccessResult> {
  const isModerator = hasPermission(caller.roles, "moderate_community");
  const participation = await loadForumParticipation(db, caller.id);

  if (isModerator && !opts.forPosting) {
    return { ok: true, participation, isModerator: true };
  }

  if (caller.age === null || caller.age < ADULT_AGE) {
    return { ok: false, response: forbidden("The Members Forum is for adult members only.") };
  }
  if (!participation || !participation.opted_in) {
    return { ok: false, response: forbidden("You need to opt in to the Members Forum first.") };
  }
  if (isSuspended(participation)) {
    return { ok: false, response: forbidden("Your forum access is currently suspended.") };
  }
  if (opts.forPosting && isRestricted(participation)) {
    return { ok: false, response: forbidden("Your posting ability is currently restricted — you can still read and report content.") };
  }
  return { ok: true, participation, isModerator };
}

export function requireModerator(caller: { roles: string[] }): Response | null {
  return hasPermission(caller.roles, "moderate_community") ? null : forbidden("Only Community Moderators and Administrators can do that.");
}
