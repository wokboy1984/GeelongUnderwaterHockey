// ---------------------------------------------------------------------------
// GUWH concept — My Profile (editable demo profile)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;

  const EMOJI_CHOICES = ["🏊", "🤿", "🐬", "🦈", "🐢", "🐙", "🌊", "🥽"];

  const REAL_POSITIONS = ["Forward", "Back", "Wing", "Goalie", "Centre", "Unknown"];
  const REAL_GRADES = ["A", "B", "Casual", "Junior"];

  // Real Profile (live site) — a member's own details. Games played is
  // read-only (counted from real attendance history, never typed in);
  // grade can be self-set here but a Game Coordinator/Administrator may
  // override it later from the Attendance tab after seeing someone play.
  function RealProfilePage() {
    const [member, setMember] = React.useState(null);
    const [form, setForm] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [savedFlash, setSavedFlash] = React.useState(false);

    function load() {
      setLoading(true);
      return GUWH.Identity.authFetch("/api/profile")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setMember(d.member);
            setForm({
              dateOfBirth: d.member.dateOfBirth || "",
              emergencyName: d.member.emergencyName || "",
              emergencyPhone: d.member.emergencyPhone || "",
              position: d.member.position || "Unknown",
              grade: d.member.grade || "",
            });
          } else setError(d.error || "Something went wrong");
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { load(); }, []);

    function set(key, value) {
      setForm((f) => Object.assign({}, f, { [key]: value }));
    }

    async function save(ev) {
      ev.preventDefault();
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/profile", { method: "POST", body: JSON.stringify(form) });
        const d = await res.json();
        if (d.ok) {
          setMember(d.member);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2200);
        } else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    if (loading) return h(Container, { className: "py-10 sm:py-14 max-w-2xl" }, h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"));
    if (!member) return h(Container, { className: "py-10 sm:py-14 max-w-2xl" }, error && h("p", { className: "text-sm text-[var(--bad)]" }, error));

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-2xl" },
      h(SectionHeading, { eyebrow: "My profile", title: member.firstName + " " + member.lastName }),

      h(
        "form",
        { onSubmit: save, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },

        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "First name" }, h("input", { className: inputCls, value: member.firstName, disabled: true })),
          h(FormField, { label: "Last name" }, h("input", { className: inputCls, value: member.lastName, disabled: true }))
        ),
        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Email" }, h("input", { className: inputCls, value: member.email, disabled: true })),
          h(FormField, { label: "Games played" }, h("input", { className: inputCls, value: member.gamesPlayed, disabled: true }))
        ),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Date of birth" }, h("input", { type: "date", className: inputCls, value: form.dateOfBirth, onChange: (e) => set("dateOfBirth", e.target.value) })),
          h(
            FormField,
            { label: "Grade" },
            h(
              "select",
              { className: inputCls, value: form.grade, onChange: (e) => set("grade", e.target.value) },
              h("option", { value: "" }, "Not set"),
              REAL_GRADES.map((g) => h("option", { key: g, value: g }, g))
            )
          )
        ),
        h(
          "p",
          { className: "text-xs text-[var(--ink-soft)] -mt-3" },
          "Pick your own grade to start — a Game Coordinator or Administrator may adjust it once they've seen you play."
        ),

        h(
          FormField,
          { label: "Preferred position" },
          h(
            "select",
            { className: inputCls, value: form.position, onChange: (e) => set("position", e.target.value) },
            REAL_POSITIONS.map((p) => h("option", { key: p, value: p }, p))
          )
        ),

        h("hr", { className: "border-black/5" }),
        h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "Private — never shown on This Week's Game"),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Emergency contact name" }, h("input", { className: inputCls, value: form.emergencyName, onChange: (e) => set("emergencyName", e.target.value) })),
          h(FormField, { label: "Emergency contact phone" }, h("input", { type: "tel", className: inputCls, value: form.emergencyPhone, onChange: (e) => set("emergencyPhone", e.target.value) }))
        ),

        h(
          "div",
          { className: "flex items-center gap-3" },
          h(Button, { type: "submit" }, "Save profile"),
          savedFlash && h("span", { className: "text-sm text-[var(--good-dark)] flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "Saved")
        )
      )
    );
  }

  // Concept-preview Profile (artifact-entry.html only) — unchanged demo data.
  function DemoProfilePage() {
    const player = GUWH.Store.currentPlayer();
    const saved = GUWH.Store.profileFor(player.id);
    const [form, setForm] = React.useState(
      Object.assign(
        { photoEmoji: playerPhotoEmoji(player.id), age: player.age, grade: player.grade, position: player.position, finSize: player.finSize, handed: player.handed, emergencyName: "", emergencyPhone: "", phone: "", email: "" },
        saved
      )
    );
    const [savedFlash, setSavedFlash] = React.useState(false);

    function set(key, value) {
      setForm((f) => Object.assign({}, f, { [key]: value }));
    }

    function save(ev) {
      ev.preventDefault();
      GUWH.Store.updateProfile(player.id, form);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-2xl" },
      h(SectionHeading, { eyebrow: "My profile", title: player.firstName + " " + player.lastName }),

      h(
        "form",
        { onSubmit: save, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },

        h(
          FormField,
          { label: "Profile photo" },
          h(
            "div",
            { className: "flex flex-wrap gap-2" },
            EMOJI_CHOICES.map((e) =>
              h(
                "button",
                { type: "button", key: e, onClick: () => set("photoEmoji", e), className: cx("h-11 w-11 rounded-full flex items-center justify-center text-xl border-2 transition", form.photoEmoji === e ? "border-[var(--accent)] bg-[var(--accent-10)]" : "border-black/10") },
                e
              )
            )
          )
        ),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "First name" }, h("input", { className: inputCls, value: player.firstName, disabled: true })),
          h(FormField, { label: "Last name" }, h("input", { className: inputCls, value: player.lastName, disabled: true }))
        ),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Age" }, h("input", { type: "number", className: inputCls, value: form.age, onChange: (e) => set("age", e.target.value) })),
          h(
            FormField,
            { label: "Grade" },
            h("select", { className: inputCls, value: form.grade, onChange: (e) => set("grade", e.target.value) }, GUWH.GRADES.map((g) => h("option", { key: g }, g)))
          )
        ),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(
            FormField,
            { label: "Preferred position" },
            h("select", { className: inputCls, value: form.position, onChange: (e) => set("position", e.target.value) }, GUWH.POSITIONS.map((p) => h("option", { key: p }, p)))
          ),
          h(FormField, { label: "Fin size" }, h("input", { className: inputCls, value: form.finSize, onChange: (e) => set("finSize", e.target.value) }))
        ),

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

        h("hr", { className: "border-black/5" }),
        h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, "Private — never shown on This Week's Game"),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Emergency contact name" }, h("input", { className: inputCls, value: form.emergencyName, onChange: (e) => set("emergencyName", e.target.value) })),
          h(FormField, { label: "Emergency contact phone" }, h("input", { type: "tel", className: inputCls, value: form.emergencyPhone, onChange: (e) => set("emergencyPhone", e.target.value) }))
        ),
        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "Phone" }, h("input", { type: "tel", className: inputCls, value: form.phone, onChange: (e) => set("phone", e.target.value) })),
          h(FormField, { label: "Email" }, h("input", { type: "email", className: inputCls, value: form.email, onChange: (e) => set("email", e.target.value) }))
        ),

        h(
          "div",
          { className: "flex items-center gap-3" },
          h(Button, { type: "submit" }, "Save profile"),
          savedFlash && h("span", { className: "text-sm text-[var(--good-dark)] flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "Saved")
        )
      )
    );
  }

  function ProfilePage() {
    return GUWH.Identity ? h(RealProfilePage) : h(DemoProfilePage);
  }

  GUWH.Pages.Profile = ProfilePage;
})();
