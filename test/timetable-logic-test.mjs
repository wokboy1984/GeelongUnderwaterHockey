// Node-only unit tests for the real timetable logic in
// netlify/functions/_shared/timetable.mts — overlap detection, referee
// eligibility/exclusion, conflict flagging and publish-blocking validation.
// No DB, no server: this exercises the exact pure functions the live
// coordinator-schedule.mts and game-board.mts endpoints import and run.
import * as T from "../netlify/functions/_shared/timetable.mts";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log("FAIL:", msg); }
  else console.log("pass:", msg);
}

// ---------------------------------------------------------------- fixtures
// Crays (black) vs Freedivers (white) in Pool A, Seals (black) vs
// Barracudas (white) in Pool B, both at 6:00pm for 20 minutes.
const teams = {
  1: { id: 1, name: "Crays", playerIds: ["p-crays-1", "p-crays-2"] },
  2: { id: 2, name: "Freedivers", playerIds: ["p-free-1", "p-free-2"] },
  3: { id: 3, name: "Seals", playerIds: ["p-seals-1", "p-seals-2"] },
  4: { id: 4, name: "Barracudas", playerIds: ["p-barra-1", "p-barra-2"] },
};
const confirmedIds = new Set([
  ...teams[1].playerIds, ...teams[2].playerIds, ...teams[3].playerIds, ...teams[4].playerIds,
  "ref-sarah", "ref-james", "ref-ben", "ref-alex",
]);

function makeRow(overrides) {
  return Object.assign(
    {
      id: 1,
      rowType: "game",
      label: "Game 1",
      startMin: 0,
      durationMin: 20,
      archived: false,
      poolGames: [
        { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: [] },
        { id: 11, pool: "Pool B", blackTeamId: 3, whiteTeamId: 4, refereeIds: [] },
      ],
    },
    overrides
  );
}

// ------------------------------------------------------------ row types
assert(T.ROW_TYPES.includes("set_up") && T.ROW_TYPES.includes("custom"), "all row types include set_up and custom");
assert(T.isRowType("game") && !T.isRowType("bogus"), "isRowType validates against the real list");
T.ROW_TYPES.forEach((rt) => assert(typeof T.ROW_TYPE_LABELS[rt] === "string", "row type " + rt + " has a display label"));

// ------------------------------------------------------------ overlap detection
assert(T.intervalsOverlap(0, 20, 0, 20) === true, "identical 6:00-6:20 intervals overlap");
assert(T.intervalsOverlap(0, 25, 20, 40) === true, "partial overlap 6:00-6:25 vs 6:20-6:40 is detected");
assert(T.intervalsOverlap(0, 20, 20, 40) === false, "back-to-back 6:00-6:20 then 6:20-6:40 do not overlap");
assert(T.intervalsOverlap(null, null, 0, 20) === false, "an unscheduled row (no time) never overlaps");
assert(T.endMin(0, 20) === 20, "endMin adds duration to start");
assert(T.endMin(null, 20) === null, "endMin is null when start is unknown");

// ------------------------------------------------------- referee eligibility
{
  const row = makeRow({});
  const { eligibleIds, unavailable } = T.computeEligibility(1, "Pool A", [row], teams, confirmedIds);
  // Excludes every player of both simultaneous games (Crays, Freedivers, Seals, Barracudas).
  [...teams[1].playerIds, ...teams[2].playerIds, ...teams[3].playerIds, ...teams[4].playerIds].forEach((pid) => {
    assert(!eligibleIds.includes(pid), pid + " (playing) is excluded from Pool A referee list");
  });
  assert(eligibleIds.includes("ref-sarah"), "a confirmed non-player is eligible to referee Pool A");
  const reasonFor = (id) => (unavailable.find((u) => u.memberId === id) || {}).reason;
  assert(reasonFor("p-crays-1") === "playing_this_row", "Pool A player excluded with playing_this_row reason");
  assert(reasonFor("p-seals-1") === "playing_this_row", "Pool B player also excluded from Pool A (simultaneous game)");
}

// One referee cannot officiate both pools of the same simultaneous row.
{
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: ["ref-alex"] },
    { id: 11, pool: "Pool B", blackTeamId: 3, whiteTeamId: 4, refereeIds: [] },
  ] });
  const { eligibleIds, unavailable } = T.computeEligibility(1, "Pool B", [row], teams, confirmedIds);
  assert(!eligibleIds.includes("ref-alex"), "someone already refereeing Pool A cannot also referee Pool B at the same time");
  const entry = unavailable.find((u) => u.memberId === "ref-alex");
  assert(entry && entry.reason === "refereeing_other_pool", "reason correctly identifies the dual-pool referee conflict");
}

