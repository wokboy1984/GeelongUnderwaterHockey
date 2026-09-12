// ---------------------------------------------------------------------------
// Real member login for the live build, via Netlify Identity.
// Only loaded by index.html (the live site) — the concept preview never
// includes this file, so it stays exactly as it was.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  const listeners = new Set();
  let cachedMember = null; // { id, email, firstName, lastName, age, roles } — always from /api/me, never client-guessed

  function ready() {
    return typeof window.netlifyIdentity !== "undefined";
  }

  // Fetches the real member profile + roles for whoever's logged in right
  // now. Roles are the server's answer, not anything cached client-side
  // trusted on its own — every privileged endpoint re-checks them anyway.
  async function refreshMember() {
    if (!currentUser()) {
      cachedMember = null;
      listeners.forEach((fn) => fn());
      return null;
    }
    try {
      const res = await authFetch("/api/me");
      const data = await res.json();
      cachedMember = data.ok ? data.member : null;
    } catch (e) {
      cachedMember = null;
    }
    listeners.forEach((fn) => fn());
    return cachedMember;
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
    window.netlifyIdentity.on("login", () => { refreshMember(); listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.on("logout", () => { cachedMember = null; listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.on("init", (user) => { if (user) refreshMember(); listeners.forEach((fn) => fn()); });
    window.netlifyIdentity.init();
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

  GUWH.Identity = { init, onChange, currentUser, login, signup, logout, updateEmail, authFetch, currentMember, currentRoles, hasRole, refreshMember };
})();
