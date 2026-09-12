// ---------------------------------------------------------------------------
// GUWH concept — This Week's Game (member portal only)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, Icon, TeamBoard, MilestoneCard } = GUWH.UI;

  function teamCount(board) {
    return Object.values(board.pools).reduce((n, p) => n + (p.white.length ? 1 : 0) + (p.black.length ? 1 : 0), 0);
  }

  function RunSheetRow({ time, label, muted }) {
    return h(
      "div",
      { className: "flex items-start gap-4 py-2.5 border-b border-black/5 last:border-0" },
      h("span", { className: "font-mono text-sm font-bold text-[var(--accent-dark)] w-20 shrink-0 tabular-nums" }, time),
      h("span", { className: cx("text-sm", muted ? "text-[var(--ink-soft)]" : "text-[var(--ink)] font-semibold") }, label)
    );
  }

  function MatchRow({ match, refs }) {
    return h(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white ring-1 ring-black/5 px-4 py-3" },
      h(
        "div",
        { className: "flex items-center gap-3" },
        h(Pill, { tone: "dark", className: "!py-1" }, match.pool),
        h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, match.teamA, h("span", { className: "text-[var(--ink-soft)] font-normal mx-1.5" }, "vs"), match.teamB)
      ),
      refs.length > 0 &&
        h(
          "div",
          { className: "flex items-center gap-1.5 text-xs text-[var(--ink-soft)]" },
          h(Icon, { name: "shield", size: 13, className: "text-[var(--accent-dark)]" }),
          "Ref: " + refs.join(" & ")
        )
    );
  }

  function GameBlock({ game, gameIndex, refereeList }) {
    const refs = GUWH.refereesForGame(refereeList, gameIndex);
    return h(
      "div",
      { className: "py-3 border-b border-black/5 last:border-0" },
      h(
        "div",
        { className: "flex items-center gap-4 mb-2" },
        h("span", { className: "font-mono text-sm font-bold text-[var(--accent-dark)] w-20 shrink-0 tabular-nums" }, GUWH.timeFromSessionStart(game.startMin)),
        h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, game.label + " · finishes " + GUWH.timeFromSessionStart(game.endMin))
      ),
      h(
        "div",
        { className: "flex flex-col gap-2 sm:pl-[5.5rem]" },
        game.matches.map((m) => h(MatchRow, { key: m.pool, match: m, refs }))
      )
    );
  }

  function RunSheet({ board }) {
    const gamesOnly = GUWH.gameSchedule.filter((s) => s.kind === "game");
    return h(
      "div",
      { className: "rounded-2xl border-2 border-black/5 p-5 sm:p-6" },
      h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-1" }, "The night's schedule"),
      h("p", { className: "text-sm text-[var(--ink-soft)] mb-3" }, "Three games, everyone plays every other team once."),
      GUWH.gameSchedule.map((seg) => {
        if (seg.kind === "game") {
          const gameIndex = gamesOnly.indexOf(seg);
          return h(GameBlock, { key: seg.label, game: seg, gameIndex, refereeList: board.referees });
        }
        return h(RunSheetRow, { key: seg.label, time: GUWH.timeFromSessionStart(seg.startMin), label: seg.label, muted: true });
      }),
      h(RunSheetRow, { key: "after", time: "After", label: "BBQ & drinks @ Corio Bay" })
    );
  }

  function minToClockReal(min) {
    if (min == null) return null;
    const base = new Date(2000, 0, 1, 18, 0, 0);
    base.setMinutes(base.getMinutes() + min);
    let hr = base.getHours();
    const m = base.getMinutes();
    const suffix = hr >= 12 ? "pm" : "am";
    hr = hr % 12 || 12;
    return hr + ":" + String(m).padStart(2, "0") + suffix;
  }

  // Real Game Board (live site) — read-only, shows the published teams and
  // timetable from /api/game-board, or a "not yet finalised" state.
  function RealGameBoardPage() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      GUWH.Identity.authFetch("/api/game-board")
        .then((r) => r.json())
        .then((d) => (d.ok ? setData(d) : setError(d.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, []);

    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-3xl" },
      h(SectionHeading, { eyebrow: "This week's game", title: data ? GUWH.formatDate(new Date(data.sessionDate + "T00:00:00")) : "" }),
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      loading && h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"),
      data && !data.published &&
        h(
          "div",
          { className: "rounded-2xl border-2 border-dashed border-black/10 p-10 text-center text-[var(--ink-soft)]" },
          "Check back soon — the Game Coordinator is still sorting teams for this week."
        ),
      data && data.published &&
        h(
          React.Fragment,
          null,
          h(
            "div",
            { className: "mb-10" },
            h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Teams"),
            data.teams.length === 0
              ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No teams yet.")
              : h(
                  "div",
                  { className: "grid sm:grid-cols-2 gap-4" },
                  data.teams.map((team) =>
                    h(
                      "div",
                      { key: team.id, className: "rounded-2xl bg-[var(--sand)] p-4" },
                      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, team.name),
                      team.players.length === 0
                        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "—")
                        : h(
                            "div",
                            { className: "flex flex-col gap-1.5" },
                            team.players.map((p) => h("p", { key: p.id, className: "text-sm text-[var(--ink)]" }, p.firstName + " " + p.lastName, p.isNew && h(Pill, { tone: "accent", className: "ml-2 !py-0.5 !px-2 !text-[10px]" }, "New")))
                          )
                    )
                  )
                )
          ),
          h(
            "div",
            { className: "rounded-2xl border-2 border-black/5 p-5 sm:p-6" },
            h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "The night's timetable"),
            data.slots.length === 0
              ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No games set yet.")
              : data.slots.map((slot) =>
                  h(
                    "div",
                    { key: slot.id, className: "py-3 border-b border-black/5 last:border-0" },
                    h(
                      "div",
                      { className: "flex items-center gap-4 mb-1" },
                      slot.startMin != null && h("span", { className: "font-mono text-sm font-bold text-[var(--accent-dark)] w-20 shrink-0 tabular-nums" }, minToClockReal(slot.startMin)),
                      h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, slot.label)
                    ),
                    h(
                      "div",
                      { className: cx("flex flex-col gap-1", slot.startMin != null ? "sm:pl-[5.5rem]" : "") },
                      (slot.teamAName || slot.teamBName) &&
                        h("p", { className: "text-sm text-[var(--ink)]" }, (slot.teamAName || "TBC") + " vs " + (slot.teamBName || "TBC")),
                      slot.referees.length > 0 &&
                        h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Ref: " + slot.referees.map((p) => p.firstName + " " + p.lastName).join(" & "))
                    )
                  )
                )
          )
        )
    );
  }

  // Concept-preview Game Board (artifact-entry.html only) — unchanged demo data.
  function DemoGameBoardPage() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);
    const state = GUWH.Store.getState();
    const board = state.gameBoard;
    const wed = new Date(board.weekOf);
    const confirmed = GUWH.Store.confirmedPlayerIds().length;
    const teams = teamCount(board);
    const nextTeamNeeded = Math.max(0, (teams + 1) * GUWH.TEAM_MIN_SIZE - confirmed);

    async function onShare() {
      await shareOrCopy({
        title: "Wednesday at Geelong UWH",
        text: confirmed + " players in, " + teams + " teams building for " + GUWH.formatDate(wed) + ". Bring a mate.",
        url: window.location.origin + window.location.pathname + "#/portal/board",
      });
    }

    return h(
      Container,
      { className: "py-12 sm:py-16" },
      h(
        "div",
        { className: "rounded-3xl overflow-hidden ring-1 ring-black/5 mb-8 h-40 sm:h-56" },
        h("img", { src: "images/team-dive-wide.jpg", alt: "The whole club mid-session, swimming down together", loading: "lazy", className: "w-full h-full object-cover" })
      ),
      h(
        "div",
        { className: "flex flex-wrap items-end justify-between gap-4 mb-8" },
        h(SectionHeading, { eyebrow: "This week's game", title: GUWH.formatDate(wed) }),
        h(Button, { variant: "secondary", onClick: onShare }, h(Icon, { name: "share", size: 16 }), "Share")
      ),

      // ---- schedule, moved to the top ----
      h(RunSheet, { board }),

      h(
        "div",
        { className: "grid sm:grid-cols-3 gap-4 my-10" },
        h(MilestoneCard, { icon: "users", value: confirmed, label: "Players in" }),
        h(MilestoneCard, { icon: "trophy", value: teams, label: "Teams playing" }),
        h(MilestoneCard, {
          icon: "share",
          value: nextTeamNeeded > 0 ? nextTeamNeeded : "✓",
          label: nextTeamNeeded > 0 ? "more players and we've got a 5th team!" : "Enough players for a 5th team!",
        })
      ),

      // ---- teams for the night ----
      h(
        "div",
        { className: "flex flex-wrap items-center justify-between gap-3 mb-4" },
        h("h3", { className: "font-display text-xl font-bold text-[var(--ink)]" }, "Teams for the night"),
        board.published
          ? h(Pill, { tone: "good" }, h(Icon, { name: "check", size: 12 }), "Finalised by the organiser")
          : h(Pill, { tone: "warn" }, "Not yet finalised by the organiser")
      ),

      board.published
        ? h(
            "div",
            { className: "grid lg:grid-cols-2 gap-6" },
            h(TeamBoard, { pool: "Pool A" }),
            h(TeamBoard, { pool: "Pool B" })
          )
        : h(
            "div",
            { className: "rounded-2xl border-2 border-dashed border-black/10 p-10 text-center text-[var(--ink-soft)]" },
            "Check back soon — the organiser is still sorting ", GUWH.TEAM_NAMES.join(", "), " for this week."
          )
    );
  }

  function GameBoardPage() {
    return GUWH.Identity ? h(RealGameBoardPage) : h(DemoGameBoardPage);
  }

  GUWH.Pages.GameBoard = GameBoardPage;
})();
