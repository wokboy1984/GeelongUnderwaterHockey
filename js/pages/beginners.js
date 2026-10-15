// ---------------------------------------------------------------------------
// GUWH — Beginners Guide (16 Oct 2026, Cheongy).
// A general, not-Geelong-specific resource for new players who've been down
// once and want to learn more and get better: what the game is, the rules,
// safety, gear, the stick, core skills (with videos) and where to buy gear.
// Club specifics (times, venue, what we lend) live on the Try It Free page,
// which this page links to at the top and bottom.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "rules", label: "The rules" },
    { id: "safety", label: "Breath and safety" },
    { id: "gear", label: "The gear" },
    { id: "stick", label: "The stick" },
    { id: "skills", label: "Skills" },
    { id: "suppliers", label: "Where to buy" },
    { id: "faq", label: "FAQ" },
  ];

  function jump(id) {
    const el = document.getElementById("bg-" + id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Click-to-play YouTube: shows the thumbnail and only loads the player
  // when tapped, so eight videos don't slow the page down.
  function Video({ id, title }) {
    const [play, setPlay] = React.useState(false);
    return h(
      "div",
      { className: "relative w-full rounded-2xl overflow-hidden ring-1 ring-black/5 bg-black", style: { paddingTop: "56.25%" } },
      play
        ? h("iframe", {
            src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0",
            title,
            className: "absolute inset-0 w-full h-full",
            style: { border: 0 },
            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            allowFullScreen: true,
          })
        : h(
            "button",
            { type: "button", onClick: () => setPlay(true), className: "absolute inset-0 w-full h-full group", "aria-label": "Play video: " + title },
            h("img", { src: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", alt: "", loading: "lazy", className: "absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" }),
            h(
              "span",
              { className: "absolute inset-0 flex items-center justify-center" },
              h(
                "span",
                { className: "h-16 w-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg transition" },
                h("svg", { viewBox: "0 0 24 24", width: 26, height: 26, "aria-hidden": "true" }, h("path", { d: "M8 5v14l11-7z", fill: "var(--navy)" }))
              )
            ),
            h("span", { className: "absolute left-3 bottom-3 rounded-full bg-black/60 text-white text-xs font-semibold px-3 py-1" }, title)
          )
    );
  }

  function Section({ id, eyebrow, title, children, tint }) {
    return h(
      "section",
      { id: "bg-" + id, className: "scroll-mt-24 py-10 sm:py-12 " + (tint ? "bg-[var(--sand)]" : "") },
      h(
        Container,
        { className: "max-w-4xl" },
        eyebrow && h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, eyebrow),
        h("h2", { className: "font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-1 mb-4" }, title),
        children
      )
    );
  }

  const P = (t) => h("p", { className: "text-[var(--ink-soft)] leading-relaxed mb-3" }, t);
  function Bullets({ items }) {
    return h(
      "ul",
      { className: "flex flex-col gap-2 mb-4" },
      items.map((t, i) =>
        h("li", { key: i, className: "flex gap-2.5 text-[var(--ink-soft)] leading-relaxed" },
          h("span", { className: "mt-1 text-[var(--accent-dark)] shrink-0" }, h(Icon, { name: "check", size: 16 })),
          h("span", null, t))
      )
    );
  }

  // ---- Diagrams (drawn here, no outside images) ----
  function PoolDiagram() {
    const team = (x, fill, stroke) => [0, 1, 2, 3, 4, 5].map((i) => h("circle", { key: x + "-" + i, cx: x, cy: 34 + i * 26, r: 7, fill, stroke, strokeWidth: 2 }));
    return h(
      "figure",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 sm:p-6" },
      h(
        "svg",
        { viewBox: "0 0 600 220", className: "w-full h-auto", role: "img", "aria-label": "Top-down view of a pool: a goal tray at each end, the puck in the middle, six players from each team starting on their own wall." },
        h("rect", { x: 10, y: 10, width: 580, height: 200, rx: 14, fill: "#d8f1f4", stroke: "#7cc7d1", strokeWidth: 3 }),
        h("line", { x1: 300, y1: 14, x2: 300, y2: 206, stroke: "#7cc7d1", strokeWidth: 2, strokeDasharray: "8 8" }),
        h("rect", { x: 14, y: 85, width: 26, height: 50, rx: 4, fill: "#9aa5b1" }),
        h("rect", { x: 560, y: 85, width: 26, height: 50, rx: 4, fill: "#9aa5b1" }),
        h("text", { x: 27, y: 154, fontSize: 13, fill: "#34495e", fontFamily: "sans-serif", textAnchor: "middle" }, "Goal"),
        h("text", { x: 573, y: 154, fontSize: 13, fill: "#34495e", fontFamily: "sans-serif", textAnchor: "middle" }, "Goal"),
        team(80, "#ffffff", "#1d2b3a"),
        team(520, "#1d2b3a", "#1d2b3a"),
        h("circle", { cx: 300, cy: 110, r: 9, fill: "#ff7a45" }),
        h("text", { x: 300, y: 138, fontSize: 13, fill: "#34495e", fontFamily: "sans-serif", textAnchor: "middle" }, "Puck")
      ),
      h("figcaption", { className: "text-xs text-[var(--ink-soft)] mt-2" }, "From above: each team starts on its own wall, the puck goes in the middle, and everyone races for it. Score by getting the puck into the other team's goal tray.")
    );
  }

  const GEAR = [
    { name: "Mask", body: "A low-volume, twin-lens mask that seals well. Test it in the shop: press it to your face, breathe in gently through your nose, and it should stay on by itself. Swimming goggles don't work, as you can't equalise in them." },
    { name: "Snorkel", body: "A simple, wide-bore snorkel with a comfortable mouthpiece. A purge valve helps. Skip anything with dry-tops or splash guards - you want to clear it fast." },
    { name: "Fins", body: "Full-foot fins with no buckles or sharp edges. Short to mid-length plastic fins are the usual starting point - stiff enough to accelerate, short enough to turn. Thin neoprene socks stop rubbing." },
    { name: "Glove", body: "Worn on your stick hand to protect your knuckles from the pool floor and other sticks. Underwater hockey gloves have a hard coating on the back and fingers." },
    { name: "Stick", body: "Short, one-handed and coloured black or white for your team. Sticks come in left and right-handed versions - more on the stick below." },
    { name: "Cap", body: "A water polo cap with ear guards. Protects your ears and shows your team colour." },
    { name: "Mouthguard", body: "Recommended. Sticks and elbows move fast near your face." },
  ];

  const SKILLS = [
    { id: "mhom9i6AT8Q", title: "Swimming with the puck", body: "Keep the puck on the front of your stick, just ahead of your shoulder, and kick from the hips. Look up, not down at the puck." },
    { id: "Tmx4ayk7hTo", title: "Moving the puck underwater", body: "Small pushes keep the puck close and hard to steal. Keep your stick on the pool floor and use the back of the stick to change direction." },
    { id: "HUxHFXPeQK4", title: "How to flick", body: "A flick lifts the puck off the bottom and sends it over the other team's sticks. It comes from the wrist and the curve of the front face, not your arm. Start with short flicks to yourself." },
    { id: "BTwlEkW9jX4", title: "Turning", body: "Use the hook to wrap the puck and turn your body around it. Turning with the puck is how you get out of trouble when the way forward is blocked." },
    { id: "zIKPA9Kl_qQ", title: "Go out and practise", body: "Ten minutes before or after a session makes a big difference. Practise each skill slowly on one breath, then build up speed." },
  ];

  const SUPPLIERS = [
    { name: "Your local dive shop", what: "Masks, snorkels, fins and socks. Try masks and fins on in person.", url: null },
    { name: "True Blue Underwater Hockey Supplies (Australia)", what: "Sticks, masks and snorkels.", url: "https://true-blue.com.au/" },
    { name: "6aA Underwater Hockey (Perth)", what: "Sticks and gloves.", url: "https://www.6aa.com.au/" },
    { name: "Hydro Underwater Hockey (New Zealand)", what: "Full range: gloves, sticks, headgear, fins, pucks and starter packs. Ships to Australia.", url: "https://hydrouwh.com/" },
  ];

  const FAQ = [
    { q: "Do I need to be a strong swimmer?", a: "You need to be a confident swimmer who's comfortable in deep water. You don't need to be fast or fit to start - fitness comes from playing." },
    { q: "How long do I need to hold my breath?", a: "Not long. Most dives are a few seconds. You come up whenever you need to and breathe through your snorkel at the surface." },
    { q: "Can I wear glasses?", a: "Not in the pool, but you can buy masks with prescription lenses, and contact lenses work under a mask." },
    { q: "Will I get hurt?", a: "Deliberate contact isn't allowed and it's refereed. Wear a glove and cap, and a mouthguard is a good idea. Most knocks are minor." },
    { q: "I'm left-handed - does that matter?", a: "Not at all. Left-handed sticks are made by every maker." },
    { q: "Do I need my own gear to start?", a: "No. Most clubs lend gear to new players. Buy your own once you know you'll keep playing - start with a mask, snorkel and fins." },
    { q: "Is there an age limit?", a: "It's played from juniors through to masters. Check with your club about junior sessions." },
    { q: "What's the best way to get better?", a: "Play regularly, practise skills before or after sessions, watch the videos on this page, and ask experienced players for one thing to work on." },
  ];

  function TryCta({ dark }) {
    return h(
      "div",
      { className: "flex flex-wrap items-center gap-3" },
      h(Button, { variant: "cta", onClick: () => navigate("/new-player") }, "Try for Free", h(Icon, { name: "arrowRight", size: 16 })),
      h("p", { className: dark ? "text-sm text-white/80" : "text-sm text-[var(--ink-soft)]" }, "Your first sessions are free and the gear is provided.")
    );
  }

  function BeginnersGuidePage() {
    const [openFaq, setOpenFaq] = React.useState(null);
    return h(
      "div",
      null,
      // ---- Hero ----
      h(
        "section",
        { className: "bg-[var(--navy)] text-white" },
        h(
          Container,
          { className: "max-w-4xl py-12 sm:py-16" },
          h(Pill, { tone: "accent" }, "Beginners guide"),
          h("h1", { className: "font-display text-4xl sm:text-5xl font-bold mt-4 leading-tight" }, "Learn underwater hockey."),
          h("p", { className: "mt-3 text-white/80 text-lg max-w-2xl leading-relaxed" }, "Been down for a game and want to know more? This guide covers how the game works, the gear, the stick and the skills that will make you better."),
          h("div", { className: "mt-6" }, h(TryCta, { dark: true })),
          h(
            "nav",
            { className: "mt-8 flex flex-wrap gap-2", "aria-label": "On this page" },
            SECTIONS.map((s) => h("button", { key: s.id, type: "button", onClick: () => jump(s.id), className: "rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-sm font-semibold transition" }, s.label))
          )
        )
      ),

      h(
        Section,
        { id: "overview", eyebrow: "Overview", title: "What is underwater hockey?" },
        P("Two teams of six play on the bottom of a swimming pool, pushing a heavy puck with short sticks. Players wear a mask, snorkel and fins, breathe at the surface, and dive down to play. There's no scuba gear - it's all on one breath at a time."),
        P("Each team starts on its own wall, the puck is placed in the middle, and both teams race for it. You score by getting the puck into the other team's goal: a metal tray about 3 metres wide on the pool floor."),
        h("div", { className: "grid md:grid-cols-2 gap-5 mt-5 items-start" }, h(Video, { id: "GbrKAIbX_eE", title: "Underwater hockey overview" }), h(PoolDiagram))
      ),

      h(
        Section,
        { id: "rules", eyebrow: "The rules", title: "The basics in plain English", tint: true },
        h(Bullets, {
          items: [
            "Six players from each team are in the water at a time. Substitutes swap on and off at the edge.",
            "Only touch the puck with your stick. Hands, fins and bodies can't play it.",
            "No grabbing, pushing or blocking other players. Sticks are for the puck, not people.",
            "Teams wear black or white caps and use black or white sticks to match.",
            "A goal counts when the puck lands in the tray. Both teams then go back to their walls to start again.",
            "Referees in the water and on deck stop play for fouls. Small fouls give the other team the puck; bigger ones can mean a penalty.",
            "Games are usually two halves with a short break, and teams swap ends.",
          ],
        })
      ),

      h(
        Section,
        { id: "safety", eyebrow: "Breath and safety", title: "Breathing, and staying safe" },
        h(Bullets, {
          items: [
            "You breathe through your snorkel at the surface between dives. Come up whenever you want - nobody expects long breath-holds.",
            "Never hyperventilate (lots of fast, deep breaths) before diving. It can make you black out underwater. Take a few normal relaxed breaths instead.",
            "Equalise your ears as you go down by pinching your nose through the mask and gently blowing.",
            "Short dives often beat long ones. Your team covers you while you breathe.",
            "Wear a glove and a cap with ear guards, and a mouthguard if you have one.",
            "If you feel unwell or dizzy, get out and tell someone. It's always fine to sit a game out.",
          ],
        })
      ),

      h(
        Section,
        { id: "gear", eyebrow: "The gear", title: "What players wear", tint: true },
        P("Most clubs lend gear to new players. When you're ready to buy your own, this is what to look for."),
        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-3" },
          GEAR.map((g) => h("div", { key: g.name, className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
            h("p", { className: "font-display font-bold text-[var(--ink)]" }, g.name),
            h("p", { className: "text-sm text-[var(--ink-soft)] mt-1 leading-relaxed" }, g.body)))
        )
      ),

      h(
        Section,
        { id: "stick", eyebrow: "The stick", title: "Know your stick" },
        P("Underwater hockey sticks are short and held in one hand, usually your stronger hand."),
        h("div", { className: "max-w-2xl" }, h(Video, { id: "LAAxGI-rIrk", title: "The stick explained" }))
      ),

      h(
        Section,
        { id: "skills", eyebrow: "Skills", title: "Five skills to work on", tint: true },
        P("Start slow and on one breath at a time. Speed comes later."),
        h(
          "div",
          { className: "flex flex-col gap-8" },
          SKILLS.map((s, i) =>
            h("div", { key: s.id, className: "grid md:grid-cols-[1fr_1.3fr] gap-4 items-start" },
              h("div", null,
                h("p", { className: "font-mono text-xs font-bold text-[var(--accent-dark)]" }, String(i + 1).padStart(2, "0")),
                h("h3", { className: "font-display text-xl font-bold text-[var(--ink)]" }, s.title),
                h("p", { className: "text-[var(--ink-soft)] mt-1 leading-relaxed" }, s.body)),
              h(Video, { id: s.id, title: s.title }))
          )
        )
      ),

      h(
        Section,
        { id: "suppliers", eyebrow: "Where to buy", title: "Getting your own gear" },
        P("Buy a mask, snorkel and fins first - fit matters most there, so try them on. Sticks and gloves come from specialist underwater hockey makers. Prices and stock change, so check with each one."),
        h(
          "div",
          { className: "flex flex-col gap-2" },
          SUPPLIERS.map((s) => h("div", { key: s.name, className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 flex flex-wrap items-center justify-between gap-3" },
            h("div", { className: "min-w-0" },
              h("p", { className: "font-semibold text-[var(--ink)]" }, s.name),
              h("p", { className: "text-sm text-[var(--ink-soft)]" }, s.what)),
            s.url && h("a", { href: s.url, target: "_blank", rel: "noopener", className: "text-sm font-semibold text-[var(--accent-dark)] hover:underline shrink-0" }, "Visit site →")))
        )
      ),

      h(
        Section,
        { id: "faq", eyebrow: "FAQ", title: "Common questions", tint: true },
        h(
          "div",
          { className: "rounded-2xl bg-white ring-1 ring-black/5 divide-y divide-black/5" },
          FAQ.map((f, i) => h("div", { key: i },
            h("button", { type: "button", onClick: () => setOpenFaq(openFaq === i ? null : i), className: "w-full flex items-center justify-between gap-3 px-5 py-4 text-left", "aria-expanded": openFaq === i },
              h("span", { className: "font-semibold text-[var(--ink)]" }, f.q),
              h("span", { className: "text-[var(--accent-dark)] text-xl leading-none shrink-0" }, openFaq === i ? "−" : "+")),
            openFaq === i && h("p", { className: "px-5 pb-4 -mt-1 text-[var(--ink-soft)] leading-relaxed" }, f.a)))
        )
      ),

      // ---- Bottom CTA ----
      h(
        "section",
        { className: "bg-[var(--navy)] text-white" },
        h(
          Container,
          { className: "max-w-4xl py-12" },
          h("h2", { className: "font-display text-3xl font-bold" }, "Ready to give it a go?"),
          h("p", { className: "mt-2 text-white/80 mb-6" }, "Book a free session and we'll sort the rest."),
          h(TryCta, { dark: true })
        )
      )
    );
  }

  GUWH.Pages.BeginnersGuide = BeginnersGuidePage;
})();
