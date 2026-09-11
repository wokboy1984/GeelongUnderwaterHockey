// ---------------------------------------------------------------------------
// GUWH concept — Member Portal login (demo accounts only)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon } = GUWH.UI;
  const { navigate } = GUWH.Router;

  function DemoAccountCard({ role, name, sub, onClick }) {
    return h(
      "button",
      { onClick, className: "w-full text-left rounded-2xl border-2 border-black/10 hover:border-[var(--accent)] p-5 transition flex items-center gap-4" },
      h(
        "div",
        { className: "h-12 w-12 rounded-full bg-[var(--accent-12)] text-[var(--accent-dark)] flex items-center justify-center text-xl shrink-0" },
        role === "player" ? "🏊" : role === "organiser" ? "🧑‍💼" : "📋"
      ),
      h(
        "div",
        { className: "flex-1" },
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, name),
        h("p", { className: "text-sm text-[var(--ink-soft)]" }, sub)
      ),
      h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)]" })
    );
  }

  // Real member login (live site — index.html loads js/identity.js).
  function RealLoginPage() {
    return h(
      Container,
      { className: "py-16 sm:py-24 max-w-md" },
      h(Pill, { tone: "accent" }, "Member portal"),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, "Welcome back."),
      h("p", { className: "mt-2 text-[var(--ink-soft)]" }, "Log in or create an account to book in for Wednesday."),
      h(
        "div",
        { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 flex gap-3" },
        h(Button, { onClick: () => GUWH.Identity.login() }, "Log in"),
        h(Button, { variant: "secondary", onClick: () => GUWH.Identity.signup() }, "Sign up")
      )
    );
  }

  // Concept-preview login (artifact-entry.html only — no Identity loaded there).
  function DemoLoginPage() {
    function loginAs(role) {
      GUWH.Store.login(role);
      navigate(role === "organiser" ? "/organiser/attendance" : "/portal/dashboard");
    }

    function viewGameBoard() {
      const { auth } = GUWH.Store.getState();
      if (!auth.loggedIn) GUWH.Store.login("player");
      navigate("/portal/board");
    }

    return h(
      Container,
      { className: "py-16 sm:py-24 max-w-md" },
      h(Pill, { tone: "accent" }, "Member portal"),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, "Welcome back."),
      h("p", { className: "mt-2 text-[var(--ink-soft)]" }, "This is a concept — pick a demo account to see how it works. A real build would sit proper login here."),
      h(
        "div",
        { className: "mt-8 flex flex-col gap-3" },
        h(DemoAccountCard, { role: "player", name: "Player dashboard", sub: "Alex Chen's view — booking, profile & bring a mate", onClick: () => loginAs("player") }),
        h(DemoAccountCard, { role: "organiser", name: "Organiser tools", sub: "Stu McCallum's view — attendance, team builder & publish", onClick: () => loginAs("organiser") }),
        h(DemoAccountCard, { role: "board", name: "This week's game", sub: "The schedule and teams every member sees", onClick: viewGameBoard })
      )
    );
  }

  function LoginPage() {
    return GUWH.Identity ? h(RealLoginPage) : h(DemoLoginPage);
  }

  GUWH.Pages.PortalLogin = LoginPage;
})();
