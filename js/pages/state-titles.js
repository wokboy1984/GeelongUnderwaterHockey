// ---------------------------------------------------------------------------
// Victorian State Titles interest — a PUBLIC page (main nav, no login
// required). Anyone can register interest in representing Geelong. Being
// logged in is a bonus, not a requirement: it prefills your name/email and
// shows your existing registration; Game Coordinators/Administrators also
// see the full roster. Backed by /api/state-titles, which itself treats
// auth as optional. Works in both the live site (GUWH.Identity present)
// and the concept preview (it isn't) — falls back to a plain fetch either
// way, so this page never assumes Identity exists.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, FormField, inputCls } = GUWH.UI;

  const apiFetch = (url, options) => (GUWH.Identity ? GUWH.Identity.authFetch(url, options) : fetch(url, options));

  const BLANK_FORM = { firstName: "", lastName: "", email: "", phone: "", grade: "", isMember: false, notes: "" };

  function StateTitlesPage() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [form, setForm] = React.useState(BLANK_FORM);
    const [myRegistration, setMyRegistration] = React.useState(null);
    const [saving, setSaving] = React.useState(false);

    function setField(key, value) {
      setForm((prev) => Object.assign({}, prev, { [key]: value }));
    }

    React.useEffect(() => {
      apiFetch("/api/state-titles")
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok) return setError(d.error || "Something went wrong");
          setData(d);
          if (d.registration) {
            setMyRegistration(d.registration);
          } else if (d.prefill) {
            setForm((prev) => Object.assign({}, prev, {
              firstName: d.prefill.firstName || "", lastName: d.prefill.lastName || "",
              email: d.prefill.email || "", isMember: true,
            }));
          }
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, []);

    async function submit(ev) {
      ev.preventDefault();
      setError(null);
      setSaving(true);
      try {
        const res = await apiFetch("/api/state-titles", {
          method: "POST",
          body: JSON.stringify(Object.assign({ action: "register" }, form)),
        });
        const d = await res.json();
        if (!d.ok) {
          setError(d.error || "Something went wrong");
          return;
        }
        setMyRegistration({
          firstName: form.firstName, lastName: form.lastName, email: form.email,
          phone: form.phone, grade: form.grade, isMember: form.isMember, notes: form.notes,
        });
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    }

    async function withdraw() {
      if (!myRegistration) return;
      setError(null);
      setSaving(true);
      try {
        const res = await apiFetch("/api/state-titles", {
          method: "POST",
          body: JSON.stringify({ action: "withdraw", email: myRegistration.email }),
        });
        const d = await res.json();
        if (!d.ok) {
          setError(d.error || "Something went wrong");
          return;
        }
        setMyRegistration(null);
        setForm((prev) => Object.assign({}, BLANK_FORM, {
          firstName: prev.firstName, lastName: prev.lastName, email: prev.email, isMember: prev.isMember,
        }));
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    }

    if (loading) return h(Container, { className: "py-16 text-center text-[var(--ink-soft)]" }, "Loading…");
    if (!data) return h(Container, { className: "py-16 text-center text-[var(--bad)]" }, error || "Something went wrong");

    const { event, grades, canViewRoster, roster } = data;

    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-2xl" },
      h(Pill, { tone: "accent" }, event.dateLabel + " — " + event.venue),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, event.label),
      h("p", { className: "mt-2 text-[var(--ink-soft)] leading-relaxed" }, event.blurb),
      h(
        "p",
        { className: "mt-2 text-sm text-[var(--ink-soft)]" },
        "Are you keen to represent Geelong? Register your interest below — you don't need to be logged in to do this."
      ),

      error && h("p", { className: "text-sm text-[var(--bad)] mt-4" }, error),

      h("img", {
        src: "images/state-titles-masthead.jpg",
        alt: "Geelong — we need you",
        className: "mt-8 w-full h-auto rounded-2xl",
      }),

      myRegistration
        ? h(
            "div",
            { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8" },
            h(Pill, { tone: "good" }, "You're in"),
            h(
              "p",
              { className: "mt-3 text-sm text-[var(--ink)]" },
              "Registered as ",
              h("span", { className: "font-semibold" }, myRegistration.firstName + " " + myRegistration.lastName),
              " to play ",
              h("span", { className: "font-semibold" }, myRegistration.grade),
              "."
            ),
            h("p", { className: "mt-1 text-xs text-[var(--ink-soft)]" }, "We'll be in touch at " + myRegistration.email + " with next steps."),
            h(
              "div",
              { className: "mt-5" },
              h(Button, { type: "button", variant: "secondary", disabled: saving, onClick: withdraw }, saving ? "Saving…" : "Withdraw my interest")
            )
          )
        : h(
            "form",
            { onSubmit: submit, className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },
            h("h2", { className: "font-display text-lg font-bold text-[var(--ink)]" }, "Register your interest"),

            h(
              "div",
              { className: "grid sm:grid-cols-2 gap-4" },
              h(FormField, { label: "First name", required: true }, h("input", { className: inputCls, value: form.firstName, onChange: (e) => setField("firstName", e.target.value) })),
              h(FormField, { label: "Last name", required: true }, h("input", { className: inputCls, value: form.lastName, onChange: (e) => setField("lastName", e.target.value) }))
            ),
            h(
              "div",
              { className: "grid sm:grid-cols-2 gap-4" },
              h(FormField, { label: "Email", required: true }, h("input", { type: "email", className: inputCls, value: form.email, onChange: (e) => setField("email", e.target.value) })),
              h(FormField, { label: "Phone", hint: "Optional, but helps us reach you quickly" }, h("input", { type: "tel", className: inputCls, value: form.phone, onChange: (e) => setField("phone", e.target.value) }))
            ),
            h(
              FormField,
              { label: "Grade", required: true },
              h(
                "select",
                { className: inputCls, value: form.grade, onChange: (e) => setField("grade", e.target.value) },
                h("option", { value: "" }, "Select a grade…"),
                grades.map((g) => h("option", { key: g, value: g }, g))
              )
            ),
            h(
              "label",
              { className: "flex items-start gap-3 text-sm" },
              h("input", { type: "checkbox", className: "mt-0.5", checked: form.isMember, onChange: (e) => setField("isMember", e.target.checked) }),
              h("span", null, "I'm already a member of Geelong Underwater Hockey.")
            ),
            h(
              FormField,
              { label: "Anything else we should know?", hint: "Playing experience, availability, questions — optional" },
              h("textarea", { className: inputCls + " min-h-[90px]", value: form.notes, onChange: (e) => setField("notes", e.target.value) })
            ),

            h(Button, { type: "submit", size: "lg", disabled: saving }, saving ? "Saving…" : "Register interest")
          ),

      canViewRoster &&
        h(
          "div",
          { className: "mt-10" },
          h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Who's registered"),
          !roster || roster.length === 0
            ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No one has registered interest yet.")
            : h(
                "div",
                { className: "rounded-2xl bg-white ring-1 ring-black/5 overflow-x-auto" },
                h(
                  "table",
                  { className: "w-full text-sm" },
                  h(
                    "thead",
                    null,
                    h(
                      "tr",
                      { className: "text-left text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)] border-b border-black/5" },
                      ["Name", "Grade", "Contact", "Member?"].map((c) => h("th", { key: c, className: "px-4 py-3 font-semibold" }, c))
                    )
                  ),
                  h(
                    "tbody",
                    null,
                    roster.map((p) =>
                      h(
                        "tr",
                        { key: p.id, className: "border-b border-black/5 last:border-0" },
                        h("td", { className: "px-4 py-3 text-[var(--ink)]" }, p.firstName + " " + p.lastName),
                        h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.grade),
                        h(
                          "td",
                          { className: "px-4 py-3 text-[var(--ink-soft)]" },
                          h("p", null, p.email),
                          p.phone && h("p", { className: "text-xs" }, p.phone)
                        ),
                        h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.isMember ? "Yes" : "No")
                      )
                    )
                  )
                )
              )
        )
    );
  }

  GUWH.Pages.StateTitles = StateTitlesPage;
})();
