// ---------------------------------------------------------------------------
// Finance workspace — reserved for the Treasurer role. No fees, payments or
// financial records exist in the system yet (deliberately — no fee plan is
// decided as of Sept 2026). This page exists so the role and its access
// control are real and ready for whenever that feature gets designed.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Pill, SectionHeading } = GUWH.UI;

  function FinancePage() {
    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-2xl" },
      h(SectionHeading, { eyebrow: "Finance", title: "Nothing built here yet.", sub: "" }),
      h(Pill, { tone: "accent" }, "Treasurer workspace"),
      h(
        "p",
        { className: "mt-4 text-sm text-[var(--ink-soft)] leading-relaxed" },
        "This space is reserved for membership fees, game fees and payment records — nothing here touches money yet, and no fee structure has been decided. " +
          "You can see this page because your account holds the Treasurer role; that access control is real, even though the financial tools behind it aren't built."
      )
    );
  }

  GUWH.Pages.Finance = FinancePage;
})();
