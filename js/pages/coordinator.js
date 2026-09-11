// ---------------------------------------------------------------------------
// Game Coordination workspace (live site, real backend) — for members with
// the game_coordinator or administrator role. Three tabs, mirroring the
// concept's organiser flow but wired to real data: Attendance, Teams,
// Publish.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const TABS = [
    { key: "attendance", label: "Attendance", path: "/coordinator" },
    { key: "teams", label: "Team builder", path: "/coordinator/teams" },
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
                  { key: p.id, className: "flex items-center justify-between px-5 py-3" },
                  h(
                    "div",
                    null,
                    h("p", { className: "text-sm font-semibold text-[var(--ink)] flex items-center gap-2" }, p.firstName + " " + p.lastName, p.isNew && h(Pill, { tone: "accent" }, "New")),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, p.email)
                  ),
                  h(Button, { size: "sm", variant: "ghost", onClick: () => setAttendance(p.email, false) }, "Cancel")
                )
              )
            )
      )
    );
  }

  // ---------------------------------------------------------------- Teams
  const POOLS = ["Pool A", "Pool B"];
  const CAPS = ["White", "Black"];

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
    const [assignTo, setAssignTo] = React.useState({}); // memberId -> "Pool A|White"

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

    function assign(player) {
      const choice = assignTo[player.id] || "Pool A|White";
      const [pool, cap] = choice.split("|");
      call({ action: "assign", memberEmail: player.email, pool, cap });
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (!board) return error && h("p", { className: "text-sm text-[var(--bad)]" }, error);

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      h("p", { className: "text-sm text-[var(--ink-soft)] max-w-md mb-6" }, "Pick a pool and cap colour for each confirmed player, then assign. Nothing here is visible to players until you publish."),

      board.unassigned.length > 0 &&
        h(
          "div",
          { className: "rounded-2xl bg-[var(--warn-10)] p-5 mb-6" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Unassigned (" + board.unassigned.length + ")"),
          h(
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
                    { className: inputCls + " !w-auto !py-1.5 text-sm", value: assignTo[p.id] || "Pool A|White", onChange: (e) => setAssignTo((prev) => Object.assign({}, prev, { [p.id]: e.target.value })) },
                    POOLS.flatMap((pool) => CAPS.map((cap) => h("option", { key: pool + "|" + cap, value: pool + "|" + cap }, pool + " · " + cap)))
                  ),
                  h(Button, { size: "sm", onClick: () => assign(p) }, "Assign")
                ),
              })
            )
          )
        ),

      h(
        "div",
        { className: "grid sm:grid-cols-2 gap-5" },
        POOLS.map((pool) =>
          h(
            "div",
            { key: pool, className: "flex flex-col gap-3" },
            h("h3", { className: "font-display font-bold text-[var(--ink)]" }, pool),
            CAPS.map((cap) =>
              h(
                "div",
                { key: cap, className: "rounded-2xl bg-[var(--sand)] p-3" },
                h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] px-1 mb-2" }, cap + " caps (" + board.assignments[pool][cap].length + ")"),
                h(
                  "div",
                  { className: "flex flex-col gap-2" },
                  board.assignments[pool][cap].map((p) =>
                    h(PlayerRow, { key: p.id, player: p, action: h(Button, { size: "sm", variant: "ghost", onClick: () => call({ action: "unassign", memberEmail: p.email }) }, "Remove") })
                  )
                )
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
        ? h("p", { className: "text-sm text-[var(--warn-light,#f0c98a)]" }, board.unassigned.length + " confirmed player(s) still unassigned — check the Team builder tab.")
        : h("p", { className: "text-sm text-white/70" }, "Every confirmed player has a pool and a cap colour."),
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
      h(SectionHeading, { eyebrow: "Game Coordination", title: "This Wednesday", sub: "Real bookings and teams, editable on a player's behalf." }),
      h(CoordinatorTabs, { active: activeTab }),
      activeTab === "attendance" && h(AttendanceTab),
      activeTab === "teams" && h(TeamsTab),
      activeTab === "publish" && h(PublishTab)
    );
  }

  GUWH.Pages.Coordinator = CoordinatorPage;
})();
