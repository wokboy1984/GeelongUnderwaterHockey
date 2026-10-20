// ---------------------------------------------------------------------------
// Treasurer workspace. Game fees come from the separate actual-attendance
// register; this page manages player fee accounts, membership charges,
// payments (including partial payments), balances and monthly CSV reports.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Pill, SectionHeading, Button, FormField, inputCls, Icon } = GUWH.UI;

  const ENTRY_LABELS = {
    game: "Game attendance",
    joining: "Joining fee",
    annual: "Yearly membership",
    payment: "Payment received",
    custom: "Custom charge",
  };

  // Which rows the server will let a treasurer delete (20 Oct 2026).
  // Mirrors the two refusals in finance.mts so the button only appears
  // where it will work:
  //  - payments are never deletable (money that changed hands stays on the
  //    record; a wrong one is fixed with a correcting entry)
  //  - automatic game charges aren't rows in finance_entries at all. They
  //    are derived from attendance and carry a synthetic "attendance:..."
  //    id, so they're removed by unticking the player on the Coordinator's
  //    Attendance tab instead.
  function isAutomaticGameCharge(entry) {
    return typeof entry.id === "string" && entry.id.indexOf("attendance:") === 0;
  }
  function deletable(entry) {
    return entry.kind !== "payment" && !isAutomaticGameCharge(entry);
  }
  function deletableReason(entry) {
    if (isAutomaticGameCharge(entry)) return "Automatic game fee — untick this player's attendance on the Game Coordination tab to remove it.";
    return "Payments can't be deleted — record a correcting entry instead.";
  }

  function money(cents) {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((Number(cents) || 0) / 100);
  }

  function melbourneToday() {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (name) => parts.find((p) => p.type === name).value;
    return part("year") + "-" + part("month") + "-" + part("day");
  }

  function SummaryCard({ label, value, tone }) {
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h("p", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, label),
      h("p", { className: "font-display text-2xl font-bold mt-1 tabular-nums " + (tone || "text-[var(--ink)]") }, value)
    );
  }

  function FinancePage() {
    const today = melbourneToday();
    const [month, setMonth] = React.useState(today.slice(0, 7));
    const [data, setData] = React.useState(null);
    const [selectedId, setSelectedId] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState("");
    const [error, setError] = React.useState("");
    const [notice, setNotice] = React.useState("");
    const [form, setForm] = React.useState({
      category: "unwaged",
      trialEligible: false,
      evidence: "",
      kind: "payment",
      date: today,
      amount: "",
      note: "",
    });
    const requestId = React.useRef(null);

    function setField(name, value) {
      requestId.current = null;
      setForm((previous) => Object.assign({}, previous, { [name]: value }));
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await GUWH.Identity.authFetch("/api/finance?month=" + encodeURIComponent(month));
        const next = await response.json();
        if (!response.ok || !next.ok) throw new Error(next.error || "Could not load finance records");
        setData(next);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    React.useEffect(() => { load(); }, [month]);

    const selected = data && data.members.find((member) => member.id === selectedId);
    const activeMembers = data ? data.members.filter((member) => member.category) : [];
    const setupNeeded = data ? data.members.filter((member) => !member.category).length : 0;
    const reportTotals = activeMembers.reduce(
      (sum, member) => ({
        charges: sum.charges + Number(member.charges),
        payments: sum.payments + Number(member.payments),
        closing: sum.closing + Number(member.closing),
      }),
      { charges: 0, payments: 0, closing: 0 }
    );

    // Deleting changes what someone owes, so it asks first and names the
    // amount — a treasurer shouldn't be able to wipe a charge with one
    // stray tap. Every deletion is written to the audit log server-side.
    async function deleteEntry(entry) {
      const label = (ENTRY_LABELS[entry.kind] || entry.kind).toLowerCase();
      const who = selected ? selected.displayName : "this player";
      if (!window.confirm("Delete the " + label + " of " + money(entry.amount_cents) + " dated " + entry.entry_date + " for " + who + "?\n\nThis removes it from their balance and can't be undone.")) return;
      setDeleting(entry.id);
      setError("");
      setNotice("");
      try {
        const res = await GUWH.Identity.authFetch("/api/finance", {
          method: "POST",
          body: JSON.stringify({ action: "delete", id: entry.id }),
        });
        const body = await res.json();
        if (!body.ok) { setError(body.error || "Could not delete that record."); return; }
        setNotice("Deleted the " + label + " of " + money(entry.amount_cents) + ".");
        await load();
      } catch (e) {
        setError(String(e));
      } finally {
        setDeleting("");
      }
    }

    async function save(event) {
      event.preventDefault();
      if (!selected) return;
      setSaving(true);
      setError("");
      setNotice("");
      try {
        requestId.current = requestId.current || crypto.randomUUID();
        const payload = selected.category
          ? {
              action: "entry",
              id: requestId.current,
              memberId: selected.id,
              kind: form.kind,
              date: form.date,
              amount: form.amount,
              note: form.note,
            }
          : {
              action: "account",
              memberId: selected.id,
              category: form.category,
              trialEligible: form.trialEligible,
              evidence: form.evidence,
            };
        const response = await GUWH.Identity.authFetch("/api/finance", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not save finance record");
        requestId.current = null;
        setForm((previous) => Object.assign({}, previous, { amount: "", note: "" }));
        setNotice(selected.category ? "Finance record saved." : "Player finance account created.");
        await load();
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setSaving(false);
      }
    }

    async function setMemberTrial(member, free) {
      setError("");
      setNotice("");
      try {
        const response = await GUWH.Identity.authFetch("/api/finance", {
          method: "POST",
          body: JSON.stringify({ action: "member_trial", memberId: member.id, free }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not save");
        setNotice(free ? "First 3 sessions are now free." : "Free sessions removed, all games are charged.");
        await load();
      } catch (err) {
        setError(err.message || String(err));
      }
    }

    // Tick box: this child gets their first 3 sessions free (Try Underwater
    // Hockey). Off by default - not assumed (16 Oct 2026).
    async function setChildTrial(kid, free) {
      setError("");
      setNotice("");
      try {
        const response = await GUWH.Identity.authFetch("/api/finance", {
          method: "POST",
          body: JSON.stringify({ action: "child_trial", childId: kid.id, free }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not save");
        setNotice(kid.displayName + (free ? ": first 3 sessions are now free." : ": free sessions removed, all games are charged."));
        await load();
      } catch (err) {
        setError(err.message || String(err));
      }
    }

    function downloadCsv() {
      if (!data) return;
      const safeCell = (value) => {
        let text = String(value == null ? "" : value);
        if (/^[=+@-]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const rows = [
        ["Player", "Category", "Month", "Opening AUD", "Fees AUD", "Received AUD", "Closing AUD"],
        ...activeMembers.map((member) => [
          (member.displayName || GUWH.displayName({ nickname: member.nickname, firstName: member.first_name, lastName: member.last_name })),
          member.category,
          month,
          (member.opening / 100).toFixed(2),
          (member.charges / 100).toFixed(2),
          (member.payments / 100).toFixed(2),
          (member.closing / 100).toFixed(2),
        ]),
      ];
      const csv = rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "guwh-treasurer-" + month + ".csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function accountRow(member) {
      const name = (member.displayName || GUWH.displayName({ nickname: member.nickname, firstName: member.first_name, lastName: member.last_name }));
      return h(
        "tr",
        { key: member.id, className: "border-t border-black/5" },
        h("td", { className: "p-3" }, h("button", { className: "font-semibold text-left hover:text-[var(--accent-dark)] underline underline-offset-2", onClick: () => setSelectedId(member.id) }, name)),
        h("td", { className: "p-3" }, h(Pill, { tone: "dark", className: "!normal-case !tracking-normal" }, member.category === "waged" ? "Waged" : "Unwaged / junior")),
        h("td", { className: "p-3 text-right tabular-nums" }, money(member.opening)),
        h("td", { className: "p-3 text-right tabular-nums" }, money(member.charges)),
        h("td", { className: "p-3 text-right tabular-nums text-[var(--good-dark)]" }, money(member.payments)),
        h("td", { className: "p-3 text-right tabular-nums font-bold " + (member.closing > 0 ? "text-[var(--bad)]" : "text-[var(--ink)]") }, money(member.closing))
      );
    }

    const selectedEntries = data && selected
      ? data.entries.filter((entry) => entry.member_id === selected.id).slice().reverse()
      : [];

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-5xl" },
      h(SectionHeading, {
        eyebrow: "Treasurer workspace",
        title: "Player fees & payments",
        sub: "Game fees come from confirmed attendance. Record membership charges and full or partial payments here.",
      }),
      error && h("p", { role: "alert", className: "mb-5 rounded-xl bg-[var(--bad-05)] border border-[var(--bad-30)] p-3 text-sm text-[var(--bad)]" }, error),
      notice && h("p", { role: "status", className: "mb-5 rounded-xl bg-[var(--good-15)] p-3 text-sm text-[var(--good-dark)]" }, notice),
      h(
        "div",
        { className: "flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5" },
        h(FormField, { label: "Report month" }, h("input", { type: "month", className: inputCls, value: month, onChange: (event) => event.target.value && setMonth(event.target.value) })),
        h(Button, { type: "button", variant: "secondary", disabled: !data || loading, onClick: downloadCsv }, h(Icon, { name: "arrowRight", size: 16 }), "Download CSV")
      ),
      h(
        "div",
        { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" },
        h(SummaryCard, { label: "Fees this month", value: money(reportTotals.charges) }),
        h(SummaryCard, { label: "Payments received", value: money(reportTotals.payments), tone: "text-[var(--good-dark)]" }),
        h(SummaryCard, { label: "Outstanding total", value: money(reportTotals.closing), tone: reportTotals.closing > 0 ? "text-[var(--bad)]" : "text-[var(--ink)]" }),
        h(SummaryCard, { label: "Accounts to set up", value: setupNeeded })
      ),
      // Games that were attended but can't be charged because the payer has no
      // fee account yet (16 Oct 2026). Child games bill to the parent.
      !loading && data && data.unbilled && data.unbilled.length > 0 && h(
        "div",
        { role: "status", className: "mb-6 rounded-xl bg-[var(--warn-10)] p-4 text-sm text-[var(--ink)]" },
        h("p", { className: "font-semibold" }, "Attended games not being charged"),
        h("p", { className: "mt-1 text-[var(--ink-soft)]" }, "These people have no fee account, so their games (including their children's) are missing from the totals. Select them below and create the account."),
        h("ul", { className: "mt-2 flex flex-col gap-1" },
          data.unbilled.map((u) => h("li", { key: u.memberId },
            h("button", { type: "button", className: "font-semibold underline text-left", onClick: () => { setSelectedId(u.memberId); requestId.current = null; setNotice(""); } }, u.displayName),
            " - " + u.games + " game" + (u.games === 1 ? "" : "s") + (u.childGames ? " (" + u.childGames + " by their children)" : "")
          ))
        )
      ),
      loading
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading finance records…")
        : data && h(
            React.Fragment,
            null,
            h(
              "div",
              { className: "rounded-2xl bg-white ring-1 ring-black/5 overflow-x-auto" },
              activeMembers.length
                ? h(
                    "table",
                    { className: "w-full min-w-[720px] text-sm" },
                    h("caption", { className: "text-left px-4 pt-4 pb-2 text-xs text-[var(--ink-soft)]" }, "A negative closing balance is credit held for the player."),
                    h("thead", { className: "text-[var(--ink-soft)]" }, h("tr", null,
                      ["Player", "Category", "Opening", "Fees", "Received", "Closing"].map((heading, index) => h("th", { key: heading, scope: "col", className: "p-3 " + (index > 1 ? "text-right" : "text-left") }, heading))
                    )),
                    h("tbody", null, activeMembers.map(accountRow))
                  )
                : h("p", { className: "p-5 text-sm text-[var(--ink-soft)]" }, "No player finance accounts have been set up yet. Select a player below to begin.")
            ),
            h(
              "section",
              { className: "mt-8 rounded-2xl bg-white ring-1 ring-black/5 p-5 sm:p-6" },
              h("h2", { className: "font-display text-2xl font-bold text-[var(--ink)]" }, "Player account"),
              h("p", { className: "mt-1 mb-5 text-sm text-[var(--ink-soft)]" }, "Select a member to configure fees, record a payment, or review their history."),
              h(FormField, { label: "Player" }, h(
                "select",
                { className: inputCls, value: selectedId, onChange: (event) => { setSelectedId(event.target.value); requestId.current = null; setNotice(""); } },
                h("option", { value: "" }, "Select a player"),
                data.members.map((member) => h("option", { key: member.id, value: member.id },
                  (member.displayName || GUWH.displayName({ nickname: member.nickname, firstName: member.first_name, lastName: member.last_name })) + (member.category ? "" : " — setup required")
                ))
              )),
              selected && data.kids && data.kids.filter((k) => k.parentId === selected.id).length > 0 && h(
                "div",
                { className: "mt-5 rounded-xl bg-[var(--sand)] p-4" },
                h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, "Children (fees bill to this account)"),
                h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5 mb-2" }, "Tick to give a child their first 3 sessions free. Unticked children are charged from the first game."),
                data.kids.filter((k) => k.parentId === selected.id).map((k) => h(
                  "label",
                  { key: k.id, className: "flex items-center gap-2 py-1 text-sm" },
                  h("input", { type: "checkbox", checked: !!k.trialFree, onChange: (event) => setChildTrial(k, event.target.checked) }),
                  k.displayName + " - 3 free trial sessions",
                  h("span", { className: "text-xs text-[var(--ink-soft)]" }, "(" + k.games + " game" + (k.games === 1 ? "" : "s") + " so far)")
                ))
              ),
              selected && !selected.category && h(
                "form",
                { onSubmit: save, className: "mt-5 grid sm:grid-cols-2 gap-4" },
                h(FormField, { label: "Fee category", required: true }, h(
                  "select",
                  { className: inputCls, value: form.category, onChange: (event) => setField("category", event.target.value) },
                  h("option", { value: "unwaged" }, "Unwaged / junior — $10 per game"),
                  h("option", { value: "waged" }, "Waged senior — $20 per game")
                )),
                h("label", { className: "flex items-center gap-2 text-sm font-semibold sm:self-end sm:pb-3" },
                  h("input", { type: "checkbox", checked: form.trialEligible, onChange: (event) => setField("trialEligible", event.target.checked) }),
                  "First 3 sessions free (Try Underwater Hockey)"
                ),
                form.trialEligible && h(FormField, { label: "Trial note (optional)", hint: "For example: trial booking reference." }, h("input", { className: inputCls, value: form.evidence, onChange: (event) => setField("evidence", event.target.value) })),
                h("p", { className: "text-sm text-[var(--ink-soft)] sm:col-span-2" }, "Regular registration means an existing member, so their game fee starts with their first confirmed attendance."),
                h("div", { className: "sm:col-span-2" }, h(Button, { type: "submit", disabled: saving }, saving ? "Saving…" : "Create finance account"))
              ),
              selected && selected.category && h(
                React.Fragment,
                null,
                h(
                  "div",
                  { className: "mt-5 flex flex-wrap items-center gap-2" },
                  h(Pill, { tone: "dark" }, selected.category === "waged" ? "Waged" : "Unwaged / junior"),
                  selected.trial_eligible && h(Pill, { tone: "good" }, "Three trial sessions free"),
                  h("span", { className: "ml-auto font-display text-xl font-bold" }, "Balance " + money(selected.closing))
                ),
                h("label", { className: "mt-3 flex items-center gap-2 text-sm font-semibold" },
                  h("input", { type: "checkbox", checked: !!selected.trial_eligible, onChange: (event) => setMemberTrial(selected, event.target.checked) }),
                  "First 3 sessions free (Try Underwater Hockey)"
                ),
                h(
                  "form",
                  { onSubmit: save, className: "mt-5 grid sm:grid-cols-2 gap-4" },
                  h(FormField, { label: "Record", required: true }, h(
                    "select",
                    { className: inputCls, value: form.kind, onChange: (event) => setField("kind", event.target.value) },
                    h("option", { value: "payment" }, "Payment received — full or partial"),
                    h("option", { value: "joining" }, "Joining fee"),
                    h("option", { value: "annual" }, "Yearly membership"),
                    h("option", { value: "game" }, "Game fee — retrospective entry"),
                    h("option", { value: "custom" }, "Custom charge")
                  )),
                  h(FormField, {
                    label: "Date",
                    required: true,
                    hint: form.kind === "game" ? "The date the game was actually played." : undefined,
                  }, h("input", { type: "date", required: true, max: today, className: inputCls, value: form.date, onChange: (event) => setField("date", event.target.value) })),
                  (form.kind === "payment" || form.kind === "custom") && h(FormField, { label: "Amount (AUD)", required: true }, h("input", { type: "number", min: "0.01", step: "0.01", required: true, className: inputCls, value: form.amount, onChange: (event) => setField("amount", event.target.value), placeholder: "0.00" })),
                  (form.kind === "game" || form.kind === "custom") && h("p", { className: "text-sm text-[var(--ink-soft)] sm:col-span-2" },
                    form.kind === "game"
                      ? "Charged at the player's usual per-game rate (" + (selected.category === "waged" ? "$20.00" : "$10.00") + "). Only use this for a game that was never checked in on the Attendance tab — a checked-in date is refused here."
                      : "Charged at the exact amount you enter below."
                  ),
                  h(FormField, {
                    label: "Reference or notes",
                    required: form.kind === "custom" || form.kind === "game",
                    hint: form.kind === "payment" ? "For example: bank reference, cash, or payer name."
                      : form.kind === "custom" ? "What this charge is for — required."
                      : form.kind === "game" ? "Why it's being entered manually — required."
                      : "Optional",
                  }, h("input", { className: inputCls, required: form.kind === "custom" || form.kind === "game", value: form.note, onChange: (event) => setField("note", event.target.value) })),
                  h("p", { className: "text-sm text-[var(--ink-soft)] sm:col-span-2" }, "Regular game fees appear automatically from the Game Coordination Attendance tab as players are checked in; bookings alone never create a charge."),
                  h("div", { className: "sm:col-span-2" }, h(Button, { type: "submit", disabled: saving }, saving ? "Saving…" : "Save record"))
                ),
                h("div", { className: "mt-8" },
                  h("h3", { className: "font-display text-lg font-bold mb-3" }, "Transaction history"),
                  selectedEntries.length
                    ? h("div", { className: "rounded-xl bg-[var(--sand)] divide-y divide-black/5" }, selectedEntries.map((entry) => h(
                        "div",
                        { key: entry.id, className: "flex items-start justify-between gap-4 px-4 py-3" },
                        h("div", null,
                          h("p", { className: "text-sm font-semibold" }, ENTRY_LABELS[entry.kind] || entry.kind),
                          h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, entry.entry_date + (entry.note ? " · " + entry.note : ""))
                        ),
                        h("div", { className: "flex items-center gap-3 shrink-0" },
                          h("span", { className: "font-semibold tabular-nums " + (entry.kind === "payment" ? "text-[var(--good-dark)]" : "") }, (entry.kind === "payment" ? "−" : "") + money(entry.amount_cents)),
                          // Delete a mistaken charge (20 Oct 2026). The API has
                          // always supported this; there was simply no button.
                          // Only offered where the server will actually allow
                          // it — see deletableReason() — so the treasurer never
                          // meets a refusal they couldn't have predicted.
                          deletable(entry)
                            ? h("button", {
                                type: "button",
                                "aria-label": "Delete this " + (ENTRY_LABELS[entry.kind] || entry.kind).toLowerCase(),
                                title: "Delete this charge",
                                disabled: deleting === entry.id,
                                onClick: () => deleteEntry(entry),
                                className: "text-[var(--ink-soft)] hover:text-[var(--bad)] disabled:opacity-40 transition p-1 -m-1",
                              }, h(Icon, { name: "x", size: 15 }))
                            : h("span", {
                                className: "text-[10px] text-[var(--ink-soft)] w-[15px] text-center cursor-help",
                                title: deletableReason(entry),
                              }, "—")
                        )
                      )))
                    : h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No transactions recorded for this player yet.")
                )
              )
            )
          )
    );
  }

  GUWH.Pages.Finance = FinancePage;
})();
