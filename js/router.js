// ---------------------------------------------------------------------------
// GUWH concept — tiny hash router (no external dependency).
// Routes are plain strings like "/", "/new-player", "/portal/dashboard".
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  // "#/new-player?ref=abc" -> path "/new-player", query ref=abc (13 Oct
  // 2026, Bring a Mate links). Routes only ever match on the path.
  function currentPath() {
    const hash = window.location.hash || "#/";
    return hash.slice(1).split("?")[0] || "/";
  }

  function queryParam(name) {
    const hash = window.location.hash || "";
    const i = hash.indexOf("?");
    if (i === -1) return null;
    try { return new URLSearchParams(hash.slice(i + 1)).get(name); } catch (e) { return null; }
  }

  function navigate(path) {
    window.location.hash = "#" + path;
    window.scrollTo({ top: 0, behavior: "instant" }); // "instant" beats the smooth-scroll CSS (2 Oct 2026)
  }

  function useRoute() {
    const [path, setPath] = React.useState(currentPath());
    React.useEffect(() => {
      const onHash = () => setPath(currentPath());
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);
    return path;
  }

  GUWH.Router = { navigate, useRoute, currentPath, queryParam };
})();
