// ---------------------------------------------------------------------------
// Club calendar (11 Nov 2026, Liam): game nights and club events, by month,
// in the member menu after This Week's Game. Administrators (only, 11 Nov
// 2026, Liam) set up a whole season of game nights at once, add events,
// and cancel, change or remove anything, right here. Members can add it to
// their phone's calendar (Apple, Google, Outlook) as a subscription that
// updates itself. Server: netlify/functions/calendar.mts and
// calendar-feed.mts (/api/calendar.ics).
//
// Step 1 of 2: booking and Try It Free don't read the calendar yet.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, SectionHeading, Button, Icon, FormField, inputCls } = GUWH.UI;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const VENUE = (GUWH.club && GUWH.club.venue) || "Handbury Centre for Wellbeing";

  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const dayLabel = (iso, opts) => new Date(iso + "T12:00:00").toLocaleDateString("en-AU", opts || { weekday: "short", day: "numeric", month: "short" });
  function timeLabel(t) {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(Number);
    return ((hh % 12) || 12) + ":" + pad(mm) + (hh < 12 ? "am" : "pm");
  }
  const timeRange = (it) => (it.startTime ? timeLabel(it.startTime) + (it.endTime ? " – " + timeLabel(it.endTime) : "") : "All day");
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  // Wednesdays between two dates, less skipped ones (same rule as the server).
  function wednesdays(from, to, skip) {
    if (!from || !to || to < from) return [];
    const out = [];
    const d = new Date(from + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7));
    for (; d.toISOString().slice(0, 10) <= to && out.length < 60; d.setUTCDate(d.getUTCDate() + 7)) {
      const iso = d.toISOString().slice(0, 10);
      if (skip.indexOf(iso) === -1) out.push(iso);
    }
    return out;
  }

  function fetchCal(path, opts) {
    const f = GUWH.Identity && GUWH.Identity.currentUser && GUWH.Identity.currentUser() ? GUWH.Identity.authFetch : fetch;
    return f(path, opts).then((r) => r.json());
  }

  // ---- Add to my phone ----------------------------------------------------
  function PhoneCard() {
    const [copied, setCopied] = React.useState(false);
    const host = window.location.host;
    const https = "https://" + host + "/api/calendar.ics";
    const webcal = "webcal://" + host + "/api/calendar.ics";
    const name = encodeURIComponent("Geelong Underwater Hockey");
    const ua = navigator.userAgent || "";
    const apple = { key: "apple", label: "Apple Calendar", hint: "iPhone, iPad, Mac", href: webcal };
    const google = { key: "google", label: "Google Calendar", hint: "Gmail, Android", href: "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal) };
    const outlook = { key: "outlook", label: "Outlook.com", hint: "Hotmail, Outlook app", href: "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(https) + "&name=" + name };
    const office = { key: "office", label: "Microsoft 365", hint: "Work or school Outlook", href: "https://outlook.office.com/calendar/0/addfromweb?url=" + encodeURIComponent(https) + "&name=" + name };
    const options = /Android/i.test(ua) ? [google, outlook, apple, office] : [apple, google, outlook, office];
    // Outlook's "add calendar from web" page only works on a computer: on a
    // phone it opens the plain calendar instead (11 Nov 2026, Liam on iPhone).
    // A calendar added there then shows in the Outlook app too.
    const isPhone = /iPhone|iPad|iPod|Android/i.test(ua);
    const [outlookNote, setOutlookNote] = React.useState(false);
    function copy() {
      const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
      try { navigator.clipboard.writeText(https).then(done, () => window.prompt("Copy this link", https)); } catch (e) { window.prompt("Copy this link", https); }
    }
    return h(
      "section",
      { className: "rounded-2xl bg-[var(--sand)] p-5 mb-8" },
      h("h2", { className: "font-display text-lg font-bold text-[var(--ink)] flex items-center gap-2" }, h(Icon, { name: "calendar", size: 18 }), "Add to my phone"),
      h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, "Subscribe once and game nights and club events appear in your own calendar, and update when anything changes. Google can take up to a day to show a change."),
      h(
        "div",
        { className: "mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" },
        options.map((o) =>
          isPhone && (o.key === "outlook" || o.key === "office")
            ? h("button", { key: o.key, type: "button", onClick: () => setOutlookNote(true), className: "text-left rounded-xl bg-white ring-1 ring-black/10 px-3 py-2.5 hover:ring-[var(--accent)] transition" },
                h("span", { className: "block text-sm font-semibold text-[var(--ink)]" }, o.label),
                h("span", { className: "block text-xs text-[var(--ink-soft)]" }, o.hint))
            : h("a", { key: o.key, href: o.href, target: o.key === "apple" ? undefined : "_blank", rel: "noopener", className: "rounded-xl bg-white ring-1 ring-black/10 px-3 py-2.5 hover:ring-[var(--accent)] transition" },
            h("span", { className: "block text-sm font-semibold text-[var(--ink)]" }, o.label),
            h("span", { className: "block text-xs text-[var(--ink-soft)]" }, o.hint))
        )
      ),
      outlookNote && h("p", { className: "mt-3 rounded-xl bg-white ring-1 ring-black/10 px-4 py-3 text-sm text-[var(--ink)]" },
        "Outlook can only add a calendar from its website on a computer. Open this Calendar page on a computer, tap Outlook.com or Microsoft 365 there, and it will then appear in the Outlook app on your phone too."),
      h("button", { type: "button", onClick: copy, className: "mt-3 text-sm font-semibold text-[var(--accent-dark)] hover:underline" }, copied ? "Link copied" : "Other calendar app? Copy the link")
    );
  }

  // ---- Admin: set up season / add event -----------------------------------
  function SeasonForm({ onSave, busy }) {
    const [f, setF] = React.useState({ from: "", to: "", startTime: "18:00", endTime: "19:45", location: VENUE, skipIn: "" });
    const [skip, setSkip] = React.useState([]);
    const [err, setErr] = React.useState(null);
    const set = (k) => (e) => { setErr(null); setF((x) => Object.assign({}, x, { [k]: e.target.value })); };
    const nights = wednesdays(f.from, f.to, skip);
    function submit(ev) {
      ev.preventDefault();
      if (!f.from || !f.to) return setErr("Pick the first and last game.");
      if (f.to < f.from) return setErr("The last game has to be after the first game.");
      if (!nights.length) return setErr("There are no Wednesdays between those dates.");
      onSave({ action: "create_season", from: f.from, to: f.to, startTime: f.startTime, endTime: f.endTime, location: f.location, skip });
    }
    return h(
      "form",
      { onSubmit: submit, className: "flex flex-col gap-4" },
      h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Creates a game night every Wednesday between the two dates. Nights already on the calendar are left as they are."),
      h("div", { className: "grid sm:grid-cols-2 gap-4" },
        h(FormField, { label: "First game", required: true }, h("input", { id: "cal-season-from", type: "date", className: inputCls, value: f.from, onChange: set("from") })),
        h(FormField, { label: "Last game", required: true }, h("input", { id: "cal-season-to", type: "date", className: inputCls, value: f.to, onChange: set("to") })),
        h(FormField, { label: "Starts" }, h("input", { id: "cal-season-start", type: "time", className: inputCls, value: f.startTime, onChange: set("startTime") })),
        h(FormField, { label: "Finishes" }, h("input", { id: "cal-season-end", type: "time", className: inputCls, value: f.endTime, onChange: set("endTime") }))
      ),
      h(FormField, { label: "Where" }, h("input", { id: "cal-season-where", className: inputCls, value: f.location, onChange: set("location") })),
      h("div", null,
        h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, "Skip these Wednesdays"),
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, "Pool closed, public holiday, competition weekend."),
        skip.length > 0 && h("div", { className: "flex flex-wrap gap-1.5 mt-2" },
          skip.map((s) => h("button", { key: s, type: "button", onClick: () => setSkip((x) => x.filter((y) => y !== s)), className: "rounded-full bg-[var(--sand)] px-3 py-1 text-xs font-semibold text-[var(--ink)]" }, dayLabel(s) + " ✕"))),
        h("div", { className: "flex flex-wrap gap-2 mt-2" },
          h("input", { id: "cal-season-skip", type: "date", className: inputCls + " !w-48", value: f.skipIn, onChange: set("skipIn") }),
          h(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => {
            if (!f.skipIn) return setErr("Pick a date to skip first.");
            if (new Date(f.skipIn + "T12:00:00").getDay() !== 3) return setErr("That isn't a Wednesday.");
            setSkip((x) => (x.indexOf(f.skipIn) === -1 ? x.concat([f.skipIn]).sort() : x));
            setF((x) => Object.assign({}, x, { skipIn: "" }));
          } }, "Skip date"))
      ),
      err && h("p", { className: "text-sm text-[var(--bad)]" }, err),
      h("div", { className: "flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/5" },
        h("p", { className: "text-sm text-[var(--ink)]" }, h("span", { className: "font-display text-2xl font-bold tabular-nums" }, String(nights.length)), " game night" + (nights.length === 1 ? "" : "s") + " will be added"),
        h(Button, { type: "submit", disabled: busy }, busy ? "Adding…" : "Create season"))
    );
  }

  function ItemForm({ item, onSave, onCancel, busy }) {
    const game = item && item.kind === "game";
    const [f, setF] = React.useState({
      date: (item && item.date) || "", title: item ? (game && item.title === "Game night" ? "" : item.title) : "",
      startTime: (item && item.startTime) || "", endTime: (item && item.endTime) || "", location: (item && item.location) || "", notes: (item && item.notes) || "",
    });
    const [err, setErr] = React.useState(null);
    const set = (k) => (e) => { setErr(null); setF((x) => Object.assign({}, x, { [k]: e.target.value })); };
    function submit(ev) {
      ev.preventDefault();
      if (!f.date) return setErr("Pick a date.");
      if (!game && !f.title.trim()) return setErr("Give the event a name.");
      if (f.endTime && !f.startTime) return setErr("Add a start time too, or clear the finish time.");
      if (f.startTime && f.endTime && f.endTime <= f.startTime) return setErr("The finish time has to be after the start.");
      const body = { date: f.date, title: f.title.trim() || (game ? "Game night" : ""), startTime: f.startTime, endTime: f.endTime, location: f.location, notes: f.notes };
      onSave(item ? Object.assign({ action: "update", id: item.id }, body) : Object.assign({ action: "add_event" }, body));
    }
    return h(
      "form",
      { onSubmit: submit, className: "flex flex-col gap-4" },
      h("div", { className: "grid sm:grid-cols-2 gap-4" },
        h(FormField, { label: game ? "Name (optional)" : "Event", required: !game }, h("input", { className: inputCls, value: f.title, placeholder: game ? "Game night" : "End of year BBQ", onChange: set("title") })),
        h(FormField, { label: "Date", required: true }, h("input", { type: "date", className: inputCls, value: f.date, onChange: set("date") })),
        h(FormField, { label: "Starts", hint: game ? null : "Leave empty for all day" }, h("input", { type: "time", className: inputCls, value: f.startTime, onChange: set("startTime") })),
        h(FormField, { label: "Finishes" }, h("input", { type: "time", className: inputCls, value: f.endTime, onChange: set("endTime") }))
      ),
      h(FormField, { label: "Where" }, h("input", { className: inputCls, value: f.location, placeholder: VENUE, onChange: set("location") })),
      h(FormField, { label: "Notes" }, h("input", { className: inputCls, value: f.notes, placeholder: "Bring a plate", onChange: set("notes") })),
      err && h("p", { className: "text-sm text-[var(--bad)]" }, err),
      h("div", { className: "flex gap-2" },
        h(Button, { type: "submit", disabled: busy }, busy ? "Saving…" : item ? "Save" : "Add event"),
        h(Button, { type: "button", variant: "ghost", onClick: onCancel }, "Cancel"))
    );
  }

  // ---- One row in the month's list ------------------------------------------
  function ItemRow({ item, canEdit, busy, onAction, editing, setEditing }) {
    const [confirm, setConfirm] = React.useState(null); // "cancel" | "delete"
    const [reason, setReason] = React.useState("");
    const game = item.kind === "game";
    const pill = item.cancelled
      ? h("span", { className: "rounded-full bg-black/5 text-[var(--ink-soft)] text-[11px] font-bold uppercase tracking-wide px-2 py-0.5" }, "Cancelled")
      : game
      ? h("span", { className: "rounded-full bg-[var(--accent-10)] text-[var(--accent-dark)] text-[11px] font-bold uppercase tracking-wide px-2 py-0.5" }, "Game night")
      : h("span", { className: "rounded-full bg-[var(--warn-10)] text-[var(--accent2-dark)] text-[11px] font-bold uppercase tracking-wide px-2 py-0.5" }, "Event");
    if (editing) {
      return h("li", { className: "py-4" }, h(ItemForm, { item, busy, onCancel: () => setEditing(null), onSave: (b) => onAction(b).then((ok) => ok && setEditing(null)) }));
    }
    return h(
      "li",
      { className: "py-3 flex flex-col gap-2" },
      h("div", { className: "flex flex-wrap items-start gap-x-4 gap-y-1" },
        h("p", { className: "w-24 shrink-0 text-sm font-bold text-[var(--ink)]" }, dayLabel(item.date)),
        h("div", { className: "flex-1 min-w-[12rem]" },
          h("p", { className: "text-sm font-semibold text-[var(--ink)]" + (item.cancelled ? " line-through text-[var(--ink-soft)]" : "") }, item.title),
          h("p", { className: "text-xs text-[var(--ink-soft)]" }, [timeRange(item), item.location].filter(Boolean).join(" · ")),
          item.cancelled && item.cancelReason && h("p", { className: "text-xs font-semibold text-[var(--bad)]" }, item.cancelReason),
          item.notes && h("p", { className: "text-xs text-[var(--ink-soft)]" }, item.notes)),
        pill),
      canEdit && !confirm && h("div", { className: "flex flex-wrap gap-1.5 sm:pl-28" },
        h(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(item.id) }, "Edit"),
        item.cancelled
          ? h(Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => onAction({ action: "uncancel", id: item.id }) }, "Put back on")
          : h(Button, { size: "sm", variant: "ghost", onClick: () => setConfirm("cancel") }, game ? "Cancel night" : "Cancel event"),
        h(Button, { size: "sm", variant: "ghost", onClick: () => setConfirm("delete") }, "Remove")),
      canEdit && confirm === "cancel" && h("div", { className: "flex flex-wrap items-center gap-2 sm:pl-28" },
        h("input", { className: inputCls + " !w-64 !py-1.5 text-sm", value: reason, placeholder: "Reason, e.g. Pool closed", onChange: (e) => setReason(e.target.value) }),
        h(Button, { size: "sm", disabled: busy, onClick: () => onAction({ action: "cancel", id: item.id, reason }).then(() => setConfirm(null)) }, "Mark cancelled"),
        h(Button, { size: "sm", variant: "ghost", onClick: () => setConfirm(null) }, "Keep it")),
      canEdit && confirm === "delete" && h("div", { className: "flex flex-wrap items-center gap-2 sm:pl-28" },
        h("span", { className: "text-xs text-[var(--bad)]" }, "Remove it from the calendar completely? To show it's off, use Cancel instead."),
        h(Button, { size: "sm", disabled: busy, onClick: () => onAction({ action: "delete", id: item.id }).then(() => setConfirm(null)) }, "Remove"),
        h(Button, { size: "sm", variant: "ghost", onClick: () => setConfirm(null) }, "Keep it"))
    );
  }

  // ---- Page -----------------------------------------------------------------
  function CalendarPage() {
    const [data, setData] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [flash, setFlash] = React.useState(null);
    const [panel, setPanel] = React.useState(null); // "season" | "event"
    const [editing, setEditing] = React.useState(null);
    const now = new Date();
    const [ym, setYm] = React.useState({ y: now.getFullYear(), m: now.getMonth() });

    function load(from, to) {
      const q = from ? "?from=" + from + "&to=" + to : "";
      return fetchCal("/api/calendar" + q).then((d) => (d.ok ? setData(d) : setError(d.error || "Couldn't load the calendar"))).catch(() => setError("Couldn't load the calendar - check your connection."));
    }
    React.useEffect(() => { load(); }, []);

    const monthStart = isoOf(ym.y, ym.m, 1);
    const monthEnd = isoOf(ym.y, ym.m, new Date(ym.y, ym.m + 1, 0).getDate());
    React.useEffect(() => {
      // Moved outside what's loaded: fetch a year from this month.
      if (data && (monthStart < data.from || monthEnd > data.to)) load(isoOf(ym.y, ym.m, 1), isoOf(ym.y + 1, ym.m, 28));
      // eslint-disable-next-line
    }, [monthStart]);

    async function act(body) {
      setBusy(true); setFlash(null);
      try {
        const d = await fetchCal("/api/calendar?from=" + data.from + "&to=" + data.to, { method: "POST", body: JSON.stringify(body) });
        if (!d.ok) { setFlash({ bad: true, text: d.error || "Couldn't save" }); return false; }
        setData(d);
        setFlash({ text: d.message || "Saved" });
        return true;
      } catch (e) {
        setFlash({ bad: true, text: "Couldn't save - check your connection." });
        return false;
      } finally {
        setBusy(false);
      }
    }

    const items = data ? data.items : [];
    const today = (data && data.today) || isoOf(now.getFullYear(), now.getMonth(), now.getDate());
    const byDate = {};
    items.forEach((it) => { (byDate[it.date] = byDate[it.date] || []).push(it); });
    const monthItems = items.filter((it) => it.date >= monthStart && it.date <= monthEnd);

    // Gaps of more than two weeks between game nights read as a break, and
    // nothing after the last game as "to be announced".
    const games = items.filter((it) => it.kind === "game" && !it.cancelled).map((it) => it.date);
    const gaps = [];
    for (let i = 0; i + 1 < games.length; i++) if (daysBetween(games[i], games[i + 1]) > 14) gaps.push({ after: games[i], back: games[i + 1] });
    const lastGame = games[games.length - 1];
    if (lastGame && lastGame < monthEnd && daysBetween(lastGame, monthEnd) > 7) gaps.push({ after: lastGame, back: null });
    const monthGaps = gaps.filter((g) => g.after < monthEnd && (!g.back || g.back > monthStart));
    const inGap = (iso) => gaps.some((g) => iso > g.after && (!g.back || iso < g.back));

    // Monday-first month grid.
    const first = new Date(ym.y, ym.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(isoOf(ym.y, ym.m, d));
    const move = (n) => setYm((x) => { const d = new Date(x.y, x.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

    function cell(iso, i) {
      if (!iso) return h("div", { key: "x" + i });
      const its = byDate[iso] || [];
      const g = its.find((x) => x.kind === "game");
      const ev = its.find((x) => x.kind === "event" && !x.cancelled);
      const off = (g && g.cancelled) || (!g && new Date(iso + "T12:00:00").getDay() === 3 && inGap(iso));
      const cls = g && !g.cancelled ? "bg-[var(--accent)] text-white font-bold" : ev ? "bg-[var(--accent2)] text-white font-bold" : off ? "bg-black/5 text-[var(--ink-soft)] line-through" : "text-[var(--ink)]";
      return h("div", { key: iso, title: its.map((x) => x.title + (x.cancelled ? " (cancelled)" : "")).join(", ") || undefined,
        className: "relative rounded-lg py-2 text-center text-sm tabular-nums " + cls + (iso === today ? " ring-2 ring-[var(--navy)]" : "") },
        Number(iso.slice(8)),
        g && ev && !g.cancelled && h("span", { className: "absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--accent2)]" }));
    }

    const rows = monthItems.map((it) => ({ date: it.date, item: it }))
      .concat(monthGaps.map((g) => ({ date: g.after < monthStart ? monthStart : g.after, gap: g })))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gap ? 1 : -1));

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-3xl" },
      h(SectionHeading, { eyebrow: "Calendar", title: "Game nights and club events", sub: "Every game night and club event, month by month." }),
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      data && data.canEdit && h(
        "section",
        { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 mb-6" },
        h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
          h("div", null,
            h("p", { className: "font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Administrators"),
            h("p", { className: "font-display text-lg font-bold text-[var(--ink)]" }, panel === "season" ? "Set up season" : panel === "event" ? "Add event" : "Change the calendar")),
          h("div", { className: "flex gap-2" },
            h(Button, { size: "sm", variant: panel === "season" ? "dark" : "secondary", onClick: () => setPanel(panel === "season" ? null : "season") }, "Set up season"),
            h(Button, { size: "sm", variant: panel === "event" ? "dark" : "secondary", onClick: () => setPanel(panel === "event" ? null : "event") }, h(Icon, { name: "plus", size: 14 }), "Add event"))),
        panel && h("div", { className: "mt-4" },
          panel === "season"
            ? h(SeasonForm, { busy, onSave: (b) => act(b).then((ok) => ok && setPanel(null)) })
            : h(ItemForm, { busy, onCancel: () => setPanel(null), onSave: (b) => act(b).then((ok) => ok && setPanel(null)) })),
        !panel && h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, "Tap Edit, Cancel night or Remove on anything below. Cancelled nights stay on the calendar, crossed out, so members can see why.")
      ),
      flash && h("p", { className: "text-sm font-semibold mb-4 " + (flash.bad ? "text-[var(--bad)]" : "text-[var(--good-dark)]") }, flash.text),

      h(
        "section",
        { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 mb-8" },
        h("div", { className: "flex items-center justify-between gap-3 mb-3" },
          h("h2", { className: "font-display text-2xl font-bold text-[var(--ink)]" }, MONTHS[ym.m] + " " + ym.y),
          h("div", { className: "flex gap-1.5" },
            h(Button, { size: "sm", variant: "secondary", "aria-label": "Previous month", onClick: () => move(-1) }, h(Icon, { name: "chevronLeft", size: 16 })),
            h(Button, { size: "sm", variant: "secondary", onClick: () => setYm({ y: now.getFullYear(), m: now.getMonth() }) }, "Today"),
            h(Button, { size: "sm", variant: "secondary", "aria-label": "Next month", onClick: () => move(1) }, h(Icon, { name: "chevronRight", size: 16 })))),
        h("div", { className: "grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-1" },
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => h("div", { key: d }, d))),
        h("div", { className: "grid grid-cols-7 gap-1" }, cells.map(cell)),
        h("div", { className: "flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[var(--ink-soft)]" },
          h("span", { className: "flex items-center gap-1.5" }, h("span", { className: "w-3 h-3 rounded bg-[var(--accent)]" }), "Game night"),
          h("span", { className: "flex items-center gap-1.5" }, h("span", { className: "w-3 h-3 rounded bg-[var(--accent2)]" }), "Club event"),
          h("span", { className: "flex items-center gap-1.5" }, h("span", { className: "w-3 h-3 rounded bg-black/10" }), "No game")),

        !data
          ? h("p", { className: "text-sm text-[var(--ink-soft)] mt-5" }, error ? "" : "Loading…")
          : rows.length === 0
          ? h("p", { className: "text-sm text-[var(--ink-soft)] mt-5" }, "Nothing on the calendar this month.")
          : h("ul", { className: "mt-4 divide-y divide-black/5 border-t border-black/5" },
              rows.map((r) =>
                r.gap
                  ? h("li", { key: "gap" + r.gap.after, className: "py-3 flex flex-wrap items-start gap-x-4" },
                      h("p", { className: "w-24 shrink-0 text-sm font-bold text-[var(--ink-soft)]" }, "From " + dayLabel(r.gap.after, { day: "numeric", month: "short" })),
                      h("div", { className: "flex-1 min-w-[12rem]" },
                        h("p", { className: "text-sm font-semibold text-[var(--ink)]" }, "No games"),
                        h("p", { className: "text-xs text-[var(--ink-soft)]" }, r.gap.back ? "Back " + dayLabel(r.gap.back, { weekday: "long", day: "numeric", month: "long" }) + "." : "First game back to be announced.")))
                  : h(ItemRow, { key: r.item.id, item: r.item, canEdit: data.canEdit, busy, onAction: act, editing: editing === r.item.id, setEditing })
              ))
      ),

      h(PhoneCard)
    );
  }

  GUWH.Pages.Calendar = CalendarPage;
})();
