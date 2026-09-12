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

  function refNames(list) {
    return (list || []).map((p) => p.firstName + " " + p.lastName).join(", ");
  }

  // Shared five-column public timetable — used by the real Game Board page
  // below AND by the Game Coordinator's "Preview the public timetable"
  // toggle in the Timetable builder (same component, fed live draft rows
  // instead of the published ones, so a preview is the real render, not a
  // mockup of it). Time / Pool A — Black / Pool A — White / Pool B — Black /
  // Pool B — White, in that order, with non-game rows spanning the four
  // pool columns. Never relies on colour alone — every cell is labelled.
  function PublicTimetable({ rows }) {
    if (!rows || rows.length === 0) {
      return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No timetable rows yet.");
    }
    return h(
      React.Fragment,
      null,
      // ---- Desktop: true 5-column grid, so every row lines up. ----
      h(
        "div",
        { className: "hidden md:grid gap-x-3 gap-y-0", style: { gridTemplateColumns: "88px repeat(4, 1fr)" } },
        h("div", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10" }, "Time"),
        h("div", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10" }, "Pool A — Black Stick"),
        h("div", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10" }, "Pool A — White Stick"),
        h("div", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10" }, "Pool B — Black Stick"),
        h("div", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10" }, "Pool B — White Stick"),
        rows.map((row) => {
          const poolA = row.poolGames && row.poolGames.find((p) => p.pool === "Pool A");
          const poolB = row.poolGames && row.poolGames.find((p) => p.pool === "Pool B");
          const showRefLine = row.isGame && (((poolA && poolA.referees) || []).length > 0 || ((poolB && poolB.referees) || []).length > 0);
          const timeCell = h(
            "div",
            { key: row.id + "-time", className: "py-2.5 border-b border-black/5 font-mono text-xs font-bold text-[var(--accent-dark)] tabular-nums" },
            minToClockReal(row.startMin) || "—"
          );
          if (!row.isGame) {
            return h(
              React.Fragment,
              { key: row.id },
              timeCell,
              h(
                "div",
                { className: "py-2.5 border-b border-black/5 col-span-4" },
                h("span", { className: "text-sm font-bold text-[var(--ink)]" }, row.label),
                row.notes && h("span", { className: "text-xs text-[var(--ink-soft)] ml-2" }, row.notes)
              )
            );
          }
          return h(
            React.Fragment,
            { key: row.id },
            timeCell,
            h("div", { className: "py-2.5 border-b border-black/5 text-sm font-semibold text-[var(--ink)]" }, (poolA && poolA.blackTeamName) || "—"),
            h("div", { className: "py-2.5 border-b border-black/5 text-sm font-semibold text-[var(--ink)]" }, (poolA && poolA.whiteTeamName) || "—"),
            h("div", { className: "py-2.5 border-b border-black/5 text-sm font-semibold text-[var(--ink)]" }, (poolB && poolB.blackTeamName) || "—"),
            h("div", { className: "py-2.5 border-b border-black/5 text-sm font-semibold text-[var(--ink)]" }, (poolB && poolB.whiteTeamName) || "—"),
            showRefLine &&
              h(
                React.Fragment,
                null,
                h("div", { className: "pb-2.5 border-b border-black/5" }),
                h(
                  "div",
                  { className: "pb-2.5 border-b border-black/5 col-span-2 text-xs text-[var(--ink-soft)]" },
                  poolA && poolA.referees && poolA.referees.length > 0 ? "Referees: " + refNames(poolA.referees) : ""
                ),
                h(
                  "div",
                  { className: "pb-2.5 border-b border-black/5 col-span-2 text-xs text-[var(--ink-soft)]" },
                  poolB && poolB.referees && poolB.referees.length > 0 ? "Referees: " + refNames(poolB.referees) : ""
                )
              )
          );
        })
      ),
      // ---- Mobile: one card per time slot, pools stacked, clearly labelled. ----
      h(
        "div",
        { className: "md:hidden flex flex-col gap-3" },
        rows.map((row) => {
          const poolA = row.poolGames && row.poolGames.find((p) => p.pool === "Pool A");
          const poolB = row.poolGames && row.poolGames.find((p) => p.pool === "Pool B");
          return h(
            "div",
            { key: row.id, className: "rounded-xl bg-[var(--sand)] p-3.5" },
            h(
              "div",
              { className: "flex items-center gap-2 mb-2" },
              h("span", { className: "font-mono text-xs font-bold text-[var(--accent-dark)] tabular-nums" }, minToClockReal(row.startMin) || "—"),
              h("span", { className: "text-sm font-bold text-[var(--ink)]" }, row.label)
            ),
            !row.isGame
              ? row.notes && h("p", { className: "text-xs text-[var(--ink-soft)]" }, row.notes)
              : h(
                  "div",
                  { className: "flex flex-col gap-2.5" },
                  [
                    { key: "Pool A", data: poolA },
                    { key: "Pool B", data: poolB },
                  ].map(
                    ({ key, data }) =>
                      (data && (data.blackTeamName || data.whiteTeamName)) &&
                      h(
                        "div",
                        { key },
                        h("p", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, key),
                        h(
                          "p",
                          { className: "text-sm text-[var(--ink)]" },
                          h("span", { className: "text-[var(--ink-soft)]" }, "Black: "),
                          data.blackTeamName || "TBC",
                          h("span", { className: "text-[var(--ink-soft)] ml-3" }, "White: "),
                          data.whiteTeamName || "TBC"
                        ),
                        data.referees && data.referees.length > 0 && h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, "Referees: " + refNames(data.referees))
                      )
                  )
                )
          );
        })
      )
    );
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
      { className: "py-12 sm:py-16 max-w-4xl" },
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
            h(PublicTimetable, { rows: data.rows })
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
  // Exposed so the Game Coordinator's Timetable builder can render an exact
  // "Preview the public timetable" using live draft rows, rather than a
  // separate mockup of the public page.
  GUWH.Pages.PublicTimetable = PublicTimetable;
})();
