// ---------------------------------------------------------------------------
// Community & Content workspace — reserved for the Community Moderator
// role. Forum moderation, photo approval and news publishing are separate
// features not built yet; this page exists so the role and its access
// control are real and testable ahead of that work.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Pill, SectionHeading } = GUWH.UI;

  function CommunityPage() {
    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-2xl" },
      h(SectionHeading, { eyebrow: "Community & Content", title: "Nothing built here yet.", sub: "" }),
      h(Pill, { tone: "accent" }, "Community Moderator workspace"),
      h(
        "p",
        { className: "mt-4 text-sm text-[var(--ink-soft)] leading-relaxed" },
        "This space is reserved for forum moderation, club photo approval, and publishing news — none of that exists yet. " +
          "You can see this page because your account holds the Community Moderator role; that access control is real, even though the tools behind it aren't built."
      )
    );
  }

  GUWH.Pages.Community = CommunityPage;
})();
