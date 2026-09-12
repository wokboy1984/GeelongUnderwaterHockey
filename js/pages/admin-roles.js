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

  function AdminRolesPage() {
    const [q, setQ] = React.useState("");
    const [members, setMembers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [note, setNote] = React.useState({}); // memberId -> note text
    const [busy, setBusy] = React.useState(null); // "memberId:role" while a request is in flight
    const [roleChoice, setRoleChoice] = React.useState({}); // memberId -> role currently selected in that row's dropdown

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
            { className: "rounded-2xl bg-white ring-1 ring-black/5 overflow-x-auto" },
            h(
              "table",
              { className: "w-full text-sm min-w-[720px]" },
              h(
                "thead",
                null,
                h(
                  "tr",
                  { className: "text-left text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)] border-b border-black/5" },
                  ["Member", "Age", "Current roles", "Change role"].map((c) => h("th", { key: c, className: "px-4 py-3 font-semibold" }, c))
                )
              ),
              h(
                "tbody",
                null,
                members.map((m) => {
                  const role = selectedRoleFor(m);
                  const hasIt = m.roles.includes(role);
                  const key = m.id + ":" + role;
                  return h(
                    "tr",
                    { key: m.id, className: "border-b border-black/5 last:border-0 align-top" },
                    h(
                      "td",
                      { className: "px-4 py-3" },
                      h("p", { className: "font-semibold text-[var(--ink)]" }, m.firstName + " " + m.lastName),
                      h("p", { className: "text-xs text-[var(--ink-soft)]" }, m.email)
                    ),
                    h("td", { className: "px-4 py-3 text-[var(--ink-soft)] tabular-nums" }, typeof m.age === "number" ? m.age : "—"),
                    h(
                      "td",
                      { className: "px-4 py-3" },
                      m.roles.length
                        ? h(
                            "div",
                            { className: "flex flex-wrap gap-1" },
                            m.roles.map((r) => h(Pill, { key: r, tone: "accent", className: "!py-0.5 !px-2 !text-[10px]" }, ROLE_LABELS[r] || r))
                          )
                        : h("span", { className: "text-xs text-[var(--ink-soft)]" }, "—")
                    ),
                    h(
                      "td",
                      { className: "px-4 py-3" },
                      h(
                        "div",
                        { className: "flex gap-2" },
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
                        )
                      ),
                      h("input", {
                        className: inputCls + " !py-1 !text-xs mt-1.5",
                        value: note[m.id] || "",
                        onChange: (e) => setNote((prev) => Object.assign({}, prev, { [m.id]: e.target.value })),
                        placeholder: "Note (optional) — e.g. Elected at AGM",
                      })
                    )
                  );
                })
              )
            )
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
