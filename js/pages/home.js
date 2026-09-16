// ---------------------------------------------------------------------------
// GUWH concept — Home page
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, Icon } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const SPORT_POINTS = [
    { title: "A proper team sport", body: "Passing, positioning, attacking and defending—just underwater." },
    { title: "An incredible workout", body: "Short breath-hold efforts combined with swimming, teamwork and recovery." },
    { title: "A genuinely social club", body: "Mixed experience levels, welcoming members and plenty of opportunities to meet the crew." },
  ];

  const FIRST_NIGHT_STEPS = [
    { title: "Meet us at the pool", body: "Arrive from 5:50pm at the Handbury Centre. One of our members will meet you and show you where to go." },
    { title: "Borrow your equipment", body: "We'll fit you with fins, a mask, snorkel, glove and stick. Just bring bathers and a towel." },
    { title: "Learn the basics", body: "An experienced player will explain the equipment, safety rules and how to move the puck." },
    { title: "Get in and have a go", body: "Warm up with an experienced player before joining the Wednesday session at your own pace." },
    { title: "Meet the crew", body: "Stick around after the game, get to know the players and become part of the local underwater hockey community." },
  ];

  const CLUB_PHOTOS = [
    { src: "images/action-contest.jpg", alt: "Two players diving for the puck along the pool floor", caption: "Contesting the puck" },
    { src: "images/action-reach.jpg", alt: "Players contesting the puck underwater", caption: "Full stretch for every inch" },
    { src: "images/gear-closeup.jpg", alt: "Player at the pool edge with stick, puck and gloves", caption: "Stick, puck, glove — that's it" },
    { src: "images/team-group.jpg", alt: "The club surfacing together for a group photo after a session", caption: "The whole crew, every Wednesday" },
  ];

  function HomePage() {
    const wed = GUWH.nextWednesday();
    // Live booking count for the upcoming Wednesday, from the public,
    // unauthenticated /api/public-stats endpoint — not the concept's fake
    // demo store. Stays null (number hidden) until it loads or if the
    // request fails, rather than showing a stale placeholder as if live.
    const [liveStats, setLiveStats] = React.useState(null);
    React.useEffect(() => {
      fetch("/api/public-stats")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setLiveStats(d); })
        .catch(() => {});
    }, []);
    const confirmed = liveStats ? liveStats.confirmedCount : null;

    return h(
      React.Fragment,
      null,

      // ============================================================
      // 1. HERO + AUDIENCE PATHWAYS
      // ============================================================
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
          h(Pill, { tone: "white" }, h(Icon, { name: "droplet", size: 14 }), "Geelong Underwater Hockey · Wednesday Nights"),
          h(
            "h1",
            { className: "font-display uppercase text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-5 leading-[1.02] tracking-tight text-balance" },
            "Play hockey at the bottom of a pool."
          ),
          h(
            "p",
            { className: "mt-5 text-lg text-white/80 max-w-2xl leading-relaxed" },
            "Underwater hockey is a fast, social team sport played entirely beneath the surface. Join us in Geelong on Wednesday nights—no experience or equipment needed."
          ),
          h(
            "div",
            { className: "mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-white/85 text-sm font-semibold" },
            h("span", { className: "flex items-center gap-1.5" }, h(Icon, { name: "clock", size: 16, className: "text-[var(--accent-light)]" }), "Wednesdays, " + GUWH.club.sessionTime),
            h("span", { className: "flex items-center gap-1.5" }, h(Icon, { name: "mapPin", size: 16, className: "text-[var(--accent-light)]" }), GUWH.club.venue + ", Corio")
          ),
          h(
            "div",
            { className: "mt-4 flex items-center gap-2.5 text-white/90 text-sm font-semibold" },
            h(Icon, { name: "check", size: 18, className: "text-[var(--accent-light)]" }),
            "Your first three sessions are free."
          ),
          h(
            "p",
            { className: "mt-3 text-white/50 text-sm italic" },
            "Turn up Wednesday. We'll lend you the rest."
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
                // New members — comes first in the DOM so it's also first on mobile.
                h(
                  "div",
                  { className: "p-6 sm:p-8 flex flex-col" },
                  h(Pill, { tone: "orange", className: "!bg-transparent !p-0 !text-[var(--accent2)] w-fit" }, "New members"),
                  h("p", { className: "font-display text-2xl font-bold text-white mt-3" }, "Try underwater hockey"),
                  h(
                    "p",
                    { className: "mt-2 text-sm text-white/70 leading-relaxed max-w-xs" },
                    "We'll lend you the equipment and help you through your first session. Just bring bathers and a towel."
                  ),
                  h(
                    Button,
                    { variant: "cta", size: "md", className: "mt-5 w-fit", onClick: () => navigate("/new-player") },
                    "Book a Free Session", h(Icon, { name: "arrowRight", size: 16 })
                  )
                ),
                // Existing members
                h(
                  "div",
                  { className: "p-6 sm:p-8 flex flex-col" },
                  h(Pill, { tone: "accent", className: "!bg-transparent !p-0 !text-[var(--accent-light)] w-fit" }, "Existing members"),
                  h("p", { className: "font-display text-2xl font-bold text-white mt-3" }, "Playing this Wednesday?"),
                  h(
                    "p",
                    { className: "mt-2 text-sm text-white/70 leading-relaxed max-w-xs" },
                    "Book in, see who else is coming and get everything you need for this week's game."
                  ),
                  confirmed !== null &&
                    h(
                      "p",
                      { className: "mt-3 text-sm" },
                      h("span", { className: "font-display font-bold text-white tabular-nums" }, confirmed),
                      h("span", { className: "text-white/60" }, " players booked for this Wednesday")
                    ),
                  h(
                    Button,
                    { variant: "secondary", size: "md", className: "mt-5 w-fit !bg-white/10 !text-white !border-white/25", onClick: () => navigate("/portal") },
                    "Book This Week", h(Icon, { name: "arrowRight", size: 16 })
                  )
                )
              )
            )
          )
        ),
        h("div", { className: "h-10 sm:h-14 bg-[var(--navy)]" })
      ),

      // ============================================================
      // 2. WHAT IS UNDERWATER HOCKEY? (+ VIDEO, aligned right)
      // ============================================================
      // 13 Sept 2026, Cheongy's request — the video (same one embedded on
      // the How It Works page) now sits inside this section instead of
      // its own section below, video on the right on desktop.
      h(
        "section",
        { className: "py-16 sm:py-20 bg-white" },
        h(
          Container,
          null,
          h(
            "div",
            { className: "grid lg:grid-cols-2 gap-10 lg:gap-16 items-center" },
            h(
              "div",
              null,
              h(SectionHeading, {
                eyebrow: "How it works",
                title: "Six players. One puck. No oxygen tanks.",
                sub: "Players wear a mask, snorkel and fins, diving beneath the surface to move a puck across the pool floor and into the opposing team's goal. It's fast, tactical, surprisingly physical—and much easier to try than it looks.",
              }),
              h(
                "div",
                { className: "flex flex-col gap-5" },
                SPORT_POINTS.map((p) =>
                  h(
                    "div",
                    { key: p.title, className: "flex gap-2.5" },
                    h(Icon, { name: "check", size: 16, className: "text-[var(--accent-dark)] shrink-0 mt-1" }),
                    h(
                      "div",
                      null,
                      h("p", { className: "font-display font-bold text-[var(--ink)]" }, p.title),
                      h("p", { className: "mt-0.5 text-sm text-[var(--ink-soft)] leading-relaxed" }, p.body)
                    )
                  )
                )
              )
            ),
            h(
              "div",
              { className: "relative w-full rounded-2xl overflow-hidden ring-1 ring-black/5", style: { paddingTop: "56.25%" } },
              h("iframe", {
                src: "https://www.youtube-nocookie.com/embed/JoiUTu4emcE",
                title: "Underwater hockey explained",
                className: "absolute inset-0 w-full h-full",
                style: { border: 0 },
                loading: "lazy",
                allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                allowFullScreen: true,
              })
            )
          )
        )
      ),

      // ============================================================
      // 3. REAL CLUB IMAGERY
      // ============================================================
      h(
        "section",
        { className: "py-14 sm:py-16 bg-[var(--sand)]" },
        h(
          Container,
          null,
          h(
            "div",
            { className: "mb-6" },
            h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)] mb-2" }, "From the pool"),
            h("h2", { className: "font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] text-balance" }, "This is Wednesday night.")
          ),
          h(
            "div",
            { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" },
            CLUB_PHOTOS.map((img) =>
              h(
                "div",
                { key: img.src },
                h(
                  "div",
                  { className: "aspect-square rounded-2xl overflow-hidden ring-1 ring-black/5" },
                  h("img", { src: img.src, alt: img.alt, loading: "lazy", className: "w-full h-full object-cover" })
                ),
                h("p", { className: "mt-2 text-xs text-[var(--ink-soft)]" }, img.caption)
              )
            )
          )
        )
      ),

      // ============================================================
      // 4. WHAT HAPPENS ON YOUR FIRST WEDNESDAY?
      // ============================================================
      h(
        "section",
        { className: "py-16 sm:py-20 bg-white" },
        h(
          Container,
          null,
          h(SectionHeading, {
            eyebrow: "Your first night",
            title: "Your first Wednesday, step by step.",
            sub: "No separate beginner session and no pressure to know what you're doing. Someone from the club will meet you, lend you the equipment and help you get started.",
          }),
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

      // ============================================================
      // 5. SOCIAL AND COMMUNITY REASSURANCE
      // ============================================================
      h(
        "section",
        { className: "py-14 bg-[var(--sand)]" },
        h(
          Container,
          { className: "rounded-3xl bg-white p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between ring-1 ring-black/5" },
          h(
            "div",
            null,
            h(Pill, { tone: "accent" }, h(Icon, { name: "heart", size: 14 }), "After the whistle"),
            h("h3", { className: "font-display text-2xl font-bold text-[var(--ink)] mt-3" }, "Wednesday doesn't end at 7:45."),
            h(
              "p",
              { className: "mt-2 text-[var(--ink-soft)] max-w-md" },
              "Plenty of players stick around after the session for a chat — it's as much a social, welcoming club as it is a competitive one."
            )
          ),
          h(Button, { variant: "dark", onClick: () => navigate("/portal") }, "See the full board", h(Icon, { name: "chevronRight", size: 16 }))
        )
      ),

      // ============================================================
      // 6. FINAL CTA
      // ============================================================
      h(
        "section",
        { className: "py-20 bg-[var(--accent)] text-white text-center" },
        h(
          Container,
          { className: "max-w-2xl" },
          h("h2", { className: "font-display text-4xl sm:text-5xl font-bold text-balance" }, "Ready to try something completely different?"),
          h("p", { className: "mt-4 text-white/90 text-lg" }, "Your first three sessions are free, and we'll lend you all the equipment you need."),
          h(
            "div",
            { className: "mt-8 flex flex-wrap justify-center gap-3" },
            h(Button, { size: "lg", variant: "dark", onClick: () => navigate("/new-player") }, "Book a Free Session")
          ),
          h("p", { className: "mt-4 text-white/70 text-sm" }, "Wednesday nights at the Handbury Centre for Wellbeing in Corio.")
        )
      )
    );
  }

  GUWH.Pages.Home = HomePage;
})();
