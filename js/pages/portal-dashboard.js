// ---------------------------------------------------------------------------
// GUWH concept — Member dashboard
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, MilestoneCard, AttendanceCounter } = GUWH.UI;
  const { navigate } = GUWH.Router;

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

  function DashboardPage() {
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

  GUWH.Pages.Dashboard = DashboardPage;
})();
