// ---------------------------------------------------------------------------
// GUWH concept — root App: nav, footer, route table, auth guards
// ---------------------------------------------------------------------------
(function () {
  const { Container, Button, Icon, Pill } = GUWH.UI;
  const { navigate, useRoute } = GUWH.Router;

  // "Try UWH" is deliberately not in this list — it's the highlighted CTA
  // button in the nav bar instead (see NavBar), not a plain text link.
  const PUBLIC_NAV = [
    { label: "Home", path: "/" },
    { label: "About Us", path: "/about" },
    { label: "News & Community", path: "/news" },
    { label: "Member portal", path: "/portal" },
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

  // Real workspaces (live site) — split into two groups so a member who
  // also holds a staff role (game_coordinator, community_moderator,
  // treasurer, administrator) sees BOTH: their ordinary member nav, and a
  // separate, clearly-labelled staff nav underneath it. Every registered
  // member is implicitly a "Member" — memberNavFor is what every logged-in
  // member sees regardless of roles; adminNavFor is only the roles stacked
  // on top, and is empty for a plain member. Real enforcement happens
  // server-side on every route/endpoint regardless — these two lists only
  // control what shows up to click.
  function memberNavFor(showForum) {
    const items = [
      { label: "Dashboard", path: "/portal/dashboard" },
      { label: "This Week's Game", path: "/portal/board" },
      { label: "Bring a Mate", path: "/portal/bring-a-mate" },
    ];
    // Members Forum only ever appears for adult members — juniors get zero
    // trace of it, not just a locked door. Real enforcement happens
    // server-side on every forum endpoint regardless; this just keeps
    // juniors from seeing it exists.
    if (showForum) items.push({ label: "Members Forum", path: "/portal/forum" });
    items.push({ label: "My Profile", path: "/portal/profile" });
    return items;
  }

  function adminNavFor(roles) {
    const items = [];
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
    // The member portal nav is now a SECOND row underneath the main site
    // nav, not a replacement for it — logged-in members still need Home /
    // Try Underwater Hockey / About Us / News & Community one click away.
    const identityMember = GUWH.Identity ? GUWH.Identity.currentMember() : null;
    const showForum = !!(identityMember && identityMember.age !== null && identityMember.age !== undefined && identityMember.age >= 18);
    // Member Functions: what every logged-in member sees. Admin Functions:
    // only the staff-role workspaces stacked on top — empty for a plain
    // member, so an administrator (who holds every staff role at once) sees
    // both rows while everyone else only ever sees the first.
    const portalItems = loggedIn
      ? GUWH.Identity
        ? memberNavFor(showForum)
        : role === "organiser" ? ORGANISER_NAV : PLAYER_NAV
      : [];
    const adminItems = loggedIn && GUWH.Identity ? adminNavFor(GUWH.Identity.currentRoles()) : [];
    const homeHref = loggedIn ? (role === "organiser" ? "/organiser/attendance" : "/portal/dashboard") : "/";
    function doLogout() {
      if (GUWH.Identity) GUWH.Identity.logout();
      else GUWH.Store.logout();
      navigate("/");
    }

    function navButton(item, { onClick, active, small }) {
      return h(
        "button",
        {
          key: item.path,
          onClick,
          className: cx(
            "rounded-full font-semibold transition",
            small ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm",
            active ? "bg-white/15 text-white" : "text-white/70 hover:text-white"
          ),
        },
        item.label
      );
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
          PUBLIC_NAV.map((item) => navButton(item, { onClick: () => navigate(item.path), active: path === item.path }))
        ),
        h(
          "div",
          { className: "hidden lg:flex items-center gap-2" },
          !loggedIn && h(Button, { size: "sm", variant: "cta", onClick: () => navigate("/new-player") }, "Try UWH"),
          loggedIn && h(Button, { size: "sm", variant: "secondary", className: "!bg-white/10 !text-white !border-white/25", onClick: doLogout }, "Log out")
        ),
        h(
          "button",
          { className: "lg:hidden text-white p-2", onClick: () => setOpen((v) => !v), "aria-label": "Menu" },
          h(Icon, { name: open ? "x" : "menu", size: 22 })
        )
      ),
      loggedIn && portalItems.length > 0 &&
        h(
          "div",
          { className: "hidden lg:block border-t border-white/10 bg-black/15" },
          h(
            Container,
            { className: "flex items-center gap-1 h-11" },
            portalItems.map((item) => navButton(item, { onClick: () => navigate(item.path), active: path === item.path, small: true }))
          )
        ),
      loggedIn && adminItems.length > 0 &&
        h(
          "div",
          { className: "hidden lg:block border-t border-white/10 bg-black/30" },
          h(
            Container,
            { className: "flex items-center gap-3 h-11" },
            h("span", { className: "font-mono text-[10px] uppercase tracking-wide text-white/40 shrink-0" }, "Admin functions"),
            adminItems.map((item) => navButton(item, { onClick: () => navigate(item.path), active: path === item.path, small: true }))
          )
        ),
      open &&
        h(
          "div",
          { className: "lg:hidden border-t border-white/10 bg-[var(--navy)]" },
          h(
            Container,
            { className: "flex flex-col py-3 gap-1" },
            PUBLIC_NAV.map((item) =>
              h(
                "button",
                { key: item.path, onClick: () => { navigate(item.path); setOpen(false); }, className: cx("text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") },
                item.label
              )
            ),
            loggedIn && portalItems.length > 0 &&
              h("div", { className: "h-px bg-white/10 my-2" }),
            loggedIn &&
              portalItems.map((item) =>
                h(
                  "button",
                  { key: item.path, onClick: () => { navigate(item.path); setOpen(false); }, className: cx("text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") },
                  item.label
                )
              ),
            loggedIn && adminItems.length > 0 &&
              h("div", { className: "h-px bg-white/10 my-2" }),
            loggedIn && adminItems.length > 0 &&
              h("span", { className: "font-mono text-[10px] uppercase tracking-wide text-white/40 px-3 pb-1" }, "Admin functions"),
            loggedIn &&
              adminItems.map((item) =>
                h(
                  "button",
                  { key: item.path, onClick: () => { navigate(item.path); setOpen(false); }, className: cx("text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") },
                  item.label
                )
              ),
            !loggedIn
              ? h(Button, { size: "sm", variant: "cta", className: "mt-2 w-fit", onClick: () => { navigate("/new-player"); setOpen(false); } }, "Try UWH")
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
    if (path === "/portal/forum" || path.indexOf("/portal/forum/topic/") === 0) {
      // Members Forum — real backend only. Adult-members-only is enforced
      // server-side on every forum endpoint; the page itself also checks
      // eligibility/opt-in before showing anything, so a junior or an
      // opted-out member who lands here directly just sees a gate, not
      // forum content.
      if (!GUWH.Identity) {
        return h(Container, { className: "py-24 text-center text-[var(--ink-soft)]" }, "Not available in this preview.");
      }
      if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      if (path === "/portal/forum") return h(GUWH.Pages.Forum);
      const topicId = Number(path.slice("/portal/forum/topic/".length));
      return h(GUWH.Pages.Forum, { topicId: Number.isFinite(topicId) ? topicId : null });
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
