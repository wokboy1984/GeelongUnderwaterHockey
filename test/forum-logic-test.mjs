// Manual QA / logic tests for the Members Forum's pure logic module.
// Run: node test/forum-logic-test.mjs
import {
  isAdultFromDOB,
  withinEditWindow,
  forumDisplayName,
  renderForumMarkup,
  extractMentionTokens,
  validatePollVote,
  isExpired,
  isReaction,
  isReportReason,
  isNotifyLevel,
  EDIT_WINDOW_MS,
} from "../netlify/functions/_shared/forum.mts";

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error("FAIL:", msg);
  }
}

// --- Adult eligibility -------------------------------------------------
const today = new Date();
function isoYearsAgo(years, monthOffset = 0) {
  const d = new Date(today.getFullYear() - years, today.getMonth() - monthOffset, today.getDate());
  return d.toISOString().slice(0, 10);
}
assert(isAdultFromDOB(isoYearsAgo(25)) === true, "25yo is adult-eligible");
assert(isAdultFromDOB(isoYearsAgo(18)) === true, "exactly 18yo (birthday already passed this year) is eligible");
assert(isAdultFromDOB(isoYearsAgo(17)) === false, "17yo is not eligible");
assert(isAdultFromDOB(isoYearsAgo(12)) === false, "junior (12yo) is not eligible");
assert(isAdultFromDOB(null) === false, "no DOB on file is not eligible (safe default)");
assert(isAdultFromDOB(undefined) === false, "undefined DOB is not eligible");

// A birthday later this same year: 18 years ago but hasn't hit it yet this year -> still 17.
{
  const d = new Date(today.getFullYear() - 18, today.getMonth() + 1, today.getDate());
  const notYet18 = d.toISOString().slice(0, 10);
  assert(isAdultFromDOB(notYet18) === false, "birthday later this year means still 17, not eligible yet");
}

// --- Edit window (server time only) -------------------------------------
const now = new Date("2026-09-12T12:00:00Z");
assert(withinEditWindow(new Date(now.getTime() - 5 * 60 * 1000), now) === true, "5 min old post is still editable");
assert(withinEditWindow(new Date(now.getTime() - 59 * 60 * 1000), now) === true, "59 min old post is still editable");
assert(withinEditWindow(new Date(now.getTime() - 61 * 60 * 1000), now) === false, "61 min old post is no longer editable");
assert(EDIT_WINDOW_MS === 60 * 60 * 1000, "edit window is exactly one hour");
assert(withinEditWindow("not a date", now) === false, "garbage createdAt is treated as not editable");

// --- Display identity ----------------------------------------------------
assert(forumDisplayName("Alex", "Cheong") === "Alex C.", "first name + surname initial");
assert(forumDisplayName("Sam", "") === "Sam", "no surname on file falls back to first name only");

// --- Markup rendering / injection safety ----------------------------------
assert(
  renderForumMarkup('<script>alert(1)</script>').includes("&lt;script&gt;"),
  "raw script tags are escaped, never rendered as real tags"
);
assert(
  !renderForumMarkup("hello <img src=x onerror=alert(1)>").includes("<img"),
  "raw img/onerror attempt never produces a real <img> tag"
);
assert(renderForumMarkup("**bold** and *italic*") === "<p><strong>bold</strong> and <em>italic</em></p>", "bold/italic render correctly");
assert(renderForumMarkup("[club site](javascript:document.cookie)").includes('href="javascript:') === false, "javascript: links never become a real href");
assert(renderForumMarkup("[club site](javascript:document.cookie)").includes("<a ") === false, "javascript: link never becomes a real <a> tag");
assert(renderForumMarkup("[GUWH](https://geelongunderwaterhockey.org.au)").includes('href="https://geelongunderwaterhockey.org.au'), "https link renders as real <a href>");
assert(renderForumMarkup("- one\n- two").includes("<ul><li>one</li><li>two</li></ul>"), "list rendering");
assert(renderForumMarkup("> quoted text").includes("<blockquote>quoted text</blockquote>"), "blockquote rendering");
assert(renderForumMarkup("## Heads up").includes("<h4>Heads up</h4>"), "heading rendering capped at h4 (no layout-hijacking h1)");

{
  const mentions = new Map([["alex c.", { memberId: "m1", display: "Alex C." }]]);
  const out = renderForumMarkup("hey @Alex C. see you Wednesday", mentions);
  assert(out.includes('data-member-id="m1"'), "resolved mention becomes a real mention span");
  const outUnknown = renderForumMarkup("hey @Random J. see you Wednesday", mentions);
  assert(!outUnknown.includes("data-member-id"), "unresolved / unknown mention never becomes a mention span");
}

assert(extractMentionTokens("hi @Alex C. and @Ben R.").length === 2, "extracts multiple mention tokens");
assert(extractMentionTokens("no mentions here").length === 0, "no false-positive mentions");

// --- Reactions / reports / notify levels ----------------------------------
assert(isReaction("like") && isReaction("helpful") && isReaction("funny") && isReaction("interested"), "all four reactions valid");
assert(!isReaction("angry"), "unsupported reaction rejected");
assert(isReportReason("harassment") && isReportReason("other"), "report reasons valid");
assert(!isReportReason("nonsense"), "unsupported report reason rejected");
assert(isNotifyLevel("in_app_email") && isNotifyLevel("in_app_only") && isNotifyLevel("none"), "notify levels valid");
assert(!isNotifyLevel("sms"), "unsupported notify level rejected");

// --- Poll validation -------------------------------------------------------
const poll = { allowMultiple: false, closesAt: null, optionIds: [1, 2, 3] };
assert(validatePollVote(poll, [1]) === null, "single valid vote passes");
assert(validatePollVote(poll, [1, 2]) !== null, "single-select poll rejects multiple selections");
assert(validatePollVote(poll, [99]) !== null, "unknown option id rejected");
assert(validatePollVote(poll, []) !== null, "empty selection rejected");
const multiPoll = { allowMultiple: true, closesAt: null, optionIds: [1, 2, 3] };
assert(validatePollVote(multiPoll, [1, 2]) === null, "multi-select poll allows multiple");
const closedPoll = { allowMultiple: false, closesAt: "2020-01-01T00:00:00Z", optionIds: [1] };
assert(validatePollVote(closedPoll, [1]) !== null, "closed poll rejects new votes");

// --- Announcement expiry ----------------------------------------------------
assert(isExpired("2020-01-01T00:00:00Z") === true, "past expiry date is expired");
assert(isExpired(null) === false, "no expiry date is never expired");
assert(isExpired(new Date(Date.now() + 86400000).toISOString()) === false, "future expiry date is not yet expired");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("ALL PASS");
