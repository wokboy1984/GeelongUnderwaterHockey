// ---------------------------------------------------------------------------
// Victorian State Titles interest registration (live site, real backend).
// A member says whether they're keen to represent Geelong and picks the
// grade they'd play; Game Coordinators/Administrators see the resulting
// roster below (same audience as team selection generally). Backed by
// /api/state-titles.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, FormField, inputCls } = GUWH.UI;

  function StateTitlesPage() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [grade, setGrade] = React.useState("");
    const [saving, setSaving] = React.useState(false);

    function load() {
      return GUWH.Identity.authFetch("/api/state-titles")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setData(d);
            setGrade((d.registration && d.registration.grade) || (d.grades && d.grades[0]) || "");
          } else setError(d.error || "Something went wrong");
        })
        .catch((e) => setError(String(e)));
    }

    React.useEffect(() => { load().finally(() => setLoading(false)); }, []);

    async function register(ev) {
      ev.preventDefault();
      setError(null);
      if (!grade) return setError("Select a grade first.");
      setSaving(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/state-titles", {
          method: "POST",
          body: JSON.stringify({ action: "register", grade }),
        });
        const d = await res.json();
        if (d.ok) setData(d);
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    }

    async function withdraw() {
      setError(null);
      setSaving(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/state-titles", {
          method: "POST",
          body: JSON.stringify({ action: "withdraw" }),
        });
        const d = await res.json();
        if (d.ok) setData(d);
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    }

    if (loading) return h(Container, { className: "py-16 text-center text-[var(--ink-soft)]" }, "Loading…");
    if (!data) return h(Container, { className: "py-16 text-center text-[var(--bad)]" }, error || "Something went wrong");

    const { event, grades, myName, registration, canViewRoster, roster } = data;

    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-2xl" },
      h(Pill, { tone: "accent" }, event.dateLabel + " — " + event.venue),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, event.label),
      h("p", { className: "mt-2 text-[var(--ink-soft)] leading-relaxed" }, event.blurb),

      error && h("p", { className: "text-sm text-[var(--bad)] mt-4" }, error),

      h("img", {
        src: "images/state-titles-masthead.jpg",
        alt: "Geelong — we need you",
        className: "mt-8 w-full h-auto rounded-2xl",
      }),

      registration
        ? h(
            "div",
            { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8" },
            h(Pill, { tone: "good" }, "You're in"),
            h(
              "p",
              { className: "mt-3 text-sm text-[var(--ink)]" },
              "Registered as ",
              h("span", { className: "font-semibold" }, myName),
              " to play ",
              h("span", { className: "font-semibold" }, registration.grade),
              "."
            ),
            h(
              "form",
              { onSubmit: register, className: "mt-5 flex flex-wrap items-end gap-3" },
              h(
                FormField,
                { label: "Change grade", className: "!mb-0" },
                h(
                  "select",
                  { className: inputCls, value: grade, onChange: (e) => setGrade(e.target.value) },
                  grades.map((g) => h("option", { key: g, value: g }, g))
                )
              ),
              h(Button, { type: "submit", disabled: saving }, saving ? "Saving…" : "Update"),
              h(Button, { type: "button", variant: "secondary", disabled: saving, onClick: withdraw }, "Withdraw")
            )
          )
        : h(
            "form",
            { onSubmit: register, className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },
            h("h2", { className: "font-display text-lg font-bold text-[var(--ink)]" }, "Are you keen to represent Geelong?"),
            h(FormField, { label: "Name" }, h("input", { className: inputCls, value: myName, disabled: true })),
            h(
              FormField,
              { label: "Grade", required: true },
              h(
                "select",
                { className: inputCls, value: grade, onChange: (e) => setGrade(e.target.value) },
                h("option", { value: "" }, "Select a grade…"),
                grades.map((g) => h("option", { key: g, value: g }, g))
              )
            ),
            h(Button, { type: "submit", size: "lg", disabled: saving }, saving ? "Saving…" : "Yes, I'm in")
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
                      ["Player", "Grade"].map((c) => h("th", { key: c, className: "px-4 py-3 font-semibold" }, c))
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
                        h("td", { className: "px-4 py-3 text-[var(--ink-soft)]" }, p.grade)
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
