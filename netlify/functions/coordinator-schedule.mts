// Game Coordinator timetable builder — a timetable-first builder: the
// organiser adds ordered rows (non-game activities like Set Up/Warm Up/Pack
// Up/Custom, or Game rows), then drags teams from the Teams tab into up to
// four slots per Game row (Pool A black/white, Pool B black/white), because
// Pool A and Pool B can run simultaneously. Referees are assigned per pool
// game, and eligibility (who's allowed to referee what) is recalculated
// fresh on every read from actual team rosters and actual time intervals —
// see _shared/timetable.mts for that logic.
//
// GET  /api/coordinator/schedule
//   -> { ok, sessionDate, teams, rows, rowTypes, validation }
//
// POST /api/coordinator/schedule { action, ... }
//   add_row          { rowType, label, startMin, durationMin, notes }
//   update_row       { rowId, rowType?, label, startMin, durationMin, notes }
//   duplicate_row    { rowId }
//   remove_row       { rowId }              -- only if never published
//   archive_row      { rowId }              -- soft-hide a published row
//   unarchive_row    { rowId }
//   reorder_rows     { orderedIds: number[] } -- full new order of active rows
//   assign_team      { rowId, pool, slot: "black"|"white", teamId | null }
//   swap_teams       { rowId, poolA, slotA, poolB, slotB }
//   clear_row_teams  { rowId }
//   assign_referee   { rowId, pool, memberId }
//   unassign_referee { rowId, pool, memberId }
//
// Publishing itself stays on the existing session-level toggle in
// coordinator-teams.mts (POST { action: "publish" }) — that action now also
// runs validateTimetable() from _shared/timetable.mts and refuses to
// publish while blocking errors remain, and stamps published_at on every
// active row/pool the first time it goes out, so "remove" vs "archive"
// know whether a row has ever been public.
//
// Requires 'game_coordinator' or 'administrator'.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";
import {
  ROW_TYPES,
  isRowType,
  ROW_TYPE_LABELS,
  ROW_TYPE_DEFAULT_DURATION,
  POOLS,
  isPool,
  computeEligibility,
  validateTimetable,
  type RowSnap,
  type PoolGameSnap,
  type TeamInfo,
} from "./_shared/timetable.mts";

