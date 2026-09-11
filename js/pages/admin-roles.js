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
  const { Container, Button, Pill, SectionHeading, FormField, inputCls } = GUWH.UI;

  const ROLE_LABELS = {
    game_coordinator: "Game Coordinator",
    community_moderator: "Community Moderator",
    treasurer: "Treasurer",
    administrator: "Administrator",
  };
  const ROLE_ORDER = ["game_coordinator", "community_moderator", "treasurer", "administrator"];

  function AdminRolesPage() {
    const [q, setQ] = React.useState("");
    const [members, setMembers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [note, setNote] = React.useState({}); // memberId -> note text
    const [busy, setBusy] = React.useState(null); // "memberId:role" while a request is in flight

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

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
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
            { className: "flex flex-col gap-4" },
            members.map((m) =>
              h(
                "div",
                { key: m.id, className: "rounded-2xl bg-white ring-1 ring-black/5 p-5" },
                h(
                  "div",
                  { className: "flex items-center justify-between" },
                  h(
                    "div",
                    null,
                    h("p", { className: "font-display font-bold text-[var(--ink)]" }, m.firstName + " " + m.lastName),
                    h("p", { className: "text-xs text-[var(--ink-soft)]" }, m.email + (typeof m.age === "number" ? " · age " + m.age : ""))
                  )
                ),
                h(
                  "div",
                  { className: "mt-3 flex flex-wrap gap-2" },
                  ROLE_ORDER.map((role) => {
                    const hasIt = m.roles.includes(role);
                    const key = m.id + ":" + role;
                    return h(
                      Button,
                      {
                        key: role,
                        size: "sm",
                        variant: hasIt ? "dark" : "secondary",
                        disabled: busy === key,
                        onClick: () => toggleRole(m, role, hasIt),
                      },
                      (hasIt ? "✓ " : "+ ") + ROLE_LABELS[role]
                    );
                  })
                ),
                h(FormField, { label: "Note (optional, applies to the next change below)" },
                  h("input", {
                    className: inputCls,
                    value: note[m.id] || "",
                    onChange: (e) => setNote((prev) => Object.assign({}, prev, { [m.id]: e.target.value })),
                    placeholder: "e.g. Elected at AGM, 12 Sept 2026",
                  })
                )
              )
            )
          ),

      h(
        "p",
        { className: "text-xs text-[var(--ink-soft)] mt-8" },
        "A member needs to have logged in at least once before you can search for them here."
      )
    );
  }

  GUWH.Pages.AdminRoles = AdminRolesPage;
})();
