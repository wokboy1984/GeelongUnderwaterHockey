// ---------------------------------------------------------------------------
// GUWH concept — tiny hash router (no external dependency).
// Routes are plain strings like "/", "/new-player", "/portal/dashboard".
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  function currentPath() {
    const hash = window.location.hash || "#/";
    return hash.slice(1) || "/";
  }

  function navigate(path) {
    window.location.hash = "#" + path;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
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

  GUWH.Router = { navigate, useRoute, currentPath };
})();
