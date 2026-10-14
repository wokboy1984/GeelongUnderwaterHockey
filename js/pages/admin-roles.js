// ---------------------------------------------------------------------------
// Administration workspace — real role management. Search a member, see
// their current roles, grant or revoke one. Every change is written to the
// server-side audit log by /api/admin/roles — this page has no permission
// logic of its own, it just calls that endpoint, which re-checks the
// caller is an Administrator against the database on every request.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, inputCls } = GUWH.UI;

  const ROLE_LABELS = {
    game_coordinator: "Game Coordinator",
    community_moderator: "Community Moderator",
    treasurer: "Treasurer",
    administrator: "Administrator",
  };
  const ROLE_ORDER = ["game_coordinator", "community_moderator", "treasurer", "administrator"];
  const GRADES = ["A", "B", "Casual", "Junior"];

  function AdminRolesPage() {
    const [q, setQ] = React.useState("");
    const [members, setMembers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [note, setNote] = React.useState({}); // memberId -> note text
    const [busy, setBusy] = React.useState(null); // "memberId:role" while a request is in flight
    const [roleChoice, setRoleChoice] = React.useState({}); // memberId -> role currently selected in that row's dropdown
    const [confirmDeleteId, setConfirmDeleteId] = React.useState(null); // member whose Delete is awaiting the second click

    function selectedRoleFor(m) {
      return roleChoice[m.id] || ROLE_ORDER[0];
    }

    function search(query) {
      setLoading(true);
      setError(null);
      return GUWH.Identity.authFetch("/api/admin/roles?q=" + encodeURIComponent(query))
        .then((r) => r.json())
        .then((data) => (data.ok ? setMembers(data.members) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }

    React.useEffect(() => { search(""); }, []);

    function onSearchSubmit(ev) {
      ev.preventDefault();
      search(q.trim());
    }

    async function toggleRole(member, role, hasIt) {
      const key = member.id + ":" + role;
      setBusy(key);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: hasIt ? "DELETE" : "POST",
          body: JSON.stringify({ memberEmail: member.email, role, note: note[member.id] || null }),
        });
        const data = await res.json();
        if (data.ok) {
          setMembers((prev) => prev.map((m) => (m.id === data.member.id ? data.member : m)));
        } else {
          setError(data.error || "Something went wrong");
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    }

    // In-person waiver (12 Oct 2026): record (or undo) a paper waiver.
    async function setWaiver(member, signed) {
      const key = member.id + ":waiver";
      setBusy(key);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          body: JSON.stringify({ action: "waiver", memberEmail: member.email, signed }),
        });
        const data = await res.json();
        if (data.ok) setMembers((prev) => prev.map((m) => (m.id === data.member.id ? data.member : m)));
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    }

    // Permanently delete a member (14 Oct 2026, Cheongy). Two clicks: Delete,
    // then "Yes, delete". The server refuses if they have attendance or fee
    // history, and says why. It does not remove their Netlify Identity login.
    async function deleteMember(member) {
      const key = member.id + ":delete";
      setBusy(key);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          body: JSON.stringify({ action: "delete_member", memberEmail: member.email, confirm: true }),
        });
        const data = await res.json();
        if (data.ok) {
          setMembers((prev) => prev.filter((m) => m.id !== member.id));
          setConfirmDeleteId(null);
        } else {
          setError(data.error || "Something went wrong");
          setConfirmDeleteId(null);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    }

    async function setGrade(member, grade) {
      const key = member.id + ":grade";
      setBusy(key);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/admin/roles", {
          method: "POST",
          body: JSON.stringify({ action: "grade", memberEmail: member.email, grade }),
        });
        const data = await res.json();
        if (data.ok) setMembers((prev) => prev.map((m) => (m.id === data.member.id ? data.member : m)));
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(SectionHeading, { eyebrow: "Administration", title: "Roles & permissions", sub: "Every grant or revoke here is logged — who, to whom, what, and when." }),

      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      h(
        "form",
        { onSubmit: onSearchSubmit, className: "flex gap-3 mb-6" },
        h("input", { className: inputCls, value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search by name or email…" }),
        h(Button, { type: "submit" }, "Search")
      ),

      loading
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
        : members.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No members found.")
        : h(
            "div",
            { className: "rounded-2xl bg-white ring-1 ring-black/5 divide-y divide-black/5" },
            members.map((m) => {
              const role = selectedRoleFor(m);
              const hasIt = m.roles.includes(role);
              const key = m.id + ":" + role;
              const isSelf = GUWH.Identity.currentMember() && GUWH.Identity.currentMember().id === m.id;
              const label = (t) => h("p", { className: "text-[10px] font-mono uppercase tracking-wide text-[var(--ink-soft)] mb-1" }, t);
              // Stacked cards, not a wide table (14 Oct 2026): the table needed a
              // horizontal scroll on anything narrower than ~920px.
              return h(
                "div",
                { key: m.id, className: "p-4 sm:p-5 flex flex-col gap-4" },
                h(
                  "div",
                  { className: "flex items-start justify-between gap-3" },
                  h(
                    "div",
                    { className: "min-w-0" },
                    h("p", { className: "font-semibold text-[var(--ink)]" }, m.firstName + " " + m.lastName, typeof m.age === "number" && h("span", { className: "ml-2 text-xs font-normal text-[var(--ink-soft)]" }, "Age " + m.age)),
                    h("p", { className: "text-xs text-[var(--ink-soft)] break-all" }, m.email)
                  ),
                  !isSelf && (confirmDeleteId === m.id
                    ? h(
                        "div",
                        { className: "flex items-center gap-1 shrink-0" },
                        h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy === m.id + ":delete", onClick: () => setConfirmDeleteId(null) }, "Cancel"),
                        h(Button, { type: "button", size: "sm", className: "!bg-[var(--bad)] !text-white", disabled: busy === m.id + ":delete", onClick: () => deleteMember(m) }, busy === m.id + ":delete" ? "Deleting…" : "Yes, delete")
                      )
                    : h(Button, { type: "button", size: "sm", variant: "ghost", className: "shrink-0 !text-[var(--bad)]", onClick: () => setConfirmDeleteId(m.id) }, "Delete"))
                ),
                confirmDeleteId === m.id && h("p", { className: "text-xs text-[var(--bad)] -mt-2" }, "Permanently deletes " + m.firstName + " and everything linked only to them (bookings, roles, goals, forum settings). This can't be undone."),
                h(
                  "div",
                  { className: "grid gap-4 sm:grid-cols-3" },
                  h(
                    "div",
                    null,
                    label("Grade"),
                    h(
                      "select",
                      {
                        className: inputCls + " !py-1.5 !text-xs !w-auto",
                        value: m.grade || "",
                        disabled: busy === m.id + ":grade",
                        onChange: (e) => setGrade(m, e.target.value),
                      },
                      h("option", { value: "" }, "No grade"),
                      GRADES.map((g) => h("option", { key: g, value: g }, g))
                    )
                  ),
                  h(
                    "div",
                    null,
                    label("Waiver"),
                    m.waiverSigned
                      ? h(
                          "div",
                          { className: "flex items-center gap-2" },
                          h(Pill, { tone: "good", className: "!py-0.5 !px-2 !text-[10px]" }, "Signed"),
                          h("button", { type: "button", className: "text-[11px] text-[var(--ink-soft)] underline disabled:opacity-40", disabled: busy === m.id + ":waiver", onClick: () => setWaiver(m, false) }, "Undo")
                        )
                      : h(
                          "div",
                          { className: "flex items-center gap-2 flex-wrap" },
                          h(Pill, { tone: "warn", className: "!py-0.5 !px-2 !text-[10px]" }, "Not signed"),
                          h(Button, { type: "button", size: "sm", variant: "secondary", className: "!py-1 !px-2.5 !text-xs whitespace-nowrap", disabled: busy === m.id + ":waiver", onClick: () => setWaiver(m, true) }, "Mark signed")
                        )
                  ),
                  h(
                    "div",
                    null,
                    label("Current roles"),
                    m.roles.length
                      ? h(
                          "div",
                          { className: "flex flex-wrap gap-1" },
                          m.roles.map((r) => h(Pill, { key: r, tone: "accent", className: "!py-0.5 !px-2 !text-[10px]" }, ROLE_LABELS[r] || r))
                        )
                      : h("span", { className: "text-xs text-[var(--ink-soft)]" }, "None")
                  )
                ),
                h(
                  "div",
                  null,
                  label("Change role"),
                  h(
                    "div",
                    { className: "flex flex-wrap gap-2" },
                    h(
                      "select",
                      {
                        className: inputCls + " !py-1.5 !text-xs !w-auto",
                        value: role,
                        onChange: (e) => setRoleChoice((prev) => Object.assign({}, prev, { [m.id]: e.target.value })),
                      },
                      ROLE_ORDER.map((r) => h("option", { key: r, value: r }, ROLE_LABELS[r]))
                    ),
                    h(
                      Button,
                      {
                        size: "sm",
                        variant: hasIt ? "secondary" : "dark",
                        disabled: busy === key,
                        onClick: () => toggleRole(m, role, hasIt),
                      },
                      hasIt ? "Revoke" : "Grant"
                    ),
                    h("input", {
                      className: inputCls + " !py-1 !text-xs !w-full sm:!w-64",
                      value: note[m.id] || "",
                      onChange: (e) => setNote((prev) => Object.assign({}, prev, { [m.id]: e.target.value })),
                      placeholder: "Note (optional) — e.g. Elected at AGM",
                    })
                  )
                )
              );
            })
          ),

      h(
        "p",
        { className: "text-xs text-[var(--ink-soft)] mt-8" },
        "A member needs to have logged in at least once before you can search for them here. Walk-in players added via " +
          "“Add Player” on the Attendance tab have no login and never appear here."
      )
    );
  }

  GUWH.Pages.AdminRoles = AdminRolesPage;
})();
