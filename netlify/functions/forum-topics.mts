// Members Forum — topics: the recency-focused main feed, a single topic's
// full thread, and every Moderator-only topic-management action. Only
// Community Moderators/Administrators can create topics — ordinary members
// go through forum-suggestions.mts instead.
//
// GET /api/forum/topics                    -> main feed (pinned + recent, across categories)
// GET /api/forum/topics?categoryId=1        -> one category's feed
// GET /api/forum/topics?topicId=1           -> full topic + threaded posts
//
// POST /api/forum/topics { action, ... }
//   create_topic   { categoryId, title, openingContent, isAnnouncement?, important?, allowReplies?,
//                     expiresAt?, linkedSessionId?, linkedNewsLabel?, linkedNewsUrl?, linkedEventLabel?,
//                     linkedEventUrl?, poll?: { question, options: string[], allowMultiple?, closesAt?, resultsVisible?, anonymous? } }
//   edit_topic     { topicId, title?, allowReplies?, important?, expiresAt? }
//   pin_topic|unpin_topic     { topicId }
//   lock_topic|unlock_topic   { topicId }
//   move_topic     { topicId, categoryId }
//   merge_topics   { fromTopicId, intoTopicId }
//   archive_topic|unarchive_topic { topicId }
//   vote_poll      { topicId, optionIds: number[] }   -- member action, not moderator-only

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";
import { requireForumAccess, requireModerator } from "./_shared/forum-access.mts";
import { forumDisplayName, isExpired, validatePollVote } from "./_shared/forum.mts";
import { renderWithMentions, recordMentionsAndNotify } from "./_shared/forum-content.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
}

async function loadPollFor(db: any, topicId: number, viewerId: string) {
  const [poll] = await db.sql`select * from forum_polls where topic_id = ${topicId}`;
  if (!poll) return null;
  const options = await db.sql`select id, label, sort_order from forum_poll_options where poll_id = ${poll.id} order by sort_order asc`;
  const myVotes = await db.sql`select option_id from forum_poll_responses where poll_id = ${poll.id} and member_id = ${viewerId}`;
  const myVoteIds = myVotes.map((v: any) => v.option_id);
  const closed = poll.closes_at ? new Date() > new Date(poll.closes_at) : false;
  const showResults = poll.results_visible === "before_vote" || closed || myVoteIds.length > 0;
  let counts: Record<number, number> = {};
  if (showResults) {
    const countRows = await db.sql`select option_id, count(*)::int as n from forum_poll_responses where poll_id = ${poll.id} group by option_id`;
    countRows.forEach((r: any) => (counts[r.option_id] = r.n));
  }
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allow_multiple,
    closesAt: poll.closes_at,
    anonymous: poll.anonymous,
    closed,
    showResults,
    myVoteIds,
    options: options.map((o: any) => ({ id: o.id, label: o.label, count: showResults ? counts[o.id] || 0 : undefined })),
  };
}

