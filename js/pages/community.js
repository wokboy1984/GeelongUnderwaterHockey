// ---------------------------------------------------------------------------
// Community & Content workspace — Community Moderator / Administrator only.
// The Members Forum moderation surface: suggestions awaiting review, open
// reports, media awaiting approval, restricted/suspended members, recent
// discussions, recent moderation activity, and category management.
// Backed by netlify/functions/forum-moderation.mts, forum-suggestions.mts
// and forum-categories.mts.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, SectionHeading, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  function StatTile({ value, label, tone }) {
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 flex flex-col gap-1" },
      h("p", { className: cx("font-display text-2xl font-bold tabular-nums", tone === "warn" && value > 0 ? "text-[var(--warn-dark)]" : "text-[var(--ink)]") }, value),
      h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, label)
    );
  }

  // --------------------------------------------------------------- Categories
  function CategoryManager({ categories, onChanged }) {
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [postingRule, setPostingRule] = React.useState("members");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function call(body) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/categories", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onChanged();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    function createCategory(ev) {
      ev.preventDefault();
      if (!name.trim()) return;
      call({ action: "create_category", name: name.trim(), description: description.trim() || undefined, postingRule }).then(() => { setName(""); setDescription(""); });
    }

    function move(index, dir) {
      const ordered = categories.map((c) => c.id);
      const target = index + dir;
      if (target < 0 || target >= ordered.length) return;
      const tmp = ordered[index];
      ordered[index] = ordered[target];
      ordered[target] = tmp;
      call({ action: "reorder_categories", orderedIds: ordered });
    }

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 flex flex-col gap-4" },
      h("p", { className: "font-display font-bold text-[var(--ink)]" }, "Categories"),
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      h(
        "div",
        { className: "flex flex-col divide-y divide-black/5" },
        categories.map((c, i) =>
          h(
            "div",
            { key: c.id, className: "flex items-center justify-between gap-3 py-2.5" },
            h(
              "div",
              null,
              h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, c.name, c.archived && h(Pill, { tone: "warn", className: "!py-0 !px-1.5 ml-2" }, "Archived")),
              h("p", { className: "text-xs text-[var(--ink-soft)]" }, c.topicCount + " topics · " + (c.postingRule === "moderators_only" ? "Moderators post" : "Members post"))
            ),
            h(
              "div",
              { className: "flex items-center gap-1.5 shrink-0" },
              h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy || i === 0, onClick: () => move(i, -1) }, "↑"),
              h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy || i === categories.length - 1, onClick: () => move(i, 1) }, "↓"),
              h(
                Button,
                { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => call({ action: c.archived ? "unarchive_category" : "archive_category", categoryId: c.id }) },
                c.archived ? "Restore" : "Archive"
              )
            )
          )
        )
      ),
      h(
        "form",
        { onSubmit: createCategory, className: "flex flex-wrap gap-2 items-end pt-2 border-t border-black/5" },
        h(FormField, { label: "New category" }, h("input", { className: inputCls + " !w-40", value: name, onChange: (e) => setName(e.target.value) })),
        h(FormField, { label: "Description" }, h("input", { className: inputCls + " !w-48", value: description, onChange: (e) => setDescription(e.target.value) })),
        h(
          FormField,
          { label: "Who can post" },
          h(
            "select",
            { className: inputCls + " !w-40", value: postingRule, onChange: (e) => setPostingRule(e.target.value) },
            h("option", { value: "members" }, "Members"),
            h("option", { value: "moderators_only" }, "Moderators only")
          )
        ),
        h(Button, { type: "submit", size: "sm", disabled: busy }, "Add category")
      )
    );
  }

  // --------------------------------------------------------------- Suggestions
  function SuggestionsPanel({ suggestions, categories, onChanged }) {
    const [decliningId, setDecliningId] = React.useState(null);
    const [declineReason, setDeclineReason] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function call(body) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/suggestions", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onChanged();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    if (suggestions.length === 0) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nothing waiting on review.");

    return h(
      "div",
      { className: "flex flex-col gap-3" },
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      suggestions.map((s) =>
        h(
          "div",
          { key: s.id, className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 flex flex-col gap-2" },
          h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, s.suggestedTitle),
          h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Suggested by " + s.suggestedBy + " · " + GUWH.formatRelativeTime(s.createdAt)),
          h("p", { className: "text-sm text-[var(--ink)]" }, s.explanation),
          s.openingContent && h("p", { className: "text-xs text-[var(--ink-soft)] italic" }, '"' + s.openingContent + '"'),
          decliningId === s.id
            ? h(
                "div",
                { className: "flex items-center gap-2" },
                h("input", { className: inputCls, placeholder: "Reason (shown to the submitter)", value: declineReason, onChange: (e) => setDeclineReason(e.target.value) }),
                h(Button, { type: "button", size: "sm", disabled: busy, onClick: () => call({ action: "decline", suggestionId: s.id, reason: declineReason.trim() }).then(() => { setDecliningId(null); setDeclineReason(""); }) }, "Confirm decline"),
                h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setDecliningId(null) }, "Cancel")
              )
            : h(
                "div",
                { className: "flex items-center gap-2" },
                h(Button, { type: "button", size: "sm", disabled: busy, onClick: () => call({ action: "approve", suggestionId: s.id, categoryId: s.suggestedCategoryId || (categories[0] && categories[0].id) }) }, "Approve & publish"),
                h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => setDecliningId(s.id) }, "Decline")
              )
        )
      )
    );
  }

  // --------------------------------------------------------------- Reports
  function ReportsPanel({ reports, onChanged }) {
    const [resolvingId, setResolvingId] = React.useState(null);
    const [resolution, setResolution] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function call(body) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/moderation", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onChanged();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    if (reports.length === 0) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No open reports.");

    return h(
      "div",
      { className: "flex flex-col gap-3" },
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      reports.map((r) =>
        h(
          "div",
          { key: r.id, className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 flex flex-col gap-2" },
          h(
            "div",
            { className: "flex items-center justify-between gap-3" },
            h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, "Reported " + r.targetType + " #" + r.targetId),
            h(Pill, { tone: r.status === "in_review" ? "accent" : "warn", className: "!py-0.5" }, r.status)
          ),
          h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Reason: " + r.reason.replace(/_/g, " ") + " · reported by " + r.reporterDisplay + " · " + GUWH.formatRelativeTime(r.createdAt)),
          r.explanation && h("p", { className: "text-sm text-[var(--ink)]" }, r.explanation),
          r.targetType === "topic" && h("button", { type: "button", className: "text-xs text-[var(--accent-dark)] underline text-left w-fit", onClick: () => navigate("/portal/forum/topic/" + r.targetId) }, "Open topic"),
          resolvingId === r.id
            ? h(
                "div",
                { className: "flex items-center gap-2" },
                h("input", { className: inputCls, placeholder: "Resolution note", value: resolution, onChange: (e) => setResolution(e.target.value) }),
                h(Button, { type: "button", size: "sm", disabled: busy, onClick: () => call({ action: "resolve_report", reportId: r.id, status: "resolved", resolution: resolution.trim() }).then(() => { setResolvingId(null); setResolution(""); }) }, "Mark resolved"),
                h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => call({ action: "resolve_report", reportId: r.id, status: "dismissed", resolution: resolution.trim() }).then(() => { setResolvingId(null); setResolution(""); }) }, "Dismiss"),
                h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setResolvingId(null) }, "Cancel")
              )
            : h(
                "div",
                { className: "flex items-center gap-2" },
                r.status === "open" && h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => call({ action: "assign_report", reportId: r.id }) }, "Assign to me"),
                h(Button, { type: "button", size: "sm", onClick: () => setResolvingId(r.id) }, "Resolve")
              )
        )
      )
    );
  }

  // --------------------------------------------------------------- Media approval
  function MediaPanel({ items, onChanged }) {
    const [busy, setBusy] = React.useState(false);

    async function call(body) {
      setBusy(true);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/moderation", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onChanged();
      } finally {
        setBusy(false);
      }
    }

    if (items.length === 0) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nothing waiting on approval.");

    return h(
      "div",
      { className: "flex flex-col divide-y divide-black/5" },
      items.map((a) =>
        h(
          "div",
          { key: a.id, className: "flex items-center justify-between gap-3 py-2.5" },
          h(
            "div",
            null,
            h("p", { className: "text-sm text-[var(--ink)]" }, a.fileName || a.kind),
            h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Uploaded by " + a.uploadedBy + " · " + GUWH.formatRelativeTime(a.createdAt))
          ),
          h(
            "div",
            { className: "flex items-center gap-2" },
            h(Button, { type: "button", size: "sm", disabled: busy, onClick: () => call({ action: "approve_media", attachmentId: a.id }) }, "Approve"),
            h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => { if (window.confirm("Reject and delete this file?")) call({ action: "reject_media", attachmentId: a.id }); } }, "Reject")
          )
        )
      )
    );
  }

  // --------------------------------------------------------------- Members
  function MembersPanel({ restricted, suspended, onChanged }) {
    const [memberId, setMemberId] = React.useState("");
    const [reason, setReason] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function call(body) {
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/moderation", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onChanged();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "flex flex-col gap-4" },
      error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
      h(
        "div",
        null,
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Restricted from posting"),
        restricted.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nobody currently.")
          : restricted.map((m) =>
              h(
                "div",
                { key: m.memberId, className: "flex items-center justify-between gap-3 py-1.5" },
                h("span", { className: "text-sm text-[var(--ink)]" }, m.display + " — " + (m.reason || "no reason given")),
                h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => call({ action: "unrestrict_member", memberId: m.memberId }) }, "Lift restriction")
              )
            )
      ),
      h(
        "div",
        null,
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Suspended from the forum"),
        suspended.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nobody currently.")
          : suspended.map((m) =>
              h(
                "div",
                { key: m.memberId, className: "flex items-center justify-between gap-3 py-1.5" },
                h("span", { className: "text-sm text-[var(--ink)]" }, m.display + " — " + (m.reason || "no reason given")),
                h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy, onClick: () => call({ action: "unsuspend_member", memberId: m.memberId }) }, "Lift suspension")
              )
            )
      ),
      h(
        "div",
        { className: "rounded-xl bg-[var(--sand)] p-3 flex flex-wrap items-end gap-2" },
        h(FormField, { label: "Member ID", hint: "From Administration → Roles" }, h("input", { className: inputCls + " !w-48", value: memberId, onChange: (e) => setMemberId(e.target.value) })),
        h(FormField, { label: "Reason" }, h("input", { className: inputCls + " !w-56", value: reason, onChange: (e) => setReason(e.target.value) })),
        h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy || !memberId.trim() || !reason.trim(), onClick: () => call({ action: "restrict_member", memberId: memberId.trim(), reason: reason.trim() }) }, "Restrict posting"),
        h(Button, { type: "button", size: "sm", variant: "ghost", disabled: busy || !memberId.trim() || !reason.trim(), onClick: () => call({ action: "suspend_member", memberId: memberId.trim(), reason: reason.trim() }) }, "Suspend")
      )
    );
  }

  // --------------------------------------------------------------- Page
  function CommunityPage() {
    const [data, setData] = React.useState(null);
    const [categories, setCategories] = React.useState([]);
    const [suggestions, setSuggestions] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function load() {
      setLoading(true);
      setError(null);
      return Promise.all([
        GUWH.Identity.authFetch("/api/forum/moderation").then((r) => r.json()),
        GUWH.Identity.authFetch("/api/forum/categories").then((r) => r.json()),
        GUWH.Identity.authFetch("/api/forum/suggestions").then((r) => r.json()),
      ])
        .then(([mod, cats, sug]) => {
          if (mod.ok) setData(mod);
          else setError(mod.error || "Something went wrong");
          if (cats.ok) setCategories(cats.categories);
          if (sug.ok) setSuggestions(sug.pending || []);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { load(); }, []);

    if (loading && !data) return h(Container, { className: "py-14" }, h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"));
    if (error && !data) return h(Container, { className: "py-14" }, h("p", { className: "text-sm text-[var(--bad)]" }, error));
    if (!data) return null;

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },
      h(SectionHeading, { eyebrow: "Community & Content", title: "Members Forum moderation", sub: "Suggestions, reports, media and category management for the Members Forum." }),

      h(
        "div",
        { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" },
        h(StatTile, { value: data.pendingSuggestionsCount, label: "Pending suggestions", tone: "warn" }),
        h(StatTile, { value: data.openReports.length, label: "Open reports", tone: "warn" }),
        h(StatTile, { value: data.mediaAwaitingApproval.length, label: "Media awaiting approval", tone: "warn" }),
        h(StatTile, { value: data.restrictedMembers.length + data.suspendedMembers.length, label: "Restricted/suspended", tone: "warn" })
      ),

      h(
        "div",
        { className: "flex flex-col gap-8" },

        h("div", null, h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Suggestions awaiting review"), h(SuggestionsPanel, { suggestions, categories, onChanged: load })),
        h("div", null, h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Reports"), h(ReportsPanel, { reports: data.openReports, onChanged: load })),
        h("div", null, h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Media awaiting approval"), h(MediaPanel, { items: data.mediaAwaitingApproval, onChanged: load })),
        h(CategoryManager, { categories, onChanged: load }),
        h("div", null, h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Members"), h(MembersPanel, { restricted: data.restrictedMembers, suspended: data.suspendedMembers, onChanged: load })),

        h(
          "div",
          null,
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Recent discussions"),
          data.recentDiscussions.length === 0
            ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nothing yet.")
            : h(
                "div",
                { className: "flex flex-col divide-y divide-black/5" },
                data.recentDiscussions.map((t) =>
                  h(
                    "button",
                    { key: t.id, type: "button", onClick: () => navigate("/portal/forum/topic/" + t.id), className: "text-left py-2 hover:opacity-70" },
                    h("span", { className: "text-sm text-[var(--ink)]" }, t.title),
                    h("span", { className: "block text-xs text-[var(--ink-soft)]" }, t.category_name + " · " + GUWH.formatRelativeTime(t.last_activity_at))
                  )
                )
              )
        ),

        h(
          "div",
          null,
          h("h3", { className: "font-display font-bold text-[var(--ink)] mb-3" }, "Recent moderation activity"),
          data.recentActivity.length === 0
            ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Nothing logged yet.")
            : h(
                "div",
                { className: "flex flex-col gap-1.5" },
                data.recentActivity.map((a, i) =>
                  h("p", { key: i, className: "text-xs text-[var(--ink-soft)]" }, h("span", { className: "text-[var(--ink)]" }, a.note || a.action.replace(/_/g, " ")), " · " + GUWH.formatRelativeTime(a.created_at))
                )
              )
        )
      )
    );
  }

  GUWH.Pages.Community = CommunityPage;
})();
