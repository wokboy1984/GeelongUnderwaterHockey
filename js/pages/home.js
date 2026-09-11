// ---------------------------------------------------------------------------
// GUWH concept — Home page
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, Icon, EventCard, MilestoneCard, PlayerChip } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const FIRST_NIGHT_STEPS = [
    { title: "Arrive & meet a member", body: "Someone from the club will be watching for you at the Handbury Centre from 5:50pm — you won't be standing around wondering where to go." },
    { title: "Get fitted with gear", body: "Fins, mask, snorkel, glove and stick, all on loan. We've got junior sizes too." },
    { title: "Learn the basics", body: "Five minutes on safety and how the puck moves. That's genuinely all the theory you need." },
    { title: "Join the Wednesday session", body: "You play the same session as everyone else, alongside an experienced player who'll call out what's happening." },
    { title: "Come for the hockey, stay for the people", body: "Help fold the nets, then head down for a BBQ and drinks at Corio Bay with the whole club. Come for that bit too — it's half the reason people stay." },
  ];

  const BENEFITS = [
    { icon: "droplet", title: "Full-body fitness, underwater", body: "Breath-hold sprints, twisting, sculling — it works muscles swimming laps never touches." },
    { icon: "users", title: "A game for everyone", body: "Ages from teens to fifties, mixed grades, same pool. Nobody's precious about it." },
    { icon: "trophy", title: "As competitive as you want", body: "Play purely for Wednesday nights, or chase state, national and international selection." },
  ];

  function HomePage() {
    const wed = GUWH.nextWednesday();
    const confirmed = GUWH.Store.confirmedPlayerIds().length;

    return h(
      React.Fragment,
      null,

      // ---------------- HERO ----------------
      h(
        "section",
        { className: "relative overflow-hidden bg-[var(--navy)]" },
        // full-bleed photo, faded into the navy from the left so headline text stays readable
        h(
          "div",
          { className: "absolute inset-0", "aria-hidden": "true" },
          h("img", {
            src: "images/team-dive-wide.jpg",
            alt: "",
            className: "absolute inset-0 w-full h-full object-cover opacity-60",
          }),
          h("div", { className: "absolute inset-0", style: { background: "linear-gradient(100deg, var(--navy) 30%, transparent 75%)" } }),
          h("div", { className: "absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-transparent to-transparent" })
        ),
        h("div", { className: "absolute inset-0 hero-bubbles", "aria-hidden": "true" }),

        h(
          Container,
          { className: "relative pt-16 sm:pt-24 pb-0" },
          h(Pill, { tone: "white" }, h(Icon, { name: "droplet", size: 14 }), "Geelong · Every Wednesday"),
          h(
            "h1",
            { className: "font-display uppercase text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-5 leading-[1.02] tracking-tight max-w-3xl text-balance" },
            "Turn up Wednesday. We'll lend you ",
            h("span", { className: "text-[var(--accent-light)]" }, "the rest"),
            "."
          ),
          h(
            "p",
            { className: "mt-5 text-lg text-white/80 max-w-lg leading-relaxed" },
            "Underwater hockey in Geelong. No experience, no gear, no club to join first — just bring bathers and a towel."
          ),
          h(
            "div",
            { className: "mt-5 flex items-center gap-2.5 text-white/90 text-sm font-semibold" },
            h(Icon, { name: "check", size: 18, className: "text-[var(--accent-light)]" }),
            "Your first three sessions are free."
          )
        ),

        // ---- two-path split card ----
        h(
          "div",
          { className: "relative mt-10 sm:mt-14" },
          h(
            Container,
            null,
            h(
              "div",
              { className: "rounded-t-3xl overflow-hidden ring-1 ring-white/10" },
              h("div", { className: "h-1.5 w-full", style: { background: "linear-gradient(to right, var(--accent2) 50%, var(--accent-light) 50%)" } }),
              h(
                "div",
                { className: "grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10 bg-[var(--navy-2)]" },
                // never played
                h(
                  "button",
                  { onClick: () => navigate("/new-player"), className: "text-left p-6 sm:p-8 hover:bg-white/[0.03] transition" },
                  h(Pill, { tone: "orange", className: "!bg-transparent !p-0 !text-[var(--accent2)]" }, "Never played"),
                  h("p", { className: "font-display text-2xl font-bold text-white mt-3" }, "I want to try it"),
                  h(
                    "p",
                    { className: "mt-2 text-sm text-white/70 leading-relaxed max-w-xs" },
                    "Three free sessions and all the gear lent to you. Wednesdays, " + GUWH.club.sessionTime + ", " + GUWH.club.venue + " in Corio."
                  ),
                  h("span", { className: "mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent2)]" }, "Start here", h(Icon, { name: "arrowRight", size: 15 }))
                ),
                // already play
                h(
                  "button",
                  { onClick: () => navigate("/portal"), className: "text-left p-6 sm:p-8 hover:bg-white/[0.03] transition" },
                  h(Pill, { tone: "accent", className: "!bg-transparent !p-0 !text-[var(--accent-light)]" }, "Already play here"),
                  h("p", { className: "font-display text-2xl font-bold text-white mt-3" }, "Book me in this week"),
                  h(
                    "p",
                    { className: "mt-2 text-sm text-white/70 leading-relaxed max-w-xs" },
                    "Get on the list, see who else is coming, and check in when you get to the pool."
                  ),
                  h(
                    "p",
                    { className: "mt-3 text-sm" },
                    h("span", { className: "font-display font-bold text-white tabular-nums" }, confirmed),
                    h("span", { className: "text-white/60" }, " booked for " + GUWH.formatDate(wed))
                  ),
                  h("span", { className: "mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent-light)]" }, "Book this week", h(Icon, { name: "arrowRight", size: 15 }))
                )
              )
            )
          )
        ),
        h("div", { className: "h-10 sm:h-14 bg-[var(--navy)]" })
      ),

      // ---------------- HOW IT WORKS (quick) ----------------
      h(
        "section",
        { className: "py-16 sm:py-20 bg-white" },
        h(
          Container,
          null,
          h(SectionHeading, {
            eyebrow: "How it works",
            title: "It's hockey, but underwater.",
            sub: "2 teams, 6 players, 1 puck. Underwater hockey is the best game you've never heard of. You swim down, push a puck along the pool floor, and try to get it into the other team's goal.",
          }),
          h(
            "div",
            { className: "grid sm:grid-cols-3 gap-4" },
            BENEFITS.map((b) =>
              h(
                "div",
                { key: b.title, className: "rounded-2xl bg-[var(--sand)] p-5" },
                h("div", { className: "text-[var(--accent-dark)] mb-3" }, h(Icon, { name: b.icon, size: 24 })),
                h("h3", { className: "font-display text-lg font-bold text-[var(--ink)]" }, b.title),
                h("p", { className: "mt-1.5 text-sm text-[var(--ink-soft)] leading-relaxed" }, b.body)
              )
            )
          )
        )
      ),

      // ---------------- PHOTO STRIP (real club imagery) ----------------
      h(
        "section",
        { className: "py-14 sm:py-16 bg-[var(--sand)]" },
        h(
          Container,
          null,
          h(
            "div",
            { className: "flex items-end justify-between gap-4 mb-6" },
            h(
              "div",
              null,
              h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)] mb-2" }, "From the pool"),
              h("h2", { className: "font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] text-balance" }, "Our people.")
            )
          ),
          h(
            "div",
            { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" },
            [
              { src: "images/action-contest.jpg", alt: "Two players diving for the puck along the pool floor" },
              { src: "images/action-reach.jpg", alt: "Players contesting the puck underwater" },
              { src: "images/gear-closeup.jpg", alt: "Player at the pool edge with stick, puck and gloves" },
              { src: "images/team-group.jpg", alt: "The club surfacing together for a group photo after a session" },
            ].map((img) =>
              h(
                "div",
                { key: img.src, className: "aspect-square rounded-2xl overflow-hidden ring-1 ring-black/5" },
                h("img", { src: img.src, alt: img.alt, loading: "lazy", className: "w-full h-full object-cover" })
              )
            )
          )
        )
      ),

      // ---------------- NEXT SESSION STRIP ----------------
      h(
        "section",
        { className: "py-14 bg-[var(--sand)]" },
        h(
          Container,
          { className: "grid md:grid-cols-[1fr_auto] gap-6 items-center" },
          h(
            "div",
            null,
            h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)] mb-2" }, "This week"),
            h("h2", { className: "font-display text-3xl font-bold text-[var(--ink)]" }, GUWH.formatDate(wed)),
            h("p", { className: "mt-2 text-[var(--ink-soft)]" }, "Bring a mate — first three sessions are free for them too."),
            h(
              "div",
              { className: "mt-4 flex flex-wrap gap-3" },
              h(Button, { onClick: () => navigate("/new-player") }, "Bring a mate"),
              h(Button, { variant: "secondary", onClick: () => navigate("/portal") }, "See this week's board")
            )
          ),
          h(EventCard, null)
        )
      ),

      // ---------------- YOUR FIRST NIGHT ----------------
      h(
        "section",
        { className: "py-16 sm:py-20 bg-white" },
        h(
          Container,
          null,
          h(SectionHeading, { eyebrow: "Your first night", title: "Exactly what happens when you show up.", sub: "No separate beginner session — you jump straight into the normal Wednesday crowd, with someone looking out for you." }),
          h(
            "div",
            { className: "grid sm:grid-cols-2 lg:grid-cols-5 gap-4" },
            FIRST_NIGHT_STEPS.map((s, i) =>
              h(
                "div",
                { key: s.title, className: "relative rounded-2xl border-2 border-black/5 p-5" },
                h("span", { className: "font-display text-3xl font-bold text-[var(--accent-30)]" }, String(i + 1).padStart(2, "0")),
                h("h3", { className: "font-display text-base font-bold text-[var(--ink)] mt-2" }, s.title),
                h("p", { className: "mt-1.5 text-sm text-[var(--ink-soft)] leading-relaxed" }, s.body)
              )
            )
          )
        )
      ),

      // ---------------- PATHWAY + ACHIEVEMENTS ----------------
      h(
        "section",
        { className: "py-16 sm:py-20 bg-[var(--navy)] text-white" },
        h(
          Container,
          { className: "grid lg:grid-cols-2 gap-12" },
          h(
            "div",
            null,
            h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-light)] mb-2" }, "Beginner to competition"),
            h("h2", { className: "font-display text-3xl font-bold text-balance" }, "Play purely for fun, or chase the green and gold."),
            h(
              "ol",
              { className: "mt-6 flex flex-col gap-4" },
              ["Wednesday nights — the whole club, every grade", "Club fixtures — Pool A and B, most terms", "Victorian titles — state selection each year", "Nationals & Australian selection — where it's gone before"].map((step, i) =>
                h(
                  "li",
                  { key: step, className: "flex items-center gap-3" },
                  h("span", { className: "font-display text-lg font-bold text-[var(--accent-light)] w-6" }, i + 1),
                  h("span", { className: "text-white/85" }, step)
                )
              )
            )
          ),
          h(
            "div",
            null,
            h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-light)] mb-2" }, "Club history"),
            h(
              "div",
              { className: "flex flex-col gap-4" },
              GUWH.club.history.map((item) =>
                h(
                  "div",
                  { key: item.year, className: "flex gap-4 pb-4 border-b border-white/10 last:border-0" },
                  h("span", { className: "font-display text-2xl font-bold text-[var(--accent-light)] w-16 shrink-0" }, item.year),
                  h("p", { className: "text-white/80 text-[15px] leading-relaxed" }, item.text)
                )
              )
            )
          )
        )
      ),

      // ---------------- SOCIAL PLAN ----------------
      h(
        "section",
        { className: "py-14 bg-white" },
        h(
          Container,
          { className: "rounded-3xl bg-[var(--sand)] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between" },
          h(
            "div",
            null,
            h(Pill, { tone: "accent" }, h(Icon, { name: "heart", size: 14 }), "After the whistle"),
            h("h3", { className: "font-display text-2xl font-bold text-[var(--ink)] mt-3" }, "Wednesday doesn't end at 7:45."),
            h("p", { className: "mt-2 text-[var(--ink-soft)] max-w-md" }, GUWH.socialPlan)
          ),
          h(Button, { variant: "dark", onClick: () => navigate("/portal") }, "See the full board", h(Icon, { name: "chevronRight", size: 16 }))
        )
      ),

      // ---------------- FINAL CTA ----------------
      h(
        "section",
        { className: "py-20 bg-[var(--accent)] text-white text-center" },
        h(
          Container,
          { className: "max-w-2xl" },
          h("h2", { className: "font-display text-4xl sm:text-5xl font-bold text-balance" }, "Three free sessions. We'll even lend you the gear."),
          h("p", { className: "mt-4 text-white/90 text-lg" }, "Come give it a crack this Wednesday. Worst case, you've had a weird, excellent workout."),
          h(
            "div",
            { className: "mt-8 flex flex-wrap justify-center gap-3" },
            h(Button, { size: "lg", variant: "dark", onClick: () => navigate("/new-player") }, "Book your first session")
          )
        )
      )
    );
  }

  GUWH.Pages.Home = HomePage;
})();
