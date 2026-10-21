// ---------------------------------------------------------------------------
// GUWH concept — root App: nav, footer, route table, auth guards
// ---------------------------------------------------------------------------
(function () {
  const { Container, Button, Icon, Pill } = GUWH.UI;
  const { navigate, linkProps, useRoute } = GUWH.Router;

  // "Members" is deliberately not in this list - it's the highlighted CTA
  // button in the nav bar instead (see NavBar), and "Try It Free" is a plain
  // text link like the rest (16 Oct 2026, Cheongy). Both are only for
  // logged-out visitors. No separate "Home" link - the logo already goes
  // there. "Play" reuses the existing /about route (its "How it works"
  // section - rules, kit, positions - is the first thing on that page)
  // rather than a new page.
  const PUBLIC_NAV = [
    { label: "About", path: "/about" },
    { label: "News", path: "/news" },
    { label: "Play", path: "/about" },
    { label: "Beginners Guide", path: "/beginners-guide" },
    { label: "Try It Free", path: "/new-player" },
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
  // "This Week's Game" and "Bring a Mate" were dropped 12 Sept 2026 when the
  // dashboard briefly embedded the timetable/teams directly and folded
  // Bring a Mate into a modal. Both are back as their own nav entries
  // (13 Sept 2026, Cheongy's request) — Teams/Timetable live on their own
  // page again, and Bring a Mate is its own box on the dashboard rather
  // than a popup, so a direct link to each is worth having again.
  function memberNavFor(showForum) {
    const items = [
      { label: "Home", path: "/portal/dashboard" },
      { label: "This Week's Game", path: "/portal/board" },
      { label: "Player Stats", path: "/portal/stats" },
    ];
    // Members Forum only ever appears for adult members — juniors get zero
    // trace of it, not just a locked door. Real enforcement happens
    // server-side on every forum endpoint regardless; this just keeps
    // juniors from seeing it exists.
    if (showForum) items.push({ label: "Forum", path: "/portal/forum" });
    items.push({ label: "Bring a Mate", path: "/portal/bring-a-mate" });
    items.push({ label: "Profile", path: "/portal/profile" });
    return items;
  }

  function adminNavFor(roles) {
    const items = [];
    // Attendance moved out from under Game Coordination to its own menu
    // item (13 Sept 2026, Cheongy's request) — same audience as Game
    // Coordination (whoever can take the roll could already see it nested
    // there); it's just no longer a tab.
    if (roles.includes("game_coordinator") || roles.includes("administrator")) {
      items.push({ label: "Attendance", path: "/attendance" });
    }
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
    // nav, not a replacement for it — logged-in members still need About /
    // News / Play one click away (the logo covers Home).
    const identityMember = GUWH.Identity ? GUWH.Identity.currentMember() : null;
    const showForum = !!(identityMember && identityMember.age !== null && identityMember.age !== undefined);
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
    const homeHref = "/"; // logo always goes to the public homepage, logged in or not
    // Logged in: "Try It Free" is for newcomers, and the Members button goes
    // to the same place as the member nav's "Home", so both are dropped.
    const publicNav = loggedIn ? PUBLIC_NAV.filter((item) => item.path !== "/new-player") : PUBLIC_NAV;
    function doLogout() {
      if (GUWH.Identity) GUWH.Identity.logout();
      else GUWH.Store.logout();
      navigate("/");
    }

    function navButton(item, { active, small }) {
      return h(
        "a",
        Object.assign(linkProps(item.path), {
          key: item.label,
          className: cx(
            "rounded-full font-semibold transition",
            small ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm",
            active ? "bg-white/15 text-white" : "text-white/70 hover:text-white"
          ),
        }),
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
          "a",
          Object.assign(linkProps(homeHref), { className: "flex items-center gap-2.5 text-white" }),
          h("span", { className: "h-9 w-9 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0" }, h(Icon, { name: "droplet", size: 17, className: "text-white" })),
          h("span", { className: "font-display font-extrabold text-sm sm:text-base tracking-tight whitespace-nowrap" }, "Geelong Underwater Hockey")
        ),
        h(
          "nav",
          { className: "hidden lg:flex items-center gap-1" },
          publicNav.map((item) => navButton(item, { active: path === item.path }))
        ),
        h(
          "div",
          { className: "hidden lg:flex items-center gap-2" },
          !loggedIn && h(Button, { size: "sm", variant: "cta", onClick: () => navigate("/portal") }, "Members"),
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
            portalItems.map((item) => navButton(item, { active: path === item.path, small: true }))
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
            adminItems.map((item) => navButton(item, { active: path === item.path || (item.path === "/admin/roles" && path === "/admin/member"), small: true }))
          )
        ),
      open &&
        h(
          "div",
          { className: "lg:hidden border-t border-white/10 bg-[var(--navy)]" },
          h(
            Container,
            { className: "flex flex-col py-3 gap-1" },
            // Mobile menu order (2 Oct 2026): a logged-in member's own links
            // (Home, This Week's Game, Forum...) come first, the public site
            // links second. Logged out, it's just the public links.
            loggedIn &&
              portalItems.map((item) =>
                h(
                  "a",
                  Object.assign(linkProps(item.path, () => setOpen(false)), { key: "m" + item.path, className: cx("block text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") }),
                  item.label
                )
              ),
            loggedIn && portalItems.length > 0 &&
              h("div", { className: "h-px bg-white/10 my-2" }),
            publicNav.map((item, i) =>
              h(
                "a",
                Object.assign(linkProps(item.path, () => setOpen(false)), { key: "p" + i, className: cx("block text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") }),
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
                  "a",
                  Object.assign(linkProps(item.path, () => setOpen(false)), { key: item.path, className: cx("block text-left px-3 py-2.5 rounded-lg text-sm font-semibold", path === item.path ? "bg-white/15 text-white" : "text-white/70") }),
                  item.label
                )
              ),
            !loggedIn
              ? h(Button, { size: "sm", variant: "cta", className: "mt-2 w-fit", onClick: () => { navigate("/portal"); setOpen(false); } }, "Members")
              : h(Button, { size: "sm", variant: "secondary", className: "mt-2 w-fit !bg-white/10 !text-white !border-white/25", onClick: () => { doLogout(); setOpen(false); } }, "Log out")
          )
        )
    );
  }

  // Browser tab title per page (21 Oct 2026, site review SW-6), so tabs,
  // bookmarks and history entries say which page they are. Unlisted paths
  // (and the homepage) keep the plain club name.
  const SITE_NAME = "Geelong Underwater Hockey";
  const PAGE_TITLES = {
    "/about": "About",
    "/news": "News",
    "/beginners-guide": "Beginners Guide",
    "/new-player": "Try It Free",
    "/portal": "Members",
    "/portal/waiver": "Waiver",
    "/portal/dashboard": "Dashboard",
    "/portal/board": "This Week's Game",
    "/portal/stats": "Player Stats",
    "/portal/forum": "Forum",
    "/portal/bring-a-mate": "Bring a Mate",
    "/portal/profile": "My Profile",
    "/attendance": "Attendance",
    "/attendance/history": "Attendance",
    "/coordinator": "Game Coordination",
    "/community": "Community & Content",
    "/finance": "Finance",
    "/admin/roles": "Administration",
    "/admin/member": "Administration",
  };
  function pageTitle(path) {
    const page = PAGE_TITLES[path] || (path.startsWith("/portal/forum/") ? "Forum" : path.startsWith("/coordinator") ? "Game Coordination" : null);
    return page ? page + " | " + SITE_NAME : SITE_NAME;
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
          // Logos moved here from the homepage (13 Sept 2026, Cheongy's
          // request) — real affiliation logos, each linking to the body's
          // own site. White chip behind each so they read on the dark
          // footer background regardless of their own background.
          h(
            "div",
            { className: "flex items-center gap-3 mt-3" },
            h(
              "a",
              { href: "https://underwaterhockeyaustralia.org.au", target: "_blank", rel: "noopener", "aria-label": "Underwater Hockey Australia", className: "opacity-90 hover:opacity-100 transition shrink-0" },
              h("img", { src: "/images/logos/uwh-australia-logo.png", alt: "Underwater Hockey Australia", loading: "lazy", className: "h-11 w-11 rounded-full bg-white p-0.5 object-contain" })
            ),
            h(
              "a",
              { href: "https://auf.com.au/", target: "_blank", rel: "noopener", "aria-label": "Australian Underwater Federation Inc.", className: "opacity-90 hover:opacity-100 transition shrink-0" },
              h("img", { src: "/images/logos/auf-logo.png", alt: "Australian Underwater Federation Inc.", loading: "lazy", className: "h-11 w-auto rounded bg-white px-1.5 py-1 object-contain" })
            )
          )
        ),
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs uppercase tracking-wide text-white/50 mb-2" }, "Get involved"),
          h("a", { href: GUWH.club.facebook, target: "_blank", rel: "noopener", className: "block text-sm hover:text-white" }, "Facebook"),
          h("a", Object.assign(linkProps("/new-player"), { className: "block text-sm hover:text-white mt-1" }), "Try three sessions free")
        )
      ),
      // Was "Concept redesign — not the live club site." — leftover copy
      // from the original demo build, wrong for the real live site. Fixed
      // in passing while in here for the footer logos (13 Sept 2026).
      h(Container, { className: "mt-8 pt-6 border-t border-white/10 text-xs text-white/40" }, "© " + new Date().getFullYear() + " Geelong Underwater Hockey.")
    );
  }

  function requireAuth(path, role) {
    const { auth } = GUWH.Store.getState();
    if (!auth.loggedIn) return "/portal";
    if (role && auth.role !== role) return auth.role === "organiser" ? "/organiser/attendance" : "/portal/dashboard";
    return null;
  }

  // Public marketing pages a logged-in-but-unsigned member can still browse
  // without being bounced to the waiver first — everything else under
  // /portal, /coordinator, /attendance etc. is gated below.
  const WAIVER_EXEMPT_PATHS = ["/", "/about", "/beginners-guide", "/news", "/new-player", "/how-it-works", "/portal", "/portal/waiver"];

  // Online waiver switched OFF (12 Oct 2026, Cheongy): for now the waiver
  // is signed in person at the pool, so new members go straight to the
  // Dashboard. Flip to true to bring the online gate back - and set
  // ONLINE_WAIVER_REQUIRED in netlify/functions/booking.mts to match.
  const ONLINE_WAIVER_REQUIRED = false;

  // Pages anyone can see without logging in - they never wait for login.
  const OPEN_PATHS = ["/", "/about", "/beginners-guide", "/news", "/new-player", "/how-it-works", "/state-titles"];

  function Route(path) {
    // Wait until we know who's logged in and what roles they have before
    // deciding on a protected page (12 Oct 2026) - otherwise a direct link
    // (bookmark, email) bounced logged-in people to the login page or the
    // Dashboard. See isReady() in js/identity.js.
    if (GUWH.Identity && OPEN_PATHS.indexOf(path) === -1 && !GUWH.Identity.isReady()) {
      return h(Container, { className: "py-24 text-center text-sm text-[var(--ink-soft)]" }, "Loading…");
    }

    // Digital waiver gate (live site only, real backend). Anyone logged in
    // whose member record shows no waiver_accepted_at gets sent to sign it
    // before doing anything else in the portal or admin areas. Existing
    // members were grandfathered as already-accepted when this shipped
    // (see the migration), so in practice this only ever catches a
    // genuinely new registration — never re-prompts someone who already
    // has an account. currentMember() can briefly be null right after
    // login while /api/me is still loading — skip the check then rather
    // than bounce on incomplete data; the per-route currentUser() checks
    // below still apply in the meantime.
    if (ONLINE_WAIVER_REQUIRED && GUWH.Identity && GUWH.Identity.currentUser() && WAIVER_EXEMPT_PATHS.indexOf(path) === -1) {
      const member = GUWH.Identity.currentMember();
      if (member && !member.waiverAccepted) { navigate("/portal/waiver"); return null; }
    }

    if (path === "/" ) return h(GUWH.Pages.Home);
    if (path === "/new-player") return h(GUWH.Pages.NewPlayer);
    if (path === "/how-it-works") { navigate("/about"); return null; }
    if (path === "/wednesday-games") { const r = requireAuth(path); navigate(r || "/portal/board"); return null; }
    if (path === "/about") return h(GUWH.Pages.About);
    if (path === "/beginners-guide") return h(GUWH.Pages.BeginnersGuide);
    if (path === "/news") return h(GUWH.Pages.News);
    // State Titles interest page removed 2 Oct 2026 (Cheongy: no longer
    // needed). Old links land on the homepage instead of "Page not found".
    if (path === "/state-titles" || path === "/portal/state-titles") { navigate("/"); return null; }

    if (path === "/portal/waiver") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      return h(GUWH.Pages.Waiver);
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
    if (path === "/portal/stats") {
      if (GUWH.Identity) {
        if (!GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
        return h(GUWH.Pages.PlayerStats);
      }
      return h(Container, { className: "py-24 text-center text-[var(--ink-soft)]" }, "Not available in this preview.");
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
    if (path === "/coordinator" || path === "/coordinator/teams" || path === "/coordinator/schedule" || path === "/coordinator/scores" || path === "/coordinator/publish") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      const roles = GUWH.Identity.currentRoles();
      if (!roles.includes("game_coordinator") && !roles.includes("administrator")) { navigate("/portal/dashboard"); return null; }
      const tab = path === "/coordinator/schedule" ? "schedule" : path === "/coordinator/scores" ? "scores" : path === "/coordinator/publish" ? "publish" : "teams";
      return h(GUWH.Pages.Coordinator, { tab });
    }
    // Attendance — its own page now, was a Game Coordination tab (13 Sept
    // 2026). "/coordinator/history" pre-dates this move and, on checking
    // just now, was never actually wired up here — history's new home,
    // "/attendance/history", is its first working route.
    if (path === "/attendance" || path === "/attendance/history" || path === "/coordinator/history") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      const roles = GUWH.Identity.currentRoles();
      if (!roles.includes("game_coordinator") && !roles.includes("administrator")) { navigate("/portal/dashboard"); return null; }
      const tab = path === "/attendance/history" || path === "/coordinator/history" ? "history" : "roll";
      return h(GUWH.Pages.Attendance, { tab });
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
    // One member's page (16 Oct 2026) - opened from the Administration list.
    if (path === "/admin/member") {
      if (!GUWH.Identity || !GUWH.Identity.currentUser()) { navigate("/portal"); return null; }
      if (!GUWH.Identity.currentRoles().includes("administrator")) { navigate("/portal/dashboard"); return null; }
      return h(GUWH.Pages.AdminMember);
    }

    return h(
      Container,
      { className: "py-24 text-center" },
      h("h1", { className: "font-display text-3xl font-bold text-[var(--ink)]" }, "Page not found"),
      h(Button, { className: "mt-6", onClick: () => navigate("/") }, "Back to home")
    );
  }

  // Logged-in members who open the site on the homepage go straight to
  // their Dashboard (2 Oct 2026) — only on that first landing, so the logo
  // can still take them to the public homepage afterwards.
  let pendingLandingRedirect = GUWH.Router.currentPath() === "/";
  // Someone clicking the link in their signup confirmation email lands on
  // "/#confirmation_token=..." - the widget logs them in a moment later.
  // Send them to their Profile to fill in their details (14 Oct 2026,
  // Cheongy: "link back to the profile page"); saving it takes them on to
  // the Dashboard's Getting started checklist. If the link has already been
  // used or has expired, the widget reports an error and we show the login
  // page with a note instead of leaving them on the homepage.
  let pendingConfirmation = /confirmation_token=/.test(window.location.hash);
  // The widget doesn't reliably raise an event when the link fails, so if
  // nobody is logged in a few seconds after the link was opened, treat it
  // as used/expired. A late login still lands on Profile (pendingConfirmation
  // stays set until a user appears).
  function confirmationFailed() {
    if (!pendingConfirmation || (GUWH.Identity && GUWH.Identity.currentUser())) return;
    pendingLandingRedirect = false;
    GUWH.confirmFailed = true;
    navigate("/portal");
  }
  if (pendingConfirmation) {
    if (window.netlifyIdentity) window.netlifyIdentity.on("error", confirmationFailed);
    setTimeout(confirmationFailed, 6000);
  }
  function maybeRedirectLanding() {
    if (pendingConfirmation && GUWH.Identity && GUWH.Identity.currentUser()) {
      pendingConfirmation = false;
      pendingLandingRedirect = false;
      GUWH.justJoined = true;
      navigate("/portal/profile");
      return;
    }
    if (pendingConfirmation) return; // wait for the login that follows confirmation
    if (!pendingLandingRedirect || !GUWH.Identity) return;
    if (GUWH.Identity.currentUser() && GUWH.Router.currentPath() === "/") navigate("/portal/dashboard");
    pendingLandingRedirect = false;
  }

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  function App() {
    const path = useRoute();
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);
    React.useEffect(() => {
      if (!GUWH.Identity) return; // no-op on the concept preview, which never loads identity.js
      // Listener first, then init, so the widget's "init" event can't fire
      // before anyone is listening.
      const off = GUWH.Identity.onChange(() => { maybeRedirectLanding(); force(); }); // re-render nav/routes on login, logout, and widget init
      GUWH.Identity.init();
      maybeRedirectLanding();
      return off;
    }, []);
    // Every page change starts at the top (2 Oct 2026). navigate() already
    // scrolled, but only before the new page rendered — and back/forward,
    // typed URLs and plain #links never went through navigate() at all, so
    // pages opened part-way down (the Dashboard landed 1,000px down, past
    // the I'm Coming button).
    React.useLayoutEffect(() => {
      // "instant" overrides the site's smooth-scroll CSS, which otherwise
      // animates (and can be interrupted by) this jump.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [path]);
    React.useEffect(() => { document.title = pageTitle(path); }, [path]);

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
