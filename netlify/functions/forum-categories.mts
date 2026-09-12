// Members Forum — categories. Members-only reading; only Community
// Moderators/Administrators can create, edit, reorder or archive them.
//
// GET  /api/forum/categories -> { ok, categories: [{ id, slug, name, description, sortOrder, postingRule, topicCount, lastActivityAt }] }
// POST /api/forum/categories { action, ... }
//   create_category   { name, description?, postingRule? }
//   update_category    { categoryId, name?, description?, postingRule? }
//   reorder_categories { orderedIds: number[] }
//   archive_category    { categoryId }
//   unarchive_category  { categoryId }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";
import { requireForumAccess, requireModerator } from "./_shared/forum-access.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
}
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "category";
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
      const modErr = requireModerator(caller);
      if (modErr) return modErr;

      if (action === "create_category") {
        const name = String(body.name || "").trim();
        if (!name) return badRequest("Category name is required");
        let slug = slugify(name);
        const [dupe] = await db.sql`select id from forum_categories where slug = ${slug}`;
        if (dupe) slug = `${slug}-${Date.now().toString(36)}`;
        const [{ next }] = await db.sql`select coalesce(max(sort_order), -1) + 1 as next from forum_categories`;
        const [cat] = await db.sql`
          insert into forum_categories (slug, name, description, sort_order, posting_rule, created_by, updated_by)
          values (${slug}, ${name}, ${body.description || null}, ${next}, ${body.postingRule === "moderators_only" ? "moderators_only" : "members"}, ${caller.id}, ${caller.id})
          returning id
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_category_created",
          resourceType: "forum_category", resourceId: String(cat.id), newValue: { name }, note: `${caller.email} created forum category "${name}"`,
        });
      } else if (action === "update_category") {
        const categoryId = Number(body.categoryId);
        const [existing] = await db.sql`select * from forum_categories where id = ${categoryId}`;
        if (!existing) return badRequest("Category not found");
        const name = body.name !== undefined ? String(body.name).trim() || existing.name : existing.name;
        const description = body.description !== undefined ? body.description : existing.description;
        const postingRule = body.postingRule === "moderators_only" || body.postingRule === "members" ? body.postingRule : existing.posting_rule;
        await db.sql`
          update forum_categories set name = ${name}, description = ${description}, posting_rule = ${postingRule}, updated_by = ${caller.id}, updated_at = now()
          where id = ${categoryId}
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_category_edited",
          resourceType: "forum_category", resourceId: String(categoryId),
          previousValue: { name: existing.name, postingRule: existing.posting_rule }, newValue: { name, postingRule },
          note: `${caller.email} edited a forum category`,
        });
      } else if (action === "reorder_categories") {
        const orderedIds: number[] = Array.isArray(body.orderedIds) ? body.orderedIds.map(Number) : [];
        for (let i = 0; i < orderedIds.length; i++) {
          await db.sql`update forum_categories set sort_order = ${i}, updated_by = ${caller.id}, updated_at = now() where id = ${orderedIds[i]}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_category_reordered",
          resourceType: "forum_category", resourceId: null, newValue: { order: orderedIds }, note: `${caller.email} reordered forum categories`,
        });
      } else if (action === "archive_category" || action === "unarchive_category") {
        const categoryId = Number(body.categoryId);
        if (action === "archive_category") {
          await db.sql`update forum_categories set archived_at = now(), updated_by = ${caller.id}, updated_at = now() where id = ${categoryId}`;
        } else {
          await db.sql`update forum_categories set archived_at = null, updated_by = ${caller.id}, updated_at = now() where id = ${categoryId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: action === "archive_category" ? "forum_category_archived" : "forum_category_unarchived",
          resourceType: "forum_category", resourceId: String(categoryId), note: `${caller.email} ${action === "archive_category" ? "archived" : "restored"} a forum category`,
        });
      } else {
        return badRequest("Unknown action");
      }
    }

    const includeArchived = access.isModerator;
    const categories = await db.sql`
      select c.id, c.slug, c.name, c.description, c.sort_order, c.posting_rule, c.archived_at,
        (select count(*)::int from forum_topics t where t.category_id = c.id and t.archived_at is null) as topic_count,
        (select max(t.last_activity_at) from forum_topics t where t.category_id = c.id and t.archived_at is null) as last_activity_at
      from forum_categories c
      where (c.archived_at is null or ${includeArchived})
      order by c.sort_order asc, c.id asc
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        categories: categories.map((c: any) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          sortOrder: c.sort_order,
          postingRule: c.posting_rule,
          archived: !!c.archived_at,
          topicCount: c.topic_count,
          lastActivityAt: c.last_activity_at,
        })),
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/categories" };
