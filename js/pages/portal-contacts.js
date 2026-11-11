// ---------------------------------------------------------------------------
// Contacts (11 Nov 2026, Liam): who's on the committee and how to reach the
// club, in the member nav after Bring a Mate. Taken from the old club
// site's contact page (geelongunderwaterhockey.org.au/contact). The names
// and roles live in GUWH.club.committee in js/data.js - update them there
// after each AGM. Only the club's role addresses (president@, secretary@,
// chief.referee@, mpio@), as on the old site - no personal numbers or emails.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading, Icon } = GUWH.UI;

  function RoleList({ title, people }) {
    if (!people || !people.length) return null;
    return h(
      "section",
      { className: "mb-8" },
      h("h2", { className: "font-display text-xl font-bold text-[var(--ink)] mb-3" }, title),
      h(
        "ul",
        { className: "rounded-2xl bg-white ring-1 ring-black/5 divide-y divide-black/5" },
        people.map((p, i) =>
          h(
            "li",
            { key: i, className: "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3" },
            h(
              "div",
              { className: "min-w-0" },
              h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, p.name),
              p.email && h("a", { className: "text-xs font-semibold text-[var(--accent-dark)] hover:underline break-all", href: "mailto:" + p.email }, p.email)
            ),
            p.role && h("span", { className: "text-xs font-semibold uppercase tracking-wide text-[var(--accent-dark)]" }, p.role)
          )
        )
      )
    );
  }

  function ContactRow({ icon, label, children }) {
    return h(
      "div",
      { className: "flex items-start gap-3" },
      h("span", { className: "mt-0.5 w-8 h-8 rounded-full bg-[var(--accent-10)] text-[var(--accent-dark)] flex items-center justify-center shrink-0" }, h(Icon, { name: icon, size: 16 })),
      h(
        "div",
        { className: "min-w-0" },
        h("p", { className: "text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, label),
        h("div", { className: "text-sm text-[var(--ink)] break-words" }, children)
      )
    );
  }

  function ContactsPage() {
    const club = GUWH.club || {};
    const season = GUWH.useSeason();
    const lines = GUWH.seasonRelevant(season) ? GUWH.seasonLines(season) : null;
    const c = club.committee || {};
    const link = "font-semibold text-[var(--accent-dark)] hover:underline";
    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Contacts", title: "Who to talk to", sub: "Any committee member is happy to help, and you'll find most of us at the pool on a Wednesday." }),

      h(
        "section",
        { className: "rounded-2xl bg-[var(--sand)] p-5 sm:p-6 mb-8 grid sm:grid-cols-2 gap-5" },
        club.email && h(ContactRow, { icon: "mail", label: "Club email" }, h("a", { className: link, href: "mailto:" + club.email }, club.email)),
        club.facebook && h(ContactRow, { icon: "share", label: "Facebook" }, h("a", { className: link, href: club.facebook, target: "_blank", rel: "noopener" }, "Geelong Underwater Hockey")),
        h(ContactRow, { icon: "mapPin", label: "Where we play" },
          club.venue, h("br"), club.venueAddress, h("br"),
          club.mapUrl && h("a", { className: link, href: club.mapUrl, target: "_blank", rel: "noopener" }, "Open in Maps")),
        h(ContactRow, { icon: "clock", label: "When" }, "Every " + club.sessionDay + ", " + club.sessionTime),
        // Summer break (11 Nov 2026): set in Administration.
        lines && h(ContactRow, { icon: "calendar", label: season.onBreak ? "Summer break - no games" : "Summer break" }, lines.last, h("br"), lines.back),
        club.postalAddress && h(ContactRow, { icon: "mail", label: "Post" }, club.postalAddress)
      ),

      h(RoleList, { title: "Office bearers " + (c.season || ""), people: c.officeBearers }),
      h(RoleList, { title: "General committee", people: c.general }),
      h(RoleList, { title: "Other club roles", people: c.exOfficio }),

      h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Something out of date? Let the Secretary know.")
    );
  }

  GUWH.Pages.Contacts = ContactsPage;
})();
