// Members Forum — the current member's own forum status: eligibility,
// opt-in/guidelines, privacy + notification preferences, follows/mutes,
// the in-app notification inbox, and mention search (typeahead).
//
// GET  /api/forum/me
//   -> { ok, eligible, participation, guidelines: {version, content, upToDate},
//        notificationPrefs, unreadCount, notifications }
//
// POST /api/forum/me { action, ... }
//   opt_in                    { showPhoto, showGrade, showBadges }
//   opt_out                   {}
//   update_privacy            { showPhoto, showGrade, showBadges }
//   accept_guidelines         {}
//   update_notification_prefs { defaultNotify, mentionsNotify, announcementsNotify, moderatorNotify }
//   follow_topic|mute_topic|unfollow_topic       { topicId, notify? }
//   follow_category|mute_category|unfollow_category { categoryId, notify? }
//   mark_notifications_read   { ids?: number[] }   -- omit ids to mark all read
//   search_mentions           { query } -> { ok, results: [{ memberId, display }] }
//
// Any adult member (even before opting in) can call GET and opt_in/accept
// guidelines — everything else requires opted_in = true, enforced here.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, logAudit, unauthorized } from "./_shared/roles.mts";
import { ADULT_AGE, forumDisplayName, isNotifyLevel } from "./_shared/forum.mts";
import { loadForumParticipation, isSuspended, isRestricted } from "./_shared/forum-access.mts";

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: { "content-type": "application/json" } });
}

