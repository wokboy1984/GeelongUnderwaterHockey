// ---------------------------------------------------------------------------
// GUWH concept — Bring a Mate referral flow
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;

  const MESSAGE = "I'm playing underwater hockey in Geelong this Wednesday. Your first three sessions are free and they'll supply the gear. Come give it a crack.";

  // One-tap share row (2 Oct 2026): WhatsApp, Messenger, phone message
  // (SMS/iMessage), plus the phone's own share sheet as "More". Each is a
  // plain link, so nothing is sent until the person hits send in that app.
  // Messenger's link only opens on phones with the Messenger app installed;
  // on a computer it falls back to copying the link and opening messenger.com.
  // `to` (12 Oct 2026): optional phone number or email of the friend. A
  // phone number pre-fills the recipient in Text message and WhatsApp
  // (Australian 04xx numbers converted to +61 for WhatsApp); an email adds
  // an Email button addressed to them.
  function ShareRow({ text, url, dark, to }) {
    const full = text + " " + url;
    const enc = encodeURIComponent;
    const raw = String(to || "").trim();
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw);
    const digits = raw.replace(/[^\d+]/g, "");
    const isPhone = !isEmail && digits.replace(/\D/g, "").length >= 8;
    const waNumber = isPhone ? (digits.startsWith("+") ? digits.slice(1) : digits.startsWith("0") ? "61" + digits.slice(1) : digits).replace(/\D/g, "") : "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const [copied, setCopied] = React.useState(false);
    const btn = dark
      ? "inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 text-sm font-semibold transition"
      : "inline-flex items-center gap-1.5 rounded-full bg-white ring-1 ring-black/10 hover:ring-[var(--accent)] text-[var(--ink)] px-3.5 py-2 text-sm font-semibold transition";

    function messenger(ev) {
      if (isMobile) return; // let the fb-messenger:// link open the app
      ev.preventDefault();
      if (navigator.clipboard) navigator.clipboard.writeText(full).catch(() => {});
      setCopied(true);
      window.open("https://www.messenger.com/", "_blank", "noopener");
    }
    async function more() {
      const r = await shareOrCopy({ title: "Come play underwater hockey", text, url });
      if (r === "copied") setCopied(true);
    }

    return h(
      "div",
      { className: "flex flex-col gap-2" },
      h(
        "div",
        { className: "flex flex-wrap gap-2" },
        h("a", { className: btn, href: "https://wa.me/" + waNumber + "?text=" + enc(full), target: "_blank", rel: "noopener" }, "WhatsApp"),
        h("a", { className: btn, href: "fb-messenger://share/?link=" + enc(url), onClick: messenger }, "Messenger"),
        h("a", { className: btn, href: "sms:" + (isPhone ? digits : "") + "?&body=" + enc(full) }, "Text message"),
        isEmail && h("a", { className: btn, href: "mailto:" + raw + "?subject=" + enc("Come try underwater hockey") + "&body=" + enc(full) }, "Email"),
        h("button", { type: "button", className: btn, onClick: more }, h(Icon, { name: "share", size: 14 }), "More")
      ),
      copied && h("p", { className: dark ? "text-xs text-white/70" : "text-xs text-[var(--ink-soft)]", role: "status" }, "Invite copied - paste it into your message.")
    );
  }

  // After an invite is saved (12 Oct 2026, pre-launch review): "Send
  // invite" used to only log the name, so it read as if the friend had
  // been messaged. Now it saves and then shows the share buttons with a
  // message addressed to them by name.
  function personalMessage(name) {
    const first = String(name || "").trim().split(" ")[0];
    return (first ? "Hey " + first + "! " : "") + MESSAGE;
  }
  function SendItNow({ sent, url }) {
    if (!sent) return null;
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--accent-12)] p-4 flex flex-col gap-3", role: "status" },
      h("p", { className: "text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14, className: "text-[var(--good-dark)]" }), "Saved. Now send it to " + sent.name + ":"),
      h(ShareRow, { text: personalMessage(sent.name), url, to: sent.contact })
    );
  }

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
          setJustSent({ name: friendName.trim(), contact: contact.trim() });
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
          h(Button, { type: "submit" }, h(Icon, { name: "plus", size: 16 }), "Save & send invite"),
          h(SendItNow, { sent: justSent, url: inviteLink })
        ),

        h(
          "div",
          { className: "rounded-3xl bg-[var(--navy)] text-white p-6 flex flex-col gap-4" },
          h("h3", { className: "font-display font-bold" }, "Or just share the link"),
          h("p", { className: "text-sm text-white/70 leading-relaxed" }, "“" + MESSAGE + "”"),
          h(ShareRow, { text: MESSAGE, url: inviteLink, dark: true })
        )
      ),

      h(
        "div",
        { className: "mt-10" },
        h("h3", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, "Invites you've sent"),
        loading
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
          : invites.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No invites yet — add your first one above.")
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

  // Compact, single-column version of the invite form — used inside the
  // dashboard's "Bring a Mate" modal. The standalone /portal/bring-a-mate
  // page above is left exactly as it was; this is a separate, smaller
  // component so that page's layout and behaviour can't be disturbed by
  // dashboard changes. Same endpoint, same validation, same real invites.
  function BringAMateForm({ onSent }) {
    const wed = GUWH.nextWednesday();
    const [friendName, setFriendName] = React.useState("");
    const [contact, setContact] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const [justSent, setJustSent] = React.useState(false);
    const [error, setError] = React.useState(null);
    const inviteLink = window.location.origin + window.location.pathname + "#/new-player";

    async function send(ev) {
      ev.preventDefault();
      if (!friendName.trim() || sending) return;
      setSending(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/invites", {
          method: "POST",
          body: JSON.stringify({ guestName: friendName.trim(), guestEmail: contact.trim() || null }),
        });
        const data = await res.json();
        if (data.ok) {
          setJustSent({ name: friendName.trim(), contact: contact.trim() });
          setFriendName("");
          setContact("");
          onSent && onSent(data.invites);
        } else {
          setError(data.error || "Something went wrong");
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setSending(false);
      }
    }

    async function shareLink() {
      await shareOrCopy({ title: "Come play underwater hockey", text: MESSAGE, url: inviteLink });
    }

    return h(
      "div",
      { className: "flex flex-col gap-4" },
      h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Their first three sessions are free too — same as yours were. Invite someone for " + GUWH.formatDate(wed) + "."),
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      h(
        "form",
        { onSubmit: send, className: "flex flex-col gap-4" },
        h(FormField, { label: "Their name" }, h("input", { className: inputCls, value: friendName, onChange: (e) => setFriendName(e.target.value), disabled: sending, autoFocus: true })),
        h(FormField, { label: "Phone or email (optional)" }, h("input", { className: inputCls, value: contact, onChange: (e) => setContact(e.target.value), disabled: sending })),
        h(Button, { type: "submit", disabled: sending || !friendName.trim() }, h(Icon, { name: "plus", size: 16 }), sending ? "Saving…" : "Save & send invite"),
        h(SendItNow, { sent: justSent, url: inviteLink })
      ),
      h(
        "div",
        { className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Or share the invite straight from your phone"),
        h(ShareRow, { text: MESSAGE, url: inviteLink })
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
  GUWH.Pages.BringAMateForm = BringAMateForm;
})();
