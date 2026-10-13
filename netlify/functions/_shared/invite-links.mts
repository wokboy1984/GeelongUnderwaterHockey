// Tracked Bring a Mate links (13 Oct 2026, Cheongy: "Tracked personal link"
// + "Coordinator sees who brought them").
//
// Two kinds of ref in "#/new-player?ref=...":
//   - an invite's own token: the member typed the mate's name first, so the
//     free trial form opens with that name filled in;
//   - a member's invite_code: the general "just share the link" button. A
//     booking through it creates an invite row for that member on the spot.
// When the mate books, the invite moves to status 'booked' with the
// Wednesday they picked, and trial_signups.invited_by records the member -
// so nobody has to tap "Mark as registered" by hand any more.

import { memberDisplayName } from "./roles.mts";

let ready = false;
export async function ensureInviteColumns(db: any): Promise<void> {
  if (ready) return;
  await db.sql`alter table invites add column if not exists token text`;
  await db.sql`create unique index if not exists invites_token_key on invites (token)`;
  await db.sql`alter table invites add column if not exists trial_signup_id integer`;
  await db.sql`alter table invites add column if not exists booked_for date`;
  await db.sql`alter table members add column if not exists invite_code text`;
  await db.sql`create unique index if not exists members_invite_code_key on members (invite_code)`;
  ready = true;
}

// 10 characters from a-z0-9 - unguessable enough for an invite link, short
// enough to look tidy in a text message.
export function newToken(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function cleanRef(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[a-z0-9]{6,20}$/.test(s) ? s : "";
}

export async function memberInviteCode(db: any, memberId: string): Promise<string> {
  const [row] = await db.sql`select invite_code from members where id = ${memberId}`;
  if (row && row.invite_code) return row.invite_code;
  const code = newToken();
  await db.sql`update members set invite_code = ${code} where id = ${memberId} and invite_code is null`;
  const [again] = await db.sql`select invite_code from members where id = ${memberId}`;
  return again.invite_code;
}

// Gives every one of this member's invites a token (older invites made
// before 13 Oct 2026 have none).
export async function backfillTokens(db: any, memberId: string): Promise<void> {
  const rows = await db.sql`select id from invites where inviter_id = ${memberId} and token is null`;
  for (const r of rows) await db.sql`update invites set token = ${newToken()} where id = ${r.id} and token is null`;
}

export type ResolvedRef = { inviteId: number | null; inviterId: string; inviterName: string; guestName: string | null };

export async function resolveRef(db: any, ref: string): Promise<ResolvedRef | null> {
  if (!ref) return null;
  const [inv] = await db.sql`
    select i.id, i.guest_name, m.id as member_id, m.nickname, m.first_name, m.last_name
    from invites i join members m on m.id = i.inviter_id
    where i.token = ${ref}
  `;
  if (inv) return { inviteId: inv.id, inviterId: inv.member_id, inviterName: memberDisplayName(inv), guestName: inv.guest_name };
  const [m] = await db.sql`select id, nickname, first_name, last_name from members where invite_code = ${ref}`;
  if (m) return { inviteId: null, inviterId: m.id, inviterName: memberDisplayName(m), guestName: null };
  return null;
}
