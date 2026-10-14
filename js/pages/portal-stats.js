// ---------------------------------------------------------------------------
// Player Stats (14 Oct 2026, Cheongy): the numbers a player can't edit -
// games played and goals - moved off the Profile page, which is now only
// things a player can change. Games are counted from real attendance
// history; goals are entered by the Game Coordinator after each session.
// A parent also sees their children's numbers here (My kids).
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading } = GUWH.UI;

  function StatTile({ label, value, hint }) {
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5" },
      h("p", { className: "font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, label),
      h("p", { className: "font-display text-4xl font-bold text-[var(--ink)] mt-1 tabular-nums" }, String(value)),
      hint && h("p", { className: "text-xs text-[var(--ink-soft)] mt-1" }, hint)
    );
  }

  function StatRow({ title, sub, games, season, career }) {
    return h(
      "div",
      { className: "mb-8" },
      h("h2", { className: "font-display text-xl font-bold text-[var(--ink)]" }, title),
      sub && h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, sub),
      h(
        "div",
        { className: "grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3" },
        h(StatTile, { label: "Games played", value: games }),
        h(StatTile, { label: "Goals this season", value: season, hint: "Calendar year" }),
        h(StatTile, { label: "Career goals", value: career })
      )
    );
  }

  function PlayerStatsPage() {
    const [me, setMe] = React.useState(null);
    const [kids, setKids] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      Promise.all([
        GUWH.Identity.authFetch("/api/profile").then((r) => r.json()),
        GUWH.Identity.authFetch("/api/family").then((r) => r.json()).catch(() => ({ ok: false })),
      ])
        .then(([p, f]) => {
          if (p.ok) setMe(p.member); else setError(p.error || "Something went wrong");
          if (f && f.ok) setKids(f.kids);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, []);

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Player stats", title: "Your numbers", sub: "Games are counted from the attendance roll. Goals are entered by the Game Coordinator after each session." }),
      loading && h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"),
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      me && h(StatRow, { title: (me.nickname || me.firstName || "You"), games: me.gamesPlayed || 0, season: me.seasonGoals || 0, career: me.careerGoals || 0 }),
      kids.map((k) => h(StatRow, { key: k.id, title: k.firstName, sub: "Your child", games: k.gamesPlayed || 0, season: k.seasonGoals || 0, career: k.careerGoals || 0 }))
    );
  }

  GUWH.Pages.PlayerStats = PlayerStatsPage;
})();
