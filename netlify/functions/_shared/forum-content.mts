// Shared DB-touching helper for turning a member's raw post text into safe
// HTML plus a resolved mentions list — used by forum-topics.mts (opening
// post), forum-posts.mts (replies) and forum-suggestions.mts (publishing an
// approved suggestion), so all three follow exactly the same mention-safety
// rule: only real, adult, opted-in members can ever be mentioned.

import { renderForumMarkup, extractMentionTokens } from "./forum.mts";

export async function renderWithMentions(db: any, raw: string): Promise<{ html: string; mentionedIds: string[] }> {
  const tokens = extractMentionTokens(raw);
  const map = new Map<string, { memberId: string; display: string }>();
  for (const token of tokens) {
    const m = /^(.+) ([A-Za-z])\.$/.exec(token);
    if (!m) continue;
    const [, first, initial] = m;
    const rows = await db.sql`
      select m.id, m.first_name, m.last_name from members m
      join forum_participation fp on fp.member_id = m.id and fp.opted_in = true
      where m.date_of_birth is not null and date_part('year', age(m.date_of_birth)) >= 18
        and lower(m.first_name) = lower(${first}) and lower(left(m.last_name, 1)) = lower(${initial})
      limit 1
    `;
    if (rows[0]) map.set(token.toLowerCase(), { memberId: rows[0].id, display: `${rows[0].first_name} ${String(rows[0].last_name || "").charAt(0).toUpperCase()}.` });
  }
  const html = renderForumMarkup(raw, map);
  return { html, mentionedIds: [...new Set([...map.values()].map((v) => v.memberId))] };
}

export async function recordMentionsAndNotify(
  db: any,
  postId: number,
  topicId: number,
  mentionedIds: string[],
  actorId: string,
  actorDisplay: string
) {
  for (const memberId of mentionedIds) {
    if (memberId === actorId) continue; // no self-notification
    await db.sql`insert into forum_mentions (post_id, mentioned_member_id) values (${postId}, ${memberId})`;
    await db.sql`
      insert into forum_notifications (member_id, kind, topic_id, post_id, actor_id, summary)
      values (${memberId}, 'mention', ${topicId}, ${postId}, ${actorId}, ${actorDisplay + " mentioned you in the forum"})
    `;
  }
}

// Notifies followers of a topic (and, for a brand-new reply, the parent
// post's author) that a new post landed — skips the poster themselves and
// anyone who has muted the topic. Per-member email delivery is out of scope
// here (no email provider connected yet); this only ever writes the in-app
// notification row that a future email step would also read from.
export async function notifyTopicActivity(db: any, topicId: number, postId: number, actorId: string, actorDisplay: string, kind: "reply" | "reply_to_comment", parentAuthorId: string | null) {
  const followers = await db.sql`
    select member_id, state from forum_topic_followers where topic_id = ${topicId} and member_id != ${actorId}
  `;
  const notified = new Set<string>();
  for (const f of followers) {
    if (f.state === "muted") continue;
    notified.add(f.member_id);
    await db.sql`
      insert into forum_notifications (member_id, kind, topic_id, post_id, actor_id, summary)
      values (${f.member_id}, 'reply', ${topicId}, ${postId}, ${actorId}, ${actorDisplay + " replied in a discussion you're following"})
    `;
  }
  if (kind === "reply_to_comment" && parentAuthorId && parentAuthorId !== actorId && !notified.has(parentAuthorId)) {
    await db.sql`
      insert into forum_notifications (member_id, kind, topic_id, post_id, actor_id, summary)
      values (${parentAuthorId}, 'reply_to_comment', ${topicId}, ${postId}, ${actorId}, ${actorDisplay + " replied to your comment"})
    `;
  }
}
