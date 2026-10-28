// ---------------------------------------------------------------------------
// Administration - one member's page (16 Oct 2026, Cheongy). Opened by
// clicking a name on the Administration list: "#/admin/member?id=<memberId>".
// Shows the real name and contact details (only Administrators see these -
// everyone else just sees "First L." or the nickname), family links, games
// and goals, and the fee statement. An Administrator can change or clear a
// nickname here, e.g. one that's offensive. All data comes from
// GET /api/admin/roles?id=..., which re-checks the Administrator role on the
// server every time.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const ROLE_LABELS = {
    game_coordinator: "Game Coordinator",
    community_moderator: "Community Moderator",
    treasurer: "Treasurer",
    administrator: "Administrator",
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return n + "th";
    return n + (["th", "st", "nd", "rd"][n % 10] || "th");
  }
  // "2026-08-15" or an ISO timestamp -> "15th August 2026"
  function fmtDate(value) {
    if (!value) return "-";
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(value);
    return ordinal(Number(m[3])) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1];
  }
  function money(cents) {
    const n = Number(cents) || 0;
    return (n < 0 ? "-$" : "$") + (Math.abs(n) / 100).toFixed(2);
  }

  function Card({ title, children, className }) {
    return h(
      "section",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 " + (className || "") },
      title && h("h2", { className: "font-display text-lg font-bold text-[var(--ink)] mb-3" }, title),
      children
    );
  }

  function Field({ label, value }) {
    return h(
      "div",
      { className: "min-w-0" },
      h("p", { className: "text-[10px] font-mono uppercase tracking-wide text-[var(--ink-soft)] mb-0.5" }, label),
      h("p", { className: "text-sm text-[var(--ink)] break-words" }, value || h("span", { className: "text-[var(--ink-soft)]" }, "Not set"))
    );
  }

  function AdminMemberPage() {
    const [id, setId] = React.useState(GUWH.Router.queryParam("id"));
    const [m, setM] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [nick, setNick] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [familyQ, setFamilyQ] = React.useState("");
    const [familyResults, setFamilyResults] = React.useState(null);
    const [loginEmail, setLoginEmail] = React.useState("");
    const [loginInvite, setLoginInvite] = React.useState(true);
    const [notice, setNotice] = React.useState(null);

    // Moving between a parent and a child changes only the query string, so
    // the page watches the hash itself.
    React.useEffect(() => {
      const onHash = () => setId(GUWH.Router.queryParam("id"));
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);

    React.useEffect(() => {
      if (!id) { setLoading(false); setError("No member selected."); return; }
      setLoading(true);
      setError(null);
      setSaved(false);
      GUWH.Identity.authFetch("/api/admin/roles?id=" + encodeURIComponent(id))
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) { setM(data.member); setNick(data.member.nickname || ""); }
          else setError(data.error || "Something went wrong");
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, [id]);

    async function savePosition(value) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "set_position", memberId: m.id, position: value }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Couldn't save");
        setM(data.member);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusy(false);
      }
    }

    // Families (28 Oct 2026): put login accounts (partners, juniors with
    // their own login) in one family, for booking each other in and the
    // family fee cap. Children under a parent follow the parent.
    async function findFamily(ev) {
      ev.preventDefault();
      if (!familyQ.trim()) return;
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles?q=" + encodeURIComponent(familyQ.trim()));
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Search failed");
        const already = new Set([m.id].concat((m.family || []).map((f) => f.id)));
        setFamilyResults(data.members.filter((x) => !already.has(x.id)));
      } catch (e) {
        setError(String(e.message || e));
      }
    }
    async function familyCall(body) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Couldn't save");
        setM(data.member);
        setFamilyQ("");
        setFamilyResults(null);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusy(false);
      }
    }

    // A child's own login (28 Oct 2026): give the child record a real email
    // so they can sign in and keep their history. Fees stay with the parent.
    async function giveLogin(ev) {
      ev.preventDefault();
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "child_login", memberId: m.id, email: loginEmail.trim(), invite: loginInvite }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Couldn't save");
        setM(data.member);
        setLoginEmail("");
        setNotice(data.notice || null);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusy(false);
      }
    }

    async function saveNickname(value) {
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "set_nickname", memberId: m.id, nickname: value }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Couldn't save");
        setM(data.member);
        setNick(data.member.nickname || "");
        setSaved(true);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setBusy(false);
      }
    }

    const back = h("button", { type: "button", className: "text-sm font-semibold text-[var(--accent-dark)] underline mb-4", onClick: () => navigate("/admin/roles") }, "Back to Administration");

    if (loading && !m) return h(Container, { className: "py-10" }, back, h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"));
    if (!m) return h(Container, { className: "py-10" }, back, h("p", { className: "text-sm text-[var(--bad)]", role: "alert" }, error || "Member not found."));

    const f = m.finance;
    const isChild = !!m.parent;
    const nickChanged = nick.trim() !== (m.nickname || "");

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      back,
      h(
        "div",
        { className: "flex flex-wrap items-center gap-2" },
        h("h1", { className: "font-display text-3xl font-bold text-[var(--ink)]" }, m.adminName || m.displayName),
        isChild && h(Pill, { tone: "accent" }, "Child"),
        m.roles.map((r) => h(Pill, { key: r, tone: "accent" }, ROLE_LABELS[r] || r))
      ),
      m.email && h("p", { className: "mt-1 text-sm text-[var(--ink-soft)]" }, m.email),
      // Straight through to what this person owes (20 Oct 2026). Looking
      // someone up in Administration and then hunting for the same name in
      // a long Finance table was the slow way round.
      h(
        "button",
        {
          type: "button",
          className: "mt-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline",
          onClick: () => navigate("/finance?member=" + encodeURIComponent(m.id)),
        },
        "View their fees & payments →"
      ),
      error && h("p", { className: "mt-3 text-sm text-[var(--bad)]", role: "alert" }, error),

      h(
        "div",
        { className: "mt-6 flex flex-col gap-5" },

        h(
          Card,
          { title: "Nickname" },
          h("p", { className: "text-sm text-[var(--ink-soft)] mb-3" }, "Everyone else sees " + (m.nickname ? "this nickname" : "first name and last initial") + " instead of the real name. Change or clear it if it's not appropriate. Clearing it goes back to “" + [m.firstName, (m.lastName || "").charAt(0).toUpperCase() ? (m.lastName || "").charAt(0).toUpperCase() + "." : ""].filter(Boolean).join(" ") + "”."),
          h(
            "form",
            { className: "flex flex-wrap gap-2", onSubmit: (e) => { e.preventDefault(); if (nickChanged) saveNickname(nick.trim()); } },
            h("input", { className: inputCls + " !w-full sm:!w-64", maxLength: 30, value: nick, placeholder: "No nickname", onChange: (e) => { setNick(e.target.value); setSaved(false); } }),
            h(Button, { type: "submit", size: "sm", disabled: busy || !nickChanged }, busy ? "Saving…" : "Save"),
            m.nickname && h(Button, { type: "button", size: "sm", variant: "secondary", disabled: busy, onClick: () => saveNickname("") }, "Clear nickname"),
            saved && h("span", { className: "self-center text-sm text-[var(--good-dark)]" }, "Saved")
          )
        ),

        h(
          Card,
          { title: "Details" },
          h(
            "div",
            { className: "grid gap-4 grid-cols-2 sm:grid-cols-3" },
            h(Field, { label: "Age", value: typeof m.age === "number" ? String(m.age) : null }),
            h(Field, { label: "Date of birth", value: m.dateOfBirth ? fmtDate(m.dateOfBirth) : null }),
            h(Field, { label: "Grade", value: m.grade }),
            // Editable here (27 Oct 2026, Liam); saves as soon as it's picked.
            h(
              "label",
              { className: "min-w-0" },
              h("span", { className: "block text-[10px] font-mono uppercase tracking-wide text-[var(--ink-soft)] mb-0.5" }, "Position"),
              h(
                "select",
                { className: inputCls + " !w-auto !py-1 text-sm", value: m.position || "Unknown", disabled: busy, onChange: (e) => savePosition(e.target.value) },
                GUWH.POSITIONS.concat("Unknown").map((p) => h("option", { key: p, value: p }, p))
              )
            ),
            h(Field, { label: "Phone", value: m.phone }),
            h(Field, { label: "Joined", value: fmtDate(m.joined) }),
            h(Field, { label: "Emergency contact", value: m.emergencyName }),
            h(Field, { label: "Emergency phone", value: m.emergencyPhone }),
            h(Field, { label: "Waiver", value: m.waiverSigned ? "Signed" + (m.waiverNote ? " (" + m.waiverNote + ")" : "") : "Not signed" })
          ),
          h("p", { className: "mt-4 text-xs text-[var(--ink-soft)]" }, "Roles, grade and the waiver are changed from the Administration list. Position saves as soon as you pick it.")
        ),

        h(
            Card,
            { title: "Family" },
            // Everyone else in the family, then (for adults) adding someone.
            (m.family || []).length > 0 &&
              h(
                "ul",
                { className: "flex flex-col gap-2 mb-3" },
                m.family.map((f) =>
                  h(
                    "li",
                    { key: f.id, className: "text-sm text-[var(--ink)] flex flex-wrap items-center gap-2" },
                    h("button", { type: "button", className: "font-semibold text-[var(--accent-dark)] underline", onClick: () => navigate("/admin/member?id=" + f.id) }, f.adminName),
                    h("span", { className: "text-[var(--ink-soft)]" }, [f.isChild ? "child" : null, typeof f.age === "number" ? "age " + f.age : null].filter(Boolean).join(" · ")),
                    !f.isChild && h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => { if (window.confirm("Take " + f.adminName + " out of this family?")) familyCall({ action: "family_remove", memberId: f.id, viewId: m.id }); } }, "Remove from family")
                  )
                )
              ),
            notice && h("p", { className: "mb-3 rounded-xl bg-[var(--accent-12)] p-3 text-sm text-[var(--ink)]" }, notice),
            isChild &&
              h(
                "p",
                { className: "text-sm text-[var(--ink)]" },
                "Parent: ",
                h("button", { type: "button", className: "font-semibold text-[var(--accent-dark)] underline", onClick: () => navigate("/admin/member?id=" + m.parent.id) }, m.parent.adminName || m.parent.fullName || m.parent.displayName),
                ". Fees for this child's games are billed to their parent."
              ),
            isChild && !m.email &&
              h(
                "form",
                { className: "mt-3 flex flex-col gap-2", onSubmit: giveLogin },
                h("p", { className: "text-sm text-[var(--ink-soft)]" }, m.firstName + " has no login of their own. Give them one with their email address: their games, goals and teams stay theirs, their parent can still book them in, and their fees still go to their parent."),
                h(
                  "div",
                  { className: "flex flex-wrap items-center gap-2" },
                  h("input", { type: "email", className: inputCls + " !w-full sm:!w-64", value: loginEmail, placeholder: "Their email address", onChange: (e) => setLoginEmail(e.target.value) }),
                  h(
                    "label",
                    { className: "flex items-center gap-2 text-sm text-[var(--ink)]" },
                    h("input", { type: "checkbox", checked: loginInvite, onChange: (e) => setLoginInvite(e.target.checked) }),
                    "Email them an invitation"
                  ),
                  h(Button, { type: "submit", size: "sm", disabled: busy || !loginEmail.trim() }, busy ? "Saving…" : "Give login")
                )
              ),
            m.kids.length > 0 &&
              h(
                "ul",
                { className: "flex flex-col gap-2" },
                m.kids.map((k) =>
                  h(
                    "li",
                    { key: k.id, className: "text-sm text-[var(--ink)]" },
                    h("button", { type: "button", className: "font-semibold text-[var(--accent-dark)] underline", onClick: () => navigate("/admin/member?id=" + k.id) }, k.adminName || k.fullName || k.displayName),
                    typeof k.age === "number" ? " · age " + k.age : "",
                    k.removed ? " · removed by parent" : ""
                  )
                )
              ),
            !isChild &&
              h(
                "div",
                { className: "mt-3" },
                h(
                  "p",
                  { className: "text-sm text-[var(--ink-soft)] mb-2" },
                  (m.family || []).length > 0
                    ? "Everyone in a family can book the others in, and the family's game fees are capped each night. Add someone else with their own login:"
                    : "Not in a family. Add a partner, or a junior with their own login, so they can book each other in and the family fee cap applies. Children under this member's profile are included automatically."
                ),
                h(
                  "form",
                  { className: "flex flex-wrap gap-2", onSubmit: findFamily },
                  h("input", { className: inputCls + " !w-full sm:!w-64", value: familyQ, placeholder: "Search by name or email", onChange: (e) => setFamilyQ(e.target.value) }),
                  h(Button, { type: "submit", size: "sm", variant: "secondary", disabled: busy || !familyQ.trim() }, "Find")
                ),
                familyResults &&
                  (familyResults.length === 0
                    ? h("p", { className: "mt-2 text-sm text-[var(--ink-soft)]" }, "No members found.")
                    : h(
                        "ul",
                        { className: "mt-2 flex flex-col gap-1.5" },
                        familyResults.map((x) =>
                          h(
                            "li",
                            { key: x.id, className: "flex items-center justify-between gap-3 text-sm text-[var(--ink)]" },
                            h("span", null, x.adminName || x.displayName, x.email ? h("span", { className: "text-[var(--ink-soft)]" }, " · " + x.email) : null),
                            h(Button, { type: "button", size: "sm", disabled: busy, onClick: () => familyCall({ action: "family_add", memberId: m.id, otherId: x.id }) }, "Add to family")
                          )
                        )
                      )),
                (m.family || []).some((f) => !f.isChild) &&
                  h(Button, { type: "button", size: "sm", variant: "ghost", className: "mt-2", disabled: busy, onClick: () => { if (window.confirm("Take " + (m.adminName || m.displayName) + " out of this family?")) familyCall({ action: "family_remove", memberId: m.id }); } }, "Take this member out of the family")
              )
          ),

        h(
          Card,
          { title: "Playing" },
          h(
            "div",
            { className: "grid gap-4 grid-cols-2 sm:grid-cols-4" },
            h(Field, { label: "Games played", value: String(m.gamesPlayed) }),
            h(Field, { label: "Last game", value: m.lastGame ? fmtDate(m.lastGame) : null }),
            h(Field, { label: "Goals this season", value: String(m.seasonGoals) }),
            h(Field, { label: "Career goals", value: String(m.careerGoals) })
          )
        ),

        isChild
          ? null
          : h(
              Card,
              { title: "Finances" },
              !f.hasAccount &&
                h(
                  "div",
                  { className: "rounded-xl bg-[var(--warn-10)] p-3 text-sm text-[var(--ink)] mb-4" },
                  h("p", { className: "font-semibold" }, "No fee account yet"),
                  h(
                    "p",
                    { className: "mt-1" },
                    f.unbilledGames > 0
                      ? f.unbilledGames + " attended game" + (f.unbilledGames === 1 ? "" : "s") + " (this person's" + (m.kids.length ? " and their children's" : "") + ") are not being charged because the Treasurer hasn't set up a fee category for them."
                      : "Nothing is charged until the Treasurer sets up a fee category for them."
                  ),
                  h(Button, { type: "button", size: "sm", variant: "secondary", className: "mt-3", onClick: () => navigate("/finance") }, "Open Finance")
                ),
              f.hasAccount &&
                h(
                  "div",
                  { className: "grid gap-4 grid-cols-2 sm:grid-cols-4 mb-4" },
                  h(Field, { label: "Category", value: f.category === "waged" ? "Waged" : "Unwaged" }),
                  h(Field, { label: "Total charged", value: money(f.chargedCents) }),
                  h(Field, { label: "Total paid", value: money(f.paidCents) }),
                  h(Field, { label: "Balance owing", value: money(f.balanceCents) })
                ),
              f.hasAccount && f.entries.length === 0 && h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No charges or payments yet."),
              f.hasAccount && f.entries.length > 0 &&
                h(
                  "ul",
                  { className: "divide-y divide-black/5" },
                  f.entries.map((e, i) =>
                    h(
                      "li",
                      { key: i, className: "py-2 flex items-start justify-between gap-3 text-sm" },
                      h(
                        "div",
                        { className: "min-w-0" },
                        h("p", { className: "text-[var(--ink)]" }, e.note || e.kind),
                        h("p", { className: "text-xs text-[var(--ink-soft)]" }, fmtDate(e.date) + " · " + e.kind)
                      ),
                      h("span", { className: "shrink-0 font-semibold " + (e.kind === "payment" ? "text-[var(--good-dark)]" : "text-[var(--ink)]") }, (e.kind === "payment" ? "-" : "") + money(e.amountCents))
                    )
                  )
                ),
              f.hasAccount && h("p", { className: "mt-3 text-xs text-[var(--ink-soft)]" }, "Latest 60 entries. Record payments and extra charges on the Finance page.")
            )
      )
    );
  }

  GUWH.Pages.AdminMember = AdminMemberPage;
})();
