// ---------------------------------------------------------------------------
// GUWH concept — Bring a Mate referral flow
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;

  const MESSAGE = "I'm playing underwater hockey in Geelong this Wednesday. Your first three sessions are free and they'll supply the gear. Come give it a crack.";

  // Real invites (live site) — backed by the `invites` table via /api/invites.
  function RealBringAMatePage() {
    const wed = GUWH.nextWednesday();
    const [friendName, setFriendName] = React.useState("");
    const [contact, setContact] = React.useState("");
    const [justSent, setJustSent] = React.useState(false);
    const [invites, setInvites] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const inviteLink = window.location.origin + window.location.pathname + "#/new-player";

    function load() {
      setLoading(true);
      setError(null);
      return GUWH.Identity.authFetch("/api/invites")
        .then((r) => r.json())
        .then((data) => (data.ok ? setInvites(data.invites) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { load(); }, []);

    async function send(ev) {
      ev.preventDefault();
      if (!friendName.trim()) return;
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/invites", {
          method: "POST",
          body: JSON.stringify({ guestName: friendName.trim(), guestEmail: contact.trim() || null }),
        });
        const data = await res.json();
        if (data.ok) {
          setInvites(data.invites);
          setJustSent(true);
          setFriendName("");
          setContact("");
        } else {
          setError(data.error || "Something went wrong");
        }
      } catch (e) {
        setError(String(e));
      }
    }

    async function markRegistered(id) {
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/invites", { method: "PATCH", body: JSON.stringify({ id, status: "registered" }) });
        const data = await res.json();
        if (data.ok) setInvites(data.invites);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      }
    }

    async function shareLink() {
      await shareOrCopy({ title: "Come play underwater hockey", text: MESSAGE, url: inviteLink });
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(SectionHeading, { eyebrow: "Bring a mate", title: "Grow the game, one Wednesday at a time.", sub: "Their first three sessions are free too — same as yours were." }),

      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr] gap-8" },

        h(
          "form",
          { onSubmit: send, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 flex flex-col gap-4 h-fit" },
          h("h3", { className: "font-display font-bold text-[var(--ink)]" }, "Invite someone for " + GUWH.formatDate(wed)),
          h(FormField, { label: "Their name" }, h("input", { className: inputCls, value: friendName, onChange: (e) => setFriendName(e.target.value) })),
          h(FormField, { label: "Phone or email (optional)" }, h("input", { className: inputCls, value: contact, onChange: (e) => setContact(e.target.value) })),
          h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Send invite"),
          justSent && h("p", { className: "text-sm text-[var(--good-dark)] flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "Invite logged — nudge them to book on Try Underwater Hockey.")
        ),

        h(
          "div",
          { className: "rounded-3xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4" },
          h("h3", { className: "font-display font-bold" }, "Or just share the link"),
          h("p", { className: "text-sm text-white/70 leading-relaxed" }, "“" + MESSAGE + "”"),
          h(Button, { variant: "dark", className: "!bg-white/15 hover:!bg-white/25", onClick: shareLink }, h(Icon, { name: "share", size: 16 }), "Share invitation")
        )
      ),

      h(
        "div",
        { className: "mt-10" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Invites you've sent"),
        loading
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
          : invites.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No invites yet — send your first one above.")
          : h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] divide-y divide-black/5" },
              invites.map((inv) =>
                h(
                  "div",
                  { key: inv.id, className: "flex items-center justify-between px-5 py-3" },
                  h(
                    "div",
                    null,
                    h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, inv.guestName),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, new Date(inv.createdAt).toLocaleDateString("en-AU"))
                  ),
                  h(
                    "div",
                    { className: "flex items-center gap-3" },
                    h(Pill, { tone: inv.status === "registered" ? "good" : "accent" }, inv.status === "registered" ? "Registered" : "Invited"),
                    inv.status !== "registered" &&
                      h(Button, { size: "sm", variant: "ghost", onClick: () => markRegistered(inv.id) }, "Mark as registered")
                  )
                )
              )
            )
      )
    );
  }

  // Concept-preview invites (artifact-entry.html only) — unchanged demo data.
  function DemoBringAMatePage() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);

    const wed = GUWH.nextWednesday();
    const [friendName, setFriendName] = React.useState("");
    const [contact, setContact] = React.useState("");
    const [justSent, setJustSent] = React.useState(null);
    const invites = GUWH.Store.getState().invites;
    const inviteLink = window.location.origin + window.location.pathname + "#/new-player";

    function send(ev) {
      ev.preventDefault();
      if (!friendName.trim()) return;
      const rec = GUWH.Store.addInvite(friendName.trim(), contact.trim());
      setJustSent(rec.id);
      setFriendName("");
      setContact("");
    }

    async function shareLink() {
      await shareOrCopy({ title: "Come play underwater hockey", text: MESSAGE, url: inviteLink });
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Bring a mate", title: "Grow the game, one Wednesday at a time.", sub: "Their first three sessions are free too — same as yours were." }),

      h(
        "div",
        { className: "grid lg:grid-cols-[1fr_1fr] gap-8" },

        h(
          "form",
          { onSubmit: send, className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 flex flex-col gap-4 h-fit" },
          h("h3", { className: "font-display font-bold text-[var(--ink)]" }, "Invite someone for " + GUWH.formatDate(wed)),
          h(FormField, { label: "Their name" }, h("input", { className: inputCls, value: friendName, onChange: (e) => setFriendName(e.target.value) })),
          h(FormField, { label: "Phone or email (optional)" }, h("input", { className: inputCls, value: contact, onChange: (e) => setContact(e.target.value) })),
          h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Send invite"),
          justSent && h("p", { className: "text-sm text-[var(--good-dark)] flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "Invite logged — nudge them to book on Try Underwater Hockey.")
        ),

        h(
          "div",
          { className: "rounded-3xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4" },
          h("h3", { className: "font-display font-bold" }, "Or just share the link"),
          h("p", { className: "text-sm text-white/70 leading-relaxed" }, "“" + MESSAGE + "”"),
          h(Button, { variant: "dark", className: "!bg-white/15 hover:!bg-white/25", onClick: shareLink }, h(Icon, { name: "share", size: 16 }), "Share invitation")
        )
      ),

      h(
        "div",
        { className: "mt-10" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Invites you've sent"),
        invites.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No invites yet — send your first one above.")
          : h(
              "div",
              { className: "rounded-2xl bg-[var(--sand)] divide-y divide-black/5" },
              invites.slice().reverse().map((inv) =>
                h(
                  "div",
                  { key: inv.id, className: "flex items-center justify-between px-5 py-3" },
                  h(
                    "div",
                    null,
                    h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, inv.friendName),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, new Date(inv.sentAt).toLocaleDateString("en-AU"))
                  ),
                  h(
                    "div",
                    { className: "flex items-center gap-3" },
                    h(Pill, { tone: inv.status === "registered" ? "good" : "accent" }, inv.status === "registered" ? "Registered" : "Invited"),
                    inv.status !== "registered" &&
                      h(Button, { size: "sm", variant: "ghost", onClick: () => GUWH.Store.markInviteRegistered(inv.id) }, "Mark as registered")
                  )
                )
              )
            )
      )
    );
  }

  function BringAMatePage() {
    return GUWH.Identity ? h(RealBringAMatePage) : h(DemoBringAMatePage);
  }

  GUWH.Pages.BringAMate = BringAMatePage;
})();
