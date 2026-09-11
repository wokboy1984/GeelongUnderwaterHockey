// ---------------------------------------------------------------------------
// GUWH concept — Organiser dashboard: Attendance / Team Builder / Publish
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, Avatar, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const TABS = [
    { key: "attendance", label: "Attendance", path: "/organiser/attendance" },
    { key: "teams", label: "Team builder", path: "/organiser/teams" },
    { key: "publish", label: "Publish", path: "/organiser/publish" },
  ];

  function useForceUpdate() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);
  }

  function OrganiserTabs({ active }) {
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
    useForceUpdate();
    const state = GUWH.Store.getState();
    const roster = GUWH.Store.allPlayers();
    const [showAdd, setShowAdd] = React.useState(false);
    const [addForm, setAddForm] = React.useState({ firstName: "", lastName: "", grade: "B-grade", position: "Midfield" });

    const confirmedCount = GUWH.Store.confirmedPlayerIds().length;
    const pendingGuests = state.guestBookings;
    const pendingInvites = state.invites.filter((i) => i.status !== "registered");

    function addPlayer(ev) {
      ev.preventDefault();
      if (!addForm.firstName.trim()) return;
      GUWH.Store.addAdHocPlayer(Object.assign({}, addForm, { tag: "new-player" }));
      setAddForm({ firstName: "", lastName: "", grade: "B-grade", position: "Midfield" });
      setShowAdd(false);
    }

    function promoteGuest(guest) {
      GUWH.Store.addAdHocPlayer({ firstName: guest.firstName, lastName: guest.lastName, age: guest.age, tag: "new-player" });
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "flex flex-wrap items-center justify-between gap-4 mb-6" },
        h(
          "div",
          { className: "flex items-center gap-3" },
          h("span", { className: "font-display text-3xl font-bold text-[var(--ink)] tabular-nums" }, confirmedCount),
          h("span", { className: "text-sm text-[var(--ink-soft)]" }, "confirmed for " + GUWH.formatDate(GUWH.nextWednesday()))
        ),
        h(Button, { onClick: () => setShowAdd((v) => !v) }, h(Icon, { name: "plus", size: 16 }), "Add a player")
      ),

      showAdd &&
        h(
          "form",
          { onSubmit: addPlayer, className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 mb-6 grid sm:grid-cols-4 gap-3 items-end" },
          h(FormField, { label: "First name" }, h("input", { className: inputCls, value: addForm.firstName, onChange: (e) => setAddForm(Object.assign({}, addForm, { firstName: e.target.value })) })),
          h(FormField, { label: "Last name" }, h("input", { className: inputCls, value: addForm.lastName, onChange: (e) => setAddForm(Object.assign({}, addForm, { lastName: e.target.value })) })),
          h(
            FormField,
            { label: "Grade" },
            h("select", { className: inputCls, value: addForm.grade, onChange: (e) => setAddForm(Object.assign({}, addForm, { grade: e.target.value })) }, GUWH.GRADES.map((g) => h("option", { key: g }, g)))
          ),
          h(Button, { type: "submit" }, "Add")
        ),

      (pendingGuests.length > 0 || pendingInvites.length > 0) &&
        h(
          "div",
          { className: "rounded-2xl bg-[var(--accent-08)] p-5 mb-6" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Waiting to be added"),
          h(
            "div",
            { className: "flex flex-col gap-2" },
            pendingGuests.map((g) =>
              h(
                "div",
                { key: g.id, className: "flex items-center justify-between bg-white rounded-xl px-4 py-2.5" },
                h("span", { className: "text-sm text-[var(--ink)]" }, g.firstName + " " + g.lastName + " — booked via Try Underwater Hockey"),
                h(Button, { size: "sm", onClick: () => promoteGuest(g) }, "Add to Wednesday")
              )
            ),
            pendingInvites.map((inv) =>
              h(
                "div",
                { key: inv.id, className: "flex items-center justify-between bg-white rounded-xl px-4 py-2.5" },
                h("span", { className: "text-sm text-[var(--ink)]" }, inv.friendName + " — invited via Bring a Mate"),
                h(Button, {
                  size: "sm",
                  onClick: () => {
                    GUWH.Store.markInviteRegistered(inv.id);
                    const [fn, ...rest] = inv.friendName.split(" ");
                    GUWH.Store.addAdHocPlayer({ firstName: fn, lastName: rest.join(" "), tag: "bring-a-mate" });
                  },
                }, "Add to Wednesday")
              )
            )
          )
        ),

      h(
        "div",
        { className: "rounded-2xl bg-white ring-1 ring-black/5 overflow-x-auto" },
        h(
          "table",
          { className: "w-full text-sm min-w-[720px]" },
          h(
            "thead",
            null,
            h(
              "tr",
              { className: "text-left text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)] border-b border-black/5" },
              ["Player", "Grade", "Position", "Age", "Last week", "Status", ""].map((c) => h("th", { key: c, className: "px-4 py-3 font-semibold" }, c))
            )
          ),
          h(
            "tbody",
            null,
            roster.map((p) => {
              const booking = GUWH.Store.bookingFor(p.id);
              return h(
                "tr",
                { key: p.id, className: "border-b border-black/5 last:border-0" },
                h(
                  "td",
                  { className: "px-4 py-3" },
                  h(
                    "div",
                    { className: "flex items-center gap-2.5" },
                    h(Avatar, { playerId: p.id, name: p.firstName, size: 30 }),
                    h(
                      "div",
                      null,
                      h("p", { className: "font-semibold text-[var(--ink)]" }, p.firstName + " " + (p.lastName || "")),
                      (p.isNew || p.tag) && h(Pill, { tone: "accent", className: "mt-0.5 !py-0.5 !px-2 !text-[10px]" }, p.tag === "bring-a-mate" ? "Bring-a-mate" : "New")
                    )
                  )
                ),
                h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.grade),
                h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.position),
                h("td", { className: "px-4 py-3 text-[var(--ink-soft)] tabular-nums" }, p.age || "—"),
                h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.lastWeekTeam || "—"),
                h("td", { className: "px-4 py-3" }, h(Pill, { tone: booking.in ? "good" : "warn" }, booking.in ? "In" : "Out")),
                h(
                  "td",
                  { className: "px-4 py-3 text-right" },
                  h(Button, { size: "sm", variant: "ghost", onClick: () => GUWH.Store.setBooking(p.id, !booking.in) }, booking.in ? "Remove" : "Add")
                )
              );
            })
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------- Team builder
  function DraggableChip({ player }) {
    return h(
      "div",
      {
        draggable: true,
        onDragStart: (e) => e.dataTransfer.setData("text/player-id", player.id),
        className: "flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-black/5 cursor-grab active:cursor-grabbing",
      },
      h(Icon, { name: "grip", size: 14, className: "text-[var(--ink-soft-50)] shrink-0" }),
      h(Avatar, { playerId: player.id, name: player.firstName, size: 30 }),
      h(
        "div",
        { className: "min-w-0 flex-1" },
        h("p", { className: "text-sm font-semibold text-[var(--ink)] truncate" }, initials(player.firstName, player.lastName)),
        h("p", { className: "text-[11px] text-[var(--ink-soft)] font-mono" }, player.grade + " · " + player.position)
      )
    );
  }

  function DropZone({ id, title, tone, playerIds, onDrop, children }) {
    const [over, setOver] = React.useState(false);
    const players = playerIds.map((pid) => GUWH.Store.findPlayer(pid)).filter(Boolean);
    return h(
      "div",
      {
        onDragOver: (e) => { e.preventDefault(); setOver(true); },
        onDragLeave: () => setOver(false),
        onDrop: (e) => { e.preventDefault(); setOver(false); onDrop(e.dataTransfer.getData("text/player-id")); },
        className: cx("rounded-2xl p-3 flex flex-col gap-2 min-h-[140px] transition", tone, over && "ring-2 ring-[var(--accent)]"),
      },
      h(
        "div",
        { className: "flex items-center justify-between px-1" },
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, title),
        h("span", { className: "text-xs font-mono text-[var(--ink-soft)]" }, players.length)
      ),
      players.map((p) => h(DraggableChip, { key: p.id, player: p })),
      children
    );
  }

  function TeamBuilderTab() {
    useForceUpdate();
    const board = GUWH.Store.getState().gameBoard;
    const unassigned = GUWH.Store.unassignedConfirmed();
    const [suggestion, setSuggestion] = React.useState(null);

    function runSuggest() {
      const result = GUWH.Store.suggestBalancedTeams();
      setSuggestion(result);
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "flex flex-wrap items-center justify-between gap-4 mb-6" },
        h("p", { className: "text-sm text-[var(--ink-soft)] max-w-md" }, "Drag players between pools and caps. Nothing here is final until you publish."),
        h(Button, { onClick: runSuggest }, h(Icon, { name: "trophy", size: 16 }), "Suggest balanced teams")
      ),

      suggestion &&
        h(
          "div",
          { className: "rounded-2xl bg-[var(--accent-08)] p-4 mb-6 text-sm" },
          h("p", { className: "text-[var(--ink)]" }, suggestion.explanation),
          h(
            "div",
            { className: "mt-2 flex flex-wrap gap-3" },
            suggestion.breakdown.map((b) =>
              h("span", { key: b.team, className: "font-mono text-xs text-[var(--ink-soft)]" }, b.team + ": " + b.total + " (" + b.counts["A-grade"] + "A/" + b.counts["B-grade"] + "B/" + b.counts["Junior"] + "J)")
            )
          )
        ),

      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr_200px] gap-5" },
        h(
          "div",
          { className: "flex flex-col gap-4" },
          h("h3", { className: "font-display font-bold text-[var(--ink)]" }, "Pool A"),
          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-3" },
            h(DropZone, { title: GUWH.teamNameFor("Pool A", "White") + " · White caps", tone: "bg-[var(--sand)]", playerIds: board.pools["Pool A"].white, onDrop: (id) => id && GUWH.Store.movePlayer(id, "Pool A", "White") }),
            h(DropZone, { title: GUWH.teamNameFor("Pool A", "Black") + " · Black caps", tone: "bg-[var(--ink-05)]", playerIds: board.pools["Pool A"].black, onDrop: (id) => id && GUWH.Store.movePlayer(id, "Pool A", "Black") })
          )
        ),
        h(
          "div",
          { className: "flex flex-col gap-4" },
          h("h3", { className: "font-display font-bold text-[var(--ink)]" }, "Pool B"),
          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-3" },
            h(DropZone, { title: GUWH.teamNameFor("Pool B", "White") + " · White caps", tone: "bg-[var(--sand)]", playerIds: board.pools["Pool B"].white, onDrop: (id) => id && GUWH.Store.movePlayer(id, "Pool B", "White") }),
            h(DropZone, { title: GUWH.teamNameFor("Pool B", "Black") + " · Black caps", tone: "bg-[var(--ink-05)]", playerIds: board.pools["Pool B"].black, onDrop: (id) => id && GUWH.Store.movePlayer(id, "Pool B", "Black") })
          )
        ),
        h(DropZone, {
          title: "Unassigned",
          tone: "bg-[var(--warn-10)]",
          playerIds: unassigned,
          onDrop: (id) => id && GUWH.Store.unassignPlayer(id),
        })
      )
    );
  }

  // ---------------------------------------------------------------- Publish
  function PublishTab() {
    useForceUpdate();
    const board = GUWH.Store.getState().gameBoard;
    const [refInput, setRefInput] = React.useState("");
    const [social, setSocial] = React.useState(board.socialPlan);
    const unassignedCount = GUWH.Store.unassignedConfirmed().length;

    function addRef(ev) {
      ev.preventDefault();
      if (!refInput.trim()) return;
      GUWH.Store.setReferees(board.referees.concat(refInput.trim()));
      setRefInput("");
    }
    function removeRef(name) {
      GUWH.Store.setReferees(board.referees.filter((r) => r !== name));
    }
    function saveSocial(ev) {
      ev.preventDefault();
      GUWH.Store.setSocialPlan(social);
    }

    return h(
      "div",
      { className: "grid lg:grid-cols-[1fr_1fr] gap-8" },
      h(
        "div",
        { className: "flex flex-col gap-6" },
        h(
          "div",
          { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Match times"),
          GUWH.POOLS.map((pool) =>
            h(
              "div",
              { key: pool, className: "flex items-center justify-between py-2" },
              h("span", { className: "text-sm text-[var(--ink)]" }, pool),
              h("input", { type: "text", className: inputCls + " !w-28 text-center", value: board.pools[pool].matchTime, onChange: (e) => GUWH.Store.setMatchTime(pool, e.target.value) })
            )
          )
        ),
        h(
          "div",
          { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Referees"),
          h("div", { className: "flex flex-wrap gap-2 mb-3" }, board.referees.map((r) => h(Pill, { key: r, tone: "dark" }, r, h("button", { onClick: () => removeRef(r), "aria-label": "Remove " + r, className: "ml-1" }, h(Icon, { name: "x", size: 10 }))))),
          h("form", { onSubmit: addRef, className: "flex gap-2" }, h("input", { className: inputCls, placeholder: "Add a referee", value: refInput, onChange: (e) => setRefInput(e.target.value) }), h(Button, { size: "sm", type: "submit" }, "Add"))
        ),
        h(
          "form",
          { onSubmit: saveSocial, className: "rounded-2xl bg-white ring-1 ring-black/5 p-5" },
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Social plan"),
          h("textarea", { className: inputCls + " min-h-[80px]", value: social, onChange: (e) => setSocial(e.target.value) }),
          h(Button, { size: "sm", type: "submit", className: "mt-3" }, "Save")
        )
      ),
      h(
        "div",
        { className: "rounded-2xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4 h-fit" },
        h("h3", { className: "font-display font-bold" }, "Ready to publish?"),
        unassignedCount > 0
          ? h("p", { className: "text-sm text-[var(--warn-light,#f0c98a)]" }, unassignedCount + " confirmed player(s) still unassigned — check the Team builder tab.")
          : h("p", { className: "text-sm text-white/70" }, "Every confirmed player has a pool and a cap colour."),
        h(
          "p",
          { className: "text-sm text-white/70" },
          board.published ? "The board is live for players right now." : "The board is currently hidden from players."
        ),
        h(
          Button,
          { size: "lg", variant: board.published ? "secondary" : "primary", className: board.published ? "!bg-transparent !text-white !border-white/30" : "", onClick: () => GUWH.Store.publishBoard(!board.published) },
          board.published ? "Unpublish" : "Publish game board"
        ),
        h("button", { className: "text-sm text-white/60 underline text-left", onClick: () => navigate("/portal/board") }, "Preview this week's game →")
      )
    );
  }

  function OrganiserPage({ tab }) {
    return h(
      Container,
      { className: "py-10 sm:py-14" },
      h(
        "div",
        { className: "flex items-center justify-between mb-2" },
        h(SectionHeading, { eyebrow: "Organiser", title: GUWH.formatDate(GUWH.nextWednesday()) }),
        h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Store.logout(); navigate("/"); } }, "Log out")
      ),
      h(OrganiserTabs, { active: tab }),
      tab === "attendance" && h(AttendanceTab),
      tab === "teams" && h(TeamBuilderTab),
      tab === "publish" && h(PublishTab)
    );
  }

  GUWH.Pages.Organiser = OrganiserPage;
})();
