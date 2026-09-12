// Pure, DB-agnostic timetable logic shared between coordinator-schedule.mts
// (the builder) and game-board.mts (the public read), plus unit-tested
// directly from test/timetable-logic-test.mjs. Nothing in this file talks
// to the database — it only ever sees plain data the caller already loaded.

export const ROW_TYPES = [
  "set_up",
  "warm_up",
  "game_briefing",
  "game",
  "game_changeover",
  "skills_development",
  "pack_up",
  "custom",
] as const;
export type RowType = (typeof ROW_TYPES)[number];
export function isRowType(value: string): value is RowType {
  return (ROW_TYPES as readonly string[]).includes(value);
}

export const ROW_TYPE_LABELS: Record<RowType, string> = {
  set_up: "Set Up",
  warm_up: "Warm Up",
  game_briefing: "Game Briefing",
  game: "Game",
  game_changeover: "Game Changeover",
  skills_development: "Skills Development",
  pack_up: "Pack Up",
  custom: "Custom",
};

// Suggested defaults only — never treated as locked club rules. The
// organiser can always override them when adding or editing a row.
export const ROW_TYPE_DEFAULT_DURATION: Record<RowType, number | null> = {
  set_up: 10,
  warm_up: 10,
  game_briefing: 5,
  game: 20,
  game_changeover: 5,
  skills_development: 10,
  pack_up: 10,
  custom: null,
};

export const POOLS = ["Pool A", "Pool B"] as const;
export type Pool = (typeof POOLS)[number];
export function isPool(value: string): value is Pool {
  return (POOLS as readonly string[]).includes(value);
}
export function otherPool(pool: Pool): Pool {
  return pool === "Pool A" ? "Pool B" : "Pool A";
}

export function endMin(startMin: number | null, durationMin: number | null): number | null {
  if (startMin == null || durationMin == null) return null;
  return startMin + durationMin;
}

