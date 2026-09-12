// Members Forum — posts: creating replies (including threaded replies to a
// specific comment), the member's own one-hour edit/delete window, reactions,
// reporting, and every Moderator content action.
//
// POST /api/forum/posts { action, ... }
//   create_post        { topicId, parentPostId?, body }
//   edit_post          { postId, body }                       -- author only, within 1hr (server time)
//   delete_post        { postId }                              -- author only, within 1hr; soft delete
//   moderator_edit_post{ postId, body, reason }                -- moderator, any time
//   hide_post          { postId, reason? }                     -- moderator
//   unhide_post        { postId }                              -- moderator
//   remove_post        { postId, reason? }                     -- moderator
//   react              { postId, reaction }
//   unreact            { postId, reaction }
//   report             { targetType: 'topic'|'post', targetId, reason, explanation? }
//
// Every content-changing action re-derives "now" on the server — the
// one-hour window is never taken from anything the client sends.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";
import { requireForumAccess, requireModerator } from "./_shared/forum-access.mts";
import { withinEditWindow, isReaction, isReportReason, forumDisplayName } from "./_shared/forum.mts";
import { renderWithMentions, recordMentionsAndNotify, notifyTopicActivity } from "./_shared/forum-content.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();
  const db = getDatabase();
  const caller = await ensureMember(db, user);
  const callerDisplay = forumDisplayName(caller.firstName, caller.lastName);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_post") {
      const access = await requireForumAccess(db, caller, { forPosting: true });
      if (!access.ok) return access.response;
      const topicId = Number(body.topicId);
      const raw = String(body.body || "").trim();
      if (!raw) return badRequest("Write something before posting");
      const [topic] = await db.sql`select id, locked, archived_at, allow_replies from forum_topics where id = ${topicId}`;
      if (!topic || topic.archived_at) return badRequest("This topic isn't open for replies");
      if (topic.locked) return badRequest("This topic is locked");
      if (!topic.allow_replies) return badRequest("Replies aren't allowed on this announcement");

      let parentPostId: number | null = null;
      let parentAuthorId: string | null = null;
      if (body.parentPostId) {
        const [parent] = await db.sql`select id, author_id from forum_posts where id = ${Number(body.parentPostId)} and topic_id = ${topicId}`;
        if (!parent) return badRequest("That comment no longer exists in this topic");
        parentPostId = parent.id;
        parentAuthorId = parent.author_id;
      }

      const { html, mentionedIds } = await renderWithMentions(db, raw);
      const [post] = await db.sql`
        insert into forum_posts (topic_id, parent_post_id, author_id, body_html) values (${topicId}, ${parentPostId}, ${caller.id}, ${html}) returning id, created_at
      `;
      await db.sql`update forum_topics set last_activity_at = now() where id = ${topicId}`;
      await recordMentionsAndNotify(db, post.id, topicId, mentionedIds, caller.id, callerDisplay);
      await notifyTopicActivity(db, topicId, post.id, caller.id, callerDisplay, parentPostId ? "reply_to_comment" : "reply", parentAuthorId);

      return new Response(JSON.stringify({ ok: true, postId: post.id, createdAt: post.created_at }), { headers: { "content-type": "application/json" } });
    }

    if (action === "edit_post") {
      const postId = Number(body.postId);
      const [post] = await db.sql`select * from forum_posts where id = ${postId}`;
      if (!post) return badRequest("Post not found");
      if (post.author_id !== caller.id) return badRequest("You can only edit your own posts");
      if (post.removed_at || post.hidden_at || post.deleted_by_author_at) return badRequest("This post can't be edited");
      if (!withinEditWindow(post.created_at)) return badRequest("The one-hour edit window for this post has passed. Ask a Moderator for help, or report it.");
      const raw = String(body.body || "").trim();
      if (!raw) return badRequest("Write something before saving");
      await db.sql`insert into forum_post_revisions (post_id, body_html, edited_by, edited_by_moderator) values (${postId}, ${post.body_html}, ${caller.id}, false)`;
      const { html, mentionedIds } = await renderWithMentions(db, raw);
      await db.sql`update forum_posts set body_html = ${html}, edited_at = now(), updated_at = now() where id = ${postId}`;
      await recordMentionsAndNotify(db, postId, post.topic_id, mentionedIds, caller.id, callerDisplay);
    } else if (action === "delete_post") {
      const postId = Number(body.postId);
      const [post] = await db.sql`select * from forum_posts where id = ${postId}`;
      if (!post) return badRequest("Post not found");
      if (post.author_id !== caller.id) return badRequest("You can only delete your own posts");
      if (!withinEditWindow(post.created_at)) return badRequest("The one-hour delete window for this post has passed. Ask a Moderator for help, or report it.");
      await db.sql`update forum_posts set deleted_by_author_at = now(), updated_at = now() where id = ${postId}`;
    } else if (action === "moderator_edit_post") {
      const modErr = requireModerator(caller);
      if (modErr) return modErr;
      const postId = Number(body.postId);
      const reason = String(body.reason || "").trim();
      if (!reason) return badRequest("A reason is required for a Moderator edit");
      const [post] = await db.sql`select * from forum_posts where id = ${postId}`;
      if (!post) return badRequest("Post not found");
      const raw = String(body.body || "").trim();
      if (!raw) return badRequest("Write something before saving");
      await db.sql`insert into forum_post_revisions (post_id, body_html, edited_by, edited_by_moderator, reason) values (${postId}, ${post.body_html}, ${caller.id}, true, ${reason})`;
      const { html } = await renderWithMentions(db, raw);
      await db.sql`update forum_posts set body_html = ${html}, edited_at = now(), edited_by_moderator = true, moderator_edit_reason = ${reason}, updated_at = now() where id = ${postId}`;
      if (post.author_id) {
        await db.sql`
          insert into forum_notifications (member_id, kind, topic_id, post_id, actor_id, summary)
          values (${post.author_id}, 'moderation_action', ${post.topic_id}, ${postId}, ${caller.id}, 'A Moderator edited one of your forum posts')
        `;
      }
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "forum_post_moderator_edited",
        resourceType: "forum_post", resourceId: String(postId), previousValue: { body: post.body_html }, newValue: { reason },
        note: `${caller.email} edited a member's post: ${reason}`,
      });
    } else if (action === "hide_post" || action === "unhide_post") {
      const modErr = requireModerator(caller);
      if (modErr) return modErr;
      const postId = Number(body.postId);
      if (action === "hide_post") {
        await db.sql`update forum_posts set hidden_at = now(), hidden_by = ${caller.id}, hidden_reason = ${body.reason || null}, updated_at = now() where id = ${postId}`;
      } else {
        await db.sql`update forum_posts set hidden_at = null, hidden_by = null, hidden_reason = null, updated_at = now() where id = ${postId}`;
      }
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: action === "hide_post" ? "forum_post_hidden" : "forum_post_unhidden",
        resourceType: "forum_post", resourceId: String(postId), newValue: { reason: body.reason }, note: `${caller.email} ${action === "hide_post" ? "hid" : "unhid"} a post`,
      });
    } else if (action === "remove_post") {
      const modErr = requireModerator(caller);
      if (modErr) return modErr;
      const postId = Number(body.postId);
      await db.sql`update forum_posts set removed_at = now(), removed_by = ${caller.id}, removed_reason = ${body.reason || null}, updated_at = now() where id = ${postId}`;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "forum_post_removed",
        resourceType: "forum_post", resourceId: String(postId), newValue: { reason: body.reason }, note: `${caller.email} removed a post`,
      });
    } else if (action === "react" || action === "unreact") {
      const access = await requireForumAccess(db, caller, { forPosting: true });
      if (!access.ok) return access.response;
      const postId = Number(body.postId);
      const reaction = String(body.reaction || "");
      if (!isReaction(reaction)) return badRequest("Unknown reaction");
      if (action === "react") {
        await db.sql`insert into forum_reactions (post_id, member_id, reaction) values (${postId}, ${caller.id}, ${reaction}) on conflict do nothing`;
      } else {
        await db.sql`delete from forum_reactions where post_id = ${postId} and member_id = ${caller.id} and reaction = ${reaction}`;
      }
    } else if (action === "report") {
      const access = await requireForumAccess(db, caller);
      if (!access.ok) return access.response;
      const targetType = String(body.targetType || "");
      const targetId = Number(body.targetId);
      const reason = String(body.reason || "");
      if (!["topic", "post", "attachment"].includes(targetType) || !targetId) return badRequest("Invalid report target");
      if (!isReportReason(reason)) return badRequest("Invalid report reason");
      const [report] = await db.sql`
        insert into forum_reports (target_type, target_id, reporter_id, reason, explanation)
        values (${targetType}, ${targetId}, ${caller.id}, ${reason}, ${body.explanation || null})
        returning id
      `;
      await logAudit(db, {
        actorId: caller.id, actorEmail: caller.email, action: "forum_content_reported",
        resourceType: "forum_report", resourceId: String(report.id), newValue: { targetType, targetId, reason },
        note: `A member reported forum ${targetType} #${targetId}`,
      });
    } else {
      return badRequest("Unknown action");
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/posts" };
