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
  // Sign up (12 Oct 2026): the site's own form instead of Netlify's pop-up,
  // because new accounts now need the club join code. The code is checked
  // by netlify/functions/identity-validate.mts against CLUB_JOIN_CODE
  // before the account is created. Log in still uses Netlify's pop-up.
  function SignupForm({ onCancel }) {
    const { FormField, inputCls } = GUWH.UI;
    const [form, setForm] = React.useState({ name: "", email: "", password: "", code: "" });
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [done, setDone] = React.useState(null);
    const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));

    async function submit(ev) {
      ev.preventDefault();
      setError(null);
      if (!form.name.trim() || !form.email.trim() || !form.password || !form.code.trim()) {
        setError("Please fill in every field.");
        return;
      }
      if (form.password.length < 8) {
        setError("Use a password of at least 8 characters.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/.netlify/identity/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            data: { full_name: form.name.trim(), join_code: form.code.trim() },
          }),
        });
        if (res.ok) {
          setDone(form.email.trim());
          return;
        }
        const body = await res.json().catch(() => ({}));
        const msg = String(body.msg || body.error_description || body.error || "");
        if (/already/i.test(msg)) setError("There's already an account with that email. Use Log in instead (or reset your password there).");
        else if (/password/i.test(msg)) setError(msg);
        else setError("That club code isn't right. Ask at the pool or in the club group chat for the current code.");
      } catch (e) {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    }

    if (done) {
      return h(
        "div",
        { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6" },
        h("p", { className: "font-display text-lg font-bold text-[var(--ink)]" }, "Check your email"),
        h("p", { className: "mt-2 text-sm text-[var(--ink-soft)]" }, "We've sent a confirmation link to " + done + ". Click it to finish setting up your account, then log in. Check your spam folder if it hasn't arrived in a few minutes.")
      );
    }

    return h(
      "form",
      { onSubmit: submit, noValidate: true, className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 flex flex-col gap-4" },
      h("p", { className: "font-display text-lg font-bold text-[var(--ink)]" }, "Create your account"),
      h(FormField, { label: "Full name" }, h("input", { className: inputCls, autoComplete: "name", value: form.name, onChange: (e) => set("name", e.target.value) })),
      h(FormField, { label: "Email" }, h("input", { type: "email", className: inputCls, autoComplete: "email", value: form.email, onChange: (e) => set("email", e.target.value) })),
      h(FormField, { label: "Password", hint: "At least 8 characters." }, h("input", { type: "password", className: inputCls, autoComplete: "new-password", value: form.password, onChange: (e) => set("password", e.target.value) })),
      h(FormField, { label: "Club code", hint: "Members only - get it at the pool or in the club group chat." }, h("input", { className: inputCls, autoComplete: "off", value: form.code, onChange: (e) => set("code", e.target.value) })),
      error && h("p", { className: "text-sm text-[var(--bad)]", role: "alert" }, error),
      h(
        "div",
        { className: "flex flex-wrap items-center gap-3" },
        h(Button, { type: "submit", disabled: busy }, busy ? "Creating…" : "Create account"),
        h("button", { type: "button", className: "text-sm text-[var(--ink-soft)] underline", onClick: onCancel }, "Back")
      ),
      h(
        "p",
        { className: "text-xs text-[var(--ink-soft)]" },
        "New to underwater hockey? You don't need an account to try it - ",
        h("button", { type: "button", className: "underline text-[var(--accent-dark)] font-semibold", onClick: () => navigate("/new-player") }, "book a free session"),
        " instead."
      )
    );
  }

  function RealLoginPage() {
    const [signingUp, setSigningUp] = React.useState(false);
    return h(
      Container,
      { className: "py-16 sm:py-24 max-w-md" },
      h(Pill, { tone: "accent" }, "Member portal"),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, signingUp ? "Join the club." : "Welcome back."),
      h("p", { className: "mt-2 text-[var(--ink-soft)]" }, signingUp ? "Members set up an account once, then book in each Wednesday." : "Log in or create an account to book in for Wednesday."),
      !signingUp && GUWH.confirmFailed && h("p", { className: "mt-4 rounded-xl bg-[var(--warn-10)] p-3 text-sm text-[var(--ink)]" }, "That confirmation link has already been used or has expired. If you've already confirmed, just log in below."),
      signingUp
        ? h(SignupForm, { onCancel: () => setSigningUp(false) })
        : h(
            "div",
            { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 flex gap-3" },
            h(Button, { onClick: () => GUWH.Identity.login() }, "Log in"),
            h(Button, { variant: "secondary", onClick: () => setSigningUp(true) }, "Sign up")
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
