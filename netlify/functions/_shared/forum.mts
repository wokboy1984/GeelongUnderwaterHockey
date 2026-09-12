// Members Forum — shared pure logic. No DB access here (mirrors
// _shared/timetable.mts), so every rule below is directly unit-testable via
// `import()` from test/forum-logic-test.mjs.
//
// Deliberate design choice on content: rather than accepting arbitrary HTML
// from members and trying to sanitize it (a well-known source of bypass
// bugs, and this project has no HTML-sanitizing library installed), posts
// are written in a small fixed markup subset (like Slack/Discord) that this
// module renders itself into HTML it fully controls. User text is always
// HTML-escaped first; only a handful of recognized safe patterns are ever
// turned into tags, so there's no "unsafe HTML slipped through" surface at
// all — nothing resembling a tag from the input can ever survive as a tag.

import { ageFromDOB } from "./roles.mts";

export const ADULT_AGE = 18;

// A member's real DOB is required to know they're an adult — no DOB on
// file yet means "not eligible", not "assume adult". Combined with
// forum_participation.opted_in server-side, this is the whole access gate.
export function isAdultFromDOB(dob: string | Date | null | undefined): boolean {
  const age = ageFromDOB(dob);
  return age !== null && age >= ADULT_AGE;
}

export type NotifyLevel = "in_app_email" | "in_app_only" | "none";
export const NOTIFY_LEVELS: NotifyLevel[] = ["in_app_email", "in_app_only", "none"];
export function isNotifyLevel(v: string): v is NotifyLevel {
  return (NOTIFY_LEVELS as string[]).includes(v);
}

export const REACTIONS = ["like", "helpful", "funny", "interested"] as const;
export type Reaction = (typeof REACTIONS)[number];
export function isReaction(v: string): v is Reaction {
  return (REACTIONS as readonly string[]).includes(v);
}

export const REPORT_REASONS = [
  "harassment",
  "unsafe_advice",
  "privacy",
  "spam",
  "inappropriate_media",
  "off_topic",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export function isReportReason(v: string): v is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(v);
}

export const EDIT_WINDOW_MS = 60 * 60 * 1000; // one hour, server time only

// `now` is always server time (`new Date()` at the moment the function
// handles the request) — never anything the client sends.
export function withinEditWindow(createdAt: string | Date, now: Date = new Date()): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() - created.getTime() <= EDIT_WINDOW_MS;
}

// "Alex C." — first name + surname initial, the only identity ever shown in
// the forum. Never pass a full last name into this.
export function forumDisplayName(firstName: string, lastName: string): string {
  const initial = (lastName || "").trim().charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}.` : firstName;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only http/https survive as real links — javascript:, data:, vbscript: etc
// are all rejected and rendered as plain escaped text instead.
function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type MentionResolution = { memberId: string; display: string };

// raw: the member's plain-text-with-lightweight-markup input.
// mentions: token -> resolved eligible member, keyed by the exact
// "FirstName S." text (case-insensitive) the composer inserted — resolution
// happens in the caller (forum-posts.mts) against real, opted-in, adult
// members only, so an unresolved "@Someone X." just stays plain text here.
export function renderForumMarkup(raw: string, mentions?: Map<string, MentionResolution>): string {
  const text = String(raw || "").replace(/\r\n/g, "\n").slice(0, 20000);
  const lines = text.split("\n");
  const blocks: string[] = [];
  let para: string[] = [];
  let list: string[] | null = null;

  function flushPara() {
    if (para.length) {
      blocks.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  }
  function flushList() {
    if (list) {
      blocks.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = null;
    }
  }

  function inline(s: string): string {
    let out = escapeHtml(s);
    // Links: [text](url) — url validated, text escaped already.
    out = out.replace(/\[([^\[\]]{1,200})\]\(([^\s()]{1,2000})\)/g, (_m, label, url) => {
      const href = safeHref(url);
      return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener nofollow ugc">${label}</a>` : `${label} (${escapeHtml(url)})`;
    });
    // Bold then italic (order matters so **x** doesn't get eaten by *x*).
    out = out.replace(/\*\*([^*]{1,500})\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(?<!\*)\*([^*]{1,500})\*(?!\*)/g, "<em>$1</em>");
    // Mentions: only substitute tokens the caller resolved to a real,
    // eligible member — anything else stays as plain escaped text.
    if (mentions && mentions.size) {
      out = out.replace(/@([A-Za-z][A-Za-z'-]*)\s+([A-Za-z])\./g, (m, first, initial) => {
        const key = `${first} ${initial}.`.toLowerCase();
        const hit = mentions.get(key);
        return hit ? `<span class="forum-mention" data-member-id="${escapeHtml(hit.memberId)}">@${escapeHtml(hit.display)}</span>` : escapeHtml(m);
      });
    }
    return out;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^##\s+(.{1,120})$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push(`<h4>${inline(heading[1])}</h4>`);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      flushList();
      blocks.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    const item = /^[-*]\s+(.{1,500})$/.exec(line);
    if (item) {
      flushPara();
      if (!list) list = [];
      list.push(item[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return blocks.join("") || "<p></p>";
}

// Finds "@FirstName S." style tokens in raw (pre-render) text — used by the
// backend to know which candidate names to try to resolve against real
// members before calling renderForumMarkup.
export function extractMentionTokens(raw: string): string[] {
  const out = new Set<string>();
  const re = /@([A-Za-z][A-Za-z'-]*)\s+([A-Za-z])\./g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out.add(`${m[1]} ${m[2]}.`);
  return [...out];
}

export type PollForVoting = { allowMultiple: boolean; closesAt: string | Date | null; optionIds: number[] };

export function validatePollVote(poll: PollForVoting, selectedOptionIds: number[], now: Date = new Date()): string | null {
  if (poll.closesAt && now.getTime() > new Date(poll.closesAt).getTime()) return "This poll has closed.";
  if (selectedOptionIds.length === 0) return "Pick at least one option.";
  if (!poll.allowMultiple && selectedOptionIds.length > 1) return "This poll only allows one choice.";
  const unknown = selectedOptionIds.find((id) => !poll.optionIds.includes(id));
  if (unknown !== undefined) return "That option isn't part of this poll.";
  return null;
}

// Announcements past their expiry lose priority (no longer treated as
// "recent"/pinned-worthy for feed ordering) but stay visible until a
// Moderator explicitly archives them.
export function isExpired(expiresAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return now.getTime() > new Date(expiresAt).getTime();
}