// Two intervals conflict only when both ends are known on both sides — a
// row with no time set yet simply can't be checked for overlap.
export function intervalsOverlap(
  aStart: number | null,
  aEnd: number | null,
  bStart: number | null,
  bEnd: number | null
): boolean {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function clockLabel(min: number | null): string {
  if (min == null) return "an unscheduled time";
  const base = new Date(2000, 0, 1, 18, 0, 0);
  base.setMinutes(base.getMinutes() + min);
  let hr = base.getHours();
  const m = base.getMinutes();
  const suffix = hr >= 12 ? "pm" : "am";
  hr = hr % 12 || 12;
  return hr + ":" + String(m).padStart(2, "0") + suffix;
}

export type TeamInfo = { id: number; name: string; playerIds: string[] };

export type PoolGameSnap = {
  id: number | null;
  pool: Pool;
  blackTeamId: number | null;
  whiteTeamId: number | null;
  refereeIds: string[];
};

export type RowSnap = {
  id: number;
  rowType: RowType;
  label: string;
  startMin: number | null;
  durationMin: number | null;
  archived: boolean;
  poolGames: PoolGameSnap[]; // only meaningful when rowType === "game"
};

function teamPlayerIds(teams: Record<number, TeamInfo>, teamId: number | null): Set<string> {
  if (teamId == null) return new Set();
  const t = teams[teamId];
  return t ? new Set(t.playerIds) : new Set();
}

function playersInPoolGame(teams: Record<number, TeamInfo>, pg: PoolGameSnap): Set<string> {
  const out = new Set<string>();
  teamPlayerIds(teams, pg.blackTeamId).forEach((id) => out.add(id));
  teamPlayerIds(teams, pg.whiteTeamId).forEach((id) => out.add(id));
  return out;
}

// Everyone playing in this row (either pool) — used because nobody can
// referee any part of a row they're also playing in.
function playersInRow(teams: Record<number, TeamInfo>, row: RowSnap): Set<string> {
  const out = new Set<string>();
  row.poolGames.forEach((pg) => playersInPoolGame(teams, pg).forEach((id) => out.add(id)));
  return out;
}

export type UnavailableReason =
  | "not_confirmed"
  | "playing_this_row"
  | "playing_overlapping_game"
  | "refereeing_other_pool"
  | "refereeing_overlapping_game";

export type UnavailablePerson = { memberId: string; reason: UnavailableReason; detail: string };

// Computes who's a legitimate referee choice for one pool game, and why
// everyone else confirmed for the night is excluded. Recalculated fresh
// every time from actual team rosters and actual time intervals — never
// from anything cached — so it's always correct after a team, time or
// duration change.
export function computeEligibility(
  targetRowId: number,
  targetPool: Pool,
  rows: RowSnap[],
  teams: Record<number, TeamInfo>,
  confirmedIds: Set<string>
): { eligibleIds: string[]; unavailable: UnavailablePerson[] } {
  const activeGameRows = rows.filter((r) => r.rowType === "game" && !r.archived);
  const targetRow = activeGameRows.find((r) => r.id === targetRowId);
  const targetPoolGame = targetRow ? targetRow.poolGames.find((pg) => pg.pool === targetPool) : undefined;
  const targetStart = targetRow ? targetRow.startMin : null;
  const targetEnd = targetRow ? endMin(targetRow.startMin, targetRow.durationMin) : null;
  const alreadyOnTarget = new Set(targetPoolGame ? targetPoolGame.refereeIds : []);

  const playingThisRow = targetRow ? playersInRow(teams, targetRow) : new Set<string>();

  const otherRows = activeGameRows.filter((r) => r.id !== targetRowId);
  const overlappingRows = targetRow
    ? otherRows.filter((r) => intervalsOverlap(targetStart, targetEnd, r.startMin, endMin(r.startMin, r.durationMin)))
    : [];

  const playingOverlap = new Set<string>();
  overlappingRows.forEach((r) => playersInRow(teams, r).forEach((id) => playingOverlap.add(id)));

  // Anyone already refereeing the sibling pool in this same row.
  const refereeingOtherPoolInRow = new Set<string>();
  if (targetRow) {
    targetRow.poolGames
      .filter((pg) => pg.pool !== targetPool)
      .forEach((pg) => pg.refereeIds.forEach((id) => refereeingOtherPoolInRow.add(id)));
  }

  // Anyone already refereeing any pool game in a different, overlapping row.
  const refereeingOverlapElsewhere = new Set<string>();
  overlappingRows.forEach((r) => r.poolGames.forEach((pg) => pg.refereeIds.forEach((id) => refereeingOverlapElsewhere.add(id))));
  // Also: the *other* pool game within this same overlapping-time row that
  // isn't the sibling of targetRow — already covered above since overlappingRows
  // excludes targetRowId and refereeingOtherPoolInRow handles the sibling pool.

  const eligibleIds: string[] = [];
  const unavailable: UnavailablePerson[] = [];

  confirmedIds.forEach((memberId) => {
    if (alreadyOnTarget.has(memberId)) return; // already chosen for this exact pool — not part of the picker list
    if (playingThisRow.has(memberId)) {
      unavailable.push({ memberId, reason: "playing_this_row", detail: "Playing in this game" });
      return;
    }
    if (playingOverlap.has(memberId)) {
      unavailable.push({ memberId, reason: "playing_overlapping_game", detail: "Playing in another game at an overlapping time" });
      return;
    }
    if (refereeingOtherPoolInRow.has(memberId)) {
      unavailable.push({ memberId, reason: "refereeing_other_pool", detail: "Already refereeing " + otherPool(targetPool) + " at the same time" });
      return;
    }
    if (refereeingOverlapElsewhere.has(memberId)) {
      unavailable.push({ memberId, reason: "refereeing_overlapping_game", detail: "Already refereeing another game at an overlapping time" });
      return;
    }
    eligibleIds.push(memberId);
  });

  // Confirmed attendees are the only pool this selector draws from; anyone
  // not confirmed at all doesn't appear in either list (they're simply not
  // in confirmedIds), matching "only confirmed attendees ... should appear".

  return { eligibleIds, unavailable };
}

export type ConflictReason = { reason: UnavailableReason; detail: string };

// Same exclusion logic as computeEligibility, but asking "is this *already
// assigned* referee still legitimate?" — used to flag a referee who became
// ineligible after a later change, rather than silently dropping them.
export function refereeConflict(
  memberId: string,
  targetRowId: number,
  targetPool: Pool,
  rows: RowSnap[],
  teams: Record<number, TeamInfo>,
  confirmedIds: Set<string>
): ConflictReason | null {
  if (!confirmedIds.has(memberId)) {
    return { reason: "not_confirmed", detail: "No longer confirmed as attending" };
  }
  const activeGameRows = rows.filter((r) => r.rowType === "game" && !r.archived);
  const targetRow = activeGameRows.find((r) => r.id === targetRowId);
  if (!targetRow) return null;

  if (playersInRow(teams, targetRow).has(memberId)) {
    return { reason: "playing_this_row", detail: "Playing in this game" };
  }

  const targetStart = targetRow.startMin;
  const targetEnd = endMin(targetRow.startMin, targetRow.durationMin);
  const overlappingRows = activeGameRows.filter(
    (r) => r.id !== targetRowId && intervalsOverlap(targetStart, targetEnd, r.startMin, endMin(r.startMin, r.durationMin))
  );
  for (const r of overlappingRows) {
    if (playersInRow(teams, r).has(memberId)) {
      return { reason: "playing_overlapping_game", detail: "Playing in another game at an overlapping time" };
    }
    for (const pg of r.poolGames) {
      if (pg.refereeIds.includes(memberId)) {
        return { reason: "refereeing_overlapping_game", detail: "Already refereeing another game at an overlapping time" };
      }
    }
  }

  const siblingPool = targetRow.poolGames.find((pg) => pg.pool !== targetPool);
  if (siblingPool && siblingPool.refereeIds.includes(memberId)) {
    return { reason: "refereeing_other_pool", detail: "Already refereeing " + otherPool(targetPool) + " at the same time" };
  }

  return null;
}

export type ValidationError = {
  rowId: number;
  pool: Pool | null;
  field: string;
  message: string;
};

// The single source of truth for "can this timetable be published right
// now?" — called both to show a live validation summary in the builder and
// to hard-block the publish action server-side.
export function validateTimetable(
  rows: RowSnap[],
  teams: Record<number, TeamInfo>,
  confirmedIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const activeRows = rows.filter((r) => !r.archived);

  // Per-row structural checks.
  activeRows.forEach((row) => {
    if (row.rowType === "custom" && !row.label.trim()) {
      errors.push({ rowId: row.id, pool: null, field: "label", message: "Custom row needs a label" });
    }
    if (row.durationMin != null && row.durationMin <= 0) {
      errors.push({ rowId: row.id, pool: null, field: "durationMin", message: "\"" + row.label + "\" needs a duration greater than zero" });
    }
    if (row.startMin != null && !Number.isFinite(row.startMin)) {
      errors.push({ rowId: row.id, pool: null, field: "startMin", message: "\"" + row.label + "\" has an invalid start time" });
    }

    if (row.rowType !== "game") return;

    const rowTeamUses: number[] = [];
    let hasCompleteMatchup = false;

    row.poolGames.forEach((pg) => {
      if (pg.blackTeamId != null) rowTeamUses.push(pg.blackTeamId);
      if (pg.whiteTeamId != null) rowTeamUses.push(pg.whiteTeamId);

      if (pg.blackTeamId != null && pg.whiteTeamId != null) {
        hasCompleteMatchup = true;
        if (pg.blackTeamId === pg.whiteTeamId) {
          const name = teams[pg.blackTeamId] ? teams[pg.blackTeamId].name : "That team";
          errors.push({ rowId: row.id, pool: pg.pool, field: "teams", message: name + " can't play both sides of " + pg.pool + " in \"" + row.label + "\"" });
        }
      } else if (pg.blackTeamId != null || pg.whiteTeamId != null) {
        errors.push({
          rowId: row.id,
          pool: pg.pool,
          field: "teams",
          message: pg.pool + " in \"" + row.label + "\" has only one team assigned — add the other team or clear it",
        });
      }
    });

    if (row.poolGames.length > 0 && !hasCompleteMatchup) {
      errors.push({ rowId: row.id, pool: null, field: "teams", message: "\"" + row.label + "\" has no complete matchup in either pool" });
    } else if (row.poolGames.length === 0) {
      errors.push({ rowId: row.id, pool: null, field: "teams", message: "\"" + row.label + "\" has no teams assigned to either pool" });
    }

    const seen = new Set<number>();
    rowTeamUses.forEach((teamId) => {
      if (seen.has(teamId)) {
        const name = teams[teamId] ? teams[teamId].name : "A team";
        errors.push({ rowId: row.id, pool: null, field: "teams", message: name + " is assigned twice within \"" + row.label + "\"" });
      }
      seen.add(teamId);
    });
  });

  // Cross-row team overlap: every team's playing intervals must not overlap.
  const activeGameRows = activeRows.filter((r) => r.rowType === "game");
  const appearances: { teamId: number; row: RowSnap; pool: Pool }[] = [];
  activeGameRows.forEach((row) => {
    row.poolGames.forEach((pg) => {
      [pg.blackTeamId, pg.whiteTeamId].forEach((teamId) => {
        if (teamId != null) appearances.push({ teamId, row, pool: pg.pool });
      });
    });
  });
  for (let i = 0; i < appearances.length; i++) {
    for (let j = i + 1; j < appearances.length; j++) {
      const a = appearances[i];
      const b = appearances[j];
      if (a.teamId !== b.teamId) continue;
      if (a.row.id === b.row.id) continue; // same-row duplicate already reported above
      const overlap = intervalsOverlap(a.row.startMin, endMin(a.row.startMin, a.row.durationMin), b.row.startMin, endMin(b.row.startMin, b.row.durationMin));
      if (overlap) {
        const name = teams[a.teamId] ? teams[a.teamId].name : "A team";
        errors.push({
          rowId: a.row.id,
          pool: a.pool,
          field: "team_conflict",
          message:
            name + " is scheduled in " + a.pool + " at " + clockLabel(a.row.startMin) + " and also in " + b.pool + " at " + clockLabel(b.row.startMin) + " — those overlap",
        });
      }
    }
  }

  // Referee conflicts: any currently-assigned referee who is no longer a
  // legitimate choice blocks publication until the organiser replaces them.
  activeGameRows.forEach((row) => {
    row.poolGames.forEach((pg) => {
      pg.refereeIds.forEach((memberId) => {
        const conflict = refereeConflict(memberId, row.id, pg.pool, rows, teams, confirmedIds);
        if (conflict) {
          errors.push({ rowId: row.id, pool: pg.pool, field: "referee_conflict", message: conflict.detail + " (" + pg.pool + " in \"" + row.label + "\")" });
        }
      });
    });
  });

  return errors;
}

// Suggests a start time for a new row placed after `previous`, so the
// organiser doesn't have to compute it by hand — always overridable.
export function suggestNextStart(previous: { startMin: number | null; durationMin: number | null } | null): number | null {
  if (!previous) return null;
  return endMin(previous.startMin, previous.durationMin);
}
