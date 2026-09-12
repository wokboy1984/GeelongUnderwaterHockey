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

  // Fetches a member's photo through the authenticated endpoint (a plain
  // <img src> can't carry the login token) and shows it as a circle, or a
  // generic placeholder if there isn't one yet.
  function MemberPhoto({ memberId, version, size }) {
    const [url, setUrl] = React.useState(null);
    const dim = size || 88;

    React.useEffect(() => {
      let objectUrl = null;
      let cancelled = false;
      setUrl(null);
      if (!memberId || !version) return undefined;
      GUWH.Identity.authFetch("/api/profile-photo?memberId=" + encodeURIComponent(memberId) + "&v=" + version)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [memberId, version]);

    if (url) {
      return h("img", { src: url, className: "rounded-full object-cover", style: { width: dim, height: dim } });
    }
    return h(
      "div",
      { className: "rounded-full bg-[var(--sand)] flex items-center justify-center text-[var(--ink-soft)]", style: { width: dim, height: dim } },
      h(Icon, { name: "users", size: Math.round(dim / 2.5) })
    );
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function PhotoUploader({ member, onChange }) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const inputRef = React.useRef(null);

    async function onPick(ev) {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        const dataUrl = await fileToDataUrl(file);
        const res = await GUWH.Identity.authFetch("/api/profile-photo", { method: "POST", body: JSON.stringify({ dataUrl }) });
        const d = await res.json();
        if (d.ok) onChange(d.photoVersion);
        else setError(d.error || "Couldn't upload that photo");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    async function onRemove() {
      setError(null);
      setBusy(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/profile-photo", { method: "DELETE" });
        const d = await res.json();
        if (d.ok) onChange(d.photoVersion);
        else setError(d.error || "Couldn't remove photo");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "flex items-center gap-4" },
      h(MemberPhoto, { memberId: member.id, version: member.photoVersion, size: 72 }),
      h(
        "div",
        { className: "flex flex-col gap-2" },
        h(
          "div",
          { className: "flex items-center gap-2" },
          h(Button, { type: "button", variant: "secondary", size: "sm", disabled: busy, onClick: () => inputRef.current && inputRef.current.click() }, member.photoVersion ? "Change photo" : "Add photo"),
          member.photoVersion > 0 && h(Button, { type: "button", variant: "ghost", size: "sm", disabled: busy, onClick: onRemove }, "Remove")
        ),
        h("input", { ref: inputRef, type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: onPick }),
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, "JPEG, PNG or WEBP, 2MB max. Visible to other logged-in members only."),
        error && h("p", { className: "text-xs text-[var(--bad)]" }, error)
      )
    );
  }

  // Separate from the main Save button since changing a login email is a
  // more sensitive action with its own confirmation step (Netlify emails
  // the new address a confirmation link — the change isn't live until
  // that's clicked).
  function EmailUpdateCard({ currentEmail }) {
    const [newEmail, setNewEmail] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState(null);
    const [error, setError] = React.useState(null);

    async function submit(ev) {
      ev.preventDefault();
      if (!newEmail.trim() || newEmail.trim() === currentEmail) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await GUWH.Identity.updateEmail(newEmail.trim());
        setMessage("Check " + newEmail.trim() + " for a confirmation link — the change isn't live until you click it.");
        setNewEmail("");
      } catch (e) {
        setError((e && e.message) || String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Login email"),
      h("p", { className: "text-sm text-[var(--ink)]" }, currentEmail),
      h(
        "form",
        { onSubmit: submit, className: "flex flex-wrap gap-2 items-end" },
        h(FormField, { label: "Update email address" }, h("input", { type: "email", className: inputCls, value: newEmail, onChange: (e) => setNewEmail(e.target.value), placeholder: "new@email.com" })),
        h(Button, { type: "submit", size: "sm", disabled: busy || !newEmail.trim() }, "Send confirmation")
      ),
      message && h("p", { className: "text-xs text-[var(--good-dark)]" }, message),
      error && h("p", { className: "text-xs text-[var(--bad)]" }, error)
    );
  }

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
              phone: d.member.phone || "",
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
        "div",
        { className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 mb-6" },
        h(PhotoUploader, { member, onChange: (photoVersion) => setMember((m) => Object.assign({}, m, { photoVersion })) })
      ),

      h(EmailUpdateCard, { currentEmail: member.email }),

      h(
        "form",
        { onSubmit: save, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 mt-6 flex flex-col gap-5" },

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
          h(FormField, { label: "Phone" }, h("input", { type: "tel", className: inputCls, value: form.phone, onChange: (e) => set("phone", e.target.value) })),
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