function nextWednesdayISO(): string {
  const d = new Date();
  const day = d.getDay();
  let add = (3 - day + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function shapePlayer(r: any) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, isNew: r.is_new };
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

// Loads everything about a session needed to both answer the GET and
// validate/compute eligibility, in one place so POST handlers and the final
// response build from the exact same snapshot.
async function loadSnapshot(db: any, sessionId: number) {
  const teamRows = await db.sql`select id, name from game_teams where session_id = ${sessionId} order by created_at asc`;
  const assignmentRows = await db.sql`
    select ta.team_id, m.id, m.first_name, m.last_name, m.grade
    from team_assignments ta join members m on m.id = ta.member_id
    where ta.session_id = ${sessionId}
  `;
  const teamPlayers: Record<number, { id: string; firstName: string; lastName: string; grade: string | null }[]> = {};
  assignmentRows.forEach((r: any) => {
    if (!teamPlayers[r.team_id]) teamPlayers[r.team_id] = [];
    teamPlayers[r.team_id].push({ id: r.id, firstName: r.first_name, lastName: r.last_name, grade: r.grade });
  });

  const teams: Record<number, TeamInfo> = {};
  const teamMeta: Record<number, { id: number; name: string; playerCount: number; gradeCounts: { grade: string; count: number }[]; ungraded: number }> = {};
  teamRows.forEach((t: any) => {
    const players = teamPlayers[t.id] || [];
    teams[t.id] = { id: t.id, name: t.name, playerIds: players.map((p) => p.id) };
    // A count per grade (not just which grades are present) so the
    // coordinator can actually see whether a team is balanced — e.g. "2 A,
    // 1 B" rather than just "A/B".
    const counts: Record<string, number> = {};
    let ungraded = 0;
    players.forEach((p) => {
      if (p.grade) counts[p.grade] = (counts[p.grade] || 0) + 1;
      else ungraded++;
    });
    teamMeta[t.id] = {
      id: t.id,
      name: t.name,
      playerCount: players.length,
      gradeCounts: Object.keys(counts).sort().map((grade) => ({ grade, count: counts[grade] })),
      ungraded,
    };
  });

  const confirmedRows = await db.sql`
    select m.id, m.first_name, m.last_name, m.is_new
    from bookings b join members m on m.id = b.member_id
    where b.session_id = ${sessionId} and b.status = 'in'
  `;
  const confirmedIds = new Set<string>(confirmedRows.map((r: any) => r.id));
  const memberNames: Record<string, { firstName: string; lastName: string; isNew: boolean }> = {};
  confirmedRows.forEach((r: any) => {
    memberNames[r.id] = { firstName: r.first_name, lastName: r.last_name, isNew: r.is_new };
  });

  const rowRows = await db.sql`
    select id, row_order, row_type, label, start_min, duration_min, notes, published_at, archived_at,
           created_by, updated_by, created_at, updated_at
    from timetable_rows where session_id = ${sessionId} order by row_order asc, id asc
  `;
  const rowIds = rowRows.map((r: any) => r.id);
  const poolGameRows = rowIds.length
    ? await db.sql`select id, row_id, pool, black_team_id, white_team_id from timetable_pool_games where row_id = any(${rowIds})`
    : [];
  const poolGameIds = poolGameRows.map((r: any) => r.id);
  const refRows = poolGameIds.length
    ? await db.sql`
        select tpr.pool_game_id, m.id, m.first_name, m.last_name
        from timetable_pool_referees tpr join members m on m.id = tpr.member_id
        where tpr.pool_game_id = any(${poolGameIds})
      `
    : [];

  const refsByPoolGame: Record<number, { id: string; firstName: string; lastName: string }[]> = {};
  refRows.forEach((r: any) => {
    if (!refsByPoolGame[r.pool_game_id]) refsByPoolGame[r.pool_game_id] = [];
    refsByPoolGame[r.pool_game_id].push({ id: r.id, firstName: r.first_name, lastName: r.last_name });
  });

  const poolGamesByRow: Record<number, any[]> = {};
  poolGameRows.forEach((pg: any) => {
    if (!poolGamesByRow[pg.row_id]) poolGamesByRow[pg.row_id] = [];
    poolGamesByRow[pg.row_id].push(pg);
  });

  // "Refereed already tonight" — a light nice-to-have for the selector.
  const refereedTonightCount: Record<string, number> = {};
  refRows.forEach((r: any) => {
    refereedTonightCount[r.id] = (refereedTonightCount[r.id] || 0) + 1;
  });

  return { teamRows, teams, teamMeta, confirmedIds, memberNames, rowRows, poolGamesByRow, refsByPoolGame, refereedTonightCount };
}

// Builds the RowSnap[] the pure logic module needs (ids only) from the raw
// snapshot — used for both validation and per-pool eligibility.
function toRowSnaps(rowRows: any[], poolGamesByRow: Record<number, any[]>, refsByPoolGame: Record<number, any[]>): RowSnap[] {
  return rowRows.map((r: any) => {
    const pgs: any[] = poolGamesByRow[r.id] || [];
    const poolGames: PoolGameSnap[] = pgs.map((pg: any) => ({
      id: pg.id,
      pool: pg.pool,
      blackTeamId: pg.black_team_id,
      whiteTeamId: pg.white_team_id,
      refereeIds: (refsByPoolGame[pg.id] || []).map((x: any) => x.id),
    }));
    return {
      id: r.id,
      rowType: r.row_type,
      label: r.label,
      startMin: r.start_min,
      durationMin: r.duration_min,
      archived: !!r.archived_at,
      poolGames,
    };
  });
}

async function ensurePoolGamesExist(db: any, rowId: number) {
  for (const pool of POOLS) {
    await db.sql`
      insert into timetable_pool_games (row_id, pool) values (${rowId}, ${pool})
      on conflict (row_id, pool) do nothing
    `;
  }
}

async function touchRow(db: any, rowId: number, sessionId: number, callerId: string) {
  await db.sql`update timetable_rows set updated_by = ${callerId}, updated_at = now() where id = ${rowId} and session_id = ${sessionId}`;
}

// Auto-orders the timetable by start time — a row with a known time sorts
// itself into the right place (nulls last) the moment it's added or its
// time changes, so the coordinator doesn't have to drag a new game into
// position. Rows sharing a time (or with no time at all) keep their
// existing relative order as a tiebreak, which is exactly what a manual
// drag-reorder (reorder_rows) is still for.
async function resequenceRows(db: any, sessionId: number) {
  await db.sql`
    with ranked as (
      select id, row_number() over (
        order by start_min nulls last, row_order asc, id asc
      ) as rn
      from timetable_rows
      where session_id = ${sessionId} and archived_at is null
    )
    update timetable_rows t set row_order = ranked.rn
    from ranked where ranked.id = t.id
  `;
}

async function buildResponse(db: any, sessionId: number, sessionDate: string) {
  const snap = await loadSnapshot(db, sessionId);
  const rowSnaps = toRowSnaps(snap.rowRows, snap.poolGamesByRow, snap.refsByPoolGame);
  const validation = validateTimetable(rowSnaps, snap.teams, snap.confirmedIds);

  const seasonYear = new Date(sessionDate + "T00:00:00").getFullYear();
  // Season referee counts — one lightweight aggregate, not attempted per-row.
  const seasonRows = await db.sql`
    select tpr.member_id, count(*)::int as cnt
    from timetable_pool_referees tpr
    join timetable_pool_games tpg on tpg.id = tpr.pool_game_id
    join timetable_rows tr on tr.id = tpg.row_id
    join sessions s on s.id = tr.session_id
    where extract(year from s.session_date) = ${seasonYear}
    group by tpr.member_id
  `;
  const seasonCounts: Record<string, number> = {};
  seasonRows.forEach((r: any) => { seasonCounts[r.member_id] = r.cnt; });

  const teamsPanel = Object.values(snap.teamMeta);

  const rows = snap.rowRows.map((r: any) => {
    const pgs = snap.poolGamesByRow[r.id] || [];
    const poolGames = POOLS.map((pool) => {
      const pg = pgs.find((x: any) => x.pool === pool);
      const referees = pg ? (snap.refsByPoolGame[pg.id] || []) : [];
      let eligible: any[] = [];
      let unavailable: any[] = [];
      if (r.row_type === "game" && !r.archived_at) {
        const elig = computeEligibility(r.id, pool, rowSnaps, snap.teams, snap.confirmedIds);
        eligible = elig.eligibleIds.map((id) => {
          const m = snap.memberNames[id] || { firstName: "?", lastName: "", isNew: false };
          return {
            id,
            firstName: m.firstName,
            lastName: m.lastName,
            isNew: m.isNew,
            refereedTonight: snap.refereedTonightCount[id] || 0,
            seasonCount: seasonCounts[id] || 0,
          };
        });
        unavailable = elig.unavailable.map((u) => {
          const m = snap.memberNames[u.memberId] || { firstName: "Unknown", lastName: "", isNew: false };
          return { id: u.memberId, firstName: m.firstName, lastName: m.lastName, reason: u.reason, detail: u.detail };
        });
      }
      return {
        pool,
        black: pg && pg.black_team_id != null ? { id: pg.black_team_id, name: (snap.teams[pg.black_team_id] || {}).name || "Unknown team" } : null,
        white: pg && pg.white_team_id != null ? { id: pg.white_team_id, name: (snap.teams[pg.white_team_id] || {}).name || "Unknown team" } : null,
        referees,
        eligible,
        unavailable,
      };
    });

    return {
      id: r.id,
      order: r.row_order,
      rowType: r.row_type,
      rowTypeLabel: ROW_TYPE_LABELS[r.row_type as keyof typeof ROW_TYPE_LABELS] || r.row_type,
      label: r.label,
      startMin: r.start_min,
      durationMin: r.duration_min,
      notes: r.notes,
      published: !!r.published_at,
      archived: !!r.archived_at,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      poolGames,
    };
  });

  return {
    ok: true,
    sessionDate,
    rowTypes: ROW_TYPES.map((rt) => ({ value: rt, label: ROW_TYPE_LABELS[rt], defaultDurationMin: ROW_TYPE_DEFAULT_DURATION[rt] })),
    teams: teamsPanel,
    rows: rows.filter((r: any) => !r.archived),
    archivedRows: rows.filter((r: any) => r.archived),
    validation,
  };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  if (!hasPermission(caller.roles, "arrange_teams")) {
    return forbidden("Only Game Coordinators and Administrators can arrange the timetable");
  }

  try {
    const sessionDate = nextWednesdayISO();
    const [session] = await db.sql`
      insert into sessions (session_date)
      values (${sessionDate})
      on conflict (session_date) do update set session_date = excluded.session_date
      returning id, published
    `;
    const sessionId = session.id;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");
      const MUTATING_ACTIONS = [
        "add_row", "update_row", "duplicate_row", "remove_row", "archive_row", "unarchive_row",
        "reorder_rows", "assign_team", "swap_teams", "clear_row_teams", "assign_referee", "unassign_referee",
      ];

      if (action === "add_row") {
        const rowType = String(body.rowType || "");
        if (!isRowType(rowType)) return badRequest("Unknown row type");
        const label = String(body.label || "").trim() || ROW_TYPE_LABELS[rowType];
        if (rowType === "custom" && !String(body.label || "").trim()) return badRequest("Custom rows need a label");
        const startMin = body.startMin === "" || body.startMin == null ? null : Number(body.startMin);
        const durationMin = body.durationMin === "" || body.durationMin == null ? null : Number(body.durationMin);
        const notes = body.notes ? String(body.notes).trim() || null : null;

        const [{ next }] = await db.sql`
          select coalesce(max(row_order), 0) + 1 as next from timetable_rows where session_id = ${sessionId} and archived_at is null
        `;
        const [row] = await db.sql`
          insert into timetable_rows (session_id, row_order, row_type, label, start_min, duration_min, notes, created_by, updated_by)
          values (${sessionId}, ${next}, ${rowType}, ${label}, ${startMin}, ${durationMin}, ${notes}, ${caller.id}, ${caller.id})
          returning id
        `;
        if (rowType === "game") await ensurePoolGamesExist(db, row.id);
        await resequenceRows(db, sessionId);

        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_added",
          resourceType: "timetable_row", resourceId: String(row.id),
          newValue: { sessionDate, rowType, label, startMin, durationMin }, note: `${caller.email} added "${label}" to the timetable`,
        });
      } else if (action === "update_row") {
        const rowId = Number(body.rowId);
        if (!rowId) return badRequest("Missing rowId");
        const [existing] = await db.sql`select * from timetable_rows where id = ${rowId} and session_id = ${sessionId}`;
        if (!existing) return badRequest("That row isn't part of this session");

        const rowType = body.rowType !== undefined ? String(body.rowType) : existing.row_type;
        if (!isRowType(rowType)) return badRequest("Unknown row type");
        const label = String(body.label !== undefined ? body.label : existing.label).trim() || ROW_TYPE_LABELS[rowType as keyof typeof ROW_TYPE_LABELS];
        if (rowType === "custom" && !label) return badRequest("Custom rows need a label");
        const startMin = body.startMin === undefined ? existing.start_min : body.startMin === "" || body.startMin == null ? null : Number(body.startMin);
        const durationMin = body.durationMin === undefined ? existing.duration_min : body.durationMin === "" || body.durationMin == null ? null : Number(body.durationMin);
        const notes = body.notes === undefined ? existing.notes : String(body.notes || "").trim() || null;

        await db.sql`
          update timetable_rows set row_type = ${rowType}, label = ${label}, start_min = ${startMin}, duration_min = ${durationMin},
            notes = ${notes}, updated_by = ${caller.id}, updated_at = now()
          where id = ${rowId} and session_id = ${sessionId}
        `;
        if (rowType === "game") await ensurePoolGamesExist(db, rowId);
        await resequenceRows(db, sessionId);

        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_edited",
          resourceType: "timetable_row", resourceId: String(rowId),
          previousValue: { label: existing.label, startMin: existing.start_min, durationMin: existing.duration_min, rowType: existing.row_type },
          newValue: { label, startMin, durationMin, rowType }, note: `${caller.email} edited a timetable row`,
        });
      } else if (action === "duplicate_row") {
        const rowId = Number(body.rowId);
        const [existing] = await db.sql`select * from timetable_rows where id = ${rowId} and session_id = ${sessionId}`;
        if (!existing) return badRequest("That row isn't part of this session");

        await db.sql`
          update timetable_rows set row_order = row_order + 1
          where session_id = ${sessionId} and archived_at is null and row_order > ${existing.row_order}
        `;
        const [copy] = await db.sql`
          insert into timetable_rows (session_id, row_order, row_type, label, start_min, duration_min, notes, created_by, updated_by)
          values (${sessionId}, ${existing.row_order + 1}, ${existing.row_type}, ${existing.label + " (copy)"}, ${existing.start_min}, ${existing.duration_min}, ${existing.notes}, ${caller.id}, ${caller.id})
          returning id
        `;
        if (existing.row_type === "game") {
          await ensurePoolGamesExist(db, copy.id);
          const sourcePGs = await db.sql`select * from timetable_pool_games where row_id = ${rowId}`;
          for (const pg of sourcePGs) {
            await db.sql`
              update timetable_pool_games set black_team_id = ${pg.black_team_id}, white_team_id = ${pg.white_team_id}
              where row_id = ${copy.id} and pool = ${pg.pool}
            `;
            const [newPg] = await db.sql`select id from timetable_pool_games where row_id = ${copy.id} and pool = ${pg.pool}`;
            const refs = await db.sql`select member_id from timetable_pool_referees where pool_game_id = ${pg.id}`;
            for (const ref of refs) {
              await db.sql`insert into timetable_pool_referees (pool_game_id, member_id) values (${newPg.id}, ${ref.member_id}) on conflict do nothing`;
            }
          }
        }
        await resequenceRows(db, sessionId);
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_added",
          resourceType: "timetable_row", resourceId: String(copy.id),
          newValue: { sessionDate, duplicatedFrom: rowId }, note: `${caller.email} duplicated a timetable row`,
        });
      } else if (action === "remove_row") {
        const rowId = Number(body.rowId);
        const [existing] = await db.sql`select * from timetable_rows where id = ${rowId} and session_id = ${sessionId}`;
        if (!existing) return badRequest("That row isn't part of this session");
        if (existing.published_at) {
          return badRequest("This row has already been published — archive it instead of removing it.");
        }
        await db.sql`delete from timetable_rows where id = ${rowId} and session_id = ${sessionId}`;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_removed",
          resourceType: "timetable_row", resourceId: String(rowId),
          previousValue: { label: existing.label }, note: `${caller.email} removed a timetable row`,
        });
      } else if (action === "archive_row") {
        const rowId = Number(body.rowId);
        await db.sql`update timetable_rows set archived_at = now(), updated_by = ${caller.id}, updated_at = now() where id = ${rowId} and session_id = ${sessionId}`;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_archived",
          resourceType: "timetable_row", resourceId: String(rowId), note: `${caller.email} archived a timetable row`,
        });
      } else if (action === "unarchive_row") {
        const rowId = Number(body.rowId);
        const [{ next }] = await db.sql`
          select coalesce(max(row_order), 0) + 1 as next from timetable_rows where session_id = ${sessionId} and archived_at is null
        `;
        await db.sql`update timetable_rows set archived_at = null, row_order = ${next}, updated_by = ${caller.id}, updated_at = now() where id = ${rowId} and session_id = ${sessionId}`;
        await resequenceRows(db, sessionId);
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_edited",
          resourceType: "timetable_row", resourceId: String(rowId), note: `${caller.email} restored an archived timetable row`,
        });
      } else if (action === "reorder_rows") {
        const orderedIds: number[] = Array.isArray(body.orderedIds) ? body.orderedIds.map(Number) : [];
        for (let i = 0; i < orderedIds.length; i++) {
          await db.sql`update timetable_rows set row_order = ${i + 1} where id = ${orderedIds[i]} and session_id = ${sessionId} and archived_at is null`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_row_reordered",
          resourceType: "timetable_row", resourceId: null,
          newValue: { sessionDate, order: orderedIds }, note: `${caller.email} reordered the timetable`,
        });
      } else if (action === "assign_team") {
        const rowId = Number(body.rowId);
        const pool = String(body.pool || "");
        const slot = String(body.slot || "");
        if (!isPool(pool)) return badRequest("Unknown pool");
        if (slot !== "black" && slot !== "white") return badRequest("Unknown slot");
        const teamId = body.teamId === "" || body.teamId == null ? null : Number(body.teamId);

        const [row] = await db.sql`select id from timetable_rows where id = ${rowId} and session_id = ${sessionId} and row_type = 'game'`;
        if (!row) return badRequest("That isn't a Game row in this session");
        if (teamId != null) {
          const [team] = await db.sql`select id from game_teams where id = ${teamId} and session_id = ${sessionId}`;
          if (!team) return badRequest("That team doesn't exist for this session");
        }
        await ensurePoolGamesExist(db, rowId);
        if (slot === "black") {
          await db.sql`update timetable_pool_games set black_team_id = ${teamId} where row_id = ${rowId} and pool = ${pool}`;
        } else {
          await db.sql`update timetable_pool_games set white_team_id = ${teamId} where row_id = ${rowId} and pool = ${pool}`;
        }
        await touchRow(db, rowId, sessionId, caller.id);
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: teamId == null ? "timetable_team_removed" : "timetable_team_assigned",
          resourceType: "timetable_row", resourceId: String(rowId),
          newValue: { pool, slot, teamId }, note: `${caller.email} ${teamId == null ? "cleared" : "set"} the ${slot} team for ${pool}`,
        });
      } else if (action === "swap_teams") {
        const rowId = Number(body.rowId);
        const poolA = String(body.poolA || ""), slotA = String(body.slotA || "");
        const poolB = String(body.poolB || ""), slotB = String(body.slotB || "");
        if (!isPool(poolA) || !isPool(poolB) || !["black", "white"].includes(slotA) || !["black", "white"].includes(slotB)) {
          return badRequest("Invalid swap request");
        }
        const [swapRow] = await db.sql`select id from timetable_rows where id = ${rowId} and session_id = ${sessionId} and row_type = 'game'`;
        if (!swapRow) return badRequest("That isn't a Game row in this session");
        await ensurePoolGamesExist(db, rowId);
        const [pgA] = await db.sql`select black_team_id, white_team_id from timetable_pool_games where row_id = ${rowId} and pool = ${poolA}`;
        const [pgB] = await db.sql`select black_team_id, white_team_id from timetable_pool_games where row_id = ${rowId} and pool = ${poolB}`;
        const aVal = slotA === "black" ? pgA.black_team_id : pgA.white_team_id;
        const bVal = slotB === "black" ? pgB.black_team_id : pgB.white_team_id;
        const setCol = (pool: string, slot: string, value: number | null) =>
          slot === "black"
            ? db.sql`update timetable_pool_games set black_team_id = ${value} where row_id = ${rowId} and pool = ${pool}`
            : db.sql`update timetable_pool_games set white_team_id = ${value} where row_id = ${rowId} and pool = ${pool}`;
        await setCol(poolA, slotA, bVal);
        await setCol(poolB, slotB, aVal);
        await touchRow(db, rowId, sessionId, caller.id);
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_team_assigned",
          resourceType: "timetable_row", resourceId: String(rowId),
          newValue: { swapped: [{ poolA, slotA }, { poolB, slotB }] }, note: `${caller.email} swapped two team slots`,
        });
      } else if (action === "clear_row_teams") {
        const rowId = Number(body.rowId);
        const [clearRow] = await db.sql`select id from timetable_rows where id = ${rowId} and session_id = ${sessionId} and row_type = 'game'`;
        if (!clearRow) return badRequest("That isn't a Game row in this session");
        await db.sql`update timetable_pool_games set black_team_id = null, white_team_id = null where row_id = ${rowId}`;
        await touchRow(db, rowId, sessionId, caller.id);
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "timetable_team_removed",
          resourceType: "timetable_row", resourceId: String(rowId), note: `${caller.email} cleared all team assignments from a row`,
        });
      } else if (action === "assign_referee" || action === "unassign_referee") {
        const rowId = Number(body.rowId);
        const pool = String(body.pool || "");
        const memberId = String(body.memberId || "").trim();
        if (!isPool(pool)) return badRequest("Unknown pool");

        const [row] = await db.sql`select id from timetable_rows where id = ${rowId} and session_id = ${sessionId} and row_type = 'game'`;
        if (!row) return badRequest("That isn't a Game row in this session");
        await ensurePoolGamesExist(db, rowId);
        const [pg] = await db.sql`select id from timetable_pool_games where row_id = ${rowId} and pool = ${pool}`;

        if (action === "assign_referee") {
          const [target] = await db.sql`select id, email from members where id = ${memberId}`;
          if (!target) return badRequest("No such member");

          const snap = await loadSnapshot(db, sessionId);
          const rowSnaps = toRowSnaps(snap.rowRows, snap.poolGamesByRow, snap.refsByPoolGame);
          const { eligibleIds } = computeEligibility(rowId, pool as any, rowSnaps, snap.teams, snap.confirmedIds);
          if (!eligibleIds.includes(memberId)) {
            return badRequest("That person isn't eligible to referee this game right now — they may be playing or already refereeing an overlapping game.");
          }
          await db.sql`insert into timetable_pool_referees (pool_game_id, member_id) values (${pg.id}, ${memberId}) on conflict do nothing`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "referee_assigned",
            resourceType: "timetable_row", resourceId: String(rowId),
            newValue: { pool, memberId }, note: `${caller.email} added ${target.email} as a referee for ${pool}`,
          });
        } else {
          await db.sql`delete from timetable_pool_referees where pool_game_id = ${pg.id} and member_id = ${memberId}`;
          await logAudit(db, {
            actorId: caller.id, actorEmail: caller.email, action: "referee_removed",
            resourceType: "timetable_row", resourceId: String(rowId),
            newValue: { pool, memberId }, note: `${caller.email} removed a referee from ${pool}`,
          });
        }
      }

      // The timetable is part of what "the board is published" covers
      // (see coordinator-teams.mts). If members can already see it live,
      // any structural change here is a change to a published timetable,
      // not just a draft edit — worth its own audit trail entry.
      if (MUTATING_ACTIONS.includes(action) && session.published) {
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "published_timetable_changed",
          resourceType: "session", resourceId: String(sessionId),
          newValue: { sessionDate, action }, note: `${caller.email} changed the already-published timetable for ${sessionDate}`,
        });
      }
    }

    return new Response(JSON.stringify(await buildResponse(db, sessionId, sessionDate)), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/coordinator/schedule",
};
