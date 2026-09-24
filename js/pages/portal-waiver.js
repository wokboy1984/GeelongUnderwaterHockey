// ---------------------------------------------------------------------------
// Digital club waiver (live site, real backend) — shown once to any member
// who hasn't accepted it yet (existing members were grandfathered when this
// shipped; only genuinely new registrations see this). Mirrors the club's
// paper Player Registration form: liability/Model Rules acknowledgment,
// AUF membership consent, and a WWCC/VIT declaration. Typed full name +
// checkbox is the signature (not a drawn signature) — stored with a server
// timestamp via /api/waiver.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  function WaiverPage() {
    const [loading, setLoading] = React.useState(true);
    const [signedName, setSignedName] = React.useState("");
    const [agreeWaiver, setAgreeWaiver] = React.useState(false);
    const [wwccStatus, setWwccStatus] = React.useState("");
    const [signingAsGuardian, setSigningAsGuardian] = React.useState(false);
    const [guardianName, setGuardianName] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      GUWH.Identity.authFetch("/api/waiver")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.accepted) navigate("/portal/dashboard");
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []);

    async function submit(ev) {
      ev.preventDefault();
      setError(null);
      if (!signedName.trim()) return setError("Type your full name to sign.");
      if (!agreeWaiver) return setError("You need to agree to the waiver to continue.");
      if (!wwccStatus) return setError("Let us know your Working With Children Check status.");
      if (signingAsGuardian && !guardianName.trim()) return setError("Enter the parent/guardian's name.");

      setSaving(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/waiver", {
          method: "POST",
          body: JSON.stringify({ signedName: signedName.trim(), agreeWaiver, wwccStatus, signingAsGuardian, guardianName: guardianName.trim() }),
        });
        const d = await res.json();
        if (!d.ok) {
          setError(d.error || "Something went wrong");
          setSaving(false);
          return;
        }
        await GUWH.Identity.refreshMember();
        navigate("/portal/dashboard");
      } catch (e) {
        setError(String(e));
        setSaving(false);
      }
    }

    if (loading) return h(Container, { className: "py-16 text-center text-[var(--ink-soft)]" }, "Loading…");

    return h(
      Container,
      { className: "py-12 sm:py-16 max-w-2xl" },
      h(Pill, { tone: "accent" }, "One-time registration step"),
      h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-4" }, "Sign the club waiver"),
      h("p", { className: "mt-2 text-[var(--ink-soft)]" }, "Before you can book in or use the member portal, please read and sign this once."),

      h(
        "div",
        { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-4 text-sm text-[var(--ink)] leading-relaxed" },
        h("h2", { className: "font-display text-lg font-bold" }, "Geelong Underwater Hockey Inc. — registration declaration"),
        h(
          "p",
          null,
          "I wish to register as a member of Geelong Underwater Hockey Incorporated (GUWH) and agree to abide by the club's duly constituted rules and by-laws, and the rules of the Victorian Underwater Hockey Commission (VUHC), Underwater Hockey Australia (UHA) and the Australian Underwater Federation (AUF)."
        ),
        h(
          "p",
          null,
          "I acknowledge that GUWH, its committee and office bearers shall not be held responsible in any way for any loss or damage, or any injury sustained by me, during or because of any club activity. To the best of my knowledge, I have no medical condition that would place myself or others at risk during vigorous physical activity."
        ),
        h(
          "p",
          null,
          "I agree to abide by the Model Rules of the organisation (see the GUWH website) and the AUF/UHA Code of Conduct, and I agree to join the AUF so the club can take advantage of its insurance arrangements — see ",
          h("a", { href: "https://www.auf.com.au", target: "_blank", rel: "noopener", className: "text-[var(--accent-dark)] font-semibold" }, "auf.com.au"),
          "."
        ),
        h(
          "p",
          null,
          "I understand that unless I complete the mandated online AUF Child Safety training within 3 months of joining, I may be disallowed from participating in GUWH activities. A link will be provided."
        )
      ),

      h(
        "form",
        { onSubmit: submit, className: "mt-6 rounded-2xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },
        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),

        h(
          FormField,
          { label: "Working With Children Check", required: true, hint: "Required for anyone around junior players" },
          h(
            "div",
            { className: "flex flex-col gap-2" },
            h(
              "label",
              { className: "flex items-start gap-3 rounded-xl border-2 border-black/10 p-3.5 text-sm cursor-pointer" },
              h("input", { type: "radio", name: "wwcc", className: "mt-0.5", checked: wwccStatus === "have", onChange: () => setWwccStatus("have") }),
              h("span", null, "I hold a valid Working With Children Check (or VIT registration) and will present a copy to the Secretary as soon as possible.")
            ),
            h(
              "label",
              { className: "flex items-start gap-3 rounded-xl border-2 border-black/10 p-3.5 text-sm cursor-pointer" },
              h("input", { type: "radio", name: "wwcc", className: "mt-0.5", checked: wwccStatus === "will_apply", onChange: () => setWwccStatus("will_apply") }),
              h("span", null, "I don't currently hold one — I'll apply for a WWCC and present it within one month of joining.")
            )
          )
        ),

        h(
          "label",
          { className: "flex items-start gap-3 text-sm" },
          h("input", { type: "checkbox", className: "mt-0.5", checked: signingAsGuardian, onChange: (e) => setSigningAsGuardian(e.target.checked) }),
          h("span", null, "I'm a parent or guardian signing on behalf of a player under 18.")
        ),
        signingAsGuardian &&
          h(FormField, { label: "Parent/guardian's full name", required: true }, h("input", { className: inputCls, value: guardianName, onChange: (e) => setGuardianName(e.target.value) })),

        h(
          FormField,
          { label: signingAsGuardian ? "Player's full name" : "Your full name (typed as your signature)", required: true },
          h("input", { className: inputCls, value: signedName, onChange: (e) => setSignedName(e.target.value) })
        ),

        h(
          "label",
          { className: "flex items-start gap-3 text-sm" },
          h("input", { type: "checkbox", className: "mt-0.5", checked: agreeWaiver, onChange: (e) => setAgreeWaiver(e.target.checked) }),
          h("span", null, "I have read and agree to the declaration above.")
        ),

        h(Button, { type: "submit", size: "lg", disabled: saving }, saving ? "Saving…" : "Sign & continue")
      )
    );
  }

  GUWH.Pages.Waiver = WaiverPage;
})();
