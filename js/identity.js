// ---------------------------------------------------------------------------
// Real member login for the live build, via Netlify Identity.
// Only loaded by index.html (the live site) — the concept preview never
// includes this file, so it stays exactly as it was.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  const listeners = new Set();

  function ready() {
    return typeof window.netlifyIdentity !== "undefined";
  }

  function init() {
    if (!ready()) return;
    window.netlifyIdentity.on("login", () => listeners.forEach((fn) => fn()));
    window.netlifyIdentity.on("logout", () => listeners.forEach((fn) => fn()));
    window.netlifyIdentity.on("init", () => listeners.forEach((fn) => fn()));
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

  GUWH.Identity = { init, onChange, currentUser, login, signup, logout, authFetch };
})();
