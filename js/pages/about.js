// ---------------------------------------------------------------------------
// GUWH concept — About Us (how it works + club history, fees & policies)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading, Pill, Icon } = GUWH.UI;

  const RULES = [
    "Two teams of six (plus subs) push a puck along the pool floor using a short stick.",
    "No contact with other players — sticks only touch the puck, not people.",
    "Score by getting the puck into the other team's metal tray at the bottom of the pool.",
    "Breathe whenever you need to. There's no penalty for coming up for air.",
    "Games run in two halves with a short break, refereed both above and below the water.",
  ];

  const EQUIPMENT = [
    { name: "Fins", body: "Short, stiff fins for quick bursts along the bottom — different from snorkelling fins." },
    { name: "Mask & snorkel", body: "Low-profile mask, snorkel for surface breathing between dives." },
    { name: "Glove", body: "Padded glove on your stick hand to protect your knuckles on the pool floor." },
    { name: "Stick", body: "A short stick, roughly hand-sized, used one-handed to flick the puck." },
    { name: "Cap", body: "White or black playing cap so teams (and referees) can tell you apart." },
  ];

  const POSITIONS = [
    { name: "Forward", body: "Leads the attack, first to the puck, looks for the shot on goal." },
    { name: "Midfield", body: "Links attack and defence, covers the most ground across a shift." },
    { name: "Back", body: "Last line before the goal, reads the game and clears the puck out." },
  ];

  function HowItWorksSection() {
    return h(
      "div",
      { className: "mb-16 pb-16 border-b border-black/5" },
      h(SectionHeading, { eyebrow: "How it works", title: "The sport, in plain English.", sub: "Everything below is the beginner version — enough to follow your first game, not a rulebook." }),

      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr] gap-10" },
        h(
          "div",
          null,
          h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-3" }, "The basics"),
          h(
            "ol",
            { className: "flex flex-col gap-3" },
            RULES.map((r, i) =>
              h(
                "li",
                { key: r, className: "flex gap-3 text-[var(--ink-soft)] text-[15px] leading-relaxed" },
                h("span", { className: "font-display font-bold text-[var(--accent-dark)] shrink-0" }, i + 1 + "."),
                r
              )
            )
          )
        ),
        h(
          "div",
          null,
          h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-3" }, "Positions"),
          h(
            "div",
            { className: "flex flex-col gap-3" },
            POSITIONS.map((p) =>
              h(
                "div",
                { key: p.name, className: "rounded-2xl bg-[var(--sand)] p-4" },
                h("p", { className: "font-display font-bold text-[var(--ink)]" }, p.name),
                h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, p.body)
              )
            )
          )
        )
      ),

      h(
        "div",
        { className: "mt-14 rounded-2xl overflow-hidden ring-1 ring-black/5" },
        h("img", { src: "images/gear-closeup.jpg", alt: "A player at the pool edge holding a stick, puck and gloves", loading: "lazy", className: "w-full h-auto object-cover max-h-72" })
      ),

      h(
        "div",
        { className: "mt-8" },
        h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-4" }, "What you'll wear"),
        h(
          "div",
          { className: "grid sm:grid-cols-2 lg:grid-cols-5 gap-4" },
          EQUIPMENT.map((e) =>
            h(
              "div",
              { key: e.name, className: "rounded-2xl border-2 border-black/5 p-4" },
              h(Pill, { tone: "accent", className: "mb-2" }, e.name),
              h("p", { className: "text-sm text-[var(--ink-soft)]" }, e.body)
            )
          )
        ),
        h("p", { className: "mt-4 text-sm text-[var(--ink-soft)]" }, "All of it is available on loan for your first three sessions — see ", h("a", { href: "#/new-player", className: "text-[var(--accent-dark)] font-semibold" }, "Try Underwater Hockey"), ".")
      )
    );
  }

  function FeeRow({ label, value }) {
    return h(
      "div",
      { className: "flex items-center justify-between py-2 border-b border-black/5 last:border-0" },
      h("span", { className: "text-sm text-[var(--ink-soft)]" }, label),
      h("span", { className: "font-mono font-semibold text-[var(--ink)] tabular-nums" }, formatMoney(value))
    );
  }

  function FeeCard({ title, rows }) {
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-5" },
      h("h3", { className: "font-display font-bold text-[var(--ink)] mb-1" }, title),
      rows.map((r) => h(FeeRow, { key: r.label, label: r.label, value: r.value }))
    );
  }

  function AboutPage() {
    const f = GUWH.club.fees;
    return h(
      Container,
      { className: "py-12 sm:py-16" },

      h(HowItWorksSection),

      h(SectionHeading, { eyebrow: "About the club", title: "Run by the people who play." }),

      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr] gap-10 mb-14" },
        h(
          "div",
          null,
          h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-3" }, "Our history"),
          h(
            "div",
            { className: "flex flex-col gap-3" },
            GUWH.club.history.map((item) =>
              h(
                "div",
                { key: item.year, className: "flex gap-4" },
                h("span", { className: "font-display text-xl font-bold text-[var(--accent-dark)] w-14 shrink-0" }, item.year),
                h("p", { className: "text-sm text-[var(--ink-soft)] leading-relaxed" }, item.text)
              )
            )
          )
        ),
        h(
          "div",
          null,
          h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-3" }, "Who's welcome"),
          h(
            "div",
            { className: "flex flex-wrap gap-2" },
            GUWH.club.inclusion.map((i) => h(Pill, { key: i, tone: "accent" }, i))
          ),
          h(
            "p",
            { className: "mt-4 text-sm text-[var(--ink-soft)] leading-relaxed" },
            "The club plays out of the ", GUWH.club.venue, ", ", GUWH.club.venueAddress, ", every Wednesday from ", GUWH.club.sessionTime, "."
          ),
          h(
            "div",
            { className: "mt-5 rounded-2xl overflow-hidden ring-1 ring-black/5" },
            h("img", { src: "images/team-group.jpg", alt: "The Geelong Underwater Hockey club surfacing together after a Wednesday session", loading: "lazy", className: "w-full h-auto object-cover" })
          )
        )
      ),

      h(
        "div",
        null,
        h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mb-1" }, "Fees"),
        h("p", { className: "text-sm text-[var(--ink-soft)] mb-4" }, "First three sessions are free. After that, everyone needs AUF membership (covers insurance) plus club fees."),
        h(
          "div",
          { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-4" },
          h(FeeCard, { title: "Unwaged / junior", rows: [{ label: "Joining fee", value: f.unwaged.joining }, { label: "Yearly membership", value: f.unwaged.yearly }, { label: "Per-game pool fee", value: f.unwaged.perGame }, { label: "AUF membership", value: f.unwaged.auf }] }),
          h(FeeCard, { title: "Waged", rows: [{ label: "Joining fee", value: f.waged.joining }, { label: "Yearly membership", value: f.waged.yearly }, { label: "Per-game pool fee", value: f.waged.perGame }, { label: "AUF membership", value: f.waged.auf }] }),
          h(FeeCard, { title: "Family", rows: [{ label: "Yearly membership", value: f.family.yearly }] }),
          h(FeeCard, { title: "Lap swimmers", rows: [{ label: "Pool collection", value: f.lapSwimmer.perGame }] })
        ),
        h("p", { className: "mt-4 text-xs text-[var(--ink-soft)]" }, "Pay on the night, in advance, or in arrears — whatever's easiest. AUF membership covers insurance while you play.")
      ),

      h(
        "div",
        { className: "mt-14 flex flex-wrap gap-4" },
        h("a", { href: "https://vuhc.org.au/", target: "_blank", rel: "noopener", className: "text-sm font-semibold text-[var(--accent-dark)]" }, "Victorian Underwater Hockey Commission →"),
        h("a", { href: "https://underwaterhockeyaustralia.org.au", target: "_blank", rel: "noopener", className: "text-sm font-semibold text-[var(--accent-dark)]" }, "Underwater Hockey Australia →"),
        h("a", { href: GUWH.club.facebook, target: "_blank", rel: "noopener", className: "text-sm font-semibold text-[var(--accent-dark)]" }, "Facebook →")
      )
    );
  }

  GUWH.Pages.About = AboutPage;
})();
