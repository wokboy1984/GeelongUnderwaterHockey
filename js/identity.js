// ---------------------------------------------------------------------------
// Real member login for the live build, via Netlify Identity.
// Only loaded by index.html (the live site) — the concept preview never
// includes this file, so it stays exactly as it was.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  const listeners = new Set();
  let cachedMember = null; // { id, email, firstName, lastName, age, roles } — always from /api/me, never client-guessed

  // Readiness (12 Oct 2026). Before this, the router checked "logged in?"
  // and "which roles?" before the Identity widget had started and before
  // /api/me had answered, so opening any member or coordinator link
  // directly (a bookmark, or the reminder / "teams are up" email links)
  // bounced a logged-in person to the login page or the Dashboard. The
  // router now waits for isReady() on protected pages.
  let initDone = false;
  let memberSettled = false;
  let refreshing = null;

  function ready() {
    return typeof window.netlifyIdentity !== "undefined";
  }

  // Fetches the real member profile + roles for whoever's logged in right
  // now. Roles are the server's answer, not anything cached client-side
  // trusted on its own — every privileged endpoint re-checks them anyway.
  async function refreshMember() {
    if (!currentUser()) {
      cachedMember = null;
      memberSettled = true;
      listeners.forEach((fn) => fn());
      return null;
    }
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const res = await authFetch("/api/me");
        const data = await res.json();
        cachedMember = data.ok ? data.member : null;
      } catch (e) {
        cachedMember = null;
      }
      memberSettled = true;
      refreshing = null;
      listeners.forEach((fn) => fn());
      return cachedMember;
    })();
    return refreshing;
  }

  // True once we know who (if anyone) is logged in and, if they are, what
  // their member record and roles are. If the widget script never loaded,
  // don't hold pages hostage - report ready.
  function isReady() {
    if (!ready()) return true;
    return initDone && (!currentUser() || memberSettled);
  }

  function currentMember() {
    return cachedMember;
  }

  function currentRoles() {
    return cachedMember ? cachedMember.roles : [];
  }

  function hasRole(role) {
    return currentRoles().includes(role);
  }

  function init() {
    if (!ready()) return;
    // Close the widget on login (27 Oct 2026). Its modal is a full-screen
    // transparent iframe that stays open after a confirmation link or a
    // modal login; on some mobile browsers (Vanadium) its "Logged in as"
    // box doesn't draw, leaving an invisible layer that swallows every tap
    // on the Profile form. Safe for password-reset and invite links: the
    // widget only fires "login" after the new password is saved.
    window.netlifyIdentity.on("login", () => { window.netlifyIdentity.close(); memberSettled = false; refreshMember(); listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.on("logout", () => { cachedMember = null; memberSettled = true; listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.on("init", (user) => { initDone = true; if (user && !cachedMember) refreshMember(); listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.init();
    // The widget can finish initialising before this runs (so its "init"
    // event has already fired and won't fire again) - in which case the
    // member record was never fetched and roles stayed empty. Its stored
    // session is readable straight away, so don't wait on the event.
    initDone = true;
    if (currentUser() && !cachedMember) refreshMember();
    else if (!currentUser()) memberSettled = true;
    listeners.forEach((fn) => fn());
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function currentUser() {
    return ready() ? window.netlifyIdentity.currentUser() : null;
  }

  function login() {
    ready() && window.netlifyIdentity.open("login");
  }

  function signup() {
    ready() && window.netlifyIdentity.open("signup");
  }

  function logout() {
    ready() && window.netlifyIdentity.logout();
  }

  // Changes the logged-in user's login email via Netlify Identity itself
  // (not the members table — that's just a cache of it). Netlify emails a
  // confirmation link to the new address by default; the change only takes
  // effect once that's clicked.
  function updateEmail(newEmail) {
    const user = currentUser();
    if (!user) return Promise.reject(new Error("Not logged in"));
    return user.update({ email: newEmail });
  }

  // Attaches the current user's token to a fetch call. Netlify Identity's
  // jwt() refreshes the token if it's stale, so callers never see an
  // expired-token error under normal use.
  async function authFetch(url, options) {
    const user = currentUser();
    const token = user ? await user.jwt() : null;
    const headers = Object.assign(
      { "content-type": "application/json" },
      (options && options.headers) || {},
      token ? { Authorization: "Bearer " + token } : {}
    );
    return fetch(url, Object.assign({}, options, { headers }));
  }

  GUWH.Identity = { init, onChange, currentUser, login, signup, logout, updateEmail, authFetch, currentMember, currentRoles, hasRole, refreshMember, isReady };
})();
