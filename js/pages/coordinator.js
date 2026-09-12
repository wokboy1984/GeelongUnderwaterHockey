// ---------------------------------------------------------------------------
// Game Coordination workspace (live site, real backend) — for members with
// the game_coordinator or administrator role. Four tabs, wired to real data:
// Attendance, Teams, Timetable, Publish.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const GRADES = ["A", "B", "Casual", "Junior"];

  const TABS = [
    { key: "attendance", label: "Attendance", path: "/coordinator" },
    { key: "teams", label: "Teams", path: "/coordinator/teams" },
    { key: "schedule", label: "Timetable", path: "/coordinator/schedule" },
    { key: "publish", label: "Publish", path: "/coordinator/publish" },
  ];

  function CoordinatorTabs({ active }) {
    return h(
      "div",
      { className: "flex flex-wrap gap-2 mb-8 border-b border-black/10" },
      TABS.map((t) =>
        h(
          "button",
          {
            key: t.key,
            onClick: () => navigate(t.path),
            className: cx(
              "px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition",
              active === t.key ? "border-[var(--accent)] text-[var(--accent-dark)]" : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            ),
          },
          t.label
        )
      )
    );
  }

  // ---------------------------------------------------------------- Attendance
  function AttendanceTab() {
    const [sessionDate, setSessionDate] = React.useState(null);
    const [players, setPlayers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [addEmail, setAddEmail] = React.useState("");

    function load() {
      setLoading(true);
      setError(null);
      return GUWH.Identity.authFetch("/api/coordinator/attendance")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) { setSessionDate(data.sessionDate); setPlayers(data.players); }
          else setError(data.error || "Something went wrong");
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { load(); }, []);

    async function setAttendance(memberEmail, isIn) {
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/coordinator/attendance", { method: "POST", body: JSON.stringify({ memberEmail, in: isIn }) });
        const data = await res.json();
        if (data.ok) { setSessionDate(data.sessionDate); setPlayers(data.players); if (isIn) setAddEmail(""); }
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    async function setGrade(memberEmail, grade) {
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/coordinator/attendance", { method: "POST", body: JSON.stringify({ memberEmail, grade }) });
        const data = await res.json();
        if (data.ok) { setSessionDate(data.sessionDate); setPlayers(data.players); }
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    function addByEmail(ev) {
      ev.preventDefault();
      if (!addEmail.trim()) return;
      setAttendance(addEmail.trim(), true);
    }

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      sessionDate && h(Pill, { tone: "accent" }, GUWH.formatDate(new Date(sessionDate + "T00:00:00"))),
      h(
        "form",
        { onSubmit: addByEmail, className: "mt-6 rounded-2xl bg-white ring-1 ring-black/5 p-5 flex gap-3 items-end" },
        h(FormField, { label: "Add a member by email" }, h("input", { className: inputCls, value: addEmail, onChange: (e) => setAddEmail(e.target.value), placeholder: "name@example.com" })),
        h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Add as confirmed")
      ),
      h(
        "div",
        { className: "mt-8" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Confirmed (" + players.length + ")"),
        loading
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
          : players.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nobody's confirmed yet.")
          : h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] divide-y divide-black/5" },
              players.map((p) =>
                h(
                  "div",
                  { key: p.id, className: "flex items-center justify-between px-5 py-3 gap-3" },
                  h(
                    "div",
                    null,
                    h("p", { className: "text-sm font-semibold text-[var(--ink)] flex items-center gap-2" }, p.firstName + " " + p.lastName, p.isNew && h(Pill, { tone: "accent" }, "New")),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, p.email)
                  ),
                  h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h(
                      "select",
                      { className: inputCls + " !w-auto !py-1.5 text-xs", value: p.grade || "", onChange: (e) => setGrade(p.email, e.target.value), title: "Grade" },
                      h("option", { value: "" }, "No grade"),
                      GRADES.map((g) => h("option", { key: g, value: g }, g))
                    ),
                    h(Button, { size: "sm", variant: "ghost", onClick: () => setAttendance(p.email, false) }, "Cancel")
                  )
                )
              )
            )
      )
    );
  }

  // ---------------------------------------------------------------- Teams
  function PlayerRow({ player, action }) {
    return h(
      "div",
      { className: "flex items-center justify-between bg-white rounded-xl px-3 py-2" },
      h("span", { className: "text-sm text-[var(--ink)]" }, player.firstName + " " + player.lastName, player.isNew && h(Pill, { tone: "accent", className: "ml-2 !py-0.5 !px-2 !text-[10px]" }, "New")),
      action
    );
  }

  function TeamsTab() {
    const [board, setBoard] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [assignTo, setAssignTo] = React.useState({}); // memberId -> teamId
    const [newTeamName, setNewTeamName] = React.useState("");
    const [renaming, setRenaming] = React.useState({}); // teamId -> draft name

    function load() {
      setLoading(true);
      setError(null);
      return GUWH.Identity.authFetch("/api/coordinator/teams")
        .then((r) => r.json())
        .then((data) => (data.ok ? setBoard(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { load(); }, []);

    async function call(body) {
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/coordinator/teams", { method: "POST", body: JSON.stringify(body) });
        const data = await res.json();
        if (data.ok) setBoard(data);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    function createTeam(ev) {
      ev.preventDefault();
      if (!newTeamName.trim()) return;
      call({ action: "create_team", name: newTeamName.trim() });
      setNewTeamName("");
    }

    function renameTeam(teamId) {
      const name = (renaming[teamId] || "").trim();
      if (!name) return;
      call({ action: "rename_team", teamId, name });
      setRenaming((prev) => Object.assign({}, prev, { [teamId]: undefined }));
    }

    function assign(player) {
      const teamId = assignTo[player.id] || (board.teams[0] && board.teams[0].id);
      if (!teamId) return;
      call({ action: "assign", memberEmail: player.email, teamId: Number(teamId) });
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!board) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      h("p", { className: "text-sm text-[var(--ink-soft)] max-w-md mb-6" }, "Create as many teams as you need for the night, assign confirmed players to them, then build the timetable in the next tab. Nothing here is visible to players until you publish."),

      h(
        "form",
        { onSubmit: createTeam, className: "flex gap-3 items-end mb-6" },
        h(FormField, { label: "New team name" }, h("input", { className: inputCls, value: newTeamName, onChange: (e) => setNewTeamName(e.target.value), placeholder: "e.g. Freedivers" })),
        h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Add team")
      ),

      board.unassigned.length > 0 &&
        h(
          "div",
          { className: "rounded-2xl bg-[var(--warn-10)] p-5 mb-6" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Unassigned (" + board.unassigned.length + ")"),
          board.teams.length === 0
            ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Create a team above before assigning players.")
            : h(
                "div",
                { className: "flex flex-col gap-2" },
                board.unassigned.map((p) =>
                  h(PlayerRow, {
                    key: p.id,
                    player: p,
                    action: h(
                      "div",
                      { className: "flex items-center gap-2" },
                      h(
                        "select",
                        { className: inputCls + " !w-auto !py-1.5 text-sm", value: assignTo[p.id] || board.teams[0].id, onChange: (e) => setAssignTo((prev) => Object.assign({}, prev, { [p.id]: e.target.value })) },
                        board.teams.map((t) => h("option", { key: t.id, value: t.id }, t.name))
                      ),
                      h(Button, { size: "sm", onClick: () => assign(p) }, "Assign")
                    ),
                  })
                )
              )
        ),

      board.teams.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No teams yet — add one above.")
        : h(
            "div",
            { className: "grid sm:grid-cols-2 gap-5" },
            board.teams.map((team) =>
              h(
                "div",
                { key: team.id, className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
                h(
                  "div",
                  { className: "flex items-center justify-between gap-2" },
                  renaming[team.id] != null
                    ? h(
                        "div",
                        { className: "flex items-center gap-2 flex-1" },
                        h("input", {
                          className: inputCls + " !py-1.5 text-sm",
                          value: renaming[team.id],
                          onChange: (e) => setRenaming((prev) => Object.assign({}, prev, { [team.id]: e.target.value })),
                          autoFocus: true,
                        }),
                        h(Button, { size: "sm", onClick: () => renameTeam(team.id) }, "Save")
                      )
                    : h(
                        "button",
                        { className: "text-left font-display font-bold text-[var(--ink)] hover:underline", onClick: () => setRenaming((prev) => Object.assign({}, prev, { [team.id]: team.name })) },
                        team.name + " (" + team.players.length + ")"
                      ),
                  h(Button, { size: "sm", variant: "ghost", onClick: () => call({ action: "delete_team", teamId: team.id }) }, "Delete team")
                ),
                h(
                  "div",
                  { className: "flex flex-col gap-2" },
                  team.players.length === 0
                    ? h("p", { className: "text-xs text-[var(--ink-soft)]" }, "No players yet.")
                    : team.players.map((p) =>
                        h(PlayerRow, { key: p.id, player: p, action: h(Button, { size: "sm", variant: "ghost", onClick: () => call({ action: "unassign", memberEmail: p.email }) }, "Remove") })
                      )
                )
              )
            )
          )
    );
  }

  // ---------------------------------------------------------------- Timetable
  //
  // Timetable-first builder: the coordinator adds ordered rows (non-game
  // activities, or Game rows), then drags teams from the Available Teams
  // panel into up to four slots per Game row — Pool A and Pool B each run
  // their own Black-stick/White-stick matchup, simultaneously. Every drop
  // zone also has a plain <select> fallback, so nothing here requires a
  // mouse-drag to operate.
  function timeInputToMin(value) {
    // value like "18:15" -> minutes since a 6:00pm session start, or null.
    if (!value) return null;
    const [h1, m1] = value.split(":").map(Number);
    if (Number.isNaN(h1) || Number.isNaN(m1)) return null;
    return (h1 - 18) * 60 + m1;
  }
  function minToTimeInput(min) {
    if (min == null) return "";
    const base = new Date(2000, 0, 1, 18, 0, 0);
    base.setMinutes(base.getMinutes() + min);
    return String(base.getHours()).padStart(2, "0") + ":" + String(base.getMinutes()).padStart(2, "0");
  }
  function minToClock(min) {
    if (min == null) return null;
    const base = new Date(2000, 0, 1, 18, 0, 0);
    base.setMinutes(base.getMinutes() + min);
    let hr = base.getHours();
    const m = base.getMinutes();
    const suffix = hr >= 12 ? "pm" : "am";
    hr = hr % 12 || 12;
    return hr + ":" + String(m).padStart(2, "0") + suffix;
  }

  // ---- Available Teams panel: draggable chips, source of every team slot ----
  function AvailableTeamsPanel({ teams, setDrag }) {
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-4 mb-6" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-1" }, "Available Teams"),
      h("p", { className: "text-xs text-[var(--ink-soft)] mb-3" }, "Drag a team onto a Black or White stick slot below, or use the dropdown on the slot itself."),
      teams.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Create teams in the Teams tab first.")
        : h(
            "div",
            { className: "flex flex-wrap gap-2" },
            teams.map((t) =>
              h(
                "div",
                {
                  key: t.id,
                  draggable: true,
                  onDragStart: () => setDrag({ source: "panel", teamId: t.id, teamName: t.name }),
                  onDragEnd: () => setDrag(null),
                  className: "rounded-xl bg-white ring-1 ring-black/10 px-3 py-2 cursor-grab select-none active:cursor-grabbing",
                  title: "Drag onto a team slot",
                },
                h("p", { className: "text-sm font-bold text-[var(--ink)]" }, t.name),
                h(
                  "p",
                  { className: "text-[10px] text-[var(--ink-soft)]" },
                  t.playerCount + " player" + (t.playerCount === 1 ? "" : "s") + (t.grades && t.grades.length ? " · " + t.grades.join("/") : "")
                )
              )
            )
          )
    );
  }

  // ---- One Black/White stick drop zone: drag target + accessible <select> ----
  function TeamSlot({ rowId, pool, slot, cur, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssign, onSwapOrMove }) {
    const key = rowId + ":" + pool + ":" + slot;
    const isOver = dragOverKey === key;

    function handleSelectChange(e) {
      const val = e.target.value;
      const newTeamId = val === "" ? null : Number(val);
      if (newTeamId === (cur ? cur.id : null)) return;
      if (cur && newTeamId != null) {
        const newName = (teams.find((t) => t.id === newTeamId) || {}).name || "that team";
        if (!window.confirm("Replace " + cur.name + " with " + newName + " here?")) return;
      }
      onAssign(rowId, pool, slot, newTeamId);
    }

    function handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverKey(null);
      if (!drag) return;
      const isSameSlot = drag.source === "slot" && drag.rowId === rowId && drag.pool === pool && drag.slot === slot;
      if (isSameSlot) { setDrag(null); return; }
      if (cur && drag.teamId !== cur.id) {
        if (!window.confirm("Replace " + cur.name + " with " + drag.teamName + " here?")) { setDrag(null); return; }
      }
      if (drag.source === "slot" && drag.rowId === rowId) {
        onSwapOrMove(rowId, drag.pool, drag.slot, pool, slot);
      } else {
        onAssign(rowId, pool, slot, drag.teamId);
      }
      setDrag(null);
    }

    return h(
      "div",
      {
        draggable: !!cur,
        onDragStart: (e) => { e.stopPropagation(); if (cur) setDrag({ source: "slot", rowId, pool, slot, teamId: cur.id, teamName: cur.name }); },
        onDragEnd: () => setDrag(null),
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); if (dragOverKey !== key) setDragOverKey(key); },
        onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
        onDrop: handleDrop,
        className: cx(
          "rounded-lg border-2 p-2 flex flex-col gap-1 min-h-[54px] justify-center transition",
          isOver ? "border-[var(--accent)] bg-[var(--accent)]/10" : cur ? "border-transparent bg-white" : "border-dashed border-black/15 bg-white/70"
        ),
      },
      h("p", { className: "text-[9px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, slot === "black" ? "Black stick" : "White stick"),
      h(
        "div",
        { className: "flex items-center gap-1" },
        h(
          "select",
          { className: inputCls + " !py-1 !text-xs !w-full", value: cur ? cur.id : "", onChange: handleSelectChange },
          h("option", { value: "" }, "— empty —"),
          teams.map((t) => h("option", { key: t.id, value: t.id }, t.name))
        ),
        cur && h("button", { type: "button", onClick: () => onAssign(rowId, pool, slot, null), className: "opacity-60 hover:opacity-100 shrink-0", title: "Clear this slot" }, h(Icon, { name: "x", size: 12 }))
      )
    );
  }

  // ---- Per-pool referee picker: eligible-only by default, reasons on request ----
  function RefereeSelector({ rowId, pool, poolGame, onAssign, onUnassign }) {
    const [showUnavailable, setShowUnavailable] = React.useState(false);
    const [pick, setPick] = React.useState("");
    const eligible = poolGame.eligible || [];
    const unavailable = poolGame.unavailable || [];
    const REASON_LABEL = {
      playing_this_row: "Playing in this game",
      playing_overlapping_game: "Playing another game at this time",
      refereeing_other_pool: "Already refereeing the other pool",
      refereeing_overlapping_game: "Already refereeing another game at this time",
      not_confirmed: "Not confirmed as attending",
    };

    return h(
      "div",
      { className: "flex flex-col gap-1.5" },
      h("p", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, pool + " referees"),
      poolGame.referees.length === 0
        ? h("p", { className: "text-xs text-[var(--ink-soft)]" }, "None picked yet.")
        : h(
            "div",
            { className: "flex flex-wrap gap-1.5" },
            poolGame.referees.map((p) =>
              h(
                Pill,
                { key: p.id, tone: "dark", className: "!py-0.5 !text-xs flex items-center gap-1" },
                p.firstName + " " + (p.lastName ? p.lastName.charAt(0) + "." : ""),
                h("button", { type: "button", onClick: () => onUnassign(rowId, pool, p.id), className: "opacity-70 hover:opacity-100", title: "Remove" }, h(Icon, { name: "x", size: 10 }))
              )
            )
          ),
      eligible.length === 0
        ? h("p", { className: "text-xs text-[var(--ink-soft)]" }, "No eligible referees available right now.")
        : h(
            "div",
            { className: "flex items-center gap-2" },
            h(
              "select",
              { className: inputCls + " !w-auto !py-1 !text-xs", value: pick || eligible[0].id, onChange: (e) => setPick(e.target.value) },
              eligible.map((p) =>
                h(
                  "option",
                  { key: p.id, value: p.id },
                  p.firstName + " " + p.lastName + (p.refereedTonight > 0 ? " (reffed once already tonight)" : "")
                )
              )
            ),
            h(
              Button,
              { type: "button", size: "sm", variant: "secondary", onClick: () => { onAssign(rowId, pool, pick || eligible[0].id); setPick(""); } },
              "Add ref"
            )
          ),
      unavailable.length > 0 &&
        h(
          "button",
          { type: "button", className: "text-[10px] text-[var(--ink-soft)] underline text-left w-fit", onClick: () => setShowUnavailable((v) => !v) },
          showUnavailable ? "Hide unavailable people" : "Show unavailable people (" + unavailable.length + ")"
        ),
      showUnavailable &&
        h(
          "div",
          { className: "flex flex-col gap-0.5 mt-0.5" },
          unavailable.map((p) =>
            h(
              "p",
              { key: p.id, className: "text-[10px] text-[var(--ink-soft)]" },
              p.firstName + " " + p.lastName + " — " + (REASON_LABEL[p.reason] || p.detail)
            )
          )
        )
    );
  }

  // ---- One pool's whole block: two slots + its referee picker ----
  function PoolBlock({ rowId, pool, poolGame, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssignTeam, onSwapOrMove, onAssignRef, onUnassignRef }) {
    return h(
      "div",
      { className: "flex-1 min-w-[240px] rounded-xl bg-[var(--sand)] p-3 flex flex-col gap-2.5" },
      h("p", { className: "text-xs font-bold text-[var(--ink)]" }, pool),
      h(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        h(TeamSlot, { rowId, pool, slot: "black", cur: poolGame.black, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssign: onAssignTeam, onSwapOrMove }),
        h(TeamSlot, { rowId, pool, slot: "white", cur: poolGame.white, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssign: onAssignTeam, onSwapOrMove })
      ),
      h(RefereeSelector, { rowId, pool, poolGame, onAssign: onAssignRef, onUnassign: onUnassignRef })
    );
  }

  // ---- One timetable row: non-game activity, or a Game row with 2 pools ----
  function RowCard({ row, teams, drag, setDrag, dragOverKey, setDragOverKey, draggingRowId, setDraggingRowId, onRowDrop, onUpdateRow, onDuplicate, onRemoveOrArchive, onClearTeams, onAssignTeam, onSwapOrMove, onAssignRef, onUnassignRef, rowErrors, registerRef }) {
    const [label, setLabel] = React.useState(row.label);
    const [notes, setNotes] = React.useState(row.notes || "");

    function commitLabel() {
      const trimmed = label.trim();
      if (trimmed && trimmed !== row.label) onUpdateRow(row, { label: trimmed });
      else setLabel(row.label);
    }
    function commitNotes() {
      const trimmed = notes.trim();
      if (trimmed !== (row.notes || "")) onUpdateRow(row, { notes: trimmed || null });
    }

    const isGame = row.rowType === "game";
    const poolA = (row.poolGames || []).find((p) => p.pool === "Pool A") || { pool: "Pool A", black: null, white: null, referees: [], eligible: [], unavailable: [] };
    const poolB = (row.poolGames || []).find((p) => p.pool === "Pool B") || { pool: "Pool B", black: null, white: null, referees: [], eligible: [], unavailable: [] };

    return h(
      "div",
      {
        ref: registerRef,
        draggable: true,
        onDragStart: (e) => { e.stopPropagation(); setDraggingRowId(row.id); },
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => { e.preventDefault(); if (draggingRowId != null && draggingRowId !== row.id) onRowDrop(draggingRowId, row.id); },
        className: cx("rounded-2xl p-4 flex flex-col gap-3 transition", rowErrors.length > 0 ? "bg-[#fff6e8] ring-2 ring-[#e0a020]" : "bg-white ring-1 ring-black/5"),
      },
      h(
        "div",
        { className: "flex items-start justify-between gap-3 flex-wrap" },
        h(
          "div",
          { className: "flex items-center gap-2 flex-wrap flex-1 min-w-[200px]" },
          h(Icon, { name: "grip", size: 16, className: "text-[var(--ink-soft)] cursor-grab shrink-0" }),
          h(Pill, { tone: isGame ? "accent" : "dark", className: "!py-0.5 shrink-0" }, row.rowTypeLabel),
          h("input", {
            className: "font-display font-bold text-[var(--ink)] bg-transparent border-b border-transparent hover:border-black/10 focus:border-black/20 focus:outline-none min-w-[140px]",
            value: label,
            onChange: (e) => setLabel(e.target.value),
            onBlur: commitLabel,
          }),
          row.published && h(Pill, { tone: "good", className: "!py-0.5" }, "Published")
        ),
        h(
          "div",
          { className: "flex items-center gap-1.5 shrink-0" },
          isGame && h(Button, { size: "sm", variant: "ghost", onClick: () => onClearTeams(row) }, "Clear teams"),
          h(Button, { size: "sm", variant: "ghost", onClick: () => onDuplicate(row) }, "Duplicate"),
          h(Button, { size: "sm", variant: "ghost", onClick: () => onRemoveOrArchive(row) }, row.published ? "Archive" : "Remove")
        )
      ),
      h(
        "div",
        { className: "flex flex-wrap items-center gap-3" },
        h("input", {
          type: "time",
          className: inputCls + " !w-auto !py-1.5 text-sm",
          value: minToTimeInput(row.startMin),
          onChange: (e) => onUpdateRow(row, { startMin: timeInputToMin(e.target.value) }),
        }),
        h("input", {
          type: "number",
          min: "0",
          placeholder: "min",
          className: inputCls + " !w-20 !py-1.5 text-sm",
          value: row.durationMin == null ? "" : row.durationMin,
          onChange: (e) => onUpdateRow(row, { durationMin: e.target.value === "" ? null : Number(e.target.value) }),
        }),
        row.startMin != null && row.durationMin != null && h("span", { className: "text-xs text-[var(--ink-soft)]" }, "ends " + minToClock(row.startMin + row.durationMin))
      ),
      !isGame &&
        h("input", {
          className: inputCls + " text-sm",
          placeholder: "Optional notes (e.g. bring a plate, meet at the BBQ area)",
          value: notes,
          onChange: (e) => setNotes(e.target.value),
          onBlur: commitNotes,
        }),
      isGame &&
        h(
          "div",
          { className: "flex flex-col sm:flex-row gap-3" },
          h(PoolBlock, { rowId: row.id, pool: "Pool A", poolGame: poolA, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssignTeam, onSwapOrMove, onAssignRef, onUnassignRef }),
          h(PoolBlock, { rowId: row.id, pool: "Pool B", poolGame: poolB, teams, drag, setDrag, dragOverKey, setDragOverKey, onAssignTeam, onSwapOrMove, onAssignRef, onUnassignRef })
        ),
      rowErrors.length > 0 &&
        h(
          "div",
          { className: "flex flex-col gap-1 mt-1" },
          rowErrors.map((e, i) => h("p", { key: i, className: "text-xs text-[#8a5a12] font-semibold" }, "⚠ " + e.message))
        )
    );
  }

  // ---- Validation summary banner: blocking issues, with jump-to-row ----
  function ValidationSummary({ validation, onJump }) {
    if (!validation || validation.length === 0) {
      return h("div", { className: "rounded-xl bg-[var(--good-15)] text-[var(--good-dark)] px-4 py-3 text-sm font-semibold mb-6" }, "No blocking issues — this timetable can be published.");
    }
    return h(
      "div",
      { className: "rounded-xl bg-[#fff6e8] ring-2 ring-[#e0a020] p-4 mb-6 flex flex-col gap-2" },
      h("p", { className: "text-sm font-bold text-[#8a5a12]" }, validation.length + " issue" + (validation.length === 1 ? "" : "s") + " must be fixed before this can be published:"),
      validation.map((e, i) =>
        h(
          "button",
          { key: i, type: "button", onClick: () => onJump(e.rowId), className: "text-left text-xs text-[#8a5a12] underline hover:no-underline" },
          e.message
        )
      )
    );
  }

  const ROW_TYPE_DEFAULT_LABEL = {
    set_up: "Set Up", warm_up: "Warm Up", game_briefing: "Game Briefing", game: "Game",
    game_changeover: "Game Changeover", skills_development: "Skills Development", pack_up: "Pack Up", custom: "",
  };

  function ScheduleTab() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [showArchived, setShowArchived] = React.useState(false);
    const [preview, setPreview] = React.useState(false);
    const [addForm, setAddForm] = React.useState({ rowType: "game", label: "", labelTouched: false, time: "", timeTouched: false, durationMin: "20", notes: "" });
    const [drag, setDrag] = React.useState(null);
    const [dragOverKey, setDragOverKey] = React.useState(null);
    const [draggingRowId, setDraggingRowId] = React.useState(null);
    const [highlightRowId, setHighlightRowId] = React.useState(null);
    const rowRefs = React.useRef({});

    function load() {
      setLoading(true);
      setError(null);
      return GUWH.Identity.authFetch("/api/coordinator/schedule")
        .then((r) => r.json())
        .then((d) => (d.ok ? setData(d) : setError(d.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { load(); }, []);

    async function call(body) {
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/coordinator/schedule", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) setData(d);
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    // Suggest a start time for the next row from the last one's end time,
    // unless the organiser has already typed their own time in this form.
    React.useEffect(() => {
      if (!data || addForm.timeTouched) return;
      const rows = data.rows || [];
      if (rows.length === 0) return;
      const last = rows[rows.length - 1];
      if (last.startMin != null && last.durationMin != null) {
        setAddForm((f) => (f.timeTouched ? f : Object.assign({}, f, { time: minToTimeInput(last.startMin + last.durationMin) })));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data && data.rows && data.rows.length]);

    function onRowTypeChange(rowType) {
      const info = (data.rowTypes || []).find((r) => r.value === rowType);
      setAddForm((f) =>
        Object.assign({}, f, {
          rowType,
          label: f.labelTouched ? f.label : ROW_TYPE_DEFAULT_LABEL[rowType] || "",
          durationMin: info && info.defaultDurationMin != null ? String(info.defaultDurationMin) : f.durationMin,
        })
      );
    }

    function addRow(ev) {
      ev.preventDefault();
      if (addForm.rowType === "custom" && !addForm.label.trim()) return;
      call({
        action: "add_row",
        rowType: addForm.rowType,
        label: addForm.label.trim(),
        startMin: timeInputToMin(addForm.time),
        durationMin: addForm.durationMin === "" ? null : Number(addForm.durationMin),
        notes: addForm.notes.trim() || null,
      });
      setAddForm({ rowType: "game", label: "", labelTouched: false, time: "", timeTouched: false, durationMin: "20", notes: "" });
    }

    function updateRow(row, patch) {
      call(Object.assign({ action: "update_row", rowId: row.id, rowType: row.rowType, label: row.label, startMin: row.startMin, durationMin: row.durationMin, notes: row.notes }, patch));
    }
    function duplicateRow(row) { call({ action: "duplicate_row", rowId: row.id }); }
    function removeOrArchive(row) {
      if (row.published) {
        if (window.confirm('Archive "' + row.label + '"? It already went out to players, so it\'ll be hidden rather than deleted.')) call({ action: "archive_row", rowId: row.id });
      } else if (window.confirm('Remove "' + row.label + '" from the timetable?')) {
        call({ action: "remove_row", rowId: row.id });
      }
    }
    function unarchiveRow(row) { call({ action: "unarchive_row", rowId: row.id }); }
    function clearTeams(row) {
      if (window.confirm('Clear every team from "' + row.label + '"?')) call({ action: "clear_row_teams", rowId: row.id });
    }
    function assignTeam(rowId, pool, slot, teamId) { call({ action: "assign_team", rowId, pool, slot, teamId }); }
    function swapOrMove(rowId, poolA, slotA, poolB, slotB) { call({ action: "swap_teams", rowId, poolA, slotA, poolB, slotB }); }
    function assignRef(rowId, pool, memberId) { call({ action: "assign_referee", rowId, pool, memberId }); }
    function unassignRef(rowId, pool, memberId) { call({ action: "unassign_referee", rowId, pool, memberId }); }

    function handleRowDrop(sourceId, targetId) {
      const ids = (data.rows || []).map((r) => r.id);
      const withoutSource = ids.filter((id) => id !== sourceId);
      const targetIndex = withoutSource.indexOf(targetId);
      withoutSource.splice(targetIndex, 0, sourceId);
      call({ action: "reorder_rows", orderedIds: withoutSource });
      setDraggingRowId(null);
    }

    function jumpToRow(rowId) {
      const el = rowRefs.current[rowId];
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightRowId(rowId);
      setTimeout(() => setHighlightRowId((cur) => (cur === rowId ? null : cur)), 1600);
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!data) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    const errorsByRow = {};
    (data.validation || []).forEach((e) => {
      if (!errorsByRow[e.rowId]) errorsByRow[e.rowId] = [];
      errorsByRow[e.rowId].push(e);
    });

    if (preview) {
      return h(
        React.Fragment,
        null,
        h(
          "div",
          { className: "flex items-center justify-between mb-6" },
          h("h3", { className: "font-display text-lg font-bold text-[var(--ink)]" }, "Preview — what players will see once published"),
          h(Button, { size: "sm", variant: "secondary", onClick: () => setPreview(false) }, "Back to editing")
        ),
        h("div", { className: "rounded-2xl border-2 border-black/5 p-5 sm:p-6" }, h(GUWH.Pages.PublicTimetable, { rows: data.rows }))
      );
    }

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      h(
        "div",
        { className: "flex flex-wrap items-center justify-between gap-3 mb-4" },
        h("p", { className: "text-sm text-[var(--ink-soft)] max-w-md" }, "Build the night as a sequence of rows, then drag teams from Available Teams into Pool A and Pool B — both pools can run at once."),
        h(Button, { size: "sm", variant: "secondary", onClick: () => setPreview(true) }, h(Icon, { name: "share", size: 14 }), "Preview public timetable")
      ),

      h(ValidationSummary, { validation: data.validation, onJump: jumpToRow }),

      h(AvailableTeamsPanel, { teams: data.teams, setDrag }),

      h(
        "form",
        { onSubmit: addRow, className: "flex flex-wrap gap-3 items-end mb-8 rounded-2xl bg-white ring-1 ring-black/5 p-5" },
        h(
          FormField,
          { label: "Row type" },
          h(
            "select",
            { className: inputCls + " !w-44", value: addForm.rowType, onChange: (e) => onRowTypeChange(e.target.value) },
            (data.rowTypes || []).map((rt) => h("option", { key: rt.value, value: rt.value }, rt.label))
          )
        ),
        h(
          FormField,
          { label: addForm.rowType === "custom" ? "Label (required)" : "Label" },
          h("input", {
            className: inputCls + " !w-40",
            value: addForm.label,
            onChange: (e) => setAddForm((f) => Object.assign({}, f, { label: e.target.value, labelTouched: true })),
            placeholder: ROW_TYPE_DEFAULT_LABEL[addForm.rowType] || "e.g. BBQ at the Bay",
          })
        ),
        h(FormField, { label: "Start time" }, h("input", { type: "time", className: inputCls + " !w-36", value: addForm.time, onChange: (e) => setAddForm((f) => Object.assign({}, f, { time: e.target.value, timeTouched: true })) })),
        h(FormField, { label: "Minutes" }, h("input", { type: "number", min: "0", className: inputCls + " !w-24", value: addForm.durationMin, onChange: (e) => setAddForm((f) => Object.assign({}, f, { durationMin: e.target.value })) })),
        h(FormField, { label: "Notes" }, h("input", { className: inputCls + " !w-40", value: addForm.notes, onChange: (e) => setAddForm((f) => Object.assign({}, f, { notes: e.target.value })), placeholder: "Optional" })),
        h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Add row")
      ),

      data.rows.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No rows in the timetable yet — add one above.")
        : h(
            "div",
            { className: "flex flex-col gap-4" },
            data.rows.map((row) =>
              h(RowCard, {
                key: row.id + ":" + row.updatedAt,
                row,
                teams: data.teams,
                drag, setDrag, dragOverKey, setDragOverKey, draggingRowId, setDraggingRowId,
                onRowDrop: handleRowDrop,
                onUpdateRow: updateRow,
                onDuplicate: duplicateRow,
                onRemoveOrArchive: removeOrArchive,
                onClearTeams: clearTeams,
                onAssignTeam: assignTeam,
                onSwapOrMove: swapOrMove,
                onAssignRef: assignRef,
                onUnassignRef: unassignRef,
                rowErrors: errorsByRow[row.id] || [],
                registerRef: (el) => {
                  rowRefs.current[row.id] = el;
                  if (el) el.style.outline = highlightRowId === row.id ? "3px solid var(--accent)" : "";
                },
              })
            )
          ),

      data.archivedRows && data.archivedRows.length > 0 &&
        h(
          "div",
          { className: "mt-8" },
          h(
            "button",
            { type: "button", className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] underline", onClick: () => setShowArchived((v) => !v) },
            showArchived ? "Hide archived rows" : "Show archived rows (" + data.archivedRows.length + ")"
          ),
          showArchived &&
            h(
              "div",
              { className: "flex flex-col gap-2 mt-3" },
              data.archivedRows.map((row) =>
                h(
                  "div",
                  { key: row.id, className: "rounded-xl bg-black/5 px-4 py-2.5 flex items-center justify-between gap-3" },
                  h("span", { className: "text-sm text-[var(--ink-soft)]" }, row.label + " (" + row.rowTypeLabel + ")"),
                  h(Button, { size: "sm", variant: "ghost", onClick: () => unarchiveRow(row) }, "Restore")
                )
              )
            )
        )
    );
  }

  // ---------------------------------------------------------------- Publish
  function PublishTab() {
    const [board, setBoard] = React.useState(null);
    const [validation, setValidation] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function load() {
      setLoading(true);
      return Promise.all([
        GUWH.Identity.authFetch("/api/coordinator/teams").then((r) => r.json()),
        GUWH.Identity.authFetch("/api/coordinator/schedule").then((r) => r.json()),
      ])
        .then(([teamsData, scheduleData]) => {
          if (teamsData.ok) setBoard(teamsData);
          else setError(teamsData.error || "Something went wrong");
          if (scheduleData.ok) setValidation(scheduleData.validation || []);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { load(); }, []);

    async function togglePublish() {
      setError(null);
      const res = await GUWH.Identity.authFetch("/api/coordinator/teams", { method: "POST", body: JSON.stringify({ action: "publish", published: !board.published }) });
      const data = await res.json();
      if (data.ok) setBoard(data);
      else {
        setError(data.error || "Something went wrong");
        if (data.validation) setValidation(data.validation);
      }
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!board) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    const blocked = !board.published && validation.length > 0;

    return h(
      "div",
      { className: "rounded-2xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4 max-w-md" },
      h("h3", { className: "font-display font-bold" }, "Ready to publish?"),
      error && h("p", { className: "text-sm text-[#ffb4a8]" }, error),
      board.unassigned.length > 0
        ? h("p", { className: "text-sm text-[var(--warn-light,#f0c98a)]" }, board.unassigned.length + " confirmed player(s) still unassigned — check the Teams tab.")
        : h("p", { className: "text-sm text-white/70" }, "Every confirmed player is on a team."),
      blocked &&
        h(
          "div",
          { className: "rounded-xl bg-white/10 p-3 flex flex-col gap-1" },
          h("p", { className: "text-sm font-semibold text-[#f0c98a]" }, validation.length + " timetable issue" + (validation.length === 1 ? "" : "s") + " to fix first — see the Timetable tab:"),
          validation.slice(0, 4).map((v, i) => h("p", { key: i, className: "text-xs text-white/70" }, "· " + v.message)),
          validation.length > 4 && h("p", { className: "text-xs text-white/50" }, "…and " + (validation.length - 4) + " more")
        ),
      h("p", { className: "text-sm text-white/70" }, board.published ? "The board is live for players right now." : "The board is currently hidden from players."),
      h(
        Button,
        {
          size: "lg",
          variant: board.published ? "secondary" : "primary",
          className: board.published ? "!bg-transparent !text-white !border-white/30" : "",
          onClick: togglePublish,
          disabled: blocked,
        },
        board.published ? "Unpublish" : "Publish game board"
      ),
      h("button", { className: "text-sm text-white/60 underline text-left", onClick: () => navigate("/portal/board") }, "Preview this week's game →")
    );
  }

  function CoordinatorPage({ tab }) {
    const activeTab = tab || "attendance";
    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Game Coordination", title: "This Wednesday", sub: "Real bookings, teams and a real timetable, editable on a player's behalf." }),
      h(CoordinatorTabs, { active: activeTab }),
      activeTab === "attendance" && h(AttendanceTab),
      activeTab === "teams" && h(TeamsTab),
      activeTab === "schedule" && h(ScheduleTab),
      activeTab === "publish" && h(PublishTab)
    );
  }

  GUWH.Pages.Coordinator = CoordinatorPage;
})();
