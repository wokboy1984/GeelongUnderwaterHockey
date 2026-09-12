// Members Forum — Community Moderator / Administrator workspace: reports,
// media approval, member restrictions/suspensions, moderation notes, and a
// recent-activity summary for the Community & Content page.
//
// GET /api/forum/moderation -> {
//   ok, pendingSuggestionsCount, openReports, mediaAwaitingApproval,
//   restrictedMembers, suspendedMembers, recentDiscussions, recentActivity
// }
//
// POST /api/forum/moderation { action, ... }
//   assign_report      { reportId }
//   resolve_report      { reportId, status: 'resolved'|'dismissed', resolution }
//   add_moderation_note { reportId?, memberId?, note }
//   restrict_member      { memberId, reason }
//   unrestrict_member    { memberId }
//   suspend_member       { memberId, reason, until? }   -- omit until for indefinite
//   unsuspend_member     { memberId }
//   approve_media        { attachmentId }
//   reject_media         { attachmentId, reason? }

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";
import { requireModerator } from "./_shared/forum-access.mts";
import { forumDisplayName } from "./_shared/forum.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();
  const db = getDatabase();
  const caller = await ensureMember(db, user);
  const modErr = requireModerator(caller);
  if (modErr) return modErr;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");

      if (action === "assign_report") {
        const reportId = Number(body.reportId);
        await db.sql`update forum_reports set assigned_moderator_id = ${caller.id}, status = 'in_review' where id = ${reportId}`;
      } else if (action === "resolve_report") {
        const reportId = Number(body.reportId);
        const status = body.status === "dismissed" ? "dismissed" : "resolved";
        const [report] = await db.sql`select * from forum_reports where id = ${reportId}`;
        if (!report) return badRequest("Report not found");
        await db.sql`
          update forum_reports set status = ${status}, resolution = ${body.resolution || null}, resolved_by = ${caller.id}, resolved_at = now()
          where id = ${reportId}
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_report_resolved",
          resourceType: "forum_report", resourceId: String(reportId), newValue: { status, resolution: body.resolution },
          note: `${caller.email} ${status} a forum report`,
        });
      } else if (action === "add_moderation_note") {
        const reportId = body.reportId ? Number(body.reportId) : null;
        const memberId = body.memberId || null;
        const note = String(body.note || "").trim();
        if (!note) return badRequest("Note text is required");
        if (!reportId && !memberId) return badRequest("A report or a member must be specified");
        await db.sql`insert into forum_moderation_notes (report_id, member_id, moderator_id, note) values (${reportId}, ${memberId}, ${caller.id}, ${note})`;
      } else if (action === "restrict_member" || action === "unrestrict_member") {
        const memberId = String(body.memberId || "");
        if (!memberId) return badRequest("Missing memberId");
        if (action === "restrict_member") {
          const reason = String(body.reason || "").trim();
          if (!reason) return badRequest("A reason is required");
          await db.sql`
            insert into forum_participation (member_id, restricted_at, restricted_reason, restricted_by)
            values (${memberId}, now(), ${reason}, ${caller.id})
            on conflict (member_id) do update set restricted_at = now(), restricted_reason = excluded.restricted_reason, restricted_by = excluded.restricted_by, updated_at = now()
          `;
          await db.sql`insert into forum_notifications (member_id, kind, actor_id, summary) values (${memberId}, 'moderation_action', ${caller.id}, 'A Moderator has restricted your forum posting')`;
        } else {
          await db.sql`update forum_participation set restricted_at = null, restricted_reason = null, restricted_by = null, updated_at = now() where member_id = ${memberId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: action === "restrict_member" ? "forum_member_restricted" : "forum_member_unrestricted",
          resourceType: "forum_participation", resourceId: memberId, newValue: { reason: body.reason }, note: `${caller.email} updated a member's forum posting restriction`,
        });
      } else if (action === "suspend_member" || action === "unsuspend_member") {
        const memberId = String(body.memberId || "");
        if (!memberId) return badRequest("Missing memberId");
        if (action === "suspend_member") {
          const reason = String(body.reason || "").trim();
          if (!reason) return badRequest("A reason is required");
          await db.sql`
            insert into forum_participation (member_id, suspended_at, suspended_until, suspended_reason, suspended_by)
            values (${memberId}, now(), ${body.until || null}, ${reason}, ${caller.id})
            on conflict (member_id) do update set suspended_at = now(), suspended_until = excluded.suspended_until, suspended_reason = excluded.suspended_reason, suspended_by = excluded.suspended_by, updated_at = now()
          `;
          await db.sql`insert into forum_notifications (member_id, kind, actor_id, summary) values (${memberId}, 'moderation_action', ${caller.id}, 'Your forum access has been temporarily suspended')`;
        } else {
          await db.sql`update forum_participation set suspended_at = null, suspended_until = null, suspended_reason = null, suspended_by = null, updated_at = now() where member_id = ${memberId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: action === "suspend_member" ? "forum_member_suspended" : "forum_member_unsuspended",
          resourceType: "forum_participation", resourceId: memberId, newValue: { reason: body.reason, until: body.until }, note: `${caller.email} updated a member's forum suspension`,
        });
      } else if (action === "approve_media" || action === "reject_media") {
        const attachmentId = Number(body.attachmentId);
        if (action === "approve_media") {
          await db.sql`update forum_attachments set approved_at = now(), approved_by = ${caller.id} where id = ${attachmentId}`;
        } else {
          await db.sql`delete from forum_attachments where id = ${attachmentId}`;
        }
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: action === "approve_media" ? "forum_media_approved" : "forum_media_rejected",
          resourceType: "forum_attachment", resourceId: String(attachmentId), newValue: { reason: body.reason }, note: `${caller.email} ${action === "approve_media" ? "approved" : "rejected"} forum media`,
        });
      } else {
        return badRequest("Unknown action");
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    const [suggestionCount] = await db.sql`select count(*)::int as count from forum_suggestions where status = 'pending'`;
    const openReports = await db.sql`
      select r.*, m.first_name, m.last_name from forum_reports r join members m on m.id = r.reporter_id
      where r.status in ('open', 'in_review') order by r.created_at asc limit 30
    `;
    const mediaAwaitingApproval = await db.sql`
      select a.id, a.kind, a.file_name, a.content_type, a.post_id, a.created_at, m.first_name, m.last_name
      from forum_attachments a left join members m on m.id = a.created_by
      where a.approved_at is null and a.kind in ('image', 'video', 'document') order by a.created_at asc limit 30
    `;
    const restrictedMembers = await db.sql`
      select fp.member_id, fp.restricted_reason, fp.restricted_at, m.first_name, m.last_name
      from forum_participation fp join members m on m.id = fp.member_id where fp.restricted_at is not null
    `;
    const suspendedMembers = await db.sql`
      select fp.member_id, fp.suspended_reason, fp.suspended_at, fp.suspended_until, m.first_name, m.last_name
      from forum_participation fp join members m on m.id = fp.member_id
      where fp.suspended_at is not null and (fp.suspended_until is null or fp.suspended_until > now())
    `;
    const recentDiscussions = await db.sql`
      select t.id, t.title, t.last_activity_at, c.name as category_name
      from forum_topics t join forum_categories c on c.id = t.category_id
      where t.archived_at is null order by t.last_activity_at desc limit 10
    `;
    const recentActivity = await db.sql`
      select action, actor_email, resource_type, resource_id, note, created_at from audit_log
      where action like 'forum_%' order by created_at desc limit 25
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        pendingSuggestionsCount: suggestionCount?.count || 0,
        openReports: openReports.map((r: any) => ({
          id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, explanation: r.explanation,
          status: r.status, assignedModeratorId: r.assigned_moderator_id, createdAt: r.created_at,
          reporterDisplay: forumDisplayName(r.first_name, r.last_name),
        })),
        mediaAwaitingApproval: mediaAwaitingApproval.map((a: any) => ({
          id: a.id, kind: a.kind, fileName: a.file_name, contentType: a.content_type, postId: a.post_id, createdAt: a.created_at,
          uploadedBy: a.first_name ? forumDisplayName(a.first_name, a.last_name) : "Unknown",
        })),
        restrictedMembers: restrictedMembers.map((m: any) => ({ memberId: m.member_id, display: forumDisplayName(m.first_name, m.last_name), reason: m.restricted_reason, since: m.restricted_at })),
        suspendedMembers: suspendedMembers.map((m: any) => ({ memberId: m.member_id, display: forumDisplayName(m.first_name, m.last_name), reason: m.suspended_reason, since: m.suspended_at, until: m.suspended_until })),
        recentDiscussions,
        recentActivity,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/moderation" };
