// ---------------------------------------------------------------------------
// GUWH concept — Member dashboard
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, MilestoneCard, AttendanceCounter, MemberPhoto } = GUWH.UI;
  const { navigate } = GUWH.Router;

  // Photo, name, grade, position at a glance — a link through to the full
  // Profile page rather than a second place to edit any of it.
  function ProfileSummaryCard({ profile }) {
    return h(
      "button",
      {
        onClick: () => navigate("/portal/profile"),
        className: "w-full rounded-2xl bg-white ring-1 ring-black/5 p-4 flex items-center gap-3 text-left hover:ring-[var(--accent)] transition",
      },
      h(MemberPhoto, { memberId: profile.id, version: profile.photoVersion, size: 52 }),
      h(
        "div",
        { className: "flex-1 min-w-0" },
        h("p", { className: "font-display font-bold text-[var(--ink)] truncate" }, profile.firstName + (profile.lastName ? " " + profile.lastName : "")),
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, (profile.grade || "Grade not set") + " · " + profile.position)
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

  // Members Forum widget — renders nothing at all for a junior, a member
  // without a DOB on file, or an adult who hasn't opted in yet, per the
  // spec: the dashboard forum widget is only for eligible, opted-in adult
  // members, never a locked/teaser version for anyone else.
  function ForumWidget() {
    const [me, setMe] = React.useState(null);
    const [topics, setTopics] = React.useState([]);

    React.useEffect(() => {
      GUWH.Identity.authFetch("/api/forum/me").then((r) => r.json()).then((d) => { if (d.ok) setMe(d); });
    }, []);
    React.useEffect(() => {
      if (!me || !me.participation || !me.participation.optedIn) return;
      GUWH.Identity.authFetch("/api/forum/topics").then((r) => r.json()).then((d) => { if (d.ok) setTopics(d.topics); });
    }, [me && me.participation && me.participation.optedIn]);

    if (!me || !me.eligible || !me.participation || !me.participation.optedIn) return null;

    const pinnedAnnouncement = topics.find((t) => t.pinned && t.isAnnouncement && !t.expired);
    const rest = topics.filter((t) => t !== pinnedAnnouncement).slice(0, 3);

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 mt-6" },
      h(
        "div",
        { className: "flex items-center justify-between mb-2" },
        h("p", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, "Members Forum", me.unreadCount > 0 && h(Pill, { tone: "accent", className: "!py-0 !px-1.5" }, me.unreadCount)),
        h("button", { onClick: () => navigate("/portal/forum"), className: "text-xs text-[var(--accent-dark)] font-semibold underline" }, "Open")
      ),
      pinnedAnnouncement &&
        h(
          "button",
          { onClick: () => navigate("/portal/forum/topic/" + pinnedAnnouncement.id), className: "block w-full text-left rounded-xl bg-[var(--accent-12)] px-3 py-2 mb-2" },
          h("span", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)]" }, "Pinned"),
          h("p", { className: "text-sm text-[var(--ink)] font-semibold" }, pinnedAnnouncement.title)
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
                h("p", { className: "text-xs text-[var(--ink-soft)]" }, t.categoryName + " · " + GUWH.formatRelativeTime(t.lastActivityAt))
              )
            )
          )
    );
  }

  // Real dashboard (live site) — real Identity user, real booking via
  // /api/booking. Deliberately minimal: only shows what we actually have
  // real data for. Game board, bring-a-mate and profile get added back here
  // as each one is migrated off demo data.
  function RealDashboardPage() {
    const [user, setUser] = React.useState(() => GUWH.Identity.currentUser());
    const [status, setStatus] = React.useState(null);
    const [profile, setProfile] = React.useState(null);
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
      // Profile summary + games-played stat load independently of booking
      // status, so a slow/failed one never blocks the other.
      GUWH.Identity.authFetch("/api/profile")
        .then((r) => r.json())
        .then((data) => { if (data.ok) setProfile(data.member); })
        .catch(() => {});
    }, [user]);

    async function toggle() {
      if (!status) return;
      setLoading(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/booking", { method: "POST", body: JSON.stringify({ in: !status.inSession }) });
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
    const displayName = (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0];

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(
        "div",
        { className: "flex items-center justify-between mb-8" },
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "G'day " + displayName),
          h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-1" }, "Wednesday dashboard")
        ),
        h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Identity.logout(); navigate("/"); } }, "Log out")
      ),

      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      h(
        "div",
        { className: "grid lg:grid-cols-[1.3fr_0.7fr] gap-6" },

        h(
          "div",
          { className: "flex flex-col gap-4" },
          status &&
            h(
              "div",
              { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" },
              h(Pill, { tone: "white" }, h(Icon, { name: "calendar", size: 14 }), GUWH.formatDate(new Date(status.sessionDate + "T00:00:00"))),
              h("p", { className: "mt-4 text-white/70 text-sm" }, GUWH.club.sessionTime.split("–")[0].trim() + " · " + GUWH.club.venue),
              h(
                "div",
                { className: "mt-6 flex items-center gap-4" },
                h(
                  Button,
                  {
                    size: "lg",
                    variant: status.inSession ? "dark" : "primary",
                    className: status.inSession ? "!bg-[var(--good)] hover:!bg-[var(--good-dark)]" : "",
                    disabled: loading,
                    onClick: toggle,
                  },
                  h(Icon, { name: status.inSession ? "check" : "plus", size: 18 }),
                  status.inSession ? "I'm in" : "I'm in?"
                ),
                h("p", { className: "text-sm text-white/70" }, h("span", { className: "font-display font-bold text-white" }, status.confirmedCount), " confirmed so far")
              )
            ),
          loading && !status && h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
        ),

        h(
          "div",
          { className: "flex flex-col gap-4" },
          profile && h(ProfileSummaryCard, { profile }),
          profile && h(MilestoneCard, { icon: "droplet", value: profile.gamesPlayed, label: "Games played" })
        )
      ),

      h(ForumWidget),

      h(
        "p",
        { className: "text-xs text-[var(--ink-soft)] mt-8" },
        "Team board and bring-a-mate are being brought onto the real site next — for now this page handles real booking, your profile summary and the Members Forum."
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
