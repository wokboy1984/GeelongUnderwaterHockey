// ---------------------------------------------------------------------------
// GUWH concept — News & Community (secondary page, kept simple)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading, Pill } = GUWH.UI;

  function NewsPage() {
    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-3xl" },
      h(SectionHeading, { eyebrow: "News & community", title: "What's happening at the club." }),
      h(
        "div",
        { className: "flex flex-col gap-4" },
        GUWH.news.map((n) =>
          h(
            "article",
            { key: n.title, className: "rounded-2xl bg-[var(--sand)] p-5 sm:p-6" },
            h("p", { className: "font-mono text-xs text-[var(--ink-soft)] uppercase tracking-wide" }, new Date(n.date).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })),
            h("h3", { className: "font-display text-xl font-bold text-[var(--ink)] mt-1" }, n.title),
            h("p", { className: "mt-2 text-sm text-[var(--ink-soft)] leading-relaxed" }, n.body)
          )
        )
      )
    );
  }

  GUWH.Pages.News = NewsPage;
})();
