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

  const SLOT_POOLS = ["Pool A", "Pool B"];

  function ScheduleTab() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [newSlot, setNewSlot] = React.useState({ label: "", time: "", durationMin: "20", pool: "" });
    const [refPick, setRefPick] = React.useState({}); // slotId -> memberId pending selection

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

    // update_slot always overwrites every field server-side, so every call
    // resends the slot's full current state plus whatever changed — this is
    // what stops picking a team from silently wiping the time that was set.
    function updateSlot(slot, patch) {
      call(Object.assign(
        {
          action: "update_slot",
          slotId: slot.id,
          label: slot.label,
          startMin: slot.startMin,
          durationMin: slot.durationMin,
          teamAId: slot.teamAId,
          teamBId: slot.teamBId,
          pool: slot.pool,
        },
        patch
      ));
    }

    function assignRef(slot) {
      const memberId = refPick[slot.id] || (slot.eligible[0] && slot.eligible[0].id);
      if (!memberId) return;
      call({ action: "assign_referee", slotId: slot.id, memberId });
      setRefPick((prev) => Object.assign({}, prev, { [slot.id]: undefined }));
    }

    function unassignRef(slot, memberId) {
      call({ action: "unassign_referee", slotId: slot.id, memberId });
    }

    function addSlot(ev) {
      ev.preventDefault();
      if (!newSlot.label.trim()) return;
      call({ action: "add_slot", label: newSlot.label.trim(), startMin: timeInputToMin(newSlot.time), durationMin: newSlot.durationMin ? Number(newSlot.durationMin) : null, pool: newSlot.pool || null });
      setNewSlot({ label: "", time: "", durationMin: "20", pool: "" });
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!data) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      h("p", { className: "text-sm text-[var(--ink-soft)] max-w-md mb-6" }, "Add each game for the night, pick which two teams play, and anyone confirmed who isn't on either of those teams shows up as a possible referee for it automatically."),

      data.teams.length === 0 &&
        h("p", { className: "text-sm text-[var(--warn-dark,#8a5a12)] mb-6" }, "Create teams in the Teams tab first — you need at least two to assign a game."),

      h(
        "form",
        { onSubmit: addSlot, className: "flex flex-wrap gap-3 items-end mb-8 rounded-2xl bg-white ring-1 ring-black/5 p-5" },
        h(FormField, { label: "Label" }, h("input", { className: inputCls + " !w-40", value: newSlot.label, onChange: (e) => setNewSlot((s) => Object.assign({}, s, { label: e.target.value })), placeholder: "Game 1" })),
        h(FormField, { label: "Start time" }, h("input", { type: "time", className: inputCls + " !w-36", value: newSlot.time, onChange: (e) => setNewSlot((s) => Object.assign({}, s, { time: e.target.value })) })),
        h(FormField, { label: "Minutes" }, h("input", { type: "number", min: "0", className: inputCls + " !w-24", value: newSlot.durationMin, onChange: (e) => setNewSlot((s) => Object.assign({}, s, { durationMin: e.target.value })) })),
        h(
          FormField,
          { label: "Pool" },
          h(
            "select",
            { className: inputCls + " !w-32", value: newSlot.pool, onChange: (e) => setNewSlot((s) => Object.assign({}, s, { pool: e.target.value })) },
            h("option", { value: "" }, "No pool"),
            SLOT_POOLS.map((p) => h("option", { key: p, value: p }, p))
          )
        ),
        h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Add game")
      ),

      data.slots.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No games in the timetable yet.")
        : h(
            "div",
            { className: "flex flex-col gap-4" },
            data.slots.map((slot) =>
              h(
                "div",
                { key: slot.id, className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
                h(
                  "div",
                  { className: "flex items-center justify-between gap-2" },
                  h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h("span", { className: "font-display font-bold text-[var(--ink)]" }, slot.label),
                    slot.pool && h(Pill, { tone: "accent", className: "!py-0.5" }, slot.pool)
                  ),
                  h(Button, { size: "sm", variant: "ghost", onClick: () => call({ action: "remove_slot", slotId: slot.id }) }, "Remove")
                ),
                h(
                  "p",
                  { className: "text-xs font-semibold text-[var(--ink)]" },
                  slot.startMin != null
                    ? "Starts at " + minToClock(slot.startMin) + (slot.durationMin ? " · " + slot.durationMin + " min" : "")
                    : "No time set yet"
                ),
                h(
                  "div",
                  { className: "flex flex-wrap items-center gap-3" },
                  h("input", {
                    type: "time",
                    className: inputCls + " !w-auto !py-1.5 text-sm",
                    value: minToTimeInput(slot.startMin),
                    onChange: (e) => updateSlot(slot, { startMin: timeInputToMin(e.target.value) }),
                  }),
                  h("input", {
                    type: "number",
                    min: "0",
                    placeholder: "min",
                    className: inputCls + " !w-20 !py-1.5 text-sm",
                    value: slot.durationMin == null ? "" : slot.durationMin,
                    onChange: (e) => updateSlot(slot, { durationMin: e.target.value === "" ? null : Number(e.target.value) }),
                  }),
                  h(
                    "select",
                    { className: inputCls + " !w-auto !py-1.5 text-sm", value: slot.pool || "", onChange: (e) => updateSlot(slot, { pool: e.target.value || null }) },
                    h("option", { value: "" }, "No pool"),
                    SLOT_POOLS.map((p) => h("option", { key: p, value: p }, p))
                  )
                ),
                h(
                  "div",
                  { className: "flex flex-wrap items-end gap-3" },
                  h(
                    "div",
                    { className: "flex flex-col gap-1" },
                    h("label", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Black sticks"),
                    h(
                      "select",
                      {
                        className: inputCls + " !w-auto !py-1.5 text-sm",
                        value: slot.teamAId || "",
                        onChange: (e) => updateSlot(slot, { teamAId: e.target.value || null }),
                      },
                      h("option", { value: "" }, "— team —"),
                      data.teams.map((t) => h("option", { key: t.id, value: t.id }, t.name))
                    )
                  ),
                  h("span", { className: "text-sm text-[var(--ink-soft)] pb-2" }, "vs"),
                  h(
                    "div",
                    { className: "flex flex-col gap-1" },
                    h("label", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "White sticks"),
                    h(
                      "select",
                      {
                        className: inputCls + " !w-auto !py-1.5 text-sm",
                        value: slot.teamBId || "",
                        onChange: (e) => updateSlot(slot, { teamBId: e.target.value || null }),
                      },
                      h("option", { value: "" }, "— team —"),
                      data.teams.map((t) => h("option", { key: t.id, value: t.id }, t.name))
                    )
                  )
                ),
                h(
                  "div",
                  { className: "flex flex-col gap-1.5" },
                  h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Referees"),
                  slot.referees.length === 0
                    ? h("p", { className: "text-xs text-[var(--ink-soft)]" }, "None picked yet.")
                    : h(
                        "div",
                        { className: "flex flex-wrap gap-2" },
                        slot.referees.map((p) =>
                          h(
                            Pill,
                            { key: p.id, tone: "dark", className: "!py-1 flex items-center gap-1.5" },
                            p.firstName + " " + p.lastName,
                            h(
                              "button",
                              { type: "button", onClick: () => unassignRef(slot, p.id), className: "opacity-70 hover:opacity-100", title: "Remove" },
                              h(Icon, { name: "x", size: 11 })
                            )
                          )
                        )
                      ),
                  slot.eligible.length === 0
                    ? h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Everyone confirmed is already playing or refereeing this game.")
                    : h(
                        "div",
                        { className: "flex items-center gap-2" },
                        h(
                          "select",
                          {
                            className: inputCls + " !w-auto !py-1.5 text-sm",
                            value: refPick[slot.id] || slot.eligible[0].id,
                            onChange: (e) => setRefPick((prev) => Object.assign({}, prev, { [slot.id]: e.target.value })),
                          },
                          slot.eligible.map((p) => h("option", { key: p.id, value: p.id }, p.firstName + " " + p.lastName))
                        ),
                        h(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => assignRef(slot) }, "Add ref")
                      )
                )
              )
            )
          )
    );
  }

  // ---------------------------------------------------------------- Publish
  function PublishTab() {
    const [board, setBoard] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function load() {
      setLoading(true);
      return GUWH.Identity.authFetch("/api/coordinator/teams")
        .then((r) => r.json())
        .then((data) => (data.ok ? setBoard(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { load(); }, []);

    async function togglePublish() {
      const res = await GUWH.Identity.authFetch("/api/coordinator/teams", { method: "POST", body: JSON.stringify({ action: "publish", published: !board.published }) });
      const data = await res.json();
      if (data.ok) setBoard(data);
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!board) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    return h(
      "div",
      { className: "rounded-2xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4 max-w-md" },
      h("h3", { className: "font-display font-bold" }, "Ready to publish?"),
      board.unassigned.length > 0
        ? h("p", { className: "text-sm text-[var(--warn-light,#f0c98a)]" }, board.unassigned.length + " confirmed player(s) still unassigned — check the Teams tab.")
        : h("p", { className: "text-sm text-white/70" }, "Every confirmed player is on a team."),
      h("p", { className: "text-sm text-white/70" }, board.published ? "The board is live for players right now." : "The board is currently hidden from players."),
      h(
        Button,
        { size: "lg", variant: board.published ? "secondary" : "primary", className: board.published ? "!bg-transparent !text-white !border-white/30" : "", onClick: togglePublish },
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
