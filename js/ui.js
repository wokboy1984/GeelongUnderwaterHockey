// ---------------------------------------------------------------------------
// GUWH concept — shared UI components (React.createElement, no JSX/build step)
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};

(function () {
  const ICON_PATHS = {
    droplet: "M12 2.69s5.5 6.11 5.5 10.06A5.5 5.5 0 0 1 12 18.25a5.5 5.5 0 0 1-5.5-5.5C6.5 8.8 12 2.69 12 2.69Z",
    calendar: "M8 2v3M16 2v3M3.5 8.5h17M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z",
    users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3 3 0 0 0-2.5-2.96M14.5 4.6a3 3 0 0 1 0 5.8",
    share: "M7.5 12.5 16 8M7.5 11.5 16 16M7 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18.5 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18.5 21.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    check: "M4 12.5 9.5 18 20 6",
    x: "M6 6l12 12M18 6 6 18",
    chevronRight: "m9 5 7 7-7 7",
    mapPin: "M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    clock: "M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z",
    trophy: "M8 4h8v4a4 4 0 0 1-8 0V4ZM5 5h3v2a3 3 0 0 1-3 3 2 2 0 0 1-2-2 3 3 0 0 1 2-3ZM19 5h-3v2a3 3 0 0 0 3 3 2 2 0 0 0 2-2 3 3 0 0 0-2-3ZM10 13.5v2.5M14 13.5v2.5M8.5 20.5h7M9.5 16h5l.5 4.5h-6l.5-4.5Z",
    plus: "M12 5v14M5 12h14",
    menu: "M4 7h16M4 12h16M4 17h16",
    arrowRight: "M5 12h14M13 6l6 6-6 6",
    heart: "M12 20.5s-7.5-4.6-9.8-9.4C.7 7.6 2.3 4 6 4c2.1 0 3.6 1.2 4.4 2.4C11.2 5.2 12.7 4 14.8 4c3.7 0 5.3 3.6 3.8 7.1-2.3 4.8-9.8 9.4-9.8 9.4Z",
    shield: "M12 3l7 3v6c0 4.7-3 8.4-7 9.5-4-1.1-7-4.8-7-9.5V6l7-3Z",
    grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
    edit: "M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z",
  };

  function Icon({ name, size = 20, className = "" }) {
    const d = ICON_PATHS[name];
    if (!d) return null;
    return h(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": "true" },
      h("path", { d })
    );
  }

  function Container({ className = "", children }) {
    return h("div", { className: cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className) }, children);
  }

  function Button({ variant = "primary", size = "md", className = "", children, ...props }) {
    const base = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed";
    const sizes = { sm: "px-4 py-2 text-sm", md: "px-5 py-3 text-[15px]", lg: "px-7 py-4 text-base" };
    const variants = {
      primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] shadow-sm",
      secondary: "bg-white text-[var(--ink)] border-2 border-[var(--ink-15)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
      ghost: "text-[var(--ink)] hover:bg-black/5",
      dark: "bg-[var(--ink)] text-white hover:bg-[var(--navy-2)]",
      danger: "bg-white text-[var(--bad)] border-2 border-[var(--bad-30)] hover:bg-[var(--bad-05)]",
      cta: "bg-[var(--accent2)] text-white hover:bg-[var(--accent2-dark)] shadow-sm",
    };
    return h("button", Object.assign({ className: cx(base, sizes[size], variants[variant], className) }, props), children);
  }

  function Pill({ tone = "accent", children, className = "" }) {
    const tones = {
      accent: "bg-[var(--accent-12)] text-[var(--accent-dark)]",
      good: "bg-[var(--good-15)] text-[var(--good-dark)]",
      warn: "bg-[var(--warn-18)] text-[var(--warn-dark)]",
      dark: "bg-[var(--ink-08)] text-[var(--ink)]",
      white: "bg-white/15 text-white",
      orange: "bg-[var(--accent2-12)] text-[var(--accent2-dark)]",
    };
    return h("span", { className: cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide", tones[tone], className) }, children);
  }

  function SectionHeading({ eyebrow, title, sub, align = "left" }) {
    return h(
      "div",
      { className: cx("max-w-2xl mb-8", align === "center" && "mx-auto text-center") },
      eyebrow && h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)] mb-2" }, eyebrow),
      h("h2", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] text-balance" }, title),
      sub && h("p", { className: "mt-3 text-[var(--ink-soft)] text-[15px] leading-relaxed" }, sub)
    );
  }

  function Avatar({ playerId, name, size = 40 }) {
    const emoji = playerPhotoEmoji(playerId);
    return h(
      "div",
      {
        className: "flex items-center justify-center rounded-full bg-[var(--accent-15)] text-[var(--accent-dark)] shrink-0 ring-2 ring-white",
        style: { width: size, height: size, fontSize: size * 0.5 },
        title: name,
        "aria-hidden": "true",
      },
      emoji
    );
  }

  // Real-member equivalent of Avatar (which only ever draws a demo emoji).
  // Fetches a member's uploaded photo through the authenticated endpoint (a
  // plain <img src> can't carry the login token) and shows it as a circle,
  // or a generic placeholder if there isn't one yet. Shared by the Profile
  // page and the Dashboard's profile summary card.
  function MemberPhoto({ memberId, version, size }) {
    const [url, setUrl] = React.useState(null);
    const dim = size || 88;

    React.useEffect(() => {
      let objectUrl = null;
      let cancelled = false;
      setUrl(null);
      if (!memberId || !version) return undefined;
      GUWH.Identity.authFetch("/api/profile-photo?memberId=" + encodeURIComponent(memberId) + "&v=" + version)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [memberId, version]);

    if (url) {
      return h("img", { src: url, className: "rounded-full object-cover", style: { width: dim, height: dim } });
    }
    return h(
      "div",
      { className: "rounded-full bg-[var(--sand)] flex items-center justify-center text-[var(--ink-soft)]", style: { width: dim, height: dim } },
      h(Icon, { name: "users", size: Math.round(dim / 2.5) })
    );
  }

  function PlayerChip({ player, showTeamLast = false }) {
    if (!player) return null;
    return h(
      "div",
      { className: "flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-black/5" },
      h(Avatar, { playerId: player.id, name: player.firstName, size: 34 }),
      h(
        "div",
        { className: "min-w-0" },
        h("p", { className: "text-sm font-semibold text-[var(--ink)] truncate" }, initials(player.firstName, player.lastName)),
        h("p", { className: "text-[11px] text-[var(--ink-soft)] font-mono" }, player.position, player.isNew && h("span", { className: "ml-1 text-[var(--accent-dark)]" }, "· new"))
      )
    );
  }

  function MilestoneCard({ icon, value, label, tone = "light" }) {
    const dark = tone === "dark";
    return h(
      "div",
      { className: cx("rounded-2xl p-5 flex flex-col gap-1", dark ? "bg-white/10 text-white" : "bg-white ring-1 ring-black/5") },
      h("div", { className: cx("mb-1", dark ? "text-[var(--accent-light)]" : "text-[var(--accent)]") }, h(Icon, { name: icon, size: 22 })),
      h("p", { className: "font-display text-3xl font-bold tabular-nums" }, value),
      h("p", { className: cx("text-xs font-mono uppercase tracking-wide", dark ? "text-white/70" : "text-[var(--ink-soft)]") }, label)
    );
  }

  function AttendanceCounter({ confirmed, teams }) {
    return h(
      "div",
      { className: "flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5" },
      h(
        "div",
        { className: "flex items-center gap-2" },
        h("span", { className: "font-display text-3xl font-bold text-[var(--accent-dark)] tabular-nums" }, confirmed),
        h("span", { className: "text-sm text-[var(--ink-soft)]" }, "players in")
      ),
      h("div", { className: "h-8 w-px bg-black/10 hidden sm:block" }),
      h(
        "div",
        { className: "flex items-center gap-2" },
        h("span", { className: "font-display text-3xl font-bold text-[var(--ink)] tabular-nums" }, teams),
        h("span", { className: "text-sm text-[var(--ink-soft)]" }, "teams across 2 pools")
      )
    );
  }

  function EventCard({ compact = false }) {
    const wed = GUWH.nextWednesday();
    const confirmed = GUWH.Store.confirmedPlayerIds().length;
    return h(
      "div",
      { className: "rounded-3xl bg-white p-6 sm:p-7 ring-1 ring-black/5 shadow-sm" },
      h(Pill, { tone: "accent" }, h(Icon, { name: "calendar", size: 14 }), "Next session"),
      h("h3", { className: "font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] mt-3" }, GUWH.formatDate(wed)),
      h(
        "div",
        { className: "mt-3 flex flex-col gap-1.5 text-[var(--ink-soft)] text-sm" },
        h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "clock", size: 16 }), GUWH.club.sessionTime),
        h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "mapPin", size: 16 }), GUWH.club.venue + ", " + GUWH.club.venueAddress)
      ),
      !compact &&
        h(
          "div",
          { className: "mt-5" },
          h(AttendanceCounter, { confirmed, teams: 4 })
        )
    );
  }

  function TeamColumn({ title, capColour, playerIds, teamName }) {
    const players = playerIds.map((id) => GUWH.Store.findPlayer(id)).filter(Boolean);
    const capStyle = capColour === "White" ? "bg-white text-[var(--ink)] ring-1 ring-black/10" : "bg-[var(--ink)] text-white";
    return h(
      "div",
      { className: "flex-1 min-w-[220px]" },
      h(
        "div",
        { className: "mb-3" },
        h(
          "div",
          { className: cx("flex items-center gap-2 rounded-full px-3 py-1.5 w-fit text-xs font-bold uppercase tracking-wide", capStyle) },
          h("span", { className: cx("h-2.5 w-2.5 rounded-full", capColour === "White" ? "bg-[var(--ink-20)] ring-1 ring-[var(--ink-30)]" : "bg-white") }),
          teamName || capColour + " caps"
        ),
        teamName && h("p", { className: "mt-1 text-[11px] font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, capColour + " caps")
      ),
      h(
        "div",
        { className: "flex flex-col gap-2" },
        players.length ? players.map((p) => h(PlayerChip, { key: p.id, player: p })) : h("p", { className: "text-sm text-[var(--ink-soft)] italic" }, "No players assigned yet")
      )
    );
  }

  function TeamBoard({ pool }) {
    const board = GUWH.Store.getState().gameBoard;
    const data = board.pools[pool];
    return h(
      "div",
      { className: "rounded-3xl bg-[var(--sand)] p-5 sm:p-6 ring-1 ring-black/5" },
      h(
        "div",
        { className: "flex items-center justify-between mb-4" },
        h("h4", { className: "font-display text-xl font-bold text-[var(--ink)]" }, pool),
        h(Pill, { tone: "dark" }, h(Icon, { name: "clock", size: 12 }), data.matchTime)
      ),
      h(
        "div",
        { className: "flex flex-col sm:flex-row gap-5" },
        h(TeamColumn, { title: pool + " White", capColour: "White", playerIds: data.white, teamName: GUWH.teamNameFor(pool, "White") }),
        h(TeamColumn, { title: pool + " Black", capColour: "Black", playerIds: data.black, teamName: GUWH.teamNameFor(pool, "Black") })
      )
    );
  }

  function ScheduleList({ items, editable = false, onChangeTime }) {
    return h(
      "ol",
      { className: "relative flex flex-col gap-0" },
      items.map((s, i) =>
        h(
          "li",
          { key: i, className: "flex items-start gap-4 py-2.5 border-b border-black/5 last:border-0" },
          h("span", { className: "font-mono text-sm font-bold text-[var(--accent-dark)] w-16 shrink-0 tabular-nums" }, s.time),
          h("span", { className: "text-sm text-[var(--ink)]" }, s.label),
          editable &&
            h(Button, {
              variant: "ghost",
              size: "sm",
              className: "ml-auto !px-2 !py-1",
              onClick: () => onChangeTime && onChangeTime(i),
              "aria-label": "Edit time for " + s.label,
            }, h(Icon, { name: "edit", size: 14 }))
        )
      )
    );
  }

  function ShareCard({ eyebrow, headline, stat, statLabel, footer }) {
    return h(
      "div",
      { className: "rounded-3xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-2)] text-white p-8 text-center flex flex-col items-center gap-2 aspect-[4/5] sm:aspect-video justify-center" },
      h(Pill, { tone: "white" }, eyebrow),
      h("p", { className: "font-display text-4xl sm:text-5xl font-bold mt-3 text-balance" }, headline),
      stat && h("p", { className: "font-display text-6xl sm:text-7xl font-bold text-[var(--accent-light)] mt-2 tabular-nums" }, stat),
      statLabel && h("p", { className: "text-white/70 text-sm font-mono uppercase tracking-wide" }, statLabel),
      footer && h("p", { className: "mt-4 text-white/80 text-sm" }, footer)
    );
  }

  function FormField({ label, children, hint, required }) {
    return h(
      "label",
      { className: "flex flex-col gap-1.5" },
      h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, label, required && h("span", { className: "text-[var(--bad)]" }, " *")),
      children,
      hint && h("span", { className: "text-xs text-[var(--ink-soft)]" }, hint)
    );
  }

  const inputCls =
    "w-full rounded-xl border-2 border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-soft-70)] focus:border-[var(--accent)] focus:outline-none transition";

  GUWH.UI = {
    Icon, Container, Button, Pill, SectionHeading, Avatar, PlayerChip, MemberPhoto,
    MilestoneCard, AttendanceCounter, EventCard, TeamBoard, ScheduleList,
    ShareCard, FormField, inputCls,
  };
})();
