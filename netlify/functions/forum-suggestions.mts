// Members Forum — "Suggest a Discussion". Members can't create topics
// directly; they submit a suggestion, and a Community Moderator/
// Administrator reviews it: approve (publishes a real topic) or decline
// (with an internal reason), and the submitter is notified either way.
//
// GET  /api/forum/suggestions -> { ok, mine: [...], pending?: [...] }
//   `pending` (all open suggestions) is only included for Moderators/Admins.
// POST /api/forum/suggestions { action, ... }
//   submit  { suggestedTitle, suggestedCategoryId, explanation, openingContent? }
//   approve { suggestionId, title?, categoryId?, openingContent? }   -- moderator
//   decline { suggestionId, reason }                                 -- moderator

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";
import { requireForumAccess, requireModerator } from "./_shared/forum-access.mts";
import { forumDisplayName } from "./_shared/forum.mts";
import { renderWithMentions, recordMentionsAndNotify } from "./_shared/forum-content.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
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

      if (action === "submit") {
        const postingAccess = await requireForumAccess(db, caller, { forPosting: true });
        if (!postingAccess.ok) return postingAccess.response;
        const title = String(body.suggestedTitle || "").trim();
        const explanation = String(body.explanation || "").trim();
        if (!title) return badRequest("A suggested title is required");
        if (!explanation) return badRequest("A short explanation is required");
        const categoryId = body.suggestedCategoryId ? Number(body.suggestedCategoryId) : null;
        const [row] = await db.sql`
          insert into forum_suggestions (suggested_by, suggested_title, suggested_category_id, explanation, opening_content)
          values (${caller.id}, ${title}, ${categoryId}, ${explanation}, ${body.openingContent || null})
          returning id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_suggestion_submitted",
          resourceType: "forum_suggestion", resourceId: String(row.id), newValue: { title },
          note: `${caller.email} suggested a discussion: "${title}"`,
        });
      } else if (action === "approve") {
        const modErr = requireModerator(caller);
        if (modErr) return modErr;
        const suggestionId = Number(body.suggestionId);
        const [s] = await db.sql`select * from forum_suggestions where id = ${suggestionId} and status = 'pending'`;
        if (!s) return badRequest("That suggestion isn't pending review");
        const title = body.title !== undefined ? String(body.title).trim() || s.suggested_title : s.suggested_title;
        const categoryId = body.categoryId ? Number(body.categoryId) : s.suggested_category_id;
        if (!categoryId) return badRequest("A category is required to publish this suggestion");
        const openingContent = body.openingContent !== undefined ? body.openingContent : s.opening_content || s.explanation;

        const [topic] = await db.sql`
          insert into forum_topics (category_id, title, author_id) values (${categoryId}, ${title}, ${s.suggested_by}) returning id
        `;
        const { html, mentionedIds } = await renderWithMentions(db, String(openingContent || ""));
        const [post] = await db.sql`
          insert into forum_posts (topic_id, author_id, body_html, is_opening_post) values (${topic.id}, ${s.suggested_by}, ${html}, true) returning id
        `;
        await recordMentionsAndNotify(db, post.id, topic.id, mentionedIds, s.suggested_by, "");

        await db.sql`
          update forum_suggestions set status = 'approved', reviewed_by = ${caller.id}, reviewed_at = now(), published_topic_id = ${topic.id}
          where id = ${suggestionId}
        `;
        await db.sql`
          insert into forum_notifications (member_id, kind, topic_id, actor_id, summary)
          values (${s.suggested_by}, 'suggestion_approved', ${topic.id}, ${caller.id}, ${"Your suggested discussion \"" + title + "\" was published"})
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_suggestion_approved",
          resourceType: "forum_suggestion", resourceId: String(suggestionId), newValue: { title, topicId: topic.id },
          note: `${caller.email} approved a suggestion and published it as a topic`,
        });
      } else if (action === "decline") {
        const modErr = requireModerator(caller);
        if (modErr) return modErr;
        const suggestionId = Number(body.suggestionId);
        const reason = String(body.reason || "").trim();
        const [s] = await db.sql`select * from forum_suggestions where id = ${suggestionId} and status = 'pending'`;
        if (!s) return badRequest("That suggestion isn't pending review");
        await db.sql`update forum_suggestions set status = 'declined', decline_reason = ${reason || null}, reviewed_by = ${caller.id}, reviewed_at = now() where id = ${suggestionId}`;
        await db.sql`
          insert into forum_notifications (member_id, kind, actor_id, summary)
          values (${s.suggested_by}, 'suggestion_declined', ${caller.id}, ${"Your suggested discussion \"" + s.suggested_title + "\" wasn't published"})
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_suggestion_declined",
          resourceType: "forum_suggestion", resourceId: String(suggestionId), newValue: { reason },
          note: `${caller.email} declined a discussion suggestion`,
        });
      } else {
        return badRequest("Unknown action");
      }
    }

    const mine = await db.sql`
      select id, suggested_title, explanation, status, decline_reason, published_topic_id, created_at
      from forum_suggestions where suggested_by = ${caller.id} order by created_at desc limit 50
    `;
    let pending: any[] = [];
    if (access.isModerator) {
      pending = await db.sql`
        select s.id, s.suggested_title, s.explanation, s.opening_content, s.created_at, s.suggested_category_id,
          m.first_name, m.last_name
        from forum_suggestions s join members m on m.id = s.suggested_by
        where s.status = 'pending' order by s.created_at asc
      `;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mine,
        pending: access.isModerator
          ? pending.map((p: any) => ({
              id: p.id,
              suggestedTitle: p.suggested_title,
              explanation: p.explanation,
              openingContent: p.opening_content,
              createdAt: p.created_at,
              suggestedCategoryId: p.suggested_category_id,
              suggestedBy: forumDisplayName(p.first_name, p.last_name),
            }))
          : undefined,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/suggestions" };
