// ---------------------------------------------------------------------------
// Game Coordination workspace (live site, real backend) — for members with
// the game_coordinator or administrator role. Shows who's really confirmed
// for this Wednesday and lets a coordinator add or cancel a member's
// attendance on their behalf. Team building/publishing is a bigger feature
// planned separately; this covers attendance, the first real need.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;

  function CoordinatorPage() {
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
        const res = await GUWH.Identity.authFetch("/api/coordinator/attendance", {
          method: "POST",
          body: JSON.stringify({ memberEmail, in: isIn }),
        });
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
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Game Coordination", title: "This Wednesday's attendance", sub: "Real bookings, editable on a player's behalf." }),

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
                    h(
                      "p",
                      { className: "text-sm font-semibold text-[var(--ink)] flex items-center gap-2" },
                      p.firstName + " " + p.lastName,
                      p.isNew && h(Pill, { tone: "accent" }, "New")
                    ),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, p.email)
                  ),
                  h(Button, { size: "sm", variant: "ghost", onClick: () => setAttendance(p.email, false) }, "Cancel")
                )
              )
            )
      ),

      h(
        "p",
        { className: "text-xs text-[var(--ink-soft)] mt-8" },
        "Team building and publishing the Game Board are being built next — this page only handles attendance for now."
      )
    );
  }

  GUWH.Pages.Coordinator = CoordinatorPage;
})();