function plainSummary(html: string, len = 220): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len - 1) + "…" : text;
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();
  const db = getDatabase();
  const caller = await ensureMember(db, user);

  const access = await requireForumAccess(db, caller);
  if (!access.ok) return access.response;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");

      if (action === "vote_poll") {
        const postingAccess = await requireForumAccess(db, caller, { forPosting: true });
        if (!postingAccess.ok) return postingAccess.response;
        const topicId = Number(body.topicId);
        const [poll] = await db.sql`select * from forum_polls where topic_id = ${topicId}`;
        if (!poll) return badRequest("This topic has no poll");
        const options = await db.sql`select id from forum_poll_options where poll_id = ${poll.id}`;
        const optionIds: number[] = Array.isArray(body.optionIds) ? body.optionIds.map(Number) : [];
        const error = validatePollVote(
          { allowMultiple: poll.allow_multiple, closesAt: poll.closes_at, optionIds: options.map((o: any) => o.id) },
          optionIds
        );
        if (error) return badRequest(error);
        await db.sql`delete from forum_poll_responses where poll_id = ${poll.id} and member_id = ${caller.id}`;
        for (const optionId of optionIds) {
          await db.sql`insert into forum_poll_responses (poll_id, option_id, member_id) values (${poll.id}, ${optionId}, ${caller.id})`;
        }
        return new Response(JSON.stringify({ ok: true, poll: await loadPollFor(db, topicId, caller.id) }), { headers: { "content-type": "application/json" } });
      }

      // Every remaining action is Moderator/Administrator only.
      const modErr = requireModerator(caller);
      if (modErr) return modErr;

      if (action === "create_topic") {
        const categoryId = Number(body.categoryId);
        const title = String(body.title || "").trim();
        if (!categoryId || !title) return badRequest("Category and title are required");
        const [cat] = await db.sql`select id from forum_categories where id = ${categoryId} and archived_at is null`;
        if (!cat) return badRequest("That category doesn't exist or is archived");

        const [topic] = await db.sql`
          insert into forum_topics (
            category_id, title, author_id, is_announcement, important, allow_replies, expires_at,
            linked_session_id, linked_news_label, linked_news_url, linked_event_label, linked_event_url
          ) values (
            ${categoryId}, ${title}, ${caller.id}, ${!!body.isAnnouncement}, ${!!body.important}, ${body.allowReplies !== false}, ${body.expiresAt || null},
            ${body.linkedSessionId || null}, ${body.linkedNewsLabel || null}, ${body.linkedNewsUrl || null}, ${body.linkedEventLabel || null}, ${body.linkedEventUrl || null}
          ) returning id
        `;
        const { html, mentionedIds } = await renderWithMentions(db, String(body.openingContent || ""));
        const [post] = await db.sql`
          insert into forum_posts (topic_id, author_id, body_html, is_opening_post) values (${topic.id}, ${caller.id}, ${html}, true) returning id
        `;
        await recordMentionsAndNotify(db, post.id, topic.id, mentionedIds, caller.id, forumDisplayName(caller.firstName, caller.lastName));

        if (body.poll && Array.isArray(body.poll.options) && body.poll.options.length >= 2) {
          const [poll] = await db.sql`
            insert into forum_polls (topic_id, question, allow_multiple, closes_at, results_visible, anonymous, created_by)
            values (${topic.id}, ${String(body.poll.question || title)}, ${!!body.poll.allowMultiple}, ${body.poll.closesAt || null}, ${body.poll.resultsVisible || "after_vote"}, ${!!body.poll.anonymous}, ${caller.id})
            returning id
          `;
          for (let i = 0; i < body.poll.options.length; i++) {
            await db.sql`insert into forum_poll_options (poll_id, label, sort_order) values (${poll.id}, ${String(body.poll.options[i]).slice(0, 200)}, ${i})`;
          }
        }

        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_topic_created",
          resourceType: "forum_topic", resourceId: String(topic.id), newValue: { title, categoryId },
          note: `${caller.email} created forum topic "${title}"`,
        });
        return new Response(JSON.stringify({ ok: true, topicId: topic.id }), { headers: { "content-type": "application/json" } });
      }

      if (action === "edit_topic") {
        const topicId = Number(body.topicId);
        const [existing] = await db.sql`select * from forum_topics where id = ${topicId}`;
        if (!existing) return badRequest("Topic not found");
        const title = body.title !== undefined ? String(body.title).trim() || existing.title : existing.title;
        await db.sql`
          update forum_topics set title = ${title},
            allow_replies = ${body.allowReplies !== undefined ? !!body.allowReplies : existing.allow_replies},
            important = ${body.important !== undefined ? !!body.important : existing.important},
            expires_at = ${body.expiresAt !== undefined ? body.expiresAt : existing.expires_at},
            updated_at = now()
          where id = ${topicId}
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_topic_edited",
          resourceType: "forum_topic", resourceId: String(topicId), previousValue: { title: existing.title }, newValue: { title },
          note: `${caller.email} edited a forum topic`,
        });
      } else if (action === "pin_topic" || action === "unpin_topic") {
        const topicId = Number(body.topicId);
        await db.sql`update forum_topics set pinned = ${action === "pin_topic"}, updated_at = now() where id = ${topicId}`;
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "forum_topic_pinned", resourceType: "forum_topic", resourceId: String(topicId), newValue: { pinned: action === "pin_topic" }, note: `${caller.email} ${action === "pin_topic" ? "pinned" : "unpinned"} a topic` });
      } else if (action === "lock_topic" || action === "unlock_topic") {
        const topicId = Number(body.topicId);
        await db.sql`update forum_topics set locked = ${action === "lock_topic"}, updated_at = now() where id = ${topicId}`;
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "forum_topic_locked", resourceType: "forum_topic", resourceId: String(topicId), newValue: { locked: action === "lock_topic" }, note: `${caller.email} ${action === "lock_topic" ? "locked" : "reopened"} a topic` });
      } else if (action === "move_topic") {
        const topicId = Number(body.topicId);
        const categoryId = Number(body.categoryId);
        const [cat] = await db.sql`select id from forum_categories where id = ${categoryId}`;
        if (!cat) return badRequest("Destination category doesn't exist");
        const [existing] = await db.sql`select category_id from forum_topics where id = ${topicId}`;
        await db.sql`update forum_topics set category_id = ${categoryId}, updated_at = now() where id = ${topicId}`;
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "forum_topic_moved", resourceType: "forum_topic", resourceId: String(topicId), previousValue: { categoryId: existing?.category_id }, newValue: { categoryId }, note: `${caller.email} moved a topic to another category` });
      } else if (action === "merge_topics") {
        const fromId = Number(body.fromTopicId);
        const intoId = Number(body.intoTopicId);
        if (!fromId || !intoId || fromId === intoId) return badRequest("Two different topics are required");
        const [into] = await db.sql`select id from forum_topics where id = ${intoId}`;
        if (!into) return badRequest("Destination topic not found");
        await db.sql`update forum_posts set topic_id = ${intoId} where topic_id = ${fromId} and is_opening_post = false`;
        await db.sql`update forum_topics set merged_into_id = ${intoId}, archived_at = now(), updated_at = now() where id = ${fromId}`;
        await db.sql`update forum_topics set last_activity_at = now() where id = ${intoId}`;
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "forum_topic_merged", resourceType: "forum_topic", resourceId: String(fromId), newValue: { mergedInto: intoId }, note: `${caller.email} merged a topic into another` });
      } else if (action === "archive_topic" || action === "unarchive_topic") {
        const topicId = Number(body.topicId);
        if (action === "archive_topic") {
          await db.sql`update forum_topics set archived_at = now(), updated_at = now() where id = ${topicId}`;
        } else {
          await db.sql`update forum_topics set archived_at = null, updated_at = now() where id = ${topicId}`;
        }
        await logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: action === "archive_topic" ? "forum_topic_archived" : "forum_topic_unarchived", resourceType: "forum_topic", resourceId: String(topicId), note: `${caller.email} ${action === "archive_topic" ? "archived" : "restored"} a topic` });
      } else {
        return badRequest("Unknown action");
      }
    }

    const url = new URL(req.url);
    const topicIdParam = url.searchParams.get("topicId");
    const categoryIdParam = url.searchParams.get("categoryId");

    if (topicIdParam) {
      const topicId = Number(topicIdParam);
      const [topic] = await db.sql`
        select t.*, c.name as category_name, c.slug as category_slug, m.first_name, m.last_name
        from forum_topics t join forum_categories c on c.id = t.category_id left join members m on m.id = t.author_id
        where t.id = ${topicId}
      `;
      if (!topic) return badRequest("Topic not found");

      const posts = await db.sql`
        select p.id, p.parent_post_id, p.author_id, p.body_html, p.is_opening_post, p.edited_at, p.edited_by_moderator,
          p.hidden_at, p.removed_at, p.deleted_by_author_at, p.created_at,
          m.first_name, m.last_name, fp.show_photo, fp.show_grade, mem.grade
        from forum_posts p
        left join members m on m.id = p.author_id
        left join forum_participation fp on fp.member_id = p.author_id
        left join members mem on mem.id = p.author_id
        where p.topic_id = ${topicId}
        order by p.created_at asc
      `;
      const postIds = posts.map((p: any) => p.id);
      const reactionRows = postIds.length
        ? await db.sql`select post_id, member_id, reaction from forum_reactions where post_id = any(${postIds})`
        : [];
      const reactionsByPost: Record<number, { reaction: string; count: number; mine: boolean }[]> = {};
      postIds.forEach((id: number) => (reactionsByPost[id] = []));
      const grouped: Record<string, { reaction: string; count: number; mine: boolean }> = {};
      reactionRows.forEach((r: any) => {
        const key = `${r.post_id}:${r.reaction}`;
        if (!grouped[key]) grouped[key] = { reaction: r.reaction, count: 0, mine: false };
        grouped[key].count++;
        if (r.member_id === caller.id) grouped[key].mine = true;
      });
      Object.entries(grouped).forEach(([key, val]) => {
        const postId = Number(key.split(":")[0]);
        reactionsByPost[postId].push(val);
      });

      const isModerator = access.isModerator;
      const shapedPosts = posts.map((p: any) => {
        const removed = !!p.removed_at || !!p.deleted_by_author_at;
        const hidden = !!p.hidden_at;
        const canSeeContent = isModerator || !(removed || hidden);
        return {
          id: p.id,
          parentPostId: p.parent_post_id,
          authorId: p.author_id,
          authorDisplay: p.first_name ? forumDisplayName(p.first_name, p.last_name) : "Former member",
          authorShowPhoto: !!p.show_photo,
          authorGrade: p.show_grade ? p.grade : null,
          bodyHtml: canSeeContent ? p.body_html : p.deleted_by_author_at ? "<p><em>Comment removed by author.</em></p>" : "<p><em>Comment removed by a Moderator.</em></p>",
          isOpeningPost: p.is_opening_post,
          editedAt: p.edited_at,
          editedByModerator: p.edited_by_moderator,
          hidden,
          removed,
          createdAt: p.created_at,
          canEditWindowOpen: p.author_id === caller.id && !removed && !hidden,
          reactions: reactionsByPost[p.id] || [],
        };
      });

      const [followRow] = await db.sql`select state, notify from forum_topic_followers where topic_id = ${topicId} and member_id = ${caller.id}`;
      const [followerCountRow] = await db.sql`select count(*)::int as count from forum_topic_followers where topic_id = ${topicId} and state = 'following'`;

      return new Response(
        JSON.stringify({
          ok: true,
          topic: {
            id: topic.id,
            title: topic.title,
            categoryId: topic.category_id,
            categoryName: topic.category_name,
            authorDisplay: topic.first_name ? forumDisplayName(topic.first_name, topic.last_name) : "Former member",
            pinned: topic.pinned,
            locked: topic.locked,
            archived: !!topic.archived_at,
            isAnnouncement: topic.is_announcement,
            important: topic.important,
            allowReplies: topic.allow_replies,
            expiresAt: topic.expires_at,
            expired: isExpired(topic.expires_at),
            linkedSessionId: topic.linked_session_id,
            linkedNewsLabel: topic.linked_news_label,
            linkedNewsUrl: topic.linked_news_url,
            linkedEventLabel: topic.linked_event_label,
            linkedEventUrl: topic.linked_event_url,
            createdAt: topic.created_at,
            lastActivityAt: topic.last_activity_at,
            followState: followRow ? followRow.state : "none",
            followerCount: followerCountRow?.count || 0,
            replyCount: posts.filter((p: any) => !p.is_opening_post).length,
          },
          posts: shapedPosts,
          poll: await loadPollFor(db, topicId, caller.id),
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // Feed (main, or one category) — pinned first, then recency order.
    const categoryFilter = categoryIdParam ? Number(categoryIdParam) : null;
    const topics = await db.sql`
      select t.id, t.title, t.category_id, c.name as category_name, m.first_name, m.last_name,
        t.pinned, t.locked, t.archived_at, t.is_announcement, t.important, t.expires_at,
        t.created_at, t.last_activity_at,
        (select count(*)::int from forum_posts p where p.topic_id = t.id and p.is_opening_post = false) as reply_count,
        (select count(*)::int from forum_topic_followers f where f.topic_id = t.id and f.state = 'following') as follower_count,
        (select p.body_html from forum_posts p where p.topic_id = t.id and p.is_opening_post = true limit 1) as opening_html
      from forum_topics t
      join forum_categories c on c.id = t.category_id
      left join members m on m.id = t.author_id
      where t.archived_at is null and (${categoryFilter}::int is null or t.category_id = ${categoryFilter})
      order by t.pinned desc, t.last_activity_at desc
      limit 40
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        topics: topics.map((t: any) => ({
          id: t.id,
          title: t.title,
          categoryId: t.category_id,
          categoryName: t.category_name,
          authorDisplay: t.first_name ? forumDisplayName(t.first_name, t.last_name) : "Former member",
          pinned: t.pinned,
          locked: t.locked,
          isAnnouncement: t.is_announcement,
          important: t.important,
          expired: isExpired(t.expires_at),
          createdAt: t.created_at,
          lastActivityAt: t.last_activity_at,
          replyCount: t.reply_count,
          followerCount: t.follower_count,
          openingSummary: plainSummary(t.opening_html || ""),
        })),
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/topics" };
