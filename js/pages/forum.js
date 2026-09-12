// ---------------------------------------------------------------------------
// Members Forum (live site, real backend) — an "elevated club group chat":
// recency-focused feed, threaded replies, reactions, informal polls,
// Suggest-a-Discussion, follow/mute, and full Moderator/Administrator
// controls. Adult-members-only and opt-in — every access rule here is a
// convenience mirror of what the server already enforces on every
// /api/forum/* endpoint (see netlify/functions/forum-*.mts and
// _shared/forum-access.mts); nothing here is the real gate.
// ---------------------------------------------------------------------------
window.GUWH = window.GUWH || {};
GUWH.Pages = GUWH.Pages || {};

(function () {
  const { Container, Button, Pill, Icon, SectionHeading, FormField, inputCls } = GUWH.UI;
  const { navigate } = GUWH.Router;

  const REACTIONS = ["like", "helpful", "funny", "interested"];
  const REACTION_LABELS = { like: "Like", helpful: "Helpful", funny: "Funny", interested: "I'm interested" };

  const REPORT_REASONS = ["harassment", "unsafe_advice", "privacy", "spam", "inappropriate_media", "off_topic", "other"];
  const REPORT_REASON_LABELS = {
    harassment: "Harassment or bullying",
    unsafe_advice: "Unsafe or dangerous advice",
    privacy: "Privacy concern",
    spam: "Spam",
    inappropriate_media: "Inappropriate photo/video/file",
    off_topic: "Off-topic",
    other: "Other",
  };

  const NOTIFY_LEVELS = ["in_app_email", "in_app_only", "none"];
  const NOTIFY_LABELS = { in_app_email: "Notify here + email", in_app_only: "Notify here only", none: "Don't notify me" };

  const MAX_VISUAL_DEPTH = 3; // beyond this, stop indenting further — show "replying to" instead

  function textareaCls() {
    return inputCls + " min-h-[90px]";
  }

  // Posts are only ever stored as rendered, sanitized HTML (see
  // _shared/forum.mts) — there's no separate "raw markup" column to edit
  // from, so this gives the edit box a reasonable plain-text starting
  // point. Not a perfect round-trip of the original **bold**/links/etc,
  // but good enough to edit from within the one-hour window.
  function stripToPlainSeed(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || "").trim();
  }

  function isModeratorNow() {
    return GUWH.Identity.hasRole("community_moderator") || GUWH.Identity.hasRole("administrator");
  }

  function Avatar({ display, size }) {
    const dim = size || 32;
    const initial = (display || "?").trim().charAt(0).toUpperCase() || "?";
    return h(
      "div",
      {
        className: "rounded-full bg-[var(--accent-15)] text-[var(--accent-dark)] flex items-center justify-center font-bold shrink-0",
        style: { width: dim, height: dim, fontSize: Math.round(dim * 0.42) },
        "aria-hidden": "true",
      },
      initial
    );
  }

  // --------------------------------------------------------------- Opt-in gate
  function OptInGate({ me, alreadyOptedIn, onDone }) {
    const p = me.participation;
    const [showPhoto, setShowPhoto] = React.useState(p ? p.showPhoto : true);
    const [showGrade, setShowGrade] = React.useState(p ? p.showGrade : false);
    const [showBadges, setShowBadges] = React.useState(p ? p.showBadges : true);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    async function submit() {
      setBusy(true);
      setError(null);
      try {
        const action = alreadyOptedIn ? "accept_guidelines" : "opt_in";
        const res = await GUWH.Identity.authFetch("/api/forum/me", { method: "POST", body: JSON.stringify({ action, showPhoto, showGrade, showBadges }) });
        const d = await res.json();
        if (d.ok) onDone();
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-2xl" },
      h(SectionHeading, {
        eyebrow: "Members Forum",
        title: alreadyOptedIn ? "The community guidelines have been updated" : "Join the Members Forum",
        sub: alreadyOptedIn
          ? "Please read the updated guidelines before continuing."
          : "Club chat, game-day talk and announcements — members only, opt-in, and built to feel more like a group chat than an internet forum.",
      }),
      h(
        "div",
        { className: "rounded-3xl bg-white ring-1 ring-black/5 p-6 sm:p-8 flex flex-col gap-5" },
        h("div", { className: "whitespace-pre-line text-sm text-[var(--ink)] leading-relaxed" }, me.guidelines.content),
        !alreadyOptedIn &&
          h(
            React.Fragment,
            null,
            h("hr", { className: "border-black/5" }),
            h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "What other members will see about you"),
            h("p", { className: "text-sm text-[var(--ink-soft)]" }, 'Only your first name + last initial is ever shown (e.g. "Alex C.") — never your full name, email, phone, or attendance history.'),
            h(
              "label",
              { className: "flex items-center gap-2 text-sm text-[var(--ink)]" },
              h("input", { type: "checkbox", checked: showPhoto, onChange: (e) => setShowPhoto(e.target.checked) }),
              "Show my profile photo on my posts"
            ),
            h(
              "label",
              { className: "flex items-center gap-2 text-sm text-[var(--ink)]" },
              h("input", { type: "checkbox", checked: showGrade, onChange: (e) => setShowGrade(e.target.checked) }),
              "Show my grade on my posts"
            ),
            h(
              "label",
              { className: "flex items-center gap-2 text-sm text-[var(--ink)]" },
              h("input", { type: "checkbox", checked: showBadges, onChange: (e) => setShowBadges(e.target.checked) }),
              "Show contribution badges on my posts"
            )
          ),
        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
        h(
          "div",
          { className: "flex flex-wrap items-center gap-3" },
          h(Button, { type: "button", onClick: submit, disabled: busy }, alreadyOptedIn ? "I've read the updated guidelines" : "I understand — opt in to the Members Forum"),
          h(Button, { type: "button", variant: "ghost", onClick: () => navigate("/portal/dashboard") }, "Not now")
        )
      )
    );
  }

  // --------------------------------------------------------------- Poll block
  function PollBlock({ poll, onVote }) {
    const [selected, setSelected] = React.useState(poll.myVoteIds || []);

    function toggle(id) {
      if (poll.allowMultiple) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      else setSelected([id]);
    }

    const totalVotes = poll.showResults ? poll.options.reduce((sum, o) => sum + (o.count || 0), 0) : 0;

    return h(
      "div",
      { className: "rounded-2xl bg-[var(--sand)] p-5 mb-5 flex flex-col gap-3" },
      h("p", { className: "text-sm font-bold text-[var(--ink)]" }, poll.question),
      poll.options.map((o) =>
        h(
          "div",
          { key: o.id, className: "flex items-center gap-2" },
          !poll.showResults &&
            !poll.closed &&
            h("input", { type: poll.allowMultiple ? "checkbox" : "radio", name: "poll-" + poll.id, checked: selected.includes(o.id), onChange: () => toggle(o.id) }),
          poll.showResults
            ? h(
                "div",
                { className: "flex-1" },
                h(
                  "div",
                  { className: "flex items-center justify-between text-sm" },
                  h("span", { className: cx(poll.myVoteIds.includes(o.id) && "font-bold text-[var(--accent-dark)]") }, o.label),
                  h("span", { className: "text-[var(--ink-soft)]" }, (o.count || 0) + " (" + (totalVotes ? Math.round(((o.count || 0) / totalVotes) * 100) : 0) + "%)")
                ),
                h("div", { className: "h-1.5 rounded-full bg-black/10 mt-1 overflow-hidden" }, h("div", { className: "h-full bg-[var(--accent)]", style: { width: (totalVotes ? ((o.count || 0) / totalVotes) * 100 : 0) + "%" } }))
              )
            : h("span", { className: "text-sm text-[var(--ink)]" }, o.label)
        )
      ),
      !poll.showResults && !poll.closed && h(Button, { type: "button", size: "sm", onClick: () => onVote(selected), disabled: selected.length === 0 }, "Vote"),
      poll.closed && h("p", { className: "text-xs text-[var(--ink-soft)]" }, "This poll is closed."),
      h("p", { className: "text-[11px] text-[var(--ink-soft)]" }, "An informal read of the room — not a formal committee vote.")
    );
  }

  // --------------------------------------------------------------- Post item
  function PostItem({ post, isModerator, topic, isOpening, editingId, editDraft, setEditingId, setEditDraft, saveEdit, onReply, onDelete, onReact, onReport, onModerate }) {
    const editing = editingId === post.id;
    const [showModEdit, setShowModEdit] = React.useState(false);
    const [modReason, setModReason] = React.useState("");
    const [modDraft, setModDraft] = React.useState(() => stripToPlainSeed(post.bodyHtml));
    const removedOrHidden = post.removed || post.hidden;

    return h(
      "div",
      { className: cx("rounded-2xl p-4 sm:p-5 ring-1 ring-black/5", isOpening ? "bg-[var(--accent-08)]" : "bg-white", removedOrHidden && "opacity-60") },
      h(
        "div",
        { className: "flex items-center gap-2 mb-2 flex-wrap" },
        h(Avatar, { display: post.authorDisplay, size: 30 }),
        h("span", { className: "text-sm font-semibold text-[var(--ink)]" }, post.authorDisplay),
        post.authorGrade && h(Pill, { tone: "dark", className: "!py-0 !px-2 !text-[10px]" }, "Grade " + post.authorGrade),
        h("span", { className: "text-xs text-[var(--ink-soft)]" }, GUWH.formatRelativeTime(post.createdAt)),
        post.editedAt && h("span", { className: "text-xs text-[var(--ink-soft)] italic" }, post.editedByModerator ? "Edited by a Moderator" : "edited")
      ),

      editing
        ? h(
            "div",
            { className: "flex flex-col gap-2" },
            h("textarea", { className: textareaCls(), value: editDraft, onChange: (e) => setEditDraft(e.target.value) }),
            h(
              "div",
              { className: "flex items-center gap-2" },
              h(Button, { type: "button", size: "sm", onClick: () => saveEdit(post.id) }, "Save"),
              h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setEditingId(null) }, "Cancel")
            )
          )
        : h("div", { className: "forum-body text-sm leading-relaxed", dangerouslySetInnerHTML: { __html: post.bodyHtml } }),

      !editing &&
        h(
          "div",
          { className: "flex flex-wrap items-center gap-1.5 mt-3" },
          REACTIONS.map((r) => {
            const found = (post.reactions || []).find((x) => x.reaction === r);
            return h(
              "button",
              {
                key: r,
                type: "button",
                onClick: () => onReact(r),
                className: cx(
                  "px-2.5 py-1 rounded-full text-xs font-semibold border transition",
                  found && found.mine ? "bg-[var(--accent-12)] text-[var(--accent-dark)] border-[var(--accent-30)]" : "bg-white text-[var(--ink-soft)] border-black/10 hover:border-black/20"
                ),
              },
              REACTION_LABELS[r] + (found && found.count ? " " + found.count : "")
            );
          }),
          !post.removed && !post.hidden && topic.allowReplies && !topic.locked && !topic.archived && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: onReply }, "Reply"),
          post.canEditWindowOpen && !post.removed && !post.hidden && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => { setEditingId(post.id); setEditDraft(stripToPlainSeed(post.bodyHtml)); } }, "Edit"),
          post.canEditWindowOpen && !post.removed && !post.hidden && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: onDelete }, "Delete"),
          !post.removed && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: onReport }, "Report"),
          isModerator && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => onModerate(post.hidden ? "unhide_post" : "hide_post") }, post.hidden ? "Unhide" : "Hide"),
          isModerator && !post.removed && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => { if (window.confirm("Remove this post? Only Moderators/Admins will still be able to see it.")) onModerate("remove_post"); } }, "Remove"),
          isModerator && h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setShowModEdit((v) => !v) }, "Moderator edit")
        ),

      showModEdit &&
        h(
          "div",
          { className: "mt-3 rounded-xl bg-[var(--sand)] p-3 flex flex-col gap-2" },
          h("textarea", { className: textareaCls(), value: modDraft, onChange: (e) => setModDraft(e.target.value) }),
          h("input", { className: inputCls, placeholder: "Reason for this edit (required — shown in the audit log)", value: modReason, onChange: (e) => setModReason(e.target.value) }),
          h(
            "div",
            { className: "flex items-center gap-2" },
            h(
              Button,
              {
                type: "button",
                size: "sm",
                onClick: () => {
                  if (!modReason.trim()) return;
                  onModerate("moderator_edit_post", { body: modDraft, reason: modReason.trim() });
                  setShowModEdit(false);
                },
              },
              "Save moderator edit"
            ),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setShowModEdit(false) }, "Cancel")
          )
        )
    );
  }

  // --------------------------------------------------------------- Topic view
  function TopicView({ topicId, onBack }) {
    const [data, setData] = React.useState(null);
    const [categories, setCategories] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [replyBody, setReplyBody] = React.useState("");
    const [replyingTo, setReplyingTo] = React.useState(null);
    const [editingId, setEditingId] = React.useState(null);
    const [editDraft, setEditDraft] = React.useState("");
    const [reportTarget, setReportTarget] = React.useState(null);
    const [reportReason, setReportReason] = React.useState(REPORT_REASONS[0]);
    const [reportExplanation, setReportExplanation] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [actionError, setActionError] = React.useState(null);
    const [moveTo, setMoveTo] = React.useState("");
    const [mergeInto, setMergeInto] = React.useState("");
    const [notifyLevel, setNotifyLevel] = React.useState("default");
    const isModerator = isModeratorNow();

    function load() {
      setLoading(true);
      return GUWH.Identity.authFetch("/api/forum/topics?topicId=" + topicId)
        .then((r) => r.json())
        .then((d) => { if (d.ok) setData(d); else setError(d.error || "Something went wrong"); })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { load(); }, [topicId]);
    React.useEffect(() => {
      GUWH.Identity.authFetch("/api/forum/categories").then((r) => r.json()).then((d) => { if (d.ok) setCategories(d.categories); });
    }, []);

    async function callTopics(body) {
      setActionError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/topics", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (!d.ok) { setActionError(d.error || "Something went wrong"); return null; }
        return d;
      } catch (e) {
        setActionError(String(e));
        return null;
      }
    }
    async function callPosts(body) {
      setActionError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/posts", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (!d.ok) { setActionError(d.error || "Something went wrong"); return null; }
        return d;
      } catch (e) {
        setActionError(String(e));
        return null;
      }
    }
    async function callMe(body) {
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/me", { method: "POST", body: JSON.stringify(body) });
        return await res.json();
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }

    async function submitReply(ev) {
      ev.preventDefault();
      if (!replyBody.trim()) return;
      setBusy(true);
      const d = await callPosts({ action: "create_post", topicId, parentPostId: replyingTo ? replyingTo.postId : undefined, body: replyBody.trim() });
      setBusy(false);
      if (d) { setReplyBody(""); setReplyingTo(null); load(); }
    }
    async function saveEdit(postId) {
      if (!editDraft.trim()) return;
      const d = await callPosts({ action: "edit_post", postId, body: editDraft.trim() });
      if (d) { setEditingId(null); load(); }
    }
    async function deletePost(postId) {
      if (!window.confirm("Delete this post? This can't be undone.")) return;
      const d = await callPosts({ action: "delete_post", postId });
      if (d) load();
    }
    async function toggleReaction(post, reaction) {
      const mine = (post.reactions || []).some((r) => r.reaction === reaction && r.mine);
      const d = await callPosts({ action: mine ? "unreact" : "react", postId: post.id, reaction });
      if (d) load();
    }
    async function submitReport() {
      if (!reportTarget) return;
      const d = await callPosts({ action: "report", targetType: reportTarget.type, targetId: reportTarget.id, reason: reportReason, explanation: reportExplanation.trim() || undefined });
      if (d) { setReportTarget(null); setReportExplanation(""); }
    }
    async function votePoll(optionIds) {
      const d = await callTopics({ action: "vote_poll", topicId, optionIds });
      if (d) load();
    }
    async function toggleFollow(state, notify) {
      if (state === "none") await callMe({ action: "unfollow_topic", topicId });
      else await callMe({ action: state === "muted" ? "mute_topic" : "follow_topic", topicId, notify: notify || "default" });
      load();
    }
    async function modAction(body) {
      const d = await callTopics(body);
      if (d) load();
    }

    if (loading) return h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…");
    if (error || !data) return h("p", { className: "text-sm text-[var(--bad)]" }, error || "Something went wrong");

    const topic = data.topic;
    const postsById = {};
    data.posts.forEach((p) => (postsById[p.id] = p));
    const opening = data.posts.find((p) => p.isOpeningPost);
    const replies = data.posts.filter((p) => !p.isOpeningPost);
    const childrenOf = {};
    replies.forEach((p) => {
      const parent = p.parentPostId || "root";
      if (!childrenOf[parent]) childrenOf[parent] = [];
      childrenOf[parent].push(p);
    });

    function postItemProps(post, isOpening) {
      return {
        post, isModerator, topic, isOpening,
        editingId, editDraft, setEditingId, setEditDraft, saveEdit,
        onReply: () => setReplyingTo({ postId: post.id, display: post.authorDisplay }),
        onDelete: () => deletePost(post.id),
        onReact: (r) => toggleReaction(post, r),
        onReport: () => setReportTarget({ type: "post", id: post.id }),
        onModerate: (action, extra) => callPosts(Object.assign({ action, postId: post.id }, extra)).then((d) => d && load()),
      };
    }

    function renderThread(parentKey, depth) {
      const kids = childrenOf[parentKey] || [];
      return kids.map((post) => {
        const parentPost = post.parentPostId ? postsById[post.parentPostId] : null;
        const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);
        return h(
          React.Fragment,
          { key: post.id },
          h(
            "div",
            { style: { marginLeft: visualDepth * 20 } },
            depth > MAX_VISUAL_DEPTH && parentPost && h("p", { className: "text-[11px] text-[var(--ink-soft)] mb-1" }, "↳ replying to " + parentPost.authorDisplay),
            h(PostItem, postItemProps(post, false))
          ),
          renderThread(post.id, depth + 1)
        );
      });
    }

    return h(
      React.Fragment,
      null,
      h(Button, { type: "button", size: "sm", variant: "ghost", onClick: onBack, className: "mb-4" }, "← Back to Members Forum"),
      actionError && h("p", { className: "text-sm text-[var(--bad)] mb-3" }, actionError),

      h(
        "div",
        { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 sm:p-6 mb-5" },
        h(
          "div",
          { className: "flex items-center gap-2 flex-wrap mb-2" },
          topic.pinned && h(Pill, { tone: "dark", className: "!py-0.5" }, "Pinned"),
          topic.isAnnouncement && h(Pill, { tone: "accent", className: "!py-0.5" }, "Announcement" + (topic.expired ? " (expired)" : "")),
          topic.locked && h(Pill, { tone: "warn", className: "!py-0.5" }, "Locked"),
          h("span", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, topic.categoryName)
        ),
        h("h1", { className: "font-display text-2xl font-bold text-[var(--ink)]" }, topic.title),
        h("div", { className: "flex items-center gap-3 mt-1.5 text-xs text-[var(--ink-soft)]" }, h("span", null, topic.authorDisplay), h("span", null, "·"), h("span", null, GUWH.formatRelativeTime(topic.createdAt))),

        (topic.linkedNewsUrl || topic.linkedEventUrl || topic.linkedSessionId) &&
          h(
            "div",
            { className: "flex flex-wrap gap-2 mt-3" },
            topic.linkedSessionId && h(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => navigate("/portal/board") }, "This Wednesday's game →"),
            topic.linkedNewsUrl && h("a", { href: topic.linkedNewsUrl, target: "_blank", rel: "noopener" }, h(Button, { type: "button", size: "sm", variant: "secondary" }, topic.linkedNewsLabel || "Related news →")),
            topic.linkedEventUrl && h("a", { href: topic.linkedEventUrl, target: "_blank", rel: "noopener" }, h(Button, { type: "button", size: "sm", variant: "secondary" }, topic.linkedEventLabel || "Related event →"))
          ),

        h(
          "div",
          { className: "flex flex-wrap items-center gap-2 mt-4" },
          h(
            "select",
            { className: inputCls + " !w-auto !py-1.5 text-xs", value: topic.followState, onChange: (e) => toggleFollow(e.target.value, notifyLevel) },
            h("option", { value: "none" }, "Not following"),
            h("option", { value: "following" }, "Following"),
            h("option", { value: "muted" }, "Muted")
          ),
          topic.followState === "following" &&
            h(
              "select",
              { className: inputCls + " !w-auto !py-1.5 text-xs", value: notifyLevel, onChange: (e) => { setNotifyLevel(e.target.value); toggleFollow("following", e.target.value); } },
              h("option", { value: "default" }, "Default notifications"),
              NOTIFY_LEVELS.map((l) => h("option", { key: l, value: l }, NOTIFY_LABELS[l]))
            ),
          h("span", { className: "text-xs text-[var(--ink-soft)]" }, topic.followerCount + " following"),
          h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setReportTarget({ type: "topic", id: topic.id }) }, "Report")
        ),

        isModerator &&
          h(
            "div",
            { className: "flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/5" },
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => modAction({ action: topic.pinned ? "unpin_topic" : "pin_topic", topicId }) }, topic.pinned ? "Unpin" : "Pin"),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => modAction({ action: topic.locked ? "unlock_topic" : "lock_topic", topicId }) }, topic.locked ? "Unlock" : "Lock"),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => modAction({ action: topic.archived ? "unarchive_topic" : "archive_topic", topicId }) }, topic.archived ? "Restore" : "Archive"),
            h(
              "select",
              { className: inputCls + " !w-auto !py-1.5 text-xs", value: moveTo, onChange: (e) => setMoveTo(e.target.value) },
              h("option", { value: "" }, "Move to…"),
              categories.filter((c) => c.id !== topic.categoryId).map((c) => h("option", { key: c.id, value: c.id }, c.name))
            ),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => moveTo && modAction({ action: "move_topic", topicId, categoryId: Number(moveTo) }) }, "Move"),
            h("input", { className: inputCls + " !w-28 !py-1.5 text-xs", placeholder: "Merge into topic #", value: mergeInto, onChange: (e) => setMergeInto(e.target.value) }),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => mergeInto && modAction({ action: "merge_topics", fromTopicId: topicId, intoTopicId: Number(mergeInto) }).then(() => navigate("/portal/forum/topic/" + mergeInto)) }, "Merge")
          )
      ),

      data.poll && h(PollBlock, { poll: data.poll, onVote: votePoll }),

      opening && h(PostItem, postItemProps(opening, true)),

      h("div", { className: "flex flex-col gap-3 mt-3" }, renderThread("root", 0)),

      reportTarget &&
        h(
          "div",
          { className: "rounded-2xl bg-[var(--sand)] p-4 mt-4 flex flex-col gap-3" },
          h("p", { className: "text-sm font-bold text-[var(--ink)]" }, "Report this " + reportTarget.type),
          h("select", { className: inputCls, value: reportReason, onChange: (e) => setReportReason(e.target.value) }, REPORT_REASONS.map((r) => h("option", { key: r, value: r }, REPORT_REASON_LABELS[r]))),
          h("textarea", { className: textareaCls(), placeholder: "Optional details", value: reportExplanation, onChange: (e) => setReportExplanation(e.target.value) }),
          h(
            "div",
            { className: "flex items-center gap-3" },
            h(Button, { type: "button", size: "sm", onClick: submitReport }, "Submit report"),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setReportTarget(null) }, "Cancel")
          )
        ),

      topic.allowReplies && !topic.locked && !topic.archived
        ? h(
            "form",
            { onSubmit: submitReply, className: "rounded-2xl bg-white ring-1 ring-black/5 p-4 mt-5 flex flex-col gap-2" },
            replyingTo &&
              h(
                "div",
                { className: "flex items-center gap-2 text-xs text-[var(--ink-soft)]" },
                "Replying to " + replyingTo.display,
                h("button", { type: "button", onClick: () => setReplyingTo(null), className: "underline" }, "cancel")
              ),
            h("textarea", {
              className: textareaCls(),
              value: replyBody,
              onChange: (e) => setReplyBody(e.target.value),
              placeholder: "Write a reply… **bold**, *italic*, [link](https://...), > quote, - list, @First S. to mention someone",
            }),
            h("div", { className: "flex items-center gap-3" }, h(Button, { type: "submit", size: "sm", disabled: busy }, "Post reply"))
          )
        : h("p", { className: "text-sm text-[var(--ink-soft)] mt-5" }, topic.locked ? "This topic is locked — replies are closed." : "Replies are turned off for this announcement.")
    );
  }

  // --------------------------------------------------------------- Suggest a discussion
  function SuggestDiscussionForm({ categories, onDone }) {
    const [title, setTitle] = React.useState("");
    const [categoryId, setCategoryId] = React.useState(categories[0] ? categories[0].id : "");
    const [explanation, setExplanation] = React.useState("");
    const [openingContent, setOpeningContent] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [mine, setMine] = React.useState([]);

    React.useEffect(() => { if (!categoryId && categories[0]) setCategoryId(categories[0].id); }, [categories]);

    function loadMine() {
      return GUWH.Identity.authFetch("/api/forum/suggestions").then((r) => r.json()).then((d) => { if (d.ok) setMine(d.mine); });
    }
    React.useEffect(() => { loadMine(); }, []);

    async function submit(ev) {
      ev.preventDefault();
      if (!title.trim() || !explanation.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/suggestions", {
          method: "POST",
          body: JSON.stringify({ action: "submit", suggestedTitle: title.trim(), suggestedCategoryId: categoryId || null, explanation: explanation.trim(), openingContent: openingContent.trim() || undefined }),
        });
        const d = await res.json();
        if (d.ok) { setTitle(""); setExplanation(""); setOpeningContent(""); loadMine(); }
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 mb-6 flex flex-col gap-4" },
      h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Only Moderators create topics directly — suggest one here and a Moderator will review it."),
      h(
        "form",
        { onSubmit: submit, className: "flex flex-col gap-3" },
        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
        h(FormField, { label: "Title", required: true }, h("input", { className: inputCls, value: title, onChange: (e) => setTitle(e.target.value) })),
        h(FormField, { label: "Category" }, h("select", { className: inputCls, value: categoryId, onChange: (e) => setCategoryId(Number(e.target.value)) }, categories.map((c) => h("option", { key: c.id, value: c.id }, c.name)))),
        h(FormField, { label: "Why should this be a discussion?", required: true }, h("textarea", { className: textareaCls(), value: explanation, onChange: (e) => setExplanation(e.target.value) })),
        h(FormField, { label: "Optional — a starting message", hint: "If approved, this becomes the opening post." }, h("textarea", { className: textareaCls(), value: openingContent, onChange: (e) => setOpeningContent(e.target.value) })),
        h("div", { className: "flex items-center gap-3" }, h(Button, { type: "submit", disabled: busy }, "Submit suggestion"), h(Button, { type: "button", variant: "ghost", onClick: onDone }, "Close"))
      ),
      mine.length > 0 &&
        h(
          "div",
          { className: "border-t border-black/5 pt-4 flex flex-col gap-2" },
          h("p", { className: "text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]" }, "Your suggestions"),
          mine.map((s) =>
            h(
              "div",
              { key: s.id, className: "flex flex-col gap-0.5" },
              h(
                "div",
                { className: "flex items-center justify-between gap-3 text-sm" },
                h("span", { className: "text-[var(--ink)]" }, s.suggested_title),
                h(Pill, { tone: s.status === "approved" ? "good" : s.status === "declined" ? "warn" : "dark", className: "!py-0.5" }, s.status)
              ),
              s.status === "declined" && s.decline_reason && h("p", { className: "text-xs text-[var(--ink-soft)]" }, s.decline_reason)
            )
          )
        )
    );
  }

  // --------------------------------------------------------------- New topic (moderator)
  function NewTopicForm({ categories, onCreated }) {
    const [categoryId, setCategoryId] = React.useState(categories[0] ? categories[0].id : "");
    const [title, setTitle] = React.useState("");
    const [content, setContent] = React.useState("");
    const [isAnnouncement, setIsAnnouncement] = React.useState(false);
    const [important, setImportant] = React.useState(false);
    const [allowReplies, setAllowReplies] = React.useState(true);
    const [expiresAt, setExpiresAt] = React.useState("");
    const [pollEnabled, setPollEnabled] = React.useState(false);
    const [pollQuestion, setPollQuestion] = React.useState("");
    const [pollOptions, setPollOptions] = React.useState(["", ""]);
    const [pollAllowMultiple, setPollAllowMultiple] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => { if (!categoryId && categories[0]) setCategoryId(categories[0].id); }, [categories]);

    function setPollOption(i, value) {
      setPollOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
    }

    async function submit(ev) {
      ev.preventDefault();
      if (!title.trim() || !categoryId) return;
      setBusy(true);
      setError(null);
      const body = { action: "create_topic", categoryId, title: title.trim(), openingContent: content.trim(), isAnnouncement, important, allowReplies, expiresAt: expiresAt || undefined };
      const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (pollEnabled && pollQuestion.trim() && cleanOptions.length >= 2) {
        body.poll = { question: pollQuestion.trim(), options: cleanOptions, allowMultiple: pollAllowMultiple };
      }
      try {
        const res = await GUWH.Identity.authFetch("/api/forum/topics", { method: "POST", body: JSON.stringify(body) });
        const d = await res.json();
        if (d.ok) onCreated(d.topicId);
        else setError(d.error || "Something went wrong");
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }

    return h(
      "div",
      { className: "rounded-2xl bg-white ring-1 ring-black/5 p-5 mb-6" },
      h(
        "form",
        { onSubmit: submit, className: "flex flex-col gap-3" },
        error && h("p", { className: "text-sm text-[var(--bad)]" }, error),
        h(
          "div",
          { className: "grid sm:grid-cols-2 gap-3" },
          h(FormField, { label: "Category" }, h("select", { className: inputCls, value: categoryId, onChange: (e) => setCategoryId(Number(e.target.value)) }, categories.map((c) => h("option", { key: c.id, value: c.id }, c.name)))),
          h(FormField, { label: "Title", required: true }, h("input", { className: inputCls, value: title, onChange: (e) => setTitle(e.target.value) }))
        ),
        h(FormField, { label: "Opening post" }, h("textarea", { className: textareaCls(), value: content, onChange: (e) => setContent(e.target.value) })),
        h(
          "div",
          { className: "flex flex-wrap gap-4" },
          h("label", { className: "flex items-center gap-2 text-sm" }, h("input", { type: "checkbox", checked: isAnnouncement, onChange: (e) => setIsAnnouncement(e.target.checked) }), "Announcement"),
          h("label", { className: "flex items-center gap-2 text-sm" }, h("input", { type: "checkbox", checked: important, onChange: (e) => setImportant(e.target.checked) }), "Mark important"),
          h("label", { className: "flex items-center gap-2 text-sm" }, h("input", { type: "checkbox", checked: allowReplies, onChange: (e) => setAllowReplies(e.target.checked) }), "Allow replies")
        ),
        isAnnouncement &&
          h(FormField, { label: "Expires", hint: "Optional — loses priority in the feed after this, stays visible until archived." }, h("input", { type: "date", className: inputCls, value: expiresAt, onChange: (e) => setExpiresAt(e.target.value) })),
        h("label", { className: "flex items-center gap-2 text-sm" }, h("input", { type: "checkbox", checked: pollEnabled, onChange: (e) => setPollEnabled(e.target.checked) }), "Add an informal poll"),
        pollEnabled &&
          h(
            "div",
            { className: "rounded-xl bg-[var(--sand)] p-4 flex flex-col gap-2" },
            h(FormField, { label: "Poll question" }, h("input", { className: inputCls, value: pollQuestion, onChange: (e) => setPollQuestion(e.target.value) })),
            pollOptions.map((opt, i) => h("input", { key: i, className: inputCls, value: opt, onChange: (e) => setPollOption(i, e.target.value), placeholder: "Option " + (i + 1) })),
            h(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setPollOptions((opts) => [...opts, ""]) }, "Add option"),
            h("label", { className: "flex items-center gap-2 text-sm" }, h("input", { type: "checkbox", checked: pollAllowMultiple, onChange: (e) => setPollAllowMultiple(e.target.checked) }), "Allow multiple choices")
          ),
        h("div", { className: "flex items-center gap-3" }, h(Button, { type: "submit", disabled: busy }, "Create topic"))
      )
    );
  }

  // --------------------------------------------------------------- Topic card
  function TopicCard({ topic }) {
    return h(
      "button",
      { type: "button", onClick: () => navigate("/portal/forum/topic/" + topic.id), className: cx("text-left rounded-2xl p-4 sm:p-5 ring-1 transition hover:ring-[var(--accent)]", topic.isAnnouncement ? "bg-[var(--accent-12)] ring-[var(--accent-30)]" : "bg-white ring-black/5") },
      h(
        "div",
        { className: "flex items-center gap-2 flex-wrap mb-1.5" },
        topic.pinned && h(Pill, { tone: "dark", className: "!py-0.5" }, "Pinned"),
        topic.isAnnouncement && h(Pill, { tone: "accent", className: "!py-0.5" }, "Announcement"),
        topic.locked && h(Pill, { tone: "warn", className: "!py-0.5" }, "Locked"),
        h("span", { className: "text-xs font-mono uppercase tracking-wide text-[var(--ink-soft)]" }, topic.categoryName)
      ),
      h("h3", { className: "font-display font-bold text-[var(--ink)] text-lg" }, topic.title),
      topic.openingSummary && h("p", { className: "text-sm text-[var(--ink-soft)] mt-1 line-clamp-2" }, topic.openingSummary),
      h(
        "div",
        { className: "flex items-center gap-3 mt-2 text-xs text-[var(--ink-soft)]" },
        h("span", null, topic.authorDisplay),
        h("span", null, "·"),
        h("span", null, GUWH.formatRelativeTime(topic.lastActivityAt)),
        h("span", null, "·"),
        h("span", null, topic.replyCount + (topic.replyCount === 1 ? " reply" : " replies"))
      )
    );
  }

  // --------------------------------------------------------------- Forum home (categories + feed)
  function ForumHome() {
    const [categories, setCategories] = React.useState([]);
    const [activeCategory, setActiveCategory] = React.useState(null);
    const [topics, setTopics] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [showSuggest, setShowSuggest] = React.useState(false);
    const [showNewTopic, setShowNewTopic] = React.useState(false);
    const isModerator = isModeratorNow();

    function loadCategories() {
      return GUWH.Identity.authFetch("/api/forum/categories").then((r) => r.json()).then((d) => { if (d.ok) setCategories(d.categories); });
    }
    function loadTopics() {
      setLoading(true);
      const qs = activeCategory ? "?categoryId=" + activeCategory : "";
      return GUWH.Identity.authFetch("/api/forum/topics" + qs)
        .then((r) => r.json())
        .then((d) => { if (d.ok) setTopics(d.topics); else setError(d.error || "Something went wrong"); })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { loadCategories(); }, []);
    React.useEffect(() => { loadTopics(); }, [activeCategory]);

    return h(
      React.Fragment,
      null,
      error && h("p", { className: "text-sm text-[var(--bad)] mb-4" }, error),
      h(
        "div",
        { className: "flex flex-wrap gap-2 mb-4" },
        h("button", { type: "button", onClick: () => setActiveCategory(null), className: cx("px-3.5 py-1.5 rounded-full text-sm font-semibold", activeCategory === null ? "bg-[var(--ink)] text-white" : "bg-[var(--sand)] text-[var(--ink-soft)]") }, "All"),
        categories.map((c) =>
          h(
            "button",
            { key: c.id, type: "button", onClick: () => setActiveCategory(c.id), className: cx("px-3.5 py-1.5 rounded-full text-sm font-semibold", activeCategory === c.id ? "bg-[var(--ink)] text-white" : "bg-[var(--sand)] text-[var(--ink-soft)]") },
            c.name + " (" + c.topicCount + ")"
          )
        )
      ),
      h(
        "div",
        { className: "flex flex-wrap gap-2 mb-6" },
        h(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => setShowSuggest((v) => !v) }, showSuggest ? "Close" : "Suggest a Discussion"),
        isModerator && h(Button, { type: "button", size: "sm", onClick: () => setShowNewTopic((v) => !v) }, showNewTopic ? "Close" : "New Topic")
      ),
      showSuggest && h(SuggestDiscussionForm, { categories, onDone: () => setShowSuggest(false) }),
      showNewTopic && h(NewTopicForm, { categories, onCreated: (id) => { setShowNewTopic(false); navigate("/portal/forum/topic/" + id); } }),
      loading
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…")
        : topics.length === 0
        ? h("p", { className: "text-sm text-[var(--ink-soft)]" }, "No discussions yet — be the first to suggest one.")
        : h("div", { className: "flex flex-col gap-3" }, topics.map((t) => h(TopicCard, { key: t.id, topic: t })))
    );
  }

  // --------------------------------------------------------------- Shell (header, notifications, gate banners)
  function ForumShell({ me, topicId, refreshMe }) {
    const [notifOpen, setNotifOpen] = React.useState(false);
    const p = me.participation;

    async function markRead(ids) {
      await GUWH.Identity.authFetch("/api/forum/me", { method: "POST", body: JSON.stringify({ action: "mark_notifications_read", ids }) });
      refreshMe();
    }
    function goToNotification(n) {
      setNotifOpen(false);
      if (!n.read_at) markRead([n.id]);
      if (n.topic_id) navigate("/portal/forum/topic/" + n.topic_id);
    }

    return h(
      Container,
      { className: "py-10 sm:py-14 max-w-5xl" },
      h(
        "div",
        { className: "flex items-start justify-between gap-4 mb-2" },
        h(SectionHeading, { eyebrow: "Members Forum", title: "Members Forum", sub: "Club chat, game-day talk and announcements — keep it quick, keep it kind." }),
        h(
          "div",
          { className: "relative shrink-0" },
          h(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => setNotifOpen((v) => !v) }, "Notifications", me.unreadCount > 0 && h(Pill, { tone: "accent", className: "!py-0 !px-1.5 ml-1" }, me.unreadCount)),
          notifOpen &&
            h(
              "div",
              { className: "absolute right-0 mt-2 w-80 rounded-2xl bg-white shadow-lg ring-1 ring-black/10 p-2 z-20 max-h-96 overflow-y-auto" },
              me.notifications.length === 0
                ? h("p", { className: "text-sm text-[var(--ink-soft)] p-3" }, "No notifications yet.")
                : me.notifications.map((n) =>
                    h(
                      "button",
                      { key: n.id, type: "button", onClick: () => goToNotification(n), className: cx("block w-full text-left px-3 py-2 rounded-xl text-sm", n.read_at ? "text-[var(--ink-soft)]" : "bg-[var(--accent-10)] text-[var(--ink)] font-semibold") },
                      h("span", { className: "block" }, n.summary),
                      h("span", { className: "block text-[11px] text-[var(--ink-soft)] font-normal mt-0.5" }, GUWH.formatRelativeTime(n.created_at))
                    )
                  ),
              me.notifications.length > 0 && h("button", { type: "button", className: "block w-full text-center text-xs text-[var(--ink-soft)] underline py-2", onClick: () => markRead() }, "Mark all as read")
            )
        )
      ),
      (p.suspended || p.restricted) &&
        h(
          "div",
          { className: "rounded-xl bg-[var(--warn-18)] text-[var(--warn-dark)] px-4 py-3 text-sm font-semibold mb-6" },
          p.suspended ? "Your forum access is temporarily suspended" + (p.suspendedReason ? ": " + p.suspendedReason : ".") : "Your forum posting is currently restricted" + (p.restrictedReason ? ": " + p.restrictedReason : ".")
        ),
      topicId ? h(TopicView, { topicId, onBack: () => navigate("/portal/forum") }) : h(ForumHome)
    );
  }

  // --------------------------------------------------------------- Top level
  function ForumPage({ topicId }) {
    const [me, setMe] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function loadMe() {
      setLoading(true);
      return GUWH.Identity.authFetch("/api/forum/me")
        .then((r) => r.json())
        .then((d) => { if (d.ok) setMe(d); else setError(d.error || "Something went wrong"); })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
    React.useEffect(() => { loadMe(); }, []);

    if (loading) return h(Container, { className: "py-14" }, h("p", { className: "text-sm text-[var(--ink-soft)]" }, "Loading…"));
    if (error || !me) return h(Container, { className: "py-14" }, h("p", { className: "text-sm text-[var(--bad)]" }, error || "Something went wrong"));

    if (!me.eligible) {
      return h(
        Container,
        { className: "py-14 max-w-xl" },
        h(SectionHeading, { eyebrow: "Members Forum", title: "Complete your profile to join" }),
        h("p", { className: "text-sm text-[var(--ink-soft)] mb-4" }, "Before you can use the Members Forum, we need your date of birth on file — it's an adult-members-only space. Head to your Profile page to add it."),
        h(Button, { variant: "primary", onClick: () => navigate("/portal/profile") }, "Go to my Profile")
      );
    }

    const participation = me.participation;
    const needsGuidelines = !participation || !participation.optedIn || !me.guidelines.upToDate;
    if (needsGuidelines) {
      return h(OptInGate, { me, alreadyOptedIn: !!(participation && participation.optedIn), onDone: loadMe });
    }

    return h(ForumShell, { me, topicId: topicId || null, refreshMe: loadMe });
  }

  GUWH.Pages.Forum = ForumPage;
})();