// ---------------------------------------------------- dynamic recalculation
// If Alex C. is refereeing Pool A but then gets added to the Seals (playing
// Pool B at the same time), Alex is no longer a legitimate referee for
// Pool A — this must be flagged, not silently dropped.
{
  const teamsWithAlexPlaying = JSON.parse(JSON.stringify(teams));
  teamsWithAlexPlaying[3].playerIds.push("ref-alex"); // Alex now plays for Seals
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: ["ref-alex"] },
    { id: 11, pool: "Pool B", blackTeamId: 3, whiteTeamId: 4, refereeIds: [] },
  ] });
  const conflict = T.refereeConflict("ref-alex", 1, "Pool A", [row], teamsWithAlexPlaying, confirmedIds);
  assert(!!conflict, "Alex C. is flagged as conflicted once assigned to a team playing an overlapping game");
  // Pool B here is the *same* row as Pool A (one simultaneous timetable row) —
  // so the reason bucket is "playing in this row", exactly the
  // "Alex C. cannot referee Pool A because they are playing for Seals in
  // Pool B at 6:00pm" example from the brief.
  assert(conflict.reason === "playing_this_row", "conflict reason is that Alex is now playing the simultaneous Pool B game");
}

// A referee already used elsewhere in an overlapping (but different) row is excluded.
{
  const rowA = makeRow({ id: 1, startMin: 0, durationMin: 20, poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: [] },
  ] });
  const rowB = makeRow({ id: 2, startMin: 10, durationMin: 20, poolGames: [
    { id: 20, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: ["ref-ben"] },
  ] });
  const { eligibleIds, unavailable } = T.computeEligibility(1, "Pool A", [rowA, rowB], teams, confirmedIds);
  assert(!eligibleIds.includes("ref-ben"), "referee already assigned to a partially-overlapping row is excluded");
  const entry = unavailable.find((u) => u.memberId === "ref-ben");
  assert(entry && entry.reason === "refereeing_overlapping_game", "overlapping-assignment reason is reported");
}

// ------------------------------------------------------------------ validation
{
  const errors = T.validateTimetable([makeRow({})], teams, confirmedIds);
  assert(errors.length === 0, "a fully valid simultaneous two-pool row passes validation with no errors (" + errors.length + ")");
}
{
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: null, refereeIds: [] },
  ] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.some((e) => e.field === "teams"), "a half-filled pool game (one team only) is a blocking error");
}
{
  const row = makeRow({ poolGames: [] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.some((e) => /no teams assigned/.test(e.message)), "a game row with no pool games at all is blocking");
}
{
  // Only Pool A populated is fine — a game row may contain a game in one pool only.
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: [] },
  ] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.length === 0, "Pool A only (Pool B empty) is valid — both pools are not required");
}
{
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 1, refereeIds: [] },
  ] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.some((e) => /can't play both sides/.test(e.message)), "the same team on both sides of one pool is blocking");
}
{
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: [] },
    { id: 11, pool: "Pool B", blackTeamId: 1, whiteTeamId: 4, refereeIds: [] },
  ] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.some((e) => /assigned twice/.test(e.message)), "the same team used twice within one row (different pools) is blocking");
}
{
  // Crays play Pool A at 6:00-6:20, then Pool A again at 6:15-6:35 elsewhere — overlapping.
  const row1 = makeRow({ id: 1, startMin: 0, durationMin: 20, poolGames: [{ id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: [] }] });
  const row2 = makeRow({ id: 2, startMin: 15, durationMin: 20, poolGames: [{ id: 20, pool: "Pool B", blackTeamId: 1, whiteTeamId: 4, refereeIds: [] }] });
  const errors = T.validateTimetable([row1, row2], teams, confirmedIds);
  assert(errors.some((e) => e.field === "team_conflict" && /Crays/.test(e.message)), "overlapping team double-booking across rows/pools is blocking");
}
{
  const row1 = makeRow({ id: 1, startMin: 0, durationMin: 20 });
  const row2 = makeRow({ id: 2, startMin: 20, durationMin: 20 });
  const errors = T.validateTimetable([row1, row2], teams, confirmedIds);
  assert(errors.length === 0, "back-to-back (non-overlapping) games with the same teams reused later are fine");
}
{
  const row = makeRow({ poolGames: [
    { id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 2, refereeIds: ["p-crays-1"] }, // referee is also playing for Crays
  ] });
  const errors = T.validateTimetable([row], teams, confirmedIds);
  assert(errors.some((e) => e.field === "referee_conflict"), "a referee who is also playing blocks publication");
}
{
  const errors = T.validateTimetable([{ id: 5, rowType: "custom", label: "", startMin: 0, durationMin: 10, archived: false, poolGames: [] }], teams, confirmedIds);
  assert(errors.some((e) => e.field === "label"), "a Custom row with no label is blocking");
}
{
  const errors = T.validateTimetable([{ id: 6, rowType: "warm_up", label: "Warm Up", startMin: 0, durationMin: 0, archived: false, poolGames: [] }], teams, confirmedIds);
  assert(errors.some((e) => e.field === "durationMin"), "a zero duration is blocking");
}
{
  const archivedRow = makeRow({ archived: true, poolGames: [{ id: 10, pool: "Pool A", blackTeamId: 1, whiteTeamId: 1, refereeIds: [] }] });
  const errors = T.validateTimetable([archivedRow], teams, confirmedIds);
  assert(errors.length === 0, "an archived row is excluded from validation entirely");
}

// --------------------------------------------------------------- suggestions
assert(T.suggestNextStart(null) === null, "no previous row means no suggested start");
assert(T.suggestNextStart({ startMin: 0, durationMin: 20 }) === 20, "suggested start is previous start + duration");

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures ? 1 : 0);
