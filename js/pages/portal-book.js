// ---------------------------------------------------------------------------
// GUWH concept — Book a Game (booking status + games played)
//
// Live: reads and writes the real booking through /api/booking, the same
// endpoint the Dashboard uses, so both pages always agree. Games played
// comes from /api/profile. There is no per-week attendance history endpoint
// yet, so this page doesn't show one rather than inventing it.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading } = GUWH.UI;
  const { navigate } = GUWH.Router;

  function BookGamePage() {
    const [user, setUser] = React.useState(() => GUWH.Identity.currentUser());
    const [status, setStatus] = React.useState(null);
    const [profile, setProfile] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => GUWH.Identity.onChange(() => setUser(GUWH.Identity.currentUser())), []);

    React.useEffect(() => {
      if (!user) return;
      setLoading(true);
      setError(null);
      GUWH.Identity.authFetch("/api/booking")
        .then((r) => r.json())
        .then((data) => (data.ok ? setStatus(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
      GUWH.Identity.authFetch("/api/profile")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setProfile(d.member); })
        .catch(() => {});
    }, [user]);

    async function setIn(wantsIn) {
      setLoading(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/booking", { method: "POST", body: JSON.stringify({ in: wantsIn }) });
        const data = await res.json();
        if (data.ok) setStatus(data);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    if (!user) return null;

    const isIn = !!(status && status.myStatus === "in");
    const sessionDate = status ? new Date(status.sessionDate + "T00:00:00") : null;

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(SectionHeading, { eyebrow: "Book a game", title: sessionDate ? GUWH.formatDate(sessionDate) : "This Wednesday" }),

      h(
        "div",
        { className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6" },
        h(
          "div",
          null,
          h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Your status for this Wednesday"),
          h(
            "p",
            { className: "font-display text-2xl font-bold mt-1", style: { color: isIn ? "var(--good-dark)" : "var(--ink)" } },
            loading && !status ? "Loading…" : isIn ? "You're in" : "Not booked yet"
          ),
          status && h("p", { className: "text-xs text-[var(--ink-soft)] mt-2" }, status.confirmedCount + " booked in so far. Please book by 5pm so the Game Coordinator can build teams — you can change your mind any time.")
        ),
        h(
          Button,
          { size: "lg", variant: isIn ? "danger" : "primary", disabled: loading || !status, onClick: () => setIn(!isIn) },
          h(Icon, { name: isIn ? "x" : "check", size: 18 }),
          isIn ? "Cancel my spot" : "I'm in"
        )
      ),

      error && h("p", { className: "mt-4 text-sm text-[var(--bad)]", role: "alert" }, error),

      h(
        "div",
        { className: "mt-10" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Your games"),
        h(
          "div",
          { className: "rounded-2xl bg-[var(--sand)] px-5 py-4 flex items-center justify-between gap-4" },
          h("span", { className: "text-sm text-[var(--ink)]" }, profile ? "You've played " + (profile.gamesPlayed || 0) + " game" + ((profile.gamesPlayed || 0) === 1 ? "" : "s") + "." : "Loading your games…"),
          h(Button, { size: "sm", variant: "ghost", onClick: () => navigate("/portal/stats") }, "See my stats")
        )
      )
    );
  }

  GUWH.Pages.BookGame = BookGamePage;
})();
