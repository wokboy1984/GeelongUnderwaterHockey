// ---------------------------------------------------------------------------
// GUWH concept — Member dashboard
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, MilestoneCard, AttendanceCounter, MemberPhoto } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const FINANCE_KIND_LABEL = { game: "Game attendance", joining: "Joining fee", annual: "Yearly membership", payment: "Payment received" };
  function money(cents) {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((Number(cents) || 0) / 100);
  }

  // Photo, name, grade, position at a glance — a link through to the full
  // Profile page rather than a second place to edit any of it.
  function ProfileSummaryCard({ profile, compact }) {
    return h(
      "button",
      {
        onClick: () => navigate("/portal/profile"),
        className: "w-full rounded-2xl bg-white ring-1 ring-black/5 p-4 flex items-center gap-3 text-left hover:ring-[var(--accent)] transition",
      },
      h(MemberPhoto, { memberId: profile.id, version: profile.photoVersion, size: compact ? 40 : 52 }),
      h(
        "div",
        { className: "flex-1 min-w-0" },
        h("p", { className: "font-display font-bold text-[var(--ink)] truncate" }, profile.firstName + (profile.lastName ? " " + profile.lastName : "")),
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, (profile.grade || "Grade not set") + " · " + profile.position),
        // Games played stays visible but small — it's real (counted from
        // attendance history), just not important enough to be a big stat.
        typeof profile.gamesPlayed === "number" && profile.gamesPlayed > 0 &&
          h("p", { className: "text-[11px] text-[var(--ink-soft)] mt-0.5" }, profile.gamesPlayed + (profile.gamesPlayed === 1 ? " game played" : " games played"))
      ),
      h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)] shrink-0" })
    );
  }

  function bookingWindow(wed) {
    const opensAt = new Date(wed);
    opensAt.setDate(opensAt.getDate() - 7);
    const closesAt = new Date(wed);
    closesAt.setHours(16, 0, 0, 0); // 4:00pm Wednesday
    const now = new Date();
    return {
      opensAt, closesAt,
      isOpen: now >= opensAt && now < closesAt,
      isPastClose: now >= closesAt,
      isFuture: now < opensAt,
    };
  }

  // ---- Teams + timetable live on their own page again (/portal/board,
  // "This Week's Game") — this is just a link card through to it, not an
  // embedded copy (13 Sept 2026, Cheongy's request: put Teams/Timetable
  // back on their own Members Portal page rather than folded into here).
  function ThisWeeksGameCard({ board }) {
    return h(
      "button",
      { onClick: () => navigate("/portal/board"), className: "w-full rounded-2xl bg-white ring-1 ring-black/5 p-4 text-left hover:ring-[var(--accent)] transition flex items-center justify-between" },
      h(
        "div",
        null,
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, "This Week's Game"),
        h("p", { className: "text-sm text-[var(--ink-soft)]" }, board && board.published ? "Teams and timetable are published — see pools, teams and cap colours." : "Teams and timetable not published yet.")
      ),
      h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)] shrink-0" })
    );
  }

  // ---- Bring a Mate: its own box directly on the dashboard, not a popup
  // (13 Sept 2026, Cheongy's request) — same compact form used before in
  // the modal, just rendered inline now. The standalone /portal/bring-a-mate
  // page and its own layout are still completely untouched.
  // Bring a Mate as a single button (2 Oct 2026, Cheongy's request) — sits
  // in the right column next to Who's Coming and opens the full Bring a
  // Mate page (invite form + WhatsApp/Messenger/Text share buttons).
  function BringAMateButton() {
    return h(
      "button",
      {
        onClick: () => navigate("/portal/bring-a-mate"),
        className: "w-full rounded-2xl bg-[var(--accent-12)] p-4 text-left hover:ring-2 hover:ring-[var(--accent)] transition flex items-center justify-between gap-3",
      },
      h(
        "div",
        null,
        h("p", { className: "font-display font-bold text-[var(--accent-dark)]" }, "Bring a Mate"),
        h("p", { className: "text-xs text-[var(--ink-70)] mt-0.5" }, "Their first three sessions are free. Invite or share in one tap.")
      ),
      h("span", { className: "h-10 w-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0" }, h(Icon, { name: "share", size: 18 }))
    );
  }

  // Inline form version — no longer on the dashboard (replaced by
  // BringAMateButton above), kept in case it's wanted back.
  function BringAMateCard() {
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--accent-12)] p-4" },
      h("p", { className: "font-display font-bold text-[var(--accent-dark)] mb-1" }, "Bring a Mate"),
      h("p", { className: "text-xs text-[var(--ink-70)] mb-3" }, "They'll show up for organisers as a guest — not counted in the confirmed number above."),
      GUWH.Pages.BringAMateForm && h(GUWH.Pages.BringAMateForm, {})
    );
  }

  // ---- Finance summary — real data only, via GET /api/finance?self=1 ----
  function FinanceCard({ finance }) {
    if (!finance || finance.hasAccount === false) return null;
    const owesNothing = finance.closing <= 0;
    const monthEntries = (finance.entries || []).filter((e) => String(e.entryDate || e.entry_date || "").slice(0, 7) === finance.month);
    const gameCharges = monthEntries.filter((e) => e.kind === "game").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);
    const otherCharges = monthEntries.filter((e) => e.kind !== "game" && e.kind !== "payment").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);
    const paidThisMonth = monthEntries.filter((e) => e.kind === "payment").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h("p", { className: "font-display font-bold text-[var(--ink)] mb-1" }, "Finance"),
      owesNothing
        ? h("p", { className: "text-sm text-[var(--good-dark)] font-semibold flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "You're all up to date")
        : h(
            "div",
            null,
            h("p", { className: "font-display text-2xl font-bold text-[var(--ink)] tabular-nums" }, money(finance.closing), h("span", { className: "text-xs font-normal text-[var(--ink-soft)] ml-1" }, "total outstanding")),
            h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, "This month: " + money(finance.charges - finance.payments))
          ),
      (gameCharges > 0 || otherCharges > 0 || paidThisMonth > 0 || finance.opening > 0) &&
        h(
          "div",
          { className: "mt-3 pt-3 border-t border-black/5 flex flex-col gap-1 text-xs text-[var(--ink-soft)]" },
          finance.opening > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Previous unpaid balance"), h("span", { className: "tabular-nums" }, money(finance.opening))),
          gameCharges > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Monthly playing fees"), h("span", { className: "tabular-nums" }, money(gameCharges))),
          otherCharges > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Other recorded charges"), h("span", { className: "tabular-nums" }, money(otherCharges))),
          paidThisMonth > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Payments received"), h("span", { className: "tabular-nums" }, "−" + money(paidThisMonth)))
        ),
      h("p", { className: "text-xs text-[var(--ink-soft)] mt-3" }, "A quick summary to help you keep track."),
      // The full Finance workspace is Treasurer/Administrator-only — only
      // show the link to someone who can actually open it.
      GUWH.Identity.currentRoles().some((r) => r === "treasurer" || r === "administrator") &&
        h("button", { onClick: () => navigate("/finance"), className: "text-xs text-[var(--accent-dark)] font-semibold underline mt-2" }, "View Finance")
    );
  }

  // ---- Forum: announcement + latest discussions, split from the old
  // single widget. Renders nothing at all for a junior, a member without a
  // DOB on file, or an adult who hasn't opted in — never a locked/teaser
  // version for anyone else.
  function AnnouncementCard({ announcement }) {
    if (!announcement) return null;
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--accent-12)] p-4" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)] mb-1" }, "Club announcement"),
      h(
        "button",
        { onClick: () => navigate("/portal/forum/topic/" + announcement.id), className: "text-left block w-full" },
        h("p", { className: "text-sm font-bold text-[var(--ink)]" }, announcement.title),
        announcement.openingSummary && h("p", { className: "text-xs text-[var(--ink-soft)] mt-1 line-clamp-2" }, announcement.openingSummary),
        h("p", { className: "text-[11px] text-[var(--ink-soft)] mt-1.5" }, announcement.authorDisplay + " · " + GUWH.formatRelativeTime(announcement.lastActivityAt))
      )
    );
  }

  function DiscussionsCard({ topics, unreadCount }) {
    const rest = topics.slice(0, 3);
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h(
        "div",
        { className: "flex items-center justify-between mb-2" },
        h("p", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, "Latest discussions", unreadCount > 0 && h(Pill, { tone: "accent", className: "!py-0 !px-1.5" }, unreadCount)),
        h("button", { onClick: () => navigate("/portal/forum"), className: "text-xs text-[var(--accent-dark)] font-semibold underline" }, "Open Forum")
      ),
      rest.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No recent discussions yet.")
        : h(
            "div",
            { className: "flex flex-col divide-y divide-black/5" },
            rest.map((t) =>
              h(
                "button",
                { key: t.id, onClick: () => navigate("/portal/forum/topic/" + t.id), className: "text-left py-2 hover:opacity-70" },
                h("p", { className: "text-sm text-[var(--ink)]" }, t.title),
                h(
                  "p",
                  { className: "text-xs text-[var(--ink-soft)]" },
                  // "Last reply by" (2 Oct 2026): lastActivityBy is whoever posted
                  // last, which read as the topic's author. Now labelled.
                  t.categoryName + " · " +
                    (t.replyCount
                      ? "Started by " + t.authorDisplay + " · last reply " + t.lastActivityBy + " " + GUWH.formatRelativeTime(t.lastActivityAt) + " · " + t.replyCount + (t.replyCount === 1 ? " reply" : " replies")
                      : "Posted by " + t.authorDisplay + " · " + GUWH.formatRelativeTime(t.lastActivityAt))
                )
              )
            )
          )
    );
  }

  // ---- Booking cut-off countdown (2 Oct 2026). cutoffAt comes from the
  // server (/api/booking), which also enforces it — see bookingCutoffFor()
  // in _shared/attendance.mts. Ticks once a minute.
  function formatCountdown(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(mins / 1440);
    const hrs = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (days > 0) return days + (days === 1 ? " day " : " days ") + hrs + (hrs === 1 ? " hr" : " hrs");
    if (hrs > 0) return hrs + (hrs === 1 ? " hr " : " hrs ") + m + " min";
    return m + " min";
  }
  function useNow(intervalMs) {
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), intervalMs);
      return () => clearInterval(t);
    }, [intervalMs]);
    return now;
  }
  function BookingCountdown({ cutoffAt }) {
    const now = useNow(60000);
    if (!cutoffAt) return null;
    const cutoff = new Date(cutoffAt);
    const left = cutoff.getTime() - now;
    // e.g. "Wed 9:00am" — built by hand so it reads the same on every phone.
    const parts = new Intl.DateTimeFormat("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Melbourne" }).formatToParts(cutoff);
    const part = (t) => (parts.find((x) => x.type === t) || {}).value || "";
    const when = part("weekday") + " " + part("hour") + ":" + part("minute") + part("dayPeriod").toLowerCase().replace(/\s|\./g, "");
    return h(
      "p",
      { className: "mt-4 text-xs text-white/60 leading-relaxed" },
      left > 0
        ? h(React.Fragment, null, "Bookings close " + when + " · ", h("span", { className: "font-semibold text-white tabular-nums whitespace-nowrap" }, formatCountdown(left) + " to go"))
        : "Bookings closed " + when + "."
    );
  }

  // ---- Who's coming (2 Oct 2026): names + photos of everyone booked in.
  // Name is nickname if set, otherwise real name (server-side, see
  // memberDisplayName in _shared/roles.mts).
  function WhosComingCard({ confirmed }) {
    const list = confirmed || [];
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h(
        "div",
        { className: "flex items-baseline justify-between mb-3" },
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, "Who's coming"),
        h("p", { className: "text-xs text-[var(--ink-soft)] tabular-nums" }, list.length + (list.length === 1 ? " player" : " players"))
      ),
      list.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No one's booked in yet - be the first.")
        : h(
            "div",
            { className: "flex flex-wrap gap-2" },
            list.map((p) =>
              h(
                "div",
                { key: p.id, className: "flex items-center gap-2 rounded-full bg-[var(--sand)] pl-1 pr-3 py-1" },
                h(MemberPhoto, { memberId: p.id, version: p.photoVersion, size: 28 }),
                h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, p.name)
              )
            )
          )
    );
  }

  // ---- Last game recap (2 Oct 2026): results, MVP and top scorers from
  // the most recent past session, via /api/recap. Renders nothing at all
  // when nothing was recorded (Cheongy's call: no empty card).
  function RecapCard({ recap }) {
    if (!recap) return null;
    const dateLabel = GUWH.formatDate(new Date(recap.sessionDate + "T00:00:00"));
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 mb-6" },
      h("p", { className: "font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "Last week"),
      h("p", { className: "font-display text-xl font-bold text-[var(--ink)] mt-0.5" }, dateLabel),
      h(
        "div",
        { className: "mt-4 grid sm:grid-cols-3 gap-4" },
        recap.mvp.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--accent-12)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)] mb-2 flex items-center gap-1.5" }, h(Icon, { name: "trophy", size: 13 }), "MVP"),
            recap.mvp.map((m) =>
              h(
                "div",
                { key: m.id, className: "flex items-center gap-2 mt-1" },
                h(MemberPhoto, { memberId: m.id, version: m.photoVersion, size: 32 }),
                h("span", { className: "font-display font-bold text-[var(--ink)]" }, m.name)
              )
            )
          ),
        recap.topScorers.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--sand)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Top scorers"),
            recap.topScorers.map((p, i) =>
              h(
                "div",
                { key: p.id, className: "flex justify-between text-sm py-0.5" },
                h("span", { className: "text-[var(--ink)]" }, (i + 1) + ". " + p.name),
                h("span", { className: "font-semibold tabular-nums text-[var(--ink)]" }, p.goals + (p.goals === 1 ? " goal" : " goals"))
              )
            )
          ),
        recap.games.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--sand)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Results"),
            recap.games.map((g, i) =>
              h(
                "div",
                { key: i, className: "flex justify-between gap-2 text-sm py-0.5" },
                h("span", { className: "text-[var(--ink)] truncate" }, g.black.name + " v " + g.white.name),
                h("span", { className: "font-semibold tabular-nums text-[var(--ink)] shrink-0" }, g.black.score + " - " + g.white.score)
              )
            )
          )
      )
    );
  }

  // Real dashboard (live site) — weekly attendance is the dominant action;
  // everything else (timetable, finance, forum, profile) is real data
  // reused from its existing source, laid out around that one job.
  function RealDashboardPage() {
    const [user, setUser] = React.useState(() => GUWH.Identity.currentUser());
    const [status, setStatus] = React.useState(null);
    const [profile, setProfile] = React.useState(null);
    const [board, setBoard] = React.useState(null);
    const [finance, setFinance] = React.useState(null);
    const [forumMe, setForumMe] = React.useState(null);
    const [topics, setTopics] = React.useState([]);
    const [recap, setRecap] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => GUWH.Identity.onChange(() => setUser(GUWH.Identity.currentUser())), []);

    React.useEffect(() => {
      if (!user) { navigate("/portal"); return; }
      setLoading(true);
      setError(null);
      GUWH.Identity.authFetch("/api/booking")
        .then((r) => r.json())
        .then((data) => (data.ok ? setStatus(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
      // Everything below loads independently — a slow or failed one never
      // blocks the primary attendance card from working.
      GUWH.Identity.authFetch("/api/profile").then((r) => r.json()).then((d) => { if (d.ok) setProfile(d.member); }).catch(() => {});
      GUWH.Identity.authFetch("/api/game-board").then((r) => r.json()).then((d) => { if (d.ok) setBoard(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/finance?self=1").then((r) => r.json()).then((d) => { if (d.ok) setFinance(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/forum/me").then((r) => r.json()).then((d) => { if (d.ok) setForumMe(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/recap").then((r) => r.json()).then((d) => { if (d.ok) setRecap(d.recap); }).catch(() => {});
    }, [user]);

    React.useEffect(() => {
      const eligible = forumMe && forumMe.eligible && forumMe.participation && forumMe.participation.optedIn;
      if (!eligible) return;
      GUWH.Identity.authFetch("/api/forum/topics").then((r) => r.json()).then((d) => { if (d.ok) setTopics(d.topics); }).catch(() => {});
      // eslint-disable-next-line
    }, [forumMe && forumMe.eligible, forumMe && forumMe.participation && forumMe.participation.optedIn]);

    async function setIn(wantsIn) {
      if (!status) return;
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
    // Greeting name (2 Oct 2026): nickname if set on the Profile page,
    // otherwise the real first name. Identity's own name is only a
    // fallback while /api/profile is still loading.
    const identityName = (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0];
    const firstName = profile ? ((profile.nickname && profile.nickname.trim()) || profile.firstName || identityName.split(" ")[0]) : identityName.split(" ")[0];
    const sessionDateObj = status
      ? new Date(status.sessionDate + "T00:00:00")
      : board
      ? new Date(board.sessionDate + "T00:00:00")
      : null;

    const forumEligible = !!(forumMe && forumMe.eligible && forumMe.participation && forumMe.participation.optedIn);
    const announcement = forumEligible ? topics.find((t) => t.pinned && t.isAnnouncement && !t.expired) : null;
    const discussionTopics = forumEligible ? topics.filter((t) => t !== announcement) : [];

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },

      // ---- Header: simplified, attendance-first ----
      // Header (2 Oct 2026): "Upcoming Wednesday" + the date in the display
      // font, once. The attendance card below no longer repeats "this
      // Wednesday". Profile/Log out wrap under the heading on narrow phones
      // instead of squeezing it.
      h(
        "div",
        { className: "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-8" },
        h(
          "div",
          { className: "min-w-0" },
          h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "G'day " + firstName),
          h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-1" }, "Upcoming Wednesday"),
          sessionDateObj && h("p", { className: "font-display text-xl sm:text-2xl font-bold text-[var(--accent-dark)] mt-1" }, GUWH.formatDate(sessionDateObj))
        ),
        h(
          "div",
          { className: "flex items-center gap-1 shrink-0 -ml-2 sm:ml-0" },
          h(Button, { variant: "ghost", size: "sm", onClick: () => navigate("/portal/profile") }, h(Icon, { name: "chevronRight", size: 14 }), "Profile"),
          h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Identity.logout(); navigate("/"); } }, "Log out")
        )
      ),

      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      h(
        "div",
        { className: "grid lg:grid-cols-[1.3fr_0.7fr] gap-6 mb-6" },

        // ---- Weekly attendance card: the dominant action ----
        h(
          "div",
          null,
          status
            ? h(
                "div",
                { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" },
                !status.inSession
                  ? h(
                      React.Fragment,
                      null,
                      h("h2", { className: "font-display text-xl sm:text-2xl font-bold" }, "Are you playing?"),
                      h(
                        "div",
                        { className: "mt-3 flex flex-col gap-1 text-sm text-white/70" },
                        h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "clock", size: 15 }), GUWH.club.sessionTime),
                        h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "mapPin", size: 15 }), GUWH.club.venue)
                      ),
                      h(
                        "div",
                        { className: "mt-6 flex items-center gap-4 flex-wrap" },
                        status.bookingClosed
                          ? h("p", { className: "text-sm text-white/80" }, "Bookings have closed. Message the Game Coordinator if you can still make it.")
                          : h(Button, { size: "lg", disabled: loading, onClick: () => setIn(true) }, h(Icon, { name: "plus", size: 18 }), "I'm Coming"),
                        h("p", { className: "text-sm text-white/70" }, h("span", { className: "font-display font-bold text-white" }, status.confirmedCount), " members confirmed")
                      ),
                      h(BookingCountdown, { cutoffAt: status.cutoffAt })
                    )
                  : h(
                      React.Fragment,
                      null,
                      h(Pill, { tone: "white" }, h(Icon, { name: "check", size: 14 }), "You're in for Wednesday"),
                      h(
                        "div",
                        { className: "mt-4 flex items-center gap-4 flex-wrap" },
                        h("p", { className: "text-sm text-white/70" }, h("span", { className: "font-display font-bold text-white text-lg" }, status.confirmedCount), " members confirmed"),
                        h(Button, { variant: "secondary", size: "sm", className: "!bg-transparent !text-white !border-white/30", disabled: loading, onClick: () => setIn(false) }, "Can't Make It")
                      ),
                      h(
                        "div",
                        { className: "mt-5 pt-5 border-t border-white/15 flex flex-wrap items-center gap-3" },
                        h(
                          "p",
                          { className: "text-xs text-white/60" },
                          board && board.published ? "This week's teams and timetable are published — see This Week's Game." : "Teams and timetable not published yet."
                        )
                      ),
                      h(BookingCountdown, { cutoffAt: status.cutoffAt })
                    )
              )
            : loading && h("div", { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" }, h("p", { className: "text-sm text-white/70" }, "Loading…")),
          // Directly under the attendance card so it's the next thing seen.
          status && h("div", { className: "mt-4" }, h(WhosComingCard, { confirmed: status.confirmed }))
        ),

        // ---- Profile + finance, secondary column ----
        h(
          "div",
          { className: "flex flex-col gap-4" },
          profile && h(ProfileSummaryCard, { profile, compact: true }),
          h(FinanceCard, { finance }),
          h(BringAMateButton)
        )
      ),

      h(RecapCard, { recap }),

      // ---- Club announcement (only when one is pinned), full width ----
      announcement && h("div", { className: "mb-4" }, h(AnnouncementCard, { announcement })),

      // ---- This Week's Game + Latest discussions, 50/50 on tablet and up,
      // stacked on phones (2 Oct 2026, Cheongy's request). items-start so
      // the shorter card doesn't stretch to the taller one's height.
      h(
        "div",
        { className: "grid sm:grid-cols-2 gap-4 items-start" },
        h(ThisWeeksGameCard, { board }),
        forumEligible && h(DiscussionsCard, { topics: discussionTopics, unreadCount: forumMe.unreadCount })
      )
    );
  }

  // Concept-preview dashboard (artifact-entry.html only) — unchanged demo data.
  function DemoDashboardPage() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);

    const player = GUWH.Store.currentPlayer();
    const wed = GUWH.nextWednesday();
    const win = bookingWindow(wed);
    const booking = GUWH.Store.bookingFor(player.id);
    const confirmed = GUWH.Store.confirmedPlayerIds().length;

    return h(
      Container,
      { className: "py-10 sm:py-14" },
      h(
        "div",
        { className: "flex items-center justify-between mb-8" },
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "G'day " + player.firstName),
          h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-1" }, "Wednesday dashboard")
        ),
        h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Store.logout(); navigate("/"); } }, "Log out")
      ),

      h(
        "div",
        { className: "grid lg:grid-cols-[1.1fr_0.9fr] gap-6" },

        // ---- booking card ----
        h(
          "div",
          { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" },
          h(Pill, { tone: "white" }, h(Icon, { name: "calendar", size: 14 }), GUWH.formatDate(wed)),
          h("p", { className: "mt-4 text-white/70 text-sm" }, GUWH.club.sessionTime + " · " + GUWH.club.venue),
          h(
            "div",
            { className: "mt-6 flex items-center gap-4" },
            h(
              Button,
              {
                size: "lg",
                variant: booking.in ? "dark" : "primary",
                className: booking.in ? "!bg-[var(--good)] hover:!bg-[var(--good-dark)]" : "",
                onClick: () => GUWH.Store.setBooking(player.id, !booking.in),
              },
              h(Icon, { name: booking.in ? "check" : "plus", size: 18 }),
              booking.in ? "I'm in" : "I'm in?"
            ),
            booking.in && h(Button, { variant: "secondary", className: "!bg-transparent !text-white !border-white/30", onClick: () => GUWH.Store.setBooking(player.id, false) }, "Cancel")
          ),
          h(
            "p",
            { className: "mt-4 text-xs text-white/60" },
            win.isPastClose
              ? "Bookings have closed for this session — you can still cancel up until the game begins."
              : "Bookings close " + win.closesAt.toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" }) + ", two hours before the session."
          )
        ),

        // ---- attendance + teams ----
        h(
          "div",
          { className: "flex flex-col gap-4" },
          h(AttendanceCounter, { confirmed, teams: 4 }),
          h(
            "button",
            { onClick: () => navigate("/portal/board"), className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 text-left hover:ring-[var(--accent)] transition flex items-center justify-between" },
            h(
              "div",
              null,
              h("p", { className: "font-display font-bold text-[var(--ink)]" }, "This Week's Game"),
              h("p", { className: "text-sm text-[var(--ink-soft)]" }, "See pools, teams and cap colours")
            ),
            h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)]" })
          ),
          h(
            "div",
            { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
            h("p", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, h(Icon, { name: "heart", size: 16, className: "text-[var(--accent-dark)]" }), "After the games"),
            h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, GUWH.Store.getState().gameBoard.socialPlan)
          )
        )
      ),

      h(
        "div",
        { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8" },
        h(MilestoneCard, { icon: "trophy", value: GUWH.milestones.clubGamesThisYear, label: "Club games this year" }),
        h(MilestoneCard, { icon: "users", value: GUWH.milestones.newPlayersThisYear, label: "New players this year" }),
        h(MilestoneCard, { icon: "share", value: GUWH.milestones.friendsInvitedThisYear, label: "Friends invited" }),
        h(MilestoneCard, { icon: "droplet", value: player.gamesThisYear, label: "Your games this year" })
      ),

      h(
        "div",
        { className: "mt-8 grid sm:grid-cols-2 gap-4" },
        h(
          "button",
          { onClick: () => navigate("/portal/bring-a-mate"), className: "rounded-2xl bg-[var(--accent-10)] p-5 text-left hover:bg-[var(--accent-15)] transition flex items-center justify-between" },
          h("div", null, h("p", { className: "font-display font-bold text-[var(--accent-dark)]" }, "Bring a mate"), h("p", { className: "text-sm text-[var(--ink-70)]" }, "Free for them too — first three sessions")),
          h(Icon, { name: "share", size: 20, className: "text-[var(--accent-dark)]" })
        ),
        h(
          "button",
          { onClick: () => navigate("/portal/profile"), className: "rounded-2xl bg-[var(--sand)] p-5 text-left hover:bg-black/5 transition flex items-center justify-between" },
          h("div", null, h("p", { className: "font-display font-bold text-[var(--ink)]" }, "My profile"), h("p", { className: "text-sm text-[var(--ink-soft)]" }, player.grade + " · " + player.position)),
          h(Icon, { name: "chevronRight", size: 20, className: "text-[var(--ink-soft)]" })
        )
      )
    );
  }

  function DashboardPage() {
    return GUWH.Identity ? h(RealDashboardPage) : h(DemoDashboardPage);
  }

  GUWH.Pages.Dashboard = DashboardPage;
})();