async function currentGuidelines(db: any) {
  const [row] = await db.sql`select version, content from forum_guidelines order by created_at desc limit 1`;
  return row || { version: "v1", content: "" };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();
  const db = getDatabase();
  const caller = await ensureMember(db, user);
  const eligible = caller.age !== null && caller.age >= ADULT_AGE;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");

      if (action === "opt_in") {
        if (!eligible) return badRequest("The forum is for adult members only.");
        const existing = await loadForumParticipation(db, caller.id);
        const guidelines = await currentGuidelines(db);
        await db.sql`
          insert into forum_participation (member_id, opted_in, opted_in_at, show_photo, show_grade, show_badges, guidelines_version, guidelines_accepted_at)
          values (${caller.id}, true, now(), ${body.showPhoto !== false}, ${!!body.showGrade}, ${body.showBadges !== false}, ${guidelines.version}, now())
          on conflict (member_id) do update set
            opted_in = true, opted_in_at = now(), opted_out_at = null,
            show_photo = excluded.show_photo, show_grade = excluded.show_grade, show_badges = excluded.show_badges,
            guidelines_version = excluded.guidelines_version, guidelines_accepted_at = now(), updated_at = now()
        `;
        await db.sql`
          insert into forum_notification_prefs (member_id) values (${caller.id}) on conflict (member_id) do nothing
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_opted_in",
          resourceType: "forum_participation", resourceId: caller.id,
          previousValue: existing ? { optedIn: existing.opted_in } : null, newValue: { optedIn: true },
          note: `${caller.email} opted into the Members Forum`,
        });
      } else if (action === "opt_out") {
        await db.sql`
          update forum_participation set opted_in = false, opted_out_at = now(), updated_at = now() where member_id = ${caller.id}
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_opted_out",
          resourceType: "forum_participation", resourceId: caller.id,
          note: `${caller.email} opted out of the Members Forum`,
        });
      } else if (action === "update_privacy") {
        await db.sql`
          update forum_participation set
            show_photo = ${body.showPhoto !== false}, show_grade = ${!!body.showGrade}, show_badges = ${body.showBadges !== false},
            updated_at = now()
          where member_id = ${caller.id}
        `;
      } else if (action === "accept_guidelines") {
        const guidelines = await currentGuidelines(db);
        await db.sql`
          update forum_participation set guidelines_version = ${guidelines.version}, guidelines_accepted_at = now(), updated_at = now()
          where member_id = ${caller.id}
        `;
        await logAudit(db, {
          actorId: caller.id, actorEmail: caller.email, action: "forum_guidelines_accepted",
          resourceType: "forum_participation", resourceId: caller.id, newValue: { version: guidelines.version },
          note: `${caller.email} accepted forum guidelines ${guidelines.version}`,
        });
      } else if (action === "update_notification_prefs") {
        const fields = ["defaultNotify", "mentionsNotify", "announcementsNotify", "moderatorNotify"] as const;
        for (const f of fields) {
          if (body[f] !== undefined && !isNotifyLevel(String(body[f]))) return badRequest(`Invalid value for ${f}`);
        }
        await db.sql`
          insert into forum_notification_prefs (member_id, default_notify, mentions_notify, announcements_notify, moderator_notify)
          values (${caller.id}, ${body.defaultNotify || "in_app_only"}, ${body.mentionsNotify || "in_app_email"}, ${body.announcementsNotify || "in_app_email"}, ${body.moderatorNotify || "in_app_only"})
          on conflict (member_id) do update set
            default_notify = excluded.default_notify, mentions_notify = excluded.mentions_notify,
            announcements_notify = excluded.announcements_notify, moderator_notify = excluded.moderator_notify, updated_at = now()
        `;
      } else if (["follow_topic", "mute_topic", "unfollow_topic"].includes(action)) {
        const topicId = Number(body.topicId);
        if (!topicId) return badRequest("Missing topicId");
        if (action === "unfollow_topic") {
          await db.sql`delete from forum_topic_followers where topic_id = ${topicId} and member_id = ${caller.id}`;
        } else {
          const state = action === "mute_topic" ? "muted" : "following";
          const notify = isNotifyLevel(String(body.notify)) ? body.notify : "default";
          await db.sql`
            insert into forum_topic_followers (topic_id, member_id, state, notify) values (${topicId}, ${caller.id}, ${state}, ${notify})
            on conflict (topic_id, member_id) do update set state = excluded.state, notify = excluded.notify
          `;
        }
      } else if (["follow_category", "mute_category", "unfollow_category"].includes(action)) {
        const categoryId = Number(body.categoryId);
        if (!categoryId) return badRequest("Missing categoryId");
        if (action === "unfollow_category") {
          await db.sql`delete from forum_category_followers where category_id = ${categoryId} and member_id = ${caller.id}`;
        } else {
          const state = action === "mute_category" ? "muted" : "following";
          const notify = isNotifyLevel(String(body.notify)) ? body.notify : "default";
          await db.sql`
            insert into forum_category_followers (category_id, member_id, state, notify) values (${categoryId}, ${caller.id}, ${state}, ${notify})
            on conflict (category_id, member_id) do update set state = excluded.state, notify = excluded.notify
          `;
        }
      } else if (action === "mark_notifications_read") {
        const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number) : [];
        if (ids.length) {
          await db.sql`update forum_notifications set read_at = now() where member_id = ${caller.id} and id = any(${ids}) and read_at is null`;
        } else {
          await db.sql`update forum_notifications set read_at = now() where member_id = ${caller.id} and read_at is null`;
        }
      } else if (action === "search_mentions") {
        const query = String(body.query || "").trim().toLowerCase();
        if (query.length < 1) return new Response(JSON.stringify({ ok: true, results: [] }), { headers: { "content-type": "application/json" } });
        const rows = await db.sql`
          select m.id, m.first_name, m.last_name from members m
          join forum_participation fp on fp.member_id = m.id and fp.opted_in = true
          where m.date_of_birth is not null and date_part('year', age(m.date_of_birth)) >= ${ADULT_AGE}
            and lower(m.first_name) like ${query + "%"}
          order by m.first_name asc
          limit 8
        `;
        const results = rows.map((r: any) => ({ memberId: r.id, display: forumDisplayName(r.first_name, r.last_name) }));
        return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" } });
      } else {
        return badRequest("Unknown action");
      }
    }

    const participation = await loadForumParticipation(db, caller.id);
    const guidelines = await currentGuidelines(db);
    const [notifPrefs] = await db.sql`select * from forum_notification_prefs where member_id = ${caller.id}`;
    const unreadRows = await db.sql`select count(*)::int as count from forum_notifications where member_id = ${caller.id} and read_at is null`;
    const notifications = await db.sql`
      select id, kind, topic_id, post_id, summary, read_at, created_at
      from forum_notifications where member_id = ${caller.id}
      order by created_at desc limit 20
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        eligible,
        participation: participation
          ? {
              optedIn: participation.opted_in,
              showPhoto: participation.show_photo,
              showGrade: participation.show_grade,
              showBadges: participation.show_badges,
              guidelinesVersion: participation.guidelines_version,
              guidelinesAcceptedAt: participation.guidelines_accepted_at,
              suspended: isSuspended(participation),
              suspendedReason: participation.suspended_reason,
              restricted: isRestricted(participation),
              restrictedReason: participation.restricted_reason,
            }
          : null,
        guidelines: {
          version: guidelines.version,
          content: guidelines.content,
          upToDate: !!participation && participation.guidelines_version === guidelines.version,
        },
        notificationPrefs: notifPrefs || null,
        unreadCount: unreadRows[0]?.count || 0,
        notifications,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config: Config = { path: "/api/forum/me" };
