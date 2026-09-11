// ---------------------------------------------------------------------------
// GUWH concept — "Try Underwater Hockey" (new player) page + booking form
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, Icon, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const WHAT_WE_PROVIDE = ["Fins (adult & junior sizes)", "Mask & snorkel", "Glove for your stick hand", "A stick and a puck", "Someone to show you the ropes"];
  const WHAT_TO_BRING = ["Swimmers", "A towel", "Water bottle", "A mouthguard if you have one (not essential)"];

  const HEARD_OPTIONS = ["Word of mouth / a friend", "Facebook", "Google search", "Geelong community directory", "Saw us at the pool", "Other"];

  function emptyForm() {
    return {
      firstName: "", lastName: "", age: "", finSize: "", handed: "Right",
      emergencyName: "", emergencyPhone: "", heardAbout: HEARD_OPTIONS[0],
      phone: "", email: "", sessionDate: "", guardianConsent: false, disclaimer: false,
    };
  }

  function NewPlayerPage() {
    const [form, setForm] = React.useState(emptyForm());
    const [errors, setErrors] = React.useState({});
    const [submitted, setSubmitted] = React.useState(null);
    const wed = GUWH.nextWednesday();

    React.useEffect(() => {
      setForm((f) => (f.sessionDate ? f : Object.assign({}, f, { sessionDate: toLocalDateInputValue(wed) })));
    }, []);

    const isJunior = Number(form.age) > 0 && Number(form.age) < 18;

    function set(key, value) {
      setForm((f) => Object.assign({}, f, { [key]: value }));
      setErrors((e) => Object.assign({}, e, { [key]: undefined }));
    }

    function validate() {
      const e = {};
      if (!form.firstName.trim()) e.firstName = "Enter a first name.";
      if (!form.lastName.trim()) e.lastName = "Enter a last name.";
      if (!form.age || Number(form.age) < 5 || Number(form.age) > 99) e.age = "Enter a realistic age.";
      if (!form.finSize.trim()) e.finSize = "Let us know a fin/shoe size so we can pull the right size.";
      if (!form.emergencyName.trim()) e.emergencyName = "We need someone to call if needed.";
      if (!form.emergencyPhone.trim()) e.emergencyPhone = "Enter a phone number for that contact.";
      if (!form.email.trim() && !form.phone.trim()) e.email = "Leave an email or a phone number.";
      if (!form.sessionDate) e.sessionDate = "Pick the Wednesday you're planning to come.";
      if (isJunior && !form.guardianConsent) e.guardianConsent = "A parent or guardian needs to acknowledge this for under-18s.";
      if (!form.disclaimer) e.disclaimer = "Please acknowledge this to continue.";
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    function handleSubmit(ev) {
      ev.preventDefault();
      if (!validate()) return;
      const rec = GUWH.Store.addGuestBooking({
        firstName: form.firstName, lastName: form.lastName, age: form.age,
        finSize: form.finSize, handed: form.handed, heardAbout: form.heardAbout,
        sessionDate: form.sessionDate,
      });
      setSubmitted(rec);
    }

    if (submitted) {
      const date = new Date(submitted.sessionDate + "T00:00:00");
      return h(
        Container,
        { className: "py-16 sm:py-24 max-w-xl" },
        h(
          "div",
          { className: "rounded-3xl bg-white ring-1 ring-black/5 p-8 sm:p-10 text-center" },
          h("div", { className: "mx-auto h-14 w-14 rounded-full bg-[var(--good-15)] text-[var(--good-dark)] flex items-center justify-center mb-5" }, h(Icon, { name: "check", size: 26 })),
          h("h1", { className: "font-display text-3xl font-bold text-[var(--ink)]" }, "You're booked in, " + form.firstName + "!"),
          h("p", { className: "mt-2 text-[var(--ink-soft)]" }, "The committee will reach out within 24 hours, but here's everything you need in the meantime."),
          h(
            "div",
            { className: "mt-7 grid sm:grid-cols-2 gap-4 text-left" },
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-4" },
              h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "When"),
              h("p", { className: "font-display text-lg font-bold text-[var(--ink)] mt-1" }, GUWH.formatDate(date)),
              h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Arrive by 5:50pm · " + GUWH.club.sessionTime)
            ),
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-4" },
              h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "Where"),
              h("p", { className: "font-display text-lg font-bold text-[var(--ink)] mt-1" }, GUWH.club.venue),
              h("a", { href: GUWH.club.mapUrl, target: "_blank", rel: "noopener", className: "text-sm text-[var(--accent-dark)] font-semibold" }, GUWH.club.venueAddress + " →")
            ),
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-4" },
              h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "We provide"),
              h("ul", { className: "text-sm text-[var(--ink)] mt-1 list-disc pl-4" }, WHAT_WE_PROVIDE.slice(0, 3).map((w) => h("li", { key: w }, w)))
            ),
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-4" },
              h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "Bring"),
              h("ul", { className: "text-sm text-[var(--ink)] mt-1 list-disc pl-4" }, WHAT_TO_BRING.slice(0, 3).map((w) => h("li", { key: w }, w)))
            )
          ),
          h(
            "div",
            { className: "mt-7 flex flex-wrap justify-center gap-3" },
            h(
              Button,
              {
                variant: "secondary",
                onClick: () =>
                  shareOrCopy({
                    title: "Add to calendar",
                    text: GUWH.club.name + " — " + GUWH.formatDate(date) + ", " + GUWH.club.sessionTime + " at " + GUWH.club.venue,
                  }),
              },
              h(Icon, { name: "calendar", size: 16 }), "Add to calendar"
            ),
            h(
              Button,
              {
                onClick: () =>
                  shareOrCopy({
                    title: "Come play underwater hockey",
                    text: "I'm playing underwater hockey in Geelong this Wednesday. Your first three sessions are free and they'll supply the gear. Come give it a crack.",
                    url: window.location.origin + window.location.pathname + "#/new-player",
                  }),
              },
              h(Icon, { name: "share", size: 16 }), "Invite a friend"
            )
          ),
          h("button", { className: "mt-6 text-sm text-[var(--ink-soft)] underline", onClick: () => navigate("/") }, "Back to home")
        )
      );
    }

    return h(
      Container,
      { className: "py-12 sm:py-16" },
      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr] gap-12" },

        // ---- info column ----
        h(
          "div",
          null,
          h(Pill, { tone: "accent" }, "First three sessions free"),
          h("h1", { className: "font-display text-4xl sm:text-5xl font-bold text-[var(--ink)] mt-4 text-balance" }, "Come give it a crack."),
          h("p", { className: "mt-3 text-[var(--ink-soft)] text-lg leading-relaxed" }, "Underwater hockey is exactly what it sounds like: two teams, a lead puck, and everyone swimming along the pool floor trying to flick it into a goal. No experience required — most people learn the basics in their first ten minutes."),

          h(
            "div",
            { className: "mt-6 rounded-2xl overflow-hidden ring-1 ring-black/5 h-32 sm:h-40" },
            h("img", { src: "images/puck-battle-wide.jpg", alt: "Two players contesting the puck along the pool floor", loading: "lazy", className: "w-full h-full object-cover" })
          ),

          h(
            "div",
            { className: "mt-8 grid sm:grid-cols-2 gap-4" },
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-5" },
              h("h3", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, h(Icon, { name: "check", size: 18, className: "text-[var(--accent-dark)]" }), "We provide"),
              h("ul", { className: "mt-2 flex flex-col gap-1.5 text-sm text-[var(--ink-soft)]" }, WHAT_WE_PROVIDE.map((w) => h("li", { key: w }, "· " + w)))
            ),
            h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] p-5" },
              h("h3", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, h(Icon, { name: "users", size: 18, className: "text-[var(--accent-dark)]" }), "You bring"),
              h("ul", { className: "mt-2 flex flex-col gap-1.5 text-sm text-[var(--ink-soft)]" }, WHAT_TO_BRING.map((w) => h("li", { key: w }, "· " + w)))
            )
          ),

          h(
            "div",
            { className: "mt-6 rounded-2xl border-2 border-black/5 p-5" },
            h("h3", { className: "font-display font-bold text-[var(--ink)]" }, "What happens on the night"),
            h(
              "p",
              { className: "mt-1.5 text-sm text-[var(--ink-soft)] leading-relaxed" },
              "Arrive by 5:50pm at " + GUWH.club.venue + ". A club member will meet you, sort your gear, and run through the basics before you join the normal Wednesday session — same pool, same people, no separate beginner class."
            )
          ),

          h(
            "div",
            { className: "mt-6 flex flex-wrap gap-4 text-sm text-[var(--ink-soft)]" },
            h("span", { className: "flex items-center gap-1.5" }, h(Icon, { name: "shield", size: 16 }), "AUF membership covers insurance"),
            h("span", { className: "flex items-center gap-1.5" }, h(Icon, { name: "heart", size: 16 }), "All ages & capacities welcome")
          )
        ),

        // ---- form column ----
        h(
          "form",
          { onSubmit: handleSubmit, noValidate: true, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5 h-fit" },
          h("h2", { className: "font-display text-2xl font-bold text-[var(--ink)]" }, "Book your first session"),

          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-4" },
            h(FormField, { label: "First name", required: true }, h("input", { className: inputCls, value: form.firstName, onChange: (e) => set("firstName", e.target.value) })),
            h(FormField, { label: "Last name", required: true }, h("input", { className: inputCls, value: form.lastName, onChange: (e) => set("lastName", e.target.value) }))
          ),
          errors.firstName && h(FieldError, { text: errors.firstName }),
          errors.lastName && h(FieldError, { text: errors.lastName }),

          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-4" },
            h(FormField, { label: "Age", required: true }, h("input", { type: "number", min: 5, max: 99, className: inputCls, value: form.age, onChange: (e) => set("age", e.target.value) })),
            h(FormField, { label: "Fin / shoe size", required: true, hint: "So we grab the right size from the loan kit" }, h("input", { className: inputCls, value: form.finSize, onChange: (e) => set("finSize", e.target.value) }))
          ),
          errors.age && h(FieldError, { text: errors.age }),
          errors.finSize && h(FieldError, { text: errors.finSize }),

          h(
            FormField,
            { label: "Which hand do you write with?" },
            h(
              "div",
              { className: "flex gap-2" },
              ["Left", "Right"].map((opt) =>
                h(
                  "button",
                  { type: "button", key: opt, onClick: () => set("handed", opt), className: cx("flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition", form.handed === opt ? "border-[var(--accent)] bg-[var(--accent-10)] text-[var(--accent-dark)]" : "border-black/10 text-[var(--ink-soft)]") },
                  opt
                )
              )
            )
          ),

          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-4" },
            h(FormField, { label: "Emergency contact name", required: true }, h("input", { className: inputCls, value: form.emergencyName, onChange: (e) => set("emergencyName", e.target.value) })),
            h(FormField, { label: "Emergency contact phone", required: true }, h("input", { type: "tel", className: inputCls, value: form.emergencyPhone, onChange: (e) => set("emergencyPhone", e.target.value) }))
          ),
          errors.emergencyName && h(FieldError, { text: errors.emergencyName }),
          errors.emergencyPhone && h(FieldError, { text: errors.emergencyPhone }),

          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-4" },
            h(FormField, { label: "Phone (optional)" }, h("input", { type: "tel", className: inputCls, value: form.phone, onChange: (e) => set("phone", e.target.value) })),
            h(FormField, { label: "Email", required: true }, h("input", { type: "email", className: inputCls, value: form.email, onChange: (e) => set("email", e.target.value) }))
          ),
          errors.email && h(FieldError, { text: errors.email }),

          h(
            "div",
            { className: "grid sm:grid-cols-2 gap-4" },
            h(FormField, { label: "Which Wednesday?", required: true }, h("input", { type: "date", className: inputCls, value: form.sessionDate, onChange: (e) => set("sessionDate", e.target.value) })),
            h(
              FormField,
              { label: "How'd you hear about us?" },
              h("select", { className: inputCls, value: form.heardAbout, onChange: (e) => set("heardAbout", e.target.value) }, HEARD_OPTIONS.map((o) => h("option", { key: o, value: o }, o)))
            )
          ),
          errors.sessionDate && h(FieldError, { text: errors.sessionDate }),

          isJunior &&
            h(
              "label",
              { className: "flex items-start gap-3 rounded-xl bg-[var(--warn-10)] p-3.5 text-sm text-[var(--ink)]" },
              h("input", { type: "checkbox", className: "mt-0.5", checked: form.guardianConsent, onChange: (e) => set("guardianConsent", e.target.checked) }),
              h("span", null, "I am this player's parent or guardian and I'm okay with them taking part.")
            ),
          errors.guardianConsent && h(FieldError, { text: errors.guardianConsent }),

          h(
            "label",
            { className: "flex items-start gap-3 text-sm text-[var(--ink-soft)]" },
            h("input", { type: "checkbox", className: "mt-0.5", checked: form.disclaimer, onChange: (e) => set("disclaimer", e.target.checked) }),
            h("span", null, "I understand this is a physical, in-water activity and I'm taking part at my own discretion.")
          ),
          errors.disclaimer && h(FieldError, { text: errors.disclaimer }),

          h(Button, { type: "submit", size: "lg", className: "mt-1" }, "Book my free session")
        )
      )
    );
  }

  function FieldError({ text }) {
    return h("p", { className: "text-xs text-[var(--bad)] -mt-3" }, text);
  }

  GUWH.Pages.NewPlayer = NewPlayerPage;
})();
