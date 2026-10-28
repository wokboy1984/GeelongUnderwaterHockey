// ---------------------------------------------------------------------------
// GUWH concept — Member dashboard
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, MilestoneCard, AttendanceCounter, MemberPhoto } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const FINANCE_KIND_LABEL = { game: "Game attendance", joining: "Joining fee", annual: "Yearly membership", payment: "Payment received" };
  function money(cents) {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((Number(cents) || 0) / 100);
  }

  // Photo, name, grade, position at a glance — a link through to the full
  // Profile page rather than a second place to edit any of it.
  function ProfileSummaryCard({ profile, compact }) {
    return h(
      "button",
      {
        onClick: () => navigate("/portal/profile"),
        className: "w-full rounded-2xl bg-white ring-1 ring-black/5 p-4 flex items-center gap-3 text-left hover:ring-[var(--accent)] transition",
      },
      h(MemberPhoto, { memberId: profile.id, version: profile.photoVersion, size: compact ? 40 : 52 }),
      h(
        "div",
        { className: "flex-1 min-w-0" },
        h("p", { className: "font-display font-bold text-[var(--ink)] truncate" }, GUWH.displayName(profile)),
        h("p", { className: "text-xs text-[var(--ink-soft)]" }, (profile.grade || "Grade not set") + " · " + profile.position),
        // Games played stays visible but small — it's real (counted from
        // attendance history), just not important enough to be a big stat.
        typeof profile.gamesPlayed === "number" && profile.gamesPlayed > 0 &&
          h("p", { className: "text-[11px] text-[var(--ink-soft)] mt-0.5" }, profile.gamesPlayed + (profile.gamesPlayed === 1 ? " game played" : " games played"))
      ),
      h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)] shrink-0" })
    );
  }

  function bookingWindow(wed) {
    const opensAt = new Date(wed);
    opensAt.setDate(opensAt.getDate() - 7);
    const closesAt = new Date(wed);
    closesAt.setHours(16, 0, 0, 0); // 4:00pm Wednesday
    const now = new Date();
    return {
      opensAt, closesAt,
      isOpen: now >= opensAt && now < closesAt,
      isPastClose: now >= closesAt,
      isFuture: now < opensAt,
    };
  }

  // ---- Teams + timetable live on their own page again (/portal/board,
  // "This Week's Game") — this is just a link card through to it, not an
  // embedded copy (13 Sept 2026, Cheongy's request: put Teams/Timetable
  // back on their own Members Portal page rather than folded into here).

  // What someone is coming for (20 Oct 2026). Not everyone who turns up is
  // playing: some lane swim, some come to help and may referee. The fee
  // differs, so this has to be the member's own answer rather than
  // something the coordinator guesses on the night.
  //
  // The price is on the button because that's the question people actually
  // have, and it stops a swimmer being surprised by a $20 game fee.
  const ATTENDANCE_KINDS = [
    { value: "player", label: "Playing", hint: "Game fee" },
    { value: "swim", label: "Lane swim", hint: "$10" },
    { value: "volunteer", label: "Volunteering", hint: "Free" },
  ];

  function KindButton({ label, hint, active, disabled, onClick }) {
    return h(
      "button",
      {
        type: "button",
        "aria-pressed": active ? "true" : "false",
        disabled: disabled,
        onClick: onClick,
        className: cx(
          "rounded-full px-3.5 py-1.5 text-sm transition inline-flex items-center gap-1.5",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          active ? "bg-white text-[var(--navy)] font-bold" : "bg-white/10 text-white hover:bg-white/20"
        ),
      },
      active && h(Icon, { name: "check", size: 14 }),
      label,
      hint && h("span", { className: active ? "font-normal text-[var(--navy)]/60" : "text-white/50" }, hint)
    );
  }

  // One of the two attendance answers (20 Oct 2026). Both are always on
  // screen; this marks whichever one is currently yours rather than hiding
  // the other, so the card shows your answer and the way to change it in
  // the same place.
  //
  // The active state is never colour alone — it carries a tick and an
  // aria-pressed flag, so it reads the same to a screen reader and on a
  // washed-out phone screen in sunlight.
  function AnswerButton({ label, icon, active, disabled, onClick }) {
    return h(
      "button",
      {
        type: "button",
        "aria-pressed": active ? "true" : "false",
        disabled: disabled,
        onClick: onClick,
        className: cx(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition px-5 py-3 text-[15px]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          active
            ? "bg-white text-[var(--navy)] shadow-sm"
            : "bg-transparent text-white border-2 border-white/30 hover:border-white/60"
        ),
      },
      active ? h(Icon, { name: "check", size: 18 }) : icon ? h(Icon, { name: icon, size: 18 }) : null,
      label
    );
  }

  // "Your team this week" on the Dashboard (20 Oct 2026). Reads the board
  // the page already loaded — no extra request — and leans on the shared
  // MyTeamSummary so Profile and This Week's Game say the same thing.
  function MyTeamCard({ board, memberId }) {
    const team = myTeamFor(board, memberId);
    const devTeam = myDevTeamFor(board, memberId);
    const colours = myGameColours(board, [devTeam, team]);
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-4 flex flex-col gap-3" },
      h(
        "div",
        { className: "flex items-baseline justify-between gap-3 flex-wrap" },
        h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Your team this week"),
        !board.published &&
          h(
            "span",
            { className: "rounded-full bg-[var(--bad)] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5" },
            "Draft"
          )
      ),
      h(GUWH.UI.MyTeamSummary, { team, devTeam, colours, memberId }),
      // Spelled out immediately above the link through to the board, where
      // a member is about to act on what they've just read. The pill up top
      // is easy to skim past; this sentence is the one that lands.
      !board.published &&
        h(
          "p",
          { className: "text-sm font-semibold text-[var(--bad)]" },
          "This is a draft timetable only — the full timetable will be published shortly."
        ),
      h(
        "button",
        { onClick: () => navigate("/portal/board"), className: "text-xs font-semibold text-[var(--accent-dark)] text-left hover:underline" },
        "See the full timetable →"
      )
    );
  }

  // One sentence about the state of the week's board, used in both places
  // the Dashboard mentions it. Members see drafts now (20 Oct 2026), so
  // "not published yet" is only true when nothing has been built at all.
  function boardBlurb(board) {
    if (!board || !board.hasDraft) return "Teams and timetable not started yet.";
    if (!board.published) return "Draft teams and timetable are up — not final, but you can see where you're headed.";
    return "Teams and timetable are published — see pools, teams and cap colours.";
  }

  function ThisWeeksGameCard({ board }) {
    return h(
      "button",
      { onClick: () => navigate("/portal/board"), className: "w-full rounded-2xl bg-white ring-1 ring-black/5 p-4 text-left hover:ring-[var(--accent)] transition flex items-center justify-between" },
      h(
        "div",
        null,
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, "This Week's Game"),
        h("p", { className: "text-sm text-[var(--ink-soft)]" }, boardBlurb(board))
      ),
      h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)] shrink-0" })
    );
  }

  // ---- Bring a Mate: its own box directly on the dashboard, not a popup
  // (13 Sept 2026, Cheongy's request) — same compact form used before in
  // the modal, just rendered inline now. The standalone /portal/bring-a-mate
  // page and its own layout are still completely untouched.
  // Bring a Mate as a single button (2 Oct 2026, Cheongy's request) — sits
  // in the right column next to Who's Coming and opens the full Bring a
  // Mate page (invite form + WhatsApp/Messenger/Text share buttons).
  function BringAMateButton() {
    return h(
      "button",
      {
        onClick: () => navigate("/portal/bring-a-mate"),
        className: "w-full rounded-2xl bg-[var(--accent-12)] p-4 text-left hover:ring-2 hover:ring-[var(--accent)] transition flex items-center justify-between gap-3",
      },
      h(
        "div",
        null,
        h("p", { className: "font-display font-bold text-[var(--accent-dark)]" }, "Bring a Mate"),
        h("p", { className: "text-xs text-[var(--ink-70)] mt-0.5" }, "Their first three sessions are free. Invite or share in one tap.")
      ),
      h("span", { className: "h-10 w-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0" }, h(Icon, { name: "share", size: 18 }))
    );
  }

  // Inline form version — no longer on the dashboard (replaced by
  // BringAMateButton above), kept in case it's wanted back.
  function BringAMateCard() {
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--accent-12)] p-4" },
      h("p", { className: "font-display font-bold text-[var(--accent-dark)] mb-1" }, "Bring a Mate"),
      h("p", { className: "text-xs text-[var(--ink-70)] mb-3" }, "They'll show up for organisers as a guest — not counted in the confirmed number above."),
      GUWH.Pages.BringAMateForm && h(GUWH.Pages.BringAMateForm, {})
    );
  }

  // ---- Finance summary — real data only, via GET /api/finance?self=1 ----
  function FinanceCard({ finance }) {
    if (!finance || finance.hasAccount === false) return null;
    const owesNothing = finance.closing <= 0;
    const monthEntries = (finance.entries || []).filter((e) => String(e.entryDate || e.entry_date || "").slice(0, 7) === finance.month);
    const gameCharges = monthEntries.filter((e) => e.kind === "game").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);
    const otherCharges = monthEntries.filter((e) => e.kind !== "game" && e.kind !== "payment").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);
    const paidThisMonth = monthEntries.filter((e) => e.kind === "payment").reduce((s, e) => s + Number(e.amount_cents ?? e.amountCents ?? e.amount ?? 0), 0);

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h("p", { className: "font-display font-bold text-[var(--ink)] mb-1" }, "Finance"),
      owesNothing
        ? h("p", { className: "text-sm text-[var(--good-dark)] font-semibold flex items-center gap-1.5" }, h(Icon, { name: "check", size: 14 }), "You're all up to date")
        : h(
            "div",
            null,
            h("p", { className: "font-display text-2xl font-bold text-[var(--ink)] tabular-nums" }, money(finance.closing), h("span", { className: "text-xs font-normal text-[var(--ink-soft)] ml-1" }, "total outstanding")),
            h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, "This month: " + money(finance.charges - finance.payments))
          ),
      (gameCharges > 0 || otherCharges > 0 || paidThisMonth > 0 || finance.opening > 0) &&
        h(
          "div",
          { className: "mt-3 pt-3 border-t border-black/5 flex flex-col gap-1 text-xs text-[var(--ink-soft)]" },
          finance.opening > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Previous unpaid balance"), h("span", { className: "tabular-nums" }, money(finance.opening))),
          gameCharges > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Monthly playing fees"), h("span", { className: "tabular-nums" }, money(gameCharges))),
          otherCharges > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Other recorded charges"), h("span", { className: "tabular-nums" }, money(otherCharges))),
          paidThisMonth > 0 && h("div", { className: "flex justify-between" }, h("span", null, "Payments received"), h("span", { className: "tabular-nums" }, "−" + money(paidThisMonth)))
        ),
      h("p", { className: "text-xs text-[var(--ink-soft)] mt-3" }, "A quick summary to help you keep track."),
      // The full Finance workspace is Treasurer/Administrator-only — only
      // show the link to someone who can actually open it.
      GUWH.Identity.currentRoles().some((r) => r === "treasurer" || r === "administrator") &&
        h("button", { onClick: () => navigate("/finance"), className: "text-xs text-[var(--accent-dark)] font-semibold underline mt-2" }, "View Finance")
    );
  }

  // ---- Forum: announcement + latest discussions, split from the old
  // single widget. Renders nothing at all for a junior, a member without a
  // DOB on file, or an adult who hasn't opted in — never a locked/teaser
  // version for anyone else.
  function AnnouncementCard({ announcement }) {
    if (!announcement) return null;
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--accent-12)] p-4" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)] mb-1" }, "Club announcement"),
      h(
        "button",
        { onClick: () => navigate("/portal/forum/topic/" + announcement.id), className: "text-left block w-full" },
        h("p", { className: "text-sm font-bold text-[var(--ink)]" }, announcement.title),
        announcement.openingSummary && h("p", { className: "text-xs text-[var(--ink-soft)] mt-1 line-clamp-2" }, announcement.openingSummary),
        h("p", { className: "text-[11px] text-[var(--ink-soft)] mt-1.5" }, announcement.authorDisplay + " · " + GUWH.formatRelativeTime(announcement.lastActivityAt))
      )
    );
  }

  // Finish your profile (12 Oct 2026, pre-launch member review): shown at
  // the top of the Dashboard until the member has an emergency contact
  // and date of birth on file. The waiver is signed in person for now, so
  // this is the only place the site collects an emergency contact; date
  // of birth is also what unlocks the adults-only Members Forum.
  function FinishProfileCard({ profile }) {
    if (!profile) return null;
    const missing = [];
    if (!profile.emergencyName || !profile.emergencyPhone) missing.push("an emergency contact");
    if (!profile.dateOfBirth) missing.push("your date of birth");
    if (missing.length === 0) return null;
    return h(
      "div",
      { className: "rounded-2xl bg-[var(--warn-10)] ring-1 ring-black/5 p-4 mb-6 flex flex-wrap items-center justify-between gap-3" },
      h(
        "div",
        { className: "min-w-0" },
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, "Finish your profile"),
        h("p", { className: "text-sm text-[var(--ink-soft)] mt-0.5" }, "Add " + missing.join(" and ") + ". We need an emergency contact for everyone in the pool.")
      ),
      h(Button, { size: "sm", onClick: () => navigate("/portal/profile") }, "Finish profile", h(Icon, { name: "chevronRight", size: 14 }))
    );
  }

  // Getting started (12 Oct 2026, Cheongy: onramping for new members -
  // "Members clicking 'I'm coming' before Wednesday @ 12pm, then taking
  // them through the features, the profile, emergency contact, positions,
  // the timetable, the forum"). A checklist at the top of the Dashboard for
  // members with fewer than 3 games played. Ticks come from real data
  // (booking, profile, invites, forum opt-in); the "have a look" steps are
  // ticked when the member opens them (members.onboarding_seen, saved via
  // POST /api/profile { action: "onboarding" }). Can't be hidden until the
  // emergency contact + date of birth are in. Members with 3+ games only
  // see the Finish your profile prompt, and only if those are missing.
  const FIRST_NIGHT = [
    "Games start at 6pm on Wednesday at the Handbury Centre for Wellbeing, Corio. Get there a bit early on your first night so we can fit your gear.",
    "Bring bathers, a towel and a water bottle (and a mouthguard if you have one). We lend you fins, mask, snorkel, glove and stick.",
    "The coordinator splits everyone into teams. Games are short and you rotate on and off - nobody expects you to know the rules yet.",
    "Your first three sessions are free. After that there's a game fee each night you play - what you owe shows on your Dashboard.",
  ];

  function GettingStartedCard({ profile, status, invites, forumMe, onBook, booking, onProfile }) {
    const [guideOpen, setGuideOpen] = React.useState(false);
    if (!profile) return null;
    if ((profile.gamesPlayed || 0) >= 3) return h(FinishProfileCard, { profile });
    const seen = profile.onboardingSeen || [];
    const hasProfile = !!(profile.emergencyName && profile.emergencyPhone && profile.dateOfBirth);
    // The step is "tell the club either way", not "say yes" (20 Oct 2026).
    // Answering "I'm Not Coming" is using the feature exactly as intended,
    // so it ticks the box. Nagging someone who has already replied just
    // teaches them to ignore the checklist.
    const answered = !!((status && status.myStatus) || (profile.gamesPlayed || 0) > 0);
    const forumOk = !!(forumMe && forumMe.eligible);

    function post(body) {
      return GUWH.Identity.authFetch("/api/profile", { method: "POST", body: JSON.stringify(Object.assign({ action: "onboarding" }, body)) })
        .then((r) => r.json()).then((d) => { if (d.ok && d.member && onProfile) onProfile(d.member); }).catch(() => {});
    }
    function mark(key, go) { post({ seen: key }); navigate(go); }
    function openGuide() { setGuideOpen((v) => !v); if (!seen.includes("guide")) post({ seen: "guide" }); }
    function hide() { post({ hide: true }); if (onProfile) onProfile(Object.assign({}, profile, { onboardingHidden: true })); }

    const steps = [
      {
        label: "Let the club know if you're playing",
        hint: "Tap I'm Coming or I'm Not Coming, ideally by 5pm Wednesday. Either answer helps — it's how the coordinator knows who to put in a team.",
        done: answered,
        button: !answered && status ? h(Button, { size: "sm", className: "shrink-0", disabled: booking, onClick: onBook }, "I'm Coming") : null,
      },
      {
        label: "Add your date of birth and an emergency contact",
        hint: "Everyone in the pool needs an emergency contact on file.",
        done: hasProfile, action: "Finish profile", go: "/portal/profile",
      },
      {
        label: "Pick your position",
        hint: "Forward, Wing, Centre, Back or Full Back. Not sure yet? Ask on the night and change it later.",
        done: !!(profile.position && profile.position !== "Unknown"), action: "Choose", go: "/portal/profile",
      },
      {
        label: "Add a photo", optional: true,
        hint: "So the team knows who you are on the night.",
        done: (profile.photoVersion || 0) > 0, action: "Add photo", go: "/portal/profile",
      },
      {
        label: "How a night works",
        hint: "What to bring, what we lend you and how the games run.",
        done: seen.includes("guide"), guide: true, alwaysButton: true,
        button: h(Button, { size: "sm", variant: "secondary", className: "shrink-0", onClick: openGuide }, guideOpen ? "Close" : "Read"),
      },
      {
        label: "Check This Week's Game",
        hint: "Teams and the timetable go up here once the coordinator publishes them, usually Wednesday afternoon.",
        done: seen.includes("board"), action: "Have a look", seenKey: "board", go: "/portal/board",
      },
      forumOk && {
        label: "Join the Members Forum",
        hint: "Club announcements, carpools, gear and chat.",
        done: !!(forumMe.participation && forumMe.participation.optedIn) || seen.includes("forum"), action: "Open forum", seenKey: "forum", go: "/portal/forum",
      },
      {
        label: "Bring a mate", optional: true,
        hint: "Their first three sessions are free too.",
        done: !!(invites && invites.length), action: "Invite", go: "/portal/bring-a-mate",
      },
    ].filter(Boolean);

    const doneCount = steps.filter((st) => st.done).length;
    if (doneCount === steps.length && !guideOpen) return null;
    if (profile.onboardingHidden && hasProfile) return null;
    const firstOpen = steps.findIndex((st) => !st.done);
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 sm:p-5 mb-6" },
      h(
        "div",
        { className: "flex items-start justify-between gap-3" },
        h(
          "div",
          null,
          h("p", { className: "font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, GUWH.justJoined ? "Welcome to the club" : "Getting started"),
          h("p", { className: "font-display text-xl font-bold text-[var(--ink)] mt-0.5" }, doneCount + " of " + steps.length + " done"),
          GUWH.justJoined && h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, "Your account is set up. Work down this list and you're ready for Wednesday.")
        ),
        hasProfile && h(Button, { variant: "ghost", size: "sm", onClick: hide }, "Hide")
      ),
      h(
        "div",
        { className: "h-1.5 rounded-full bg-[var(--sand)] mt-3 overflow-hidden" },
        h("div", { className: "h-full bg-[var(--accent)] rounded-full transition-all", style: { width: Math.round((doneCount / steps.length) * 100) + "%" } })
      ),
      h(
        "ul",
        { className: "mt-3 divide-y divide-black/5" },
        steps.map((st, i) =>
          h(
            "li",
            { key: st.label, className: "py-2.5" },
            h(
            "div",
            { className: "flex items-center gap-3" },
            h(
              "span",
              { className: cx("w-6 h-6 rounded-full flex items-center justify-center shrink-0", st.done ? "bg-[var(--accent)] text-white" : "ring-2 ring-black/10 text-[var(--ink-soft)] text-xs font-bold") },
              st.done ? h(Icon, { name: "check", size: 14 }) : String(i + 1)
            ),
            h(
              "div",
              { className: "flex-1 min-w-0" },
              h("p", { className: cx("text-sm font-semibold", st.done ? "text-[var(--ink-soft)] line-through" : "text-[var(--ink)]") }, st.label, st.optional && !st.done && h("span", { className: "font-normal text-[var(--ink-soft)]" }, " (optional)")),
              !st.done && st.hint && h("p", { className: "text-xs text-[var(--ink-soft)] mt-0.5" }, st.hint)
            ),
            (!st.done || st.alwaysButton) && (st.button ||
              (st.action && h(Button, { size: "sm", variant: i === firstOpen ? "primary" : "secondary", className: "shrink-0", onClick: () => (st.seenKey ? mark(st.seenKey, st.go) : navigate(st.go)) }, st.action)))
            ),
            st.guide && guideOpen && h(
              "ul",
              { className: "mt-3 ml-9 rounded-xl bg-[var(--sand)] p-3 space-y-2" },
              FIRST_NIGHT.map((t, k) => h("li", { key: k, className: "text-sm text-[var(--ink)] flex gap-2" }, h("span", { className: "text-[var(--accent-dark)] font-bold" }, "•"), h("span", null, t)))
            )
          )
        )
      )
    );
  }

  function DiscussionsCard({ topics, unreadCount, loaded }) {
    const rest = topics.slice(0, 3);
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h(
        "div",
        { className: "flex items-center justify-between mb-2" },
        h("p", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, "Latest discussions", unreadCount > 0 && h(Pill, { tone: "accent", className: "!py-0 !px-1.5" }, unreadCount)),
        h("button", { onClick: () => navigate("/portal/forum"), className: "text-xs text-[var(--accent-dark)] font-semibold underline" }, "Open Forum")
      ),
      // "Loading…" until the topics request has come back (12 Oct 2026) —
      // it used to flash "No recent discussions yet" for a second first.
      !loaded
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
        : rest.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No recent discussions yet.")
        : h(
            "div",
            { className: "flex flex-col divide-y divide-black/5" },
            rest.map((t) =>
              h(
                "button",
                { key: t.id, onClick: () => navigate("/portal/forum/topic/" + t.id), className: "text-left py-2 hover:opacity-70" },
                h("p", { className: "text-sm text-[var(--ink)]" }, t.title),
                h(
                  "p",
                  { className: "text-xs text-[var(--ink-soft)]" },
                  // "Last reply by" (2 Oct 2026): lastActivityBy is whoever posted
                  // last, which read as the topic's author. Now labelled.
                  t.categoryName + " · " +
                    (t.replyCount
                      ? "Started by " + t.authorDisplay + " · last reply " + t.lastActivityBy + " " + GUWH.formatRelativeTime(t.lastActivityAt) + " · " + t.replyCount + (t.replyCount === 1 ? " reply" : " replies")
                      : "Posted by " + t.authorDisplay + " · " + GUWH.formatRelativeTime(t.lastActivityAt))
                )
              )
            )
          )
    );
  }

  // ---- A nudge, not a deadline (20 Oct 2026). The booking cut-off and
  // its countdown are gone: nothing stops a member marking themselves in
  // on the night, and a ticking "bookings close in..." only made people
  // think they'd missed their chance. All that's left is the ask — book by
  // 5pm so the Game Coordinator has numbers to build teams from.
  function BookingNudge() {
    return h(
      "p",
      { className: "mt-4 text-xs text-white/60 leading-relaxed" },
      "Try to book in by 5pm Wednesday so the Game Coordinator can sort teams and the timetable. You can still change your mind after that."
    );
  }

  // ---- Who's coming (2 Oct 2026): names + photos of everyone booked in.
  // Name is nickname if set, otherwise real name (server-side, see
  // memberDisplayName in _shared/roles.mts).
  function WhosComingCard({ confirmed }) {
    const list = confirmed || [];
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
      h(
        "div",
        { className: "flex items-baseline justify-between mb-3" },
        h("p", { className: "font-display font-bold text-[var(--ink)]" }, "Who's coming"),
        h("p", { className: "text-xs text-[var(--ink-soft)] tabular-nums" }, list.length + (list.length === 1 ? " player" : " players"))
      ),
      list.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No one's booked in yet - be the first.")
        : h(
            "div",
            { className: "flex flex-wrap gap-2" },
            list.map((p) =>
              h(
                "div",
                { key: p.id, className: "flex items-center gap-2 rounded-full bg-[var(--sand)] pl-1 pr-3 py-1" },
                h(MemberPhoto, { memberId: p.id, version: p.photoVersion, size: 28 }),
                h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, p.name)
              )
            )
          )
    );
  }

  // ---- Last game recap (2 Oct 2026): results, MVP and top scorers from
  // the most recent past session, via /api/recap. Renders nothing at all
  // when nothing was recorded (Cheongy's call: no empty card).
  function RecapCard({ recap }) {
    if (!recap) return null;
    const dateLabel = GUWH.formatDate(new Date(recap.sessionDate + "T00:00:00"));
    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 mb-6" },
      h("p", { className: "font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "Last week"),
      h("p", { className: "font-display text-xl font-bold text-[var(--ink)] mt-0.5" }, dateLabel),
      h(
        "div",
        { className: "mt-4 grid sm:grid-cols-3 gap-4" },
        recap.mvp.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--accent-12)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--accent-dark)] mb-2 flex items-center gap-1.5" }, h(Icon, { name: "trophy", size: 13 }), "MVP"),
            recap.mvp.map((m) =>
              h(
                "div",
                { key: m.id, className: "flex items-center gap-2 mt-1" },
                h(MemberPhoto, { memberId: m.id, version: m.photoVersion, size: 32 }),
                h("span", { className: "font-display font-bold text-[var(--ink)]" }, m.name)
              )
            )
          ),
        recap.topScorers.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--sand)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Top scorers"),
            recap.topScorers.map((p, i) =>
              h(
                "div",
                { key: p.id, className: "flex justify-between text-sm py-0.5" },
                h("span", { className: "text-[var(--ink)]" }, (i + 1) + ". " + p.name),
                h("span", { className: "font-semibold tabular-nums text-[var(--ink)]" }, p.goals + (p.goals === 1 ? " goal" : " goals"))
              )
            )
          ),
        recap.games.length > 0 &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--sand)] p-3" },
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] mb-2" }, "Results"),
            recap.games.map((g, i) =>
              h(
                "div",
                { key: i, className: "flex justify-between gap-2 text-sm py-0.5" },
                h("span", { className: "text-[var(--ink)] truncate" }, g.white.name + " v " + g.black.name),
                h("span", { className: "font-semibold tabular-nums text-[var(--ink)] shrink-0" }, g.white.score + " - " + g.black.score)
              )
            )
          )
      )
    );
  }

  // Real dashboard (live site) — weekly attendance is the dominant action;
  // everything else (timetable, finance, forum, profile) is real data
  // reused from its existing source, laid out around that one job.
  // "My kids" on the attendance card (14 Oct 2026): one row per child saved
  // on the Profile, with a Coming / Not coming button each. Independent of
  // whether the parent is playing. With no children saved it is just a
  // quiet pointer to the Profile. Since 28 Oct 2026 it's the whole family:
  // a partner linked by an Administrator comes first, then the children
  // under either of you.
  function FamilyBooking({ family, busy, onToggle }) {
    if (!family || family.length === 0) {
      return h(
        "button",
        { type: "button", onClick: () => navigate("/portal/profile"), className: "mt-4 text-xs text-white/60 underline text-left" },
        "Bringing your kids? Add them on your Profile."
      );
    }
    return h(
      "div",
      { className: "mt-5 pt-5 border-t border-white/15" },
      h("p", { className: "text-xs font-bold uppercase tracking-wide text-white/60 mb-2" }, family.some((k) => k.isPartner) ? "Your family" : "Your kids"),
      h(
        "div",
        { className: "flex flex-col gap-2" },
        family.map((k) =>
          h(
            "div",
            { key: k.id, className: "flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5" },
            h(
              "span",
              { className: "text-sm font-semibold flex items-center gap-2" },
              k.inSession && h(Icon, { name: "check", size: 14 }),
              k.name,
              h("span", { className: "text-xs font-normal text-white/60" }, k.inSession ? "coming" : "not coming")
            ),
            k.inSession
              ? h(Button, { variant: "secondary", size: "sm", className: "!bg-transparent !text-white !border-white/30", disabled: busy, onClick: () => onToggle(k.id, false) }, "Can't make it")
              : h(Button, { size: "sm", disabled: busy, onClick: () => onToggle(k.id, true) }, k.isPartner ? k.firstName + "'s coming" : "Bring " + k.firstName)
          )
        )
      ),
      h("button", { type: "button", onClick: () => navigate("/portal/profile"), className: "mt-3 text-xs text-white/60 underline" }, "Edit kids on your Profile")
    );
  }

  function RealDashboardPage() {
    const [user, setUser] = React.useState(() => GUWH.Identity.currentUser());
    const [status, setStatus] = React.useState(null);
    const [profile, setProfile] = React.useState(null);
    const [board, setBoard] = React.useState(null);
    const [finance, setFinance] = React.useState(null);
    const [forumMe, setForumMe] = React.useState(null);
    const [topics, setTopics] = React.useState([]);
    const [topicsLoaded, setTopicsLoaded] = React.useState(false);
    const [recap, setRecap] = React.useState(null);
    const [invites, setInvites] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => GUWH.Identity.onChange(() => setUser(GUWH.Identity.currentUser())), []);

    React.useEffect(() => {
      if (!user) { navigate("/portal"); return; }
      setLoading(true);
      setError(null);
      GUWH.Identity.authFetch("/api/booking")
        .then((r) => r.json())
        .then((data) => (data.ok ? setStatus(data) : setError(data.error || "Something went wrong")))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
      // Everything below loads independently — a slow or failed one never
      // blocks the primary attendance card from working.
      GUWH.Identity.authFetch("/api/profile").then((r) => r.json()).then((d) => { if (d.ok) setProfile(d.member); }).catch(() => {});
      GUWH.Identity.authFetch("/api/game-board").then((r) => r.json()).then((d) => { if (d.ok) setBoard(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/finance?self=1").then((r) => r.json()).then((d) => { if (d.ok) setFinance(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/forum/me").then((r) => r.json()).then((d) => { if (d.ok) setForumMe(d); }).catch(() => {});
      GUWH.Identity.authFetch("/api/invites").then((r) => r.json()).then((d) => { if (d.ok) setInvites(d.invites); }).catch(() => {});
      GUWH.Identity.authFetch("/api/recap").then((r) => r.json()).then((d) => { if (d.ok) setRecap(d.recap); }).catch(() => {});
    }, [user]);

    React.useEffect(() => {
      const eligible = forumMe && forumMe.eligible && forumMe.participation && forumMe.participation.optedIn;
      if (!eligible) return;
      GUWH.Identity.authFetch("/api/forum/topics").then((r) => r.json()).then((d) => { if (d.ok) setTopics(d.topics); }).catch(() => {}).finally(() => setTopicsLoaded(true));
      // eslint-disable-next-line
    }, [forumMe && forumMe.eligible, forumMe && forumMe.participation && forumMe.participation.optedIn]);

    async function setIn(wantsIn, kind) {
      if (!status) return;
      setLoading(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/booking", { method: "POST", body: JSON.stringify({ in: wantsIn, kind: kind || "player" }) });
        const data = await res.json();
        if (data.ok) setStatus(data);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    async function setKidIn(kidId, wantsIn) {
      setLoading(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/booking", { method: "POST", body: JSON.stringify({ in: wantsIn, dependantId: kidId }) });
        const data = await res.json();
        if (data.ok) setStatus(data);
        else setError(data.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    if (!user) return null;
    // Greeting name (2 Oct 2026): nickname if set on the Profile page,
    // otherwise the real first name. Identity's own name is only a
    // fallback while /api/profile is still loading.
    const identityName = (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0];
    const firstName = profile ? ((profile.nickname && profile.nickname.trim()) || profile.firstName || identityName.split(" ")[0]) : identityName.split(" ")[0];
    const sessionDateObj = status
      ? new Date(status.sessionDate + "T00:00:00")
      : board
      ? new Date(board.sessionDate + "T00:00:00")
      : null;

    const forumEligible = !!(forumMe && forumMe.eligible && forumMe.participation && forumMe.participation.optedIn);
    const announcement = forumEligible ? topics.find((t) => t.pinned && t.isAnnouncement && !t.expired) : null;
    const discussionTopics = forumEligible ? topics.filter((t) => t !== announcement) : [];

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-4xl" },

      // ---- Header: simplified, attendance-first ----
      // Header (2 Oct 2026): "Upcoming Wednesday" + the date in the display
      // font, once. The attendance card below no longer repeats "this
      // Wednesday". Profile/Log out wrap under the heading on narrow phones
      // instead of squeezing it.
      h(
        "div",
        { className: "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-8" },
        h(
          "div",
          { className: "min-w-0" },
          h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "G'day " + firstName),
          h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-1" }, "Upcoming Wednesday"),
          sessionDateObj && h("p", { className: "font-display text-xl sm:text-2xl font-bold text-[var(--accent-dark)] mt-1" }, GUWH.formatDate(sessionDateObj))
        ),
        h(
          "div",
          { className: "flex items-center gap-1 shrink-0 -ml-2 sm:ml-0" },
          h(Button, { variant: "ghost", size: "sm", onClick: () => navigate("/portal/profile") }, h(Icon, { name: "chevronRight", size: 14 }), "Profile"),
          h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Identity.logout(); navigate("/"); } }, "Log out")
        )
      ),

      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),

      h(
        "div",
        { className: "grid lg:grid-cols-[1.3fr_0.7fr] gap-6 mb-6" },

        // ---- Weekly attendance card: the dominant action ----
        h(
          "div",
          null,
          status
            ? h(
                "div",
                { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" },
                h(
                  React.Fragment,
                  null,
                  // Both answers are always on screen (20 Oct 2026, club
                  // request). Previously only the option you hadn't picked
                  // was shown, which hid the choice and made it unclear
                  // whether you'd actually replied. Now the pair is always
                  // there with your current answer marked, so the state and
                  // the way to change it are the same control.
                  status.myStatus === "in"
                    ? h(Pill, { tone: "white" }, h(Icon, { name: "check", size: 14 }), "You're in for Wednesday")
                    : status.myStatus === "out"
                    ? h(Pill, { tone: "white" }, "You're not coming this week")
                    : h("h2", { className: "font-display text-xl sm:text-2xl font-bold" }, "Are you playing?"),
                  h(
                    "div",
                    { className: "mt-3 flex flex-col gap-1 text-sm text-white/70" },
                    h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "clock", size: 15 }), GUWH.club.sessionTime),
                    h("div", { className: "flex items-center gap-2" }, h(Icon, { name: "mapPin", size: 15 }), GUWH.club.venue)
                  ),
                  h(
                    "div",
                    { className: "mt-6 flex items-center gap-3 flex-wrap" },
                    h(AnswerButton, {
                      label: "I'm Coming",
                      icon: "plus",
                      active: status.myStatus === "in",
                      disabled: loading,
                      // Keeps whatever they're already down as, so pressing
                      // this again doesn't quietly turn a swim into a game.
                      onClick: () => setIn(true, status.myKind || "player"),
                    }),
                    h(AnswerButton, {
                      label: "I'm Not Coming",
                      active: status.myStatus === "out",
                      disabled: loading,
                      onClick: () => setIn(false),
                    })
                  ),
                  // What they're coming for (20 Oct 2026). Only shown once
                  // they're in: it's a follow-up to "yes", not a fourth way
                  // of answering. Playing is the default and almost always
                  // right, so this stays out of the way until it's needed.
                  status.myStatus === "in" &&
                    h(
                      "div",
                      { className: "mt-4 pt-4 border-t border-white/15" },
                      h("p", { className: "text-xs font-bold uppercase tracking-wide text-white/50 mb-2" }, "What for?"),
                      h(
                        "div",
                        { className: "flex items-center gap-2 flex-wrap" },
                        ATTENDANCE_KINDS.map((k) =>
                          h(KindButton, {
                            key: k.value,
                            label: k.label,
                            hint: k.hint,
                            active: (status.myKind || "player") === k.value,
                            disabled: loading,
                            onClick: () => setIn(true, k.value),
                          })
                        )
                      )
                    ),
                  h(
                    "p",
                    { className: "mt-3 text-sm text-white/70" },
                    h("span", { className: "font-display font-bold text-white" }, status.confirmedCount),
                    " members confirmed"
                  ),
                  h(
                    "div",
                    { className: "mt-5 pt-5 border-t border-white/15 flex flex-wrap items-center gap-3" },
                    h("p", { className: "text-xs text-white/60" }, boardBlurb(board))
                  ),
                  h(BookingNudge),
                  h(FamilyBooking, { family: status.family, busy: loading, onToggle: setKidIn })
                )
              )
            : loading && h("div", { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" }, h("p", { className: "text-sm text-white/70" }, "Loading…")),
          // Your team and stick colour, first thing after the attendance
          // card — what a member most wants once teams exist (20 Oct 2026).
          // Shown for drafts too, flagged as provisional.
          board && board.hasDraft && profile && h("div", { className: "mt-4" }, h(MyTeamCard, { board, memberId: profile.id })),
          // Directly under the attendance card so it's the next thing seen.
          status && h("div", { className: "mt-4" }, h(WhosComingCard, { confirmed: status.confirmed }))
        ),

        // ---- Profile + finance, secondary column ----
        h(
          "div",
          { className: "flex flex-col gap-4" },
          profile && h(ProfileSummaryCard, { profile, compact: true }),
          h(FinanceCard, { finance }),
          h(BringAMateButton)
        )
      ),

      // Getting started checklist sits UNDER the attendance card (14 Oct
      // 2026): on a phone it used to push I'm Coming well below the fold for
      // new members. The checklist's own first step still has an I'm Coming
      // button.
      h(GettingStartedCard, { key: profile ? profile.id : "none", profile, status, invites, forumMe, booking: loading, onBook: () => setIn(true), onProfile: setProfile }),

      h(RecapCard, { recap }),

      // ---- Club announcement (only when one is pinned), full width ----
      announcement && h("div", { className: "mb-4" }, h(AnnouncementCard, { announcement })),

      // ---- This Week's Game + Latest discussions, 50/50 on tablet and up,
      // stacked on phones (2 Oct 2026, Cheongy's request). items-start so
      // the shorter card doesn't stretch to the taller one's height.
      h(
        "div",
        { className: "grid sm:grid-cols-2 gap-4 items-start" },
        h(ThisWeeksGameCard, { board }),
        forumEligible && h(DiscussionsCard, { topics: discussionTopics, unreadCount: forumMe.unreadCount, loaded: topicsLoaded })
      )
    );
  }

  // Concept-preview dashboard (artifact-entry.html only) — unchanged demo data.
  function DemoDashboardPage() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => GUWH.Store.subscribe(force), []);

    const player = GUWH.Store.currentPlayer();
    const wed = GUWH.nextWednesday();
    const win = bookingWindow(wed);
    const booking = GUWH.Store.bookingFor(player.id);
    const confirmed = GUWH.Store.confirmedPlayerIds().length;

    return h(
      Container,
      { className: "py-10 sm:py-14" },
      h(
        "div",
        { className: "flex items-center justify-between mb-8" },
        h(
          "div",
          null,
          h("p", { className: "font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]" }, "G'day " + player.firstName),
          h("h1", { className: "font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] mt-1" }, "Wednesday dashboard")
        ),
        h(Button, { variant: "ghost", size: "sm", onClick: () => { GUWH.Store.logout(); navigate("/"); } }, "Log out")
      ),

      h(
        "div",
        { className: "grid lg:grid-cols-[1.1fr_0.9fr] gap-6" },

        // ---- booking card ----
        h(
          "div",
          { className: "rounded-3xl bg-[var(--navy)] text-white p-6 sm:p-8" },
          h(Pill, { tone: "white" }, h(Icon, { name: "calendar", size: 14 }), GUWH.formatDate(wed)),
          h("p", { className: "mt-4 text-white/70 text-sm" }, GUWH.club.sessionTime + " · " + GUWH.club.venue),
          h(
            "div",
            { className: "mt-6 flex items-center gap-4" },
            h(
              Button,
              {
                size: "lg",
                variant: booking.in ? "dark" : "primary",
                className: booking.in ? "!bg-[var(--good)] hover:!bg-[var(--good-dark)]" : "",
                onClick: () => GUWH.Store.setBooking(player.id, !booking.in),
              },
              h(Icon, { name: booking.in ? "check" : "plus", size: 18 }),
              booking.in ? "I'm in" : "I'm in?"
            ),
            booking.in && h(Button, { variant: "secondary", className: "!bg-transparent !text-white !border-white/30", onClick: () => GUWH.Store.setBooking(player.id, false) }, "Cancel")
          ),
          h(
            "p",
            { className: "mt-4 text-xs text-white/60" },
            win.isPastClose
              ? "Bookings have closed for this session — you can still cancel up until the game begins."
              : "Bookings close " + win.closesAt.toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" }) + ", two hours before the session."
          )
        ),

        // ---- attendance + teams ----
        h(
          "div",
          { className: "flex flex-col gap-4" },
          h(AttendanceCounter, { confirmed, teams: 4 }),
          h(
            "button",
            { onClick: () => navigate("/portal/board"), className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 text-left hover:ring-[var(--accent)] transition flex items-center justify-between" },
            h(
              "div",
              null,
              h("p", { className: "font-display font-bold text-[var(--ink)]" }, "This Week's Game"),
              h("p", { className: "text-sm text-[var(--ink-soft)]" }, "See pools, teams and cap colours")
            ),
            h(Icon, { name: "chevronRight", size: 18, className: "text-[var(--ink-soft)]" })
          ),
          h(
            "div",
            { className: "rounded-2xl bg-white ring-1 ring-black/5 p-4" },
            h("p", { className: "font-display font-bold text-[var(--ink)] flex items-center gap-2" }, h(Icon, { name: "heart", size: 16, className: "text-[var(--accent-dark)]" }), "After the games"),
            h("p", { className: "text-sm text-[var(--ink-soft)] mt-1" }, GUWH.Store.getState().gameBoard.socialPlan)
          )
        )
      ),

      h(
        "div",
        { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8" },
        h(MilestoneCard, { icon: "trophy", value: GUWH.milestones.clubGamesThisYear, label: "Club games this year" }),
        h(MilestoneCard, { icon: "users", value: GUWH.milestones.newPlayersThisYear, label: "New players this year" }),
        h(MilestoneCard, { icon: "share", value: GUWH.milestones.friendsInvitedThisYear, label: "Friends invited" }),
        h(MilestoneCard, { icon: "droplet", value: player.gamesThisYear, label: "Your games this year" })
      ),

      h(
        "div",
        { className: "mt-8 grid sm:grid-cols-2 gap-4" },
        h(
          "button",
          { onClick: () => navigate("/portal/bring-a-mate"), className: "rounded-2xl bg-[var(--accent-10)] p-5 text-left hover:bg-[var(--accent-15)] transition flex items-center justify-between" },
          h("div", null, h("p", { className: "font-display font-bold text-[var(--accent-dark)]" }, "Bring a mate"), h("p", { className: "text-sm text-[var(--ink-70)]" }, "Free for them too — first three sessions")),
          h(Icon, { name: "share", size: 20, className: "text-[var(--accent-dark)]" })
        ),
        h(
          "button",
          { onClick: () => navigate("/portal/profile"), className: "rounded-2xl bg-[var(--sand)] p-5 text-left hover:bg-black/5 transition flex items-center justify-between" },
          h("div", null, h("p", { className: "font-display font-bold text-[var(--ink)]" }, "My profile"), h("p", { className: "text-sm text-[var(--ink-soft)]" }, player.grade + " · " + player.position)),
          h(Icon, { name: "chevronRight", size: 20, className: "text-[var(--ink-soft)]" })
        )
      )
    );
  }

  function DashboardPage() {
    return GUWH.Identity ? h(RealDashboardPage) : h(DemoDashboardPage);
  }

  GUWH.Pages.Dashboard = DashboardPage;
})();
