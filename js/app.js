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

  // Real workspaces (live site) — each one only appears in nav for a member
  // who actually holds the role it needs, and each route re-checks the same
  // role server-side isn't enough on its own, so the page behind it also
  // bounces anyone without the role. Every registered member is implicitly
  // a "Member" — these are the roles stacked on top.
  function realNavFor(roles) {
    const items = [
      { label: "Dashboard", path: "/portal/dashboard" },
      { label: "This Week's Game", path: "/portal/board" },
      { label: "Bring a Mate", path: "/portal/bring-a-mate" },
      { label: "My Profile", path: "/portal/profile" },
    ];
    if (roles.includes("game_coordinator") || roles.includes("administrator")) {
      items.push({ label: "Game Coordination", path: "/coordinator" });
    }
    if (roles.includes("community_moderator") || roles.includes("administrator")) {
      items.push({ label: "Community & Content", path: "/community" });
    }
    if (roles.includes("treasurer") || roles.includes("administrator")) {
      items.push({ label: "Finance", path: "/finance" });
    }
    if (roles.includes("administrator")) {
      items.push({ label: "Administration", path: "/admin/roles" });
    }
    return items;
  }

  function NavBar({ path }) {
    const { auth } = GUWH.Store.getState();
    const [open, setOpen] = React.useState(false);
    const inPortal = path.startsWith("/portal") || path.startsWith("/organiser");

    // Real Identity user (live site) takes priority over the demo store,
    // which only exists for the concept preview.
    const identityUser = GUWH.Identity ? GUWH.Identity.currentUser() : null;
    const loggedIn = GUWH.Identity ? !!identityUser : auth.loggedIn;
    const role = GUWH.Identity ? "player" : auth.role; // demo-only concept preview has no real roles
    const items = loggedIn
      ? GUWH.Identity
        ? realNavFor(GUWH.Identity.currentRoles())
        : role === "organiser" ? ORGANISER_NAV : PLAYER_NAV
      : PUBLIC_NAV;
    const homeHref = loggedIn ? (role === "organiser" ? "/organiser/attendance" : "/portal/dashboard") : "/";
    function doLogout() {
      if (GUWH.Identity) GUWH.Identity.logout();
      else GUWH.Store.logout();
      navigate("/");
    }

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
          !loggedIn && h(Button, { size: "sm", variant: "cta", onClick: () => navigate("/portal") }, "Member portal"),
          loggedIn && h(Button, { size: "sm", variant: "secondary", className: "!bg-white/10 !text-white !border-white/25", onClick: doLogout }, "Log out")
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
            !loggedIn
              ? h(Button, { size: "sm", variant: "cta", className: "mt-2 w-fit", onClick: () => { navigate("/portal"); setOpen(false); } }, "Member portal")
              : h(Button, { size: "sm", variant: "secondary", className: "mt-2 w-fit !bg-white/10 !text-white !border-white/25", onClick: () => { doLogout(); setOpen(false); } }, "Log out")
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
      if (GUWH.Identity) {
        if (GUWH.Identity.currentUser()) { navigate("/portal/dashboard"); return null; }
        return h(GUWH.Pages.PortalLogin);
      }
      const { auth } = GUWH.Store.getState();
      if (auth.loggedIn) { navigate(auth.role === "organiser" ? "/organiser/attendance" : "/portal/dashboard"); return null; }
      return h(GUWH.Pages.PortalLogin);
    }
    if (path === "/portal/dashboard") {
      if (GUWH.Identity) {
        if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
        return h(GUWH.Pages.Dashboard);
      }
      const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Dashboard);
    }
    if (path === "/portal/book") { const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.BookGame); }
    if (path === "/portal/board") {
      if (GUWH.Identity) {
        if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
        return h(GUWH.Pages.GameBoard);
      }
      const r = requireAuth(path); if (r) { navigate(r); return null; } return h(GUWH.Pages.GameBoard);
    }
    if (path === "/portal/bring-a-mate") {
      if (GUWH.Identity) {
        if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
        return h(GUWH.Pages.BringAMate);
      }
      const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.BringAMate);
    }
    if (path === "/portal/profile") {
      if (GUWH.Identity) {
        if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
        return h(GUWH.Pages.Profile);
      }
      const r = requireAuth(path, "player"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Profile);
    }

    if (path === "/organiser/attendance") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "attendance" }); }
    if (path === "/organiser/teams") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "teams" }); }
    if (path === "/organiser/publish") { const r = requireAuth(path, "organiser"); if (r) { navigate(r); return null; } return h(GUWH.Pages.Organiser, { tab: "publish" }); }

    // Real role-gated workspaces (live site only — GUWH.Identity present).
    // Each check is client-side convenience only; the pages themselves call
    // endpoints that re-check the same role against the database, so a
    // direct URL visit without the role gets a 403 from the server, not
    // just a redirect here.
    if (path === "/coordinator" || path === "/coordinator/teams" || path === "/coordinator/schedule" || path === "/coordinator/publish") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      const roles = GUWH.Identity.currentRoles();
      if (!roles.includes("game_coordinator") && !roles.includes("administrator")) { navigate("/portal/dashboard"); return null; }
      const tab = path === "/coordinator/teams" ? "teams" : path === "/coordinator/schedule" ? "schedule" : path === "/coordinator/publish" ? "publish" : "attendance";
      return h(GUWH.Pages.Coordinator, { tab });
    }
    if (path === "/community") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      const roles = GUWH.Identity.currentRoles();
      if (!roles.includes("community_moderator") && !roles.includes("administrator")) { navigate("/portal/dashboard"); return null; }
      return h(GUWH.Pages.Community);
    }
    if (path === "/finance") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      const roles = GUWH.Identity.currentRoles();
      if (!roles.includes("treasurer") && !roles.includes("administrator")) { navigate("/portal/dashboard"); return null; }
      return h(GUWH.Pages.Finance);
    }
    if (path === "/admin/roles") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      if (!GUWH.Identity.currentRoles().includes("administrator")) { navigate("/portal/dashboard"); return null; }
      return h(GUWH.Pages.AdminRoles);
    }

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
      if (!GUWH.Identity) return; // no-op on the concept preview, which never loads identity.js
      GUWH.Identity.init();
      return GUWH.Identity.onChange(force); // re-render nav/routes on login, logout, and widget init
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
