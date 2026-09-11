// ---------------------------------------------------------------------------
// GUWH concept — root App: nav, footer, route table, auth guards
// ---------------------------------------------------------------------------
(function () {
  const { Container, Button, Icon, Pill } = GUWH.UI;
  const { navigate, useRoute } = GUWH.Router;

  const PUBLIC_NAV = [
    { label: "Home", path: "/" },
    { label: "Try Underwater Hockey", path: "/new-player" },
    { label: "About Us", path: "/about" },
    { label: "News & Community", path: "/news" },
  ];

  const PLAYER_NAV = [
    { label: "Dashboard", path: "/portal/dashboard" },
    { label: "Book a Game", path: "/portal/book" },
    { label: "This Week's Game", path: "/portal/board" },
    { label: "Bring a Mate", path: "/portal/bring-a-mate" },
    { label: "My Profile", path: "/portal/profile" },
  ];

  const ORGANISER_NAV = [
    { label: "Attendance", path: "/organiser/attendance" },
    { label: "Team Builder", path: "/organiser/teams" },
    { label: "Publish", path: "/organiser/publish" },
  ];

  function NavBar({ path }) {
    const { auth } = GUWH.Store.getState();
    const [open, setOpen] = React.useState(false);
    const inPortal = path.startsWith("/portal") || path.startsWith("/organiser");
    const items = auth.loggedIn ? (auth.role === "organiser" ? ORGANISER_NAV : PLAYER_NAV) : PUBLIC_NAV;
    const homeHref = auth.loggedIn ? (auth.role === "organiser" ? "/organiser/attendance" : "/portal/dashboard") : "/";

    return h(
      "header",
      { className: "sticky top-0 z-40 bg-[var(--navy-95)] backdrop-blur border-b border-white/10" },
      h(
        Container,
        { className: "flex items-center justify-between h-16" },
        h(
          "button",
          { onClick: () => navigate(homeHref), className: "flex items-center gap-2.5 text-white" },
          h("span", { className: "h-9 w-9 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0" }, h(Icon, { name: "droplet", size: 17, className: "text-white" })),
          h("span", { className: "font-display font-extrabold text-sm sm:text-base tracking-tight whitespace-nowrap" }, "Geelong Underwater Hockey")
        ),
        h(
          "nav",
          { className: "hidden lg:flex items-center gap-1" },
          items.map((item) =>
            h(
              "button",
              {
                key: item.path,
                onClick: () => navigate(item.path),
                className: cx("px-3 py-2 rounded-full text-sm font-semibold transition", path === item.path ? "bg-white/15 text-white" : "text-white/70 hover:text-white"),
              },
              item.label
            )
          )
        ),
        h(
          "div",
          { className: "hidden lg:flex items-center gap-2" },
          !auth.loggedIn && h(Button, { size: "sm", variant: "cta", onClick: () => navigate("/portal") }, "Member portal"),
          auth.loggedIn && h(Button, { size: "sm", variant: "secondary", className: "!bg-white/10 !text-white !border-white/25", onClick: () => { GUWH.Store.logout(); navigate("/"); } }, "Log out")
        ),
        h(
          "button",
          { className: "lg:hidden text-white p-2", onClick: () => setOpen((v) => !v), "aria-label": "Menu" },
          h(Icon, { name: open ? "x" : "menu", size: 22 })
        )
      ),
      open &&
        h(
          "div",
          { className: "lg:hidden border-t border-white/10 bg-[var(--navy)]" },
          h(
            Container,
            { className: "flex flex-col py-3 gap-1" },
            items.map((item) =>
              h(
                "button",
                { key: item.path, onClick: () => { navigate(item.path); setOpen(false); }, className: cx("text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") },
                item.label
              )
            ),
            !auth.loggedIn
              ? h(Button, { size: "sm", variant: "cta", className: "mt-2 w-fit", onClick: () => { navigate("/portal"); setOpen(false); } }, "Member portal")
              : h(Button, { size: "sm", variant: "secondary", className: "mt-2 w-fit !bg-white/10 !text-white !border-white/25", onClick: () => { GUWH.Store.logout(); navigate("/"); setOpen(false); } }, "Log out")
          )
        )
    );
  }

  function Footer() {
    return h(
      "footer",
      { className: "bg-[var(--ink)] text-white/70 py-12 mt-auto" },
      h(
        Container,
        { className: "grid sm:grid-cols-3 gap-8" },
        h(
          "div",
          null,
          h("p", { className: "font-display text-lg font-bold text-white" }, "Geelong Underwater Hockey"),
          h("p", { className: "mt-2 text-sm leading-relaxed" }, GUWH.club.venue + ", " + GUWH.club.venueAddress),
          h("p", { className: "text-sm" }, "Every " + GUWH.club.sessionDay + ", " + GUWH.club.sessionTime)
        ),
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs uppercase tracking-wide text-white/50 mb-2" }, "Governing bodies"),
          h("a", { href: "https://vuhc.org.au/", target: "_blank", rel: "noopener", className: "block text-sm hover:text-white" }, "Victorian Underwater Hockey Commission"),
          h("a", { href: "https://underwaterhockeyaustralia.org.au", target: "_blank", rel: "noopener", className: "block text-sm hover:text-white mt-1" }, "Underwater Hockey Australia")
        ),
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs uppercase tracking-wide text-white/50 mb-2" }, "Get involved"),
          h("a", { href: GUWH.club.facebook, target: "_blank", rel: "noopener", className: "block text-sm hover:text-white" }, "Facebook"),
          h("button", { onClick: () => navigate("/new-player"), className: "block text-sm hover:text-white mt-1 text-left" }, "Try three sessions free")
        )
      ),
      h(Container, { className: "mt-8 pt-6 border-t border-white/10 text-xs text-white/40" }, "Concept redesign — not the live club site.")
    );
  }

  function requireAuth(path, role) {
    const { auth } = GUWH.Store.getState();
    if (!auth.loggedIn) return "/portal";
    if (role && auth.role !== role) return auth.role === "organiser" ? "/organiser/attendance" : "/portal/dashboard";
    return null;
  }

  function Route(path) {
    if (path === "/" ) return h(GUWH.Pages.Home);
    if (path === "/new-player") return h(GUWH.Pages.NewPlayer);
    if (path === "/how-it-works") { navigate("/about"); return null; }
    if (path === "/wednesday-games") { const r = requireAuth(path); navigate(r || "/portal/board"); return null; }
    if (path === "/about") return h(GUWH.Pages.About);
    if (path === "/news") return h(GUWH.Pages.News);
    if (path === "/live/attendance") {
      return GUWH.Pages.LiveAttendance
        ? h(GUWH.Pages.LiveAttendance)
        : h(Container, { className: "py-24 text-center text-[var(--ink-soft)]" }, "Not available in this preview.");
    }

    if (path === "/portal") {
      const { auth } = GUWH.Store.getState();
      if (auth.loggedIn) { navigate(auth.role === "organiser" ? "/organiser/attendance" : "/portal/dashboard"); return null; }
      return h(GUWH.Pages.PortalLogin);
    }
    if (path === "/portal/dashboard") { const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Dashboard); }
    if (path === "/portal/book") { const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.BookGame); }
    if (path === "/portal/board") { const r = requireAuth(path); if (r) { navigate(r); return null; } return h(GUWH.Pages.GameBoard); }
    if (path === "/portal/bring-a-mate") { const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.BringAMate); }
    if (path === "/portal/profile") { const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Profile); }

    if (path === "/organiser/attendance") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "attendance" }); }
    if (path === "/organiser/teams") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "teams" }); }
    if (path === "/organiser/publish") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "publish" }); }

    return h(
      Container,
      { className: "py-24 text-center" },
      h("h1", { className: "font-display text-3xl font-bold text-[var(--ink)]" }, "Page not found"),
      h(Button, { className: "mt-6", onClick: () => navigate("/") }, "Back to home")
    );
  }

  function App() {
    const path = useRoute();
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);
    React.useEffect(() => {
      if (GUWH.Identity) GUWH.Identity.init(); // no-op on the concept preview, which never loads identity.js
    }, []);

    return h(
      "div",
      { className: "min-h-screen flex flex-col" },
      h(NavBar, { path }),
      h("main", { className: "flex-1" }, Route(path)),
      h(Footer)
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(h(App));
})();
