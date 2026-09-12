// ---------------------------------------------------------------------------
// GUWH concept — My Profile (editable demo profile)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls, MemberPhoto } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const EMOJI_CHOICES = ["🏊", "🤿", "🐬", "🦈", "🐢", "🐙", "🌊", "🥽"];

  const REAL_POSITIONS = ["Forward", "Back", "Wing", "Goalie", "Centre", "Unknown"];
  const REAL_GRADES = ["A", "B", "Casual", "Junior"];

  // MemberPhoto now lives in js/ui.js (GUWH.UI.MemberPhoto) so the
  // Dashboard's profile summary card can share it too.

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

  // Members Forum preferences — adult members only. Kept separate from the
  // main profile form/save button since it talks to /api/forum/me, not
  // /api/profile. Mirrors the opt-in flow in js/pages/forum.js's OptInGate,
  // but here for members who are already opted in and just want to adjust
  // privacy settings or leave.
  function ForumPrefsCard() {
    const [me, setMe] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    function load() {
      return GUWH.Identity.authFetch("/api/forum/me").then((r) => r.json()).then((d) => { if (d.ok) setMe(d); });
    }
    React.useEffect(() => { load(); }, []);

    async function updatePrivacy(patch) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/me", { method: "POST", body: JSON.stringify(Object.assign({ action: "update_privacy" }, patch)) });
        const d = await res.json();
        if (d.ok) load();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    async function leaveForum() {
      if (!window.confirm("Leave the Members Forum? Your existing posts stay, but you'll stop seeing forum content and won't be able to post until you opt back in.")) return;
      setBusy(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/me", { method: "POST", body: JSON.stringify({ action: "opt_out" }) });
        const d = await res.json();
        if (d.ok) load();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    if (!me || !me.eligible) return null; // juniors and members without a DOB on file see nothing forum-related here

    const p = me.participation;
    if (!p || !p.optedIn) {
      return h(
        "div",
        { className: "rounded-2xl bg-[var(--sand)] p-4 flex items-center justify-between gap-4 flex-wrap" },
        h(
          "div",
          null,
          h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Members Forum"),
          h("p", { className: "text-sm text-[var(--ink)] mt-1" }, "Not joined yet — club chat, game-day talk and announcements, opt-in only.")
        ),
        h(Button, { type: "button", size: "sm", onClick: () => navigate("/portal/forum") }, "View & join")
      );
    }

    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Members Forum"),
      error && h("p", { className: "text-xs text-[var(--bad)]" }, error),
      h("label", { className: "flex items-center gap-2 text-sm text-[var(--ink)]" }, h("input", { type: "checkbox", checked: p.showPhoto, disabled: busy, onChange: (e) => updatePrivacy({ showPhoto: e.target.checked, showGrade: p.showGrade, showBadges: p.showBadges }) }), "Show my profile photo on my posts"),
      h("label", { className: "flex items-center gap-2 text-sm text-[var(--ink)]" }, h("input", { type: "checkbox", checked: p.showGrade, disabled: busy, onChange: (e) => updatePrivacy({ showPhoto: p.showPhoto, showGrade: e.target.checked, showBadges: p.showBadges }) }), "Show my grade on my posts"),
      h("label", { className: "flex items-center gap-2 text-sm text-[var(--ink)]" }, h("input", { type: "checkbox", checked: p.showBadges, disabled: busy, onChange: (e) => updatePrivacy({ showPhoto: p.showPhoto, showGrade: p.showGrade, showBadges: e.target.checked }) }), "Show contribution badges on my posts"),
      h(
        "div",
        { className: "flex items-center gap-3 mt-1" },
        h(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => navigate("/portal/forum") }, "Open Members Forum"),
        h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: leaveForum }, "Leave the forum")
      )
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
              firstName: d.member.firstName || "",
              lastName: d.member.lastName || "",
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

    // First name, date of birth and an emergency contact are safety- or
    // eligibility-critical (DOB gates the adults-only Members Forum;
    // emergency contact is needed poolside), so the form won't submit
    // without them — checked here for an instant message, and re-checked
    // by /api/profile itself as the real gate.
    function missingRequiredFields() {
      const missing = [];
      if (!form.firstName.trim()) missing.push("First name");
      if (!form.dateOfBirth) missing.push("Date of birth");
      if (!form.emergencyName.trim()) missing.push("Emergency contact name");
      if (!form.emergencyPhone.trim()) missing.push("Emergency contact phone");
      return missing;
    }

    async function save(ev) {
      ev.preventDefault();
      setError(null);
      const missing = missingRequiredFields();
      if (missing.length) {
        setError("Please fill in: " + missing.join(", "));
        return;
      }
      try {
        const res = await GUWH.Identity.authFetch("/api/profile", { method: "POST", body: JSON.stringify(form) });
        const d = await res.json();
        if (d.ok) {
          setMember(d.member);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2200);
          // Date of birth (and therefore adult-forum eligibility) lives on
          // the cached identity used for nav visibility — refresh it so a
          // just-added DOB shows the Members Forum link without a re-login.
          GUWH.Identity.refreshMember();
        } else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    if (loading) return h(Container, { className: "py-10 sm:py-14 max-w-3xl" }, h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"));
    if (!member) return h(Container, { className: "py-10 sm:py-14 max-w-3xl" }, error && h("p", { className: "text-sm text-[var(--bad)]" }, error));

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "My profile", title: member.firstName + " " + member.lastName }),

      h(
        "div",
        { className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 mb-6" },
        h(PhotoUploader, { member, onChange: (photoVersion) => setMember((m) => Object.assign({}, m, { photoVersion })) })
      ),

      h(EmailUpdateCard, { currentEmail: member.email }),

      h("div", { className: "mt-6" }, h(ForumPrefsCard)),

      h(
        "form",
        { onSubmit: save, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 mt-6 flex flex-col gap-5" },

        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),

        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-4" },
          h(FormField, { label: "First name *" }, h("input", { className: inputCls, value: form.firstName, onChange: (e) => set("firstName", e.target.value) })),
          h(FormField, { label: "Last name" }, h("input", { className: inputCls, value: form.lastName, onChange: (e) => set("lastName", e.target.value) }))
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
          h(FormField, { label: "Date of birth *" }, h("input", { type: "date", className: inputCls, value: form.dateOfBirth, onChange: (e) => set("dateOfBirth", e.target.value) })),
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
          h(FormField, { label: "Emergency contact name *" }, h("input", { className: inputCls, value: form.emergencyName, onChange: (e) => set("emergencyName", e.target.value) })),
          h(FormField, { label: "Emergency contact phone *" }, h("input", { type: "tel", className: inputCls, value: form.emergencyPhone, onChange: (e) => set("emergencyPhone", e.target.value) }))
        ),
        h("p", { className: "text-xs text-[var(--ink-soft)] -mt-3" }, "* Required — an emergency contact is needed poolside, and date of birth is what unlocks the adults-only Members Forum."),

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
