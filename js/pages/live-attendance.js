// ---------------------------------------------------------------------------
// Real attendance — the first feature wired to the actual live backend
// (Netlify Identity + Netlify DB), separate from the concept's demo
// dashboard so the two never get mixed up while the rest of the app is
// still being migrated feature by feature.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading } = GUWH.UI;

  function LiveAttendancePage() {
    const [user, setUser] = React.useState(() => GUWH.Identity.currentUser());
    const [status, setStatus] = React.useState(null); // { sessionDate, inSession, confirmedCount }
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => GUWH.Identity.onChange(() => setUser(GUWH.Identity.currentUser())), []);

    React.useEffect(() => {
      if (!user) {
        setStatus(null);
        return;
      }
      setLoading(true);
      setError(null);
      GUWH.Identity.authFetch("/api/booking")
        .then((r) => r.json())
        .then((data) => (data.ok ? setStatus(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, [user]);

    async function toggle() {
      if (!status) return;
      setLoading(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/booking", {
          method: "POST",
          body: JSON.stringify({ in: !status.inSession }),
        });
        const data = await res.json();
        if (data.ok) setStatus(data);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    return h(
      Container,
      { className: "py-16 sm:py-24 max-w-lg" },
      h(Pill, { tone: "accent" }, "Live build — real account"),
      h("h1", { className: "font-display text-3xl font-bold text-[var(--ink)] mt-4" }, "This week's attendance"),
      h(
        "p",
        { className: "mt-2 text-[var(--ink-soft)] text-sm" },
        "The first real piece: a real account, a real database, shared with everyone who visits this page."
      ),

      !user &&
        h(
          "div",
          { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 flex flex-col gap-3" },
          h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Log in or create an account to say you're in for Wednesday."),
          h(
            "div",
            { className: "flex gap-3" },
            h(Button, { onClick: () => GUWH.Identity.login() }, "Log in"),
            h(Button, { variant: "secondary", onClick: () => GUWH.Identity.signup() }, "Sign up")
          )
        ),

      user &&
        h(
          "div",
          { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 flex flex-col gap-4" },
          h(
            "div",
            { className: "flex items-center justify-between" },
            h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Signed in as ", h("span", { className: "font-semibold text-[var(--ink)]" }, user.email)),
            h(Button, { variant: "ghost", size: "sm", onClick: () => GUWH.Identity.logout() }, "Log out")
          ),

          error && h("p", { className: "text-sm text-[var(--bad)]" }, error),

          status &&
            h(
              React.Fragment,
              null,
              h("p", { className: "font-display text-xl font-bold text-[var(--ink)]" }, GUWH.formatDate(new Date(status.sessionDate + "T00:00:00"))),
              h(
                "div",
                { className: "flex items-center gap-4" },
                h(
                  Button,
                  {
                    size: "lg",
                    variant: status.inSession ? "dark" : "primary",
                    className: status.inSession ? "!bg-[var(--good)] hover:!bg-[var(--good-dark)]" : "",
                    disabled: loading,
                    onClick: toggle,
                  },
                  h(Icon, { name: status.inSession ? "check" : "plus", size: 18 }),
                  status.inSession ? "I'm in" : "I'm in?"
                ),
                h("p", { className: "text-sm text-[var(--ink-soft)]" }, h("span", { className: "font-display font-bold text-[var(--ink)]" }, status.confirmedCount), " real players in so far")
              )
            ),

          loading && !status && h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
        )
    );
  }

  GUWH.Pages.LiveAttendance = LiveAttendancePage;
})();
