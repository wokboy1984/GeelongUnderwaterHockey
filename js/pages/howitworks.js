// ---------------------------------------------------------------------------
// GUWH concept — How It Works page (rules, equipment, positions)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading, Icon, Pill } = GUWH.UI;

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

  function HowItWorksPage() {
    return h(
      Container,
      { className: "py-12 sm:py-16" },
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

  GUWH.Pages.HowItWorks = HowItWorksPage;
})();
