// ---------------------------------------------------------------------------
// GUWH concept — This Week's Game (member portal only)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, Icon, TeamBoard, MilestoneCard, inputCls } = GUWH.UI;

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
    return (list || []).map((p) => GUWH.displayName(p)).join(", ");
  }

  // Shared five-column public timetable — used by the real Game Board page
  // below AND by the Game Coordinator's "Preview the public timetable"
  // toggle in the Timetable builder (same component, fed live draft rows
  // instead of the published ones, so a preview is the real render, not a
  // mockup of it). Time / Pool A — Black / Pool A — White / Pool B — Black /
  // Pool B — White, in that order, with non-game rows spanning the four
  // pool columns. Never relies on colour alone — every cell is labelled.
  // teamCell renders one team-name cell in the desktop grid, highlighting it
  // when it's the logged-in member's own team (see highlightTeamName below)
  // — an accent border/background plus a "YOUR TEAM" label, never colour
  // alone, so it still reads under colour-blindness or on a bad screen.
  function teamCell(name, highlightTeamName, extraClass, prefix) {
    const mine = !!(name && highlightTeamName && name === highlightTeamName);
    return h(
      "div",
      { className: cx("py-2.5 border-b border-black/5 text-sm font-semibold", extraClass, mine ? "text-[var(--accent-dark)]" : "text-[var(--ink)]") },
      mine && h("span", { className: "block text-[9px] font-bold uppercase tracking-wide text-[var(--accent-dark)]" }, "Your team"),
      prefix && h("span", { className: "text-[var(--ink-soft)] font-normal" }, prefix),
      h("span", { className: mine ? "underline decoration-2 decoration-[var(--accent)] underline-offset-2" : "" }, name || "—")
    );
  }

  // Mobile equivalent of teamCell — inline text (not a block cell), so "your
  // team" is shown with a bold accent colour plus a "(you)" word, never
  // colour alone.
  function teamNameInline(name, highlightTeamName) {
    const mine = !!(name && highlightTeamName && name === highlightTeamName);
    return h(
      "span",
      { className: mine ? "font-bold text-[var(--accent-dark)]" : undefined },
      name || "TBC",
      mine && " (you)"
    );
  }

  function MobileTimetable({ rows, highlightTeamName }) {
    return h(
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
                  ((row.gameCount || (row.poolGames || []).length) === 1
                    ? [{ key: "", data: poolA }]
                    : [
                    { key: "Pool A", data: poolA },
                    { key: "Pool B", data: poolB },
                  ]).map(
                    ({ key, data }) =>
                      (data && (data.blackTeamName || data.whiteTeamName)) &&
                      h(
                        "div",
                        { key: key || "single" },
                        key && h("p", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, key),
                        h(
                          "p",
                          { className: "text-sm text-[var(--ink)]" },
                          h("span", { className: "text-[var(--ink-soft)]" }, "Black: "),
                          teamNameInline(data.blackTeamName, highlightTeamName),
                          h("span", { className: "text-[var(--ink-soft)] ml-3" }, "White: "),
                          teamNameInline(data.whiteTeamName, highlightTeamName)
                        ),
                        data.referees && data.referees.length > 0 && h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, "Referees: " + refNames(data.referees))
                      )
                  )
                )
          );
        })
      );
  }

  function PublicTimetable({ rows, highlightTeamName }) {
    if (!rows || rows.length === 0) {
      return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No timetable rows yet.");
    }
    // Every game tonight is one-at-a-time (12 Oct 2026): a simpler desktop
    // grid - Time / Black Stick / White Stick - instead of four pool columns.
    const anyDouble = rows.some((r) => r.isGame && (r.gameCount || (r.poolGames || []).length) === 2);
    if (!anyDouble) {
      const head = "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)] pb-2 border-b-2 border-black/10";
      const desktop = h(
        "div",
        { className: "hidden md:grid gap-x-3 gap-y-0", style: { gridTemplateColumns: "88px 1fr 1fr" } },
        h("div", { className: head }, "Time"),
        h("div", { className: head }, "Black Stick"),
        h("div", { className: head }, "White Stick"),
        rows.map((row) => {
          const g = (row.poolGames || [])[0];
          const time = h("div", { key: row.id + "-t", className: "py-2.5 border-b border-black/5 font-mono text-xs font-bold text-[var(--accent-dark)] tabular-nums" }, minToClockReal(row.startMin) || "—");
          if (!row.isGame) {
            return h(
              React.Fragment,
              { key: row.id },
              time,
              h("div", { className: "py-2.5 border-b border-black/5 col-span-2" }, h("span", { className: "text-sm font-bold text-[var(--ink)]" }, row.label), row.notes && h("span", { className: "text-xs text-[var(--ink-soft)] ml-2" }, row.notes))
            );
          }
          return h(
            React.Fragment,
            { key: row.id },
            time,
            teamCell(g && g.blackTeamName, highlightTeamName),
            teamCell(g && g.whiteTeamName, highlightTeamName),
            g && g.referees && g.referees.length > 0 &&
              h(React.Fragment, null, h("div", { className: "pb-2.5 border-b border-black/5" }), h("div", { className: "pb-2.5 border-b border-black/5 col-span-2 text-xs text-[var(--ink-soft)]" }, "Referees: " + refNames(g.referees)))
          );
        })
      );
      return h(React.Fragment, null, desktop, h(MobileTimetable, { rows, highlightTeamName }));
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
          // One game at a time (12 Oct 2026): Black and White each span both
          // pool columns, and the referee line spans all four.
          if ((row.gameCount || (row.poolGames || []).length) === 1) {
            // One game at a time (12 Oct 2026): a single matchup across all
            // four pool columns ("Black: X v White: Y"), referees underneath.
            const refs = poolA && poolA.referees && poolA.referees.length > 0 ? poolA.referees : null;
            return h(
              React.Fragment,
              { key: row.id },
              timeCell,
              h(
                "div",
                { className: "py-2.5 border-b border-black/5 col-span-4 text-sm font-semibold text-[var(--ink)] flex flex-wrap items-baseline gap-x-2" },
                h("span", { className: "text-[var(--ink-soft)] font-normal" }, "Black:"),
                teamNameInline(poolA && poolA.blackTeamName, highlightTeamName),
                h("span", { className: "text-[var(--ink-soft)] font-normal px-1" }, "v"),
                h("span", { className: "text-[var(--ink-soft)] font-normal" }, "White:"),
                teamNameInline(poolA && poolA.whiteTeamName, highlightTeamName),
                refs && h("span", { className: "basis-full text-xs font-normal text-[var(--ink-soft)] mt-0.5" }, "Referees: " + refNames(refs))
              )
            );
          }
          return h(
            React.Fragment,
            { key: row.id },
            timeCell,
            teamCell(poolA && poolA.blackTeamName, highlightTeamName),
            teamCell(poolA && poolA.whiteTeamName, highlightTeamName),
            teamCell(poolB && poolB.blackTeamName, highlightTeamName),
            teamCell(poolB && poolB.whiteTeamName, highlightTeamName),
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
      h(MobileTimetable, { rows, highlightTeamName })
    );
  }

  // MVP nomination card — only ever shown to someone who actually refereed
  // a pool game in this session's timetable (checked server-side by
  // /api/mvp, never inferred here). One nomination per referee per night;
  // submitting again just updates it.
  function MvpNominationCard({ mvp, onSaved }) {
    const [nomineeId, setNomineeId] = React.useState((mvp.myNomination && mvp.myNomination.nomineeId) || "");
    const [note, setNote] = React.useState((mvp.myNomination && mvp.myNomination.note) || "");
    const [saving, setSaving] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function submit(ev) {
      ev.preventDefault();
      if (!nomineeId) return;
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        const res = await GUWH.Identity.authFetch("/api/mvp", { method: "POST", body: JSON.stringify({ sessionDate: mvp.sessionDate, nomineeId, note }) });
        const d = await res.json();
        if (d.ok) {
          setSaved(true);
          onSaved(d);
        } else {
          setError(d.error || "Something went wrong");
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    }

    return h(
      "div",
      { className: "rounded-2xl border-2 border-black/5 p-5 sm:p-6 mt-6" },
      h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-1" }, "Nominate tonight's MVP"),
      h("p", { className: "text-sm text-[var(--ink-soft)] mb-3" }, "You reffed a game this session — pick who impressed you most."),
      error && h("p", { className: "text-sm text-[var(--bad)] mb-2" }, error),
      h(
        "form",
        { onSubmit: submit, className: "flex flex-col gap-3 max-w-sm" },
        h(
          "select",
          { className: inputCls, value: nomineeId, onChange: (e) => setNomineeId(e.target.value) },
          h("option", { value: "" }, "Choose a player…"),
          mvp.nominees.map((p) => h("option", { key: p.id, value: p.id }, GUWH.displayName(p)))
        ),
        h("input", { type: "text", maxLength: 280, placeholder: "Optional note (e.g. why)", className: inputCls, value: note, onChange: (e) => setNote(e.target.value) }),
        h(Button, { type: "submit", disabled: !nomineeId || saving }, mvp.myNomination ? "Update nomination" : "Submit nomination")
      ),
      saved && h("p", { className: "text-xs text-[var(--good-dark)] mt-2" }, "Saved.")
    );
  }

  // Results for the week (2 Oct 2026): final scores, goal scorers and the
  // night's MVP, from /api/game-board. Renders nothing until something has
  // been recorded for that week.
  function ResultsCard({ rows, mvp, highlightTeamName }) {
    const games = [];
    (rows || []).forEach((row) => (row.poolGames || []).forEach((pg) => {
      if (pg.blackScore != null && pg.whiteScore != null) games.push(Object.assign({ rowLabel: row.label, single: (row.gameCount || (row.poolGames || []).length) === 1 }, pg));
    }));
    const mvps = mvp || [];
    if (games.length === 0 && mvps.length === 0) return null;
    const scorerLine = (pg, side) => pg.scorers.filter((x) => x.side === side).map((x) => x.name + (x.goals > 1 ? " x" + x.goals : "")).join(", ");
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 sm:p-6 mb-8" },
      h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Results"),
      mvps.length > 0 &&
        h(
          "div",
          { className: "rounded-xl bg-[var(--accent-12)] px-4 py-3 mb-4 flex items-center gap-2" },
          h(Icon, { name: "trophy", size: 16, className: "text-[var(--accent-dark)]" }),
          h("span", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)]" }, "MVP"),
          h("span", { className: "font-display font-bold text-[var(--ink)]" }, mvps.map((m) => m.name).join(" & "))
        ),
      h(
        "div",
        { className: "flex flex-col divide-y divide-black/5" },
        games.map((pg, i) =>
          h(
            "div",
            { key: i, className: "py-2.5" },
            h("p", { className: "text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, pg.single ? pg.rowLabel : pg.rowLabel + " · " + pg.pool),
            h(
              "div",
              { className: "flex items-center justify-between gap-3 mt-0.5" },
              h("span", { className: "text-sm text-[var(--ink)]" }, h("span", { className: "text-[var(--ink-soft)]" }, "Black: "), teamNameInline(pg.blackTeamName, highlightTeamName)),
              h("span", { className: "font-display font-bold tabular-nums text-[var(--ink)] shrink-0" }, pg.blackScore + " - " + pg.whiteScore),
              h("span", { className: "text-sm text-[var(--ink)] text-right" }, h("span", { className: "text-[var(--ink-soft)]" }, "White: "), teamNameInline(pg.whiteTeamName, highlightTeamName))
            ),
            pg.scorers && pg.scorers.length > 0 &&
              h(
                "div",
                { className: "flex justify-between gap-3 text-xs text-[var(--ink-soft)] mt-0.5" },
                h("span", null, scorerLine(pg, "black")),
                h("span", { className: "text-right" }, scorerLine(pg, "white"))
              )
          )
        )
      )
    );
  }

  // Real Game Board (live site) — read-only, shows the published teams and
  // timetable from /api/game-board, or a "not yet finalised" state.
  // Week by week (2 Oct 2026): Prev/Next steps through every published
  // Wednesday, so members can look back at how previous weeks went.
  function RealGameBoardPage() {
    const [data, setData] = React.useState(null);
    const [myId, setMyId] = React.useState(null);
    const [mvp, setMvp] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function load(date) {
      setLoading(true);
      setError(null);
      setMvp(null);
      const q = date ? "?date=" + encodeURIComponent(date) : "";
      GUWH.Identity.authFetch("/api/game-board" + q)
        .then((r) => r.json())
        .then((d) => (d.ok ? setData(d) : setError(d.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
      // Whether I refereed that week, and if so my current nomination —
      // harmless if it fails, the rest of the board still works.
      GUWH.Identity.authFetch("/api/mvp" + q).then((r) => r.json()).then((d) => { if (d.ok && d.published) setMvp(d); }).catch(() => {});
    }

    React.useEffect(() => {
      load();
      // Just for "your team" highlighting below — failure here is harmless,
      // the page still works without it.
      GUWH.Identity.authFetch("/api/profile").then((r) => r.json()).then((d) => { if (d.ok) setMyId(d.member.id); }).catch(() => {});
    }, []);

    const isPast = !!(data && data.upcoming && data.sessionDate < data.upcoming);

    // Highlighting works on drafts too (20 Oct 2026) — knowing your team
    // early is most of the point of showing an unfinished board.
    const myTeam = myId ? myTeamFor(data, myId) : null;
    const myTeamName = myTeam ? myTeam.name : null;
    const showBoard = !!(data && data.hasDraft);

    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-4xl" },
      h(SectionHeading, { eyebrow: isPast ? "Past game" : "This week's game", title: data ? GUWH.formatDate(new Date(data.sessionDate + "T00:00:00")) : "" }),
      data && data.weeks && data.weeks.length > 1 &&
        h("div", { className: "max-w-md mb-8" }, h(GUWH.UI.WeekSwitcher, { date: data.sessionDate, weeks: data.weeks, upcoming: data.upcoming, onChange: load })),
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      loading && h("p", { className: "text-sm text-[var(--ink-soft)] mb-4" }, "Loading…"),
      data && !showBoard &&
        h(
          "div",
          { className: "rounded-2xl border-2 border-dashed border-black/10 p-10 text-center text-[var(--ink-soft)]" },
          isPast ? "No game board was published for this week." : "Check back soon — the Game Coordinator hasn't started teams for this week."
        ),
      showBoard && !data.published && h(GUWH.UI.DraftNotice, { className: "mb-6" }),
      showBoard &&
        h(
          React.Fragment,
          null,
          data.published && h(ResultsCard, { rows: data.rows, mvp: data.mvp, highlightTeamName: myTeamName }),
          h(
            "div",
            { className: "mb-10" },
            h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Teams"),
            data.teams.length === 0
              ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No teams yet.")
              : h(
                  "div",
                  { className: "grid sm:grid-cols-2 gap-4" },
                  data.teams.map((team) => {
                    const mine = team.name === myTeamName;
                    return h(
                      "div",
                      { key: team.id, className: cx("rounded-2xl p-4", mine ? "bg-[var(--accent-12)] ring-2 ring-[var(--accent)]" : "bg-[var(--sand)]") },
                      h(
                        "div",
                        { className: "flex items-center justify-between mb-2" },
                        h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, team.name),
                        mine && h(Pill, { tone: "accent", className: "!py-0.5 !px-2 !text-[10px]" }, "Your team")
                      ),
                      team.players.length === 0
                        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "—")
                        : h(
                            "div",
                            { className: "flex flex-col gap-1.5" },
                            team.players.map((p) => h("p", { key: p.id, className: "text-sm text-[var(--ink)]" }, GUWH.displayName(p), p.isNew && h(Pill, { tone: "accent", className: "ml-2 !py-0.5 !px-2 !text-[10px]" }, "New")))
                          )
                    );
                  })
                )
          ),
          h(
            "div",
            { className: "rounded-2xl border-2 border-black/5 p-5 sm:p-6" },
            h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "The night's timetable"),
            h(PublicTimetable, { rows: data.rows, highlightTeamName: myTeamName })
          ),
          mvp && mvp.canNominate && h(MvpNominationCard, { mvp, onSaved: setMvp })
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
