// ---------------------------------------------------------------------------
// GUWH concept — Book a Game (booking status + recent attendance history)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading } = GUWH.UI;

  function recentWeeks(wed, count) {
    const out = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(wed);
      d.setDate(d.getDate() - 7 * i);
      out.push(d);
    }
    return out;
  }

  function BookGamePage() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);

    const player = GUWH.Store.currentPlayer();
    const wed = GUWH.nextWednesday();
    const closesAt = new Date(wed);
    closesAt.setHours(16, 0, 0, 0);
    const booking = GUWH.Store.bookingFor(player.id);
    const past = recentWeeks(wed, 5);

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(SectionHeading, { eyebrow: "Book a game", title: GUWH.formatDate(wed) }),

      h(
        "div",
        { className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6" },
        h(
          "div",
          null,
          h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Your status for this Wednesday"),
          h(
            "p",
            { className: "font-display text-2xl font-bold mt-1", style: { color: booking.in ? "var(--good-dark)" : "var(--ink)" } },
            booking.in ? "You're in" : "Not booked yet"
          ),
          h("p", { className: "text-xs text-[var(--ink-soft)] mt-2" }, "Bookings close " + closesAt.toLocaleString("en-AU", { weekday: "long", hour: "numeric", minute: "2-digit" }) + " — you can cancel any time before the game starts.")
        ),
        h(
          Button,
          { size: "lg", variant: booking.in ? "danger" : "primary", onClick: () => GUWH.Store.setBooking(player.id, !booking.in) },
          h(Icon, { name: booking.in ? "x" : "check", size: 18 }),
          booking.in ? "Cancel my spot" : "I'm in"
        )
      ),

      h(
        "div",
        { className: "mt-10" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Your recent attendance"),
        h(
          "div",
          { className: "rounded-2xl bg-[var(--sand)] divide-y divide-black/5" },
          past.map((d, i) => {
            const attended = i !== 2; // mock: missed one week a fortnight back
            return h(
              "div",
              { key: d.toISOString(), className: "flex items-center justify-between px-5 py-3" },
              h("span", { className: "text-sm text-[var(--ink)]" }, GUWH.formatDate(d)),
              h(Pill, { tone: attended ? "good" : "warn" }, attended ? "Played" : "Missed")
            );
          })
        ),
        h("p", { className: "mt-3 text-sm text-[var(--ink-soft)]" }, player.firstName + " has played " + player.gamesThisYear + " games this year.")
      )
    );
  }

  GUWH.Pages.BookGame = BookGamePage;
})();
