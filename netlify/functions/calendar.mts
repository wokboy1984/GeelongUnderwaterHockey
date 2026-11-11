// Club calendar (11 Nov 2026) - see _shared/calendar.mts.
//
// GET  /api/calendar[?from=YYYY-MM-DD&to=YYYY-MM-DD]
//   -> { ok, from, to, items[], canEdit }   public; canEdit only when logged
//      in as a Game Coordinator or Administrator. Default range: the start
//      of last month to a year ahead.
// POST /api/calendar { action, ... }   Game Coordinator / Administrator
//   create_season { from, to, startTime, endTime, location?, skip?: [date] }
//       -> one game night every Wednesday from..to, except skip. Nights
//          already on the calendar are left alone. Returns created + skipped.
//   add_event     { date, title, startTime?, endTime?, location?, notes? }
//   update        { id, date?, title?, startTime?, endTime?, location?, notes? }
//   cancel        { id, reason? }      uncancel { id }      delete { id }
//   All return the same shape as GET, plus message.

import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, hasPermission, logAudit, unauthorized, forbidden } from "./_shared/roles.mts";
import { clubToday } from "./_shared/attendance.mts";
import { CLUB_VENUE, ensureCalendar, isISODate, isTime, listItems, seasonDates } from "./_shared/calendar.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const optTime = (v: unknown) => { const s = clean(v, 5); return s ? s : null; };

function defaultRange() {
  const today = clubToday();
  const [y, m] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y + 1, m - 1, 28)).toISOString().slice(0, 10);
  return { from, to };
}

export default async (req: Request, context: Context) => {
  try {
    const db = getDatabase();
    await ensureCalendar(db);
    const url = new URL(req.url);

    // Who's asking: a logged-in editor sees the edit controls.
    const user = await getVerifiedUser(req);
    const caller = user ? await ensureMember(db, user) : null;
    const canEdit = !!caller && hasPermission(caller.roles, "arrange_teams");

    let message: string | null = null;
    if (req.method === "POST") {
      if (!caller) return unauthorized();
      if (!canEdit) return forbidden("Only Game Coordinators and Administrators can change the calendar");
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "");
      const audit = (what: string, newValue: unknown, resourceId = "calendar") =>
        logAudit(db, { actorId: caller.id, actorEmail: caller.email, action: "calendar_changed", resourceType: "calendar_item", resourceId, newValue, note: `${caller.email} ${what}` });

      if (action === "create_season") {
        const from = clean(body.from, 10), to = clean(body.to, 10);
        const startTime = optTime(body.startTime) || "18:00", endTime = optTime(body.endTime) || "19:45";
        if (!isISODate(from) || !isISODate(to)) return json({ ok: false, error: "Pick the first and last game dates" }, 400);
        if (to < from) return json({ ok: false, error: "The last game has to be after the first game" }, 400);
        if (!isTime(startTime) || !isTime(endTime) || endTime <= startTime) return json({ ok: false, error: "Check the start and finish times" }, 400);
        const skip = Array.isArray(body.skip) ? body.skip.filter(isISODate) : [];
        const dates = seasonDates(from, to, 3, skip);
        if (!dates.length) return json({ ok: false, error: "There are no Wednesdays between those dates" }, 400);
        const location = clean(body.location, 120) || CLUB_VENUE;
        let created = 0;
        for (const d of dates) {
          const rows = await db.sql`
            insert into calendar_items (item_date, kind, title, start_time, end_time, location, created_by, updated_by)
            values (${d}::date, 'game', 'Game night', ${startTime}, ${endTime}, ${location}, ${caller.id}, ${caller.id})
            on conflict (item_date) where kind = 'game' do nothing
            returning id`;
          created += rows.length;
        }
        const already = dates.length - created;
        message = `Added ${created} game night${created === 1 ? "" : "s"}` + (already ? ` (${already} already on the calendar)` : "") + ".";
        await audit(`set up game nights ${from} to ${to}: ${created} added`, { from, to, startTime, endTime, skip, created });
      } else if (action === "add_event") {
        const date = clean(body.date, 10), title = clean(body.title, 120);
        const startTime = optTime(body.startTime), endTime = optTime(body.endTime);
        if (!isISODate(date)) return json({ ok: false, error: "Pick a date" }, 400);
        if (!title) return json({ ok: false, error: "Give the event a name" }, 400);
        if ((startTime && !isTime(startTime)) || (endTime && !isTime(endTime)) || (endTime && !startTime) || (startTime && endTime && endTime <= startTime)) return json({ ok: false, error: "Check the times" }, 400);
        const [row] = await db.sql`
          insert into calendar_items (item_date, kind, title, start_time, end_time, location, notes, created_by, updated_by)
          values (${date}::date, 'event', ${title}, ${startTime}, ${endTime}, ${clean(body.location, 120) || null}, ${clean(body.notes, 500) || null}, ${caller.id}, ${caller.id})
          returning id`;
        message = "Added " + title + ".";
        await audit(`added "${title}" on ${date}`, { date, title }, String(row.id));
      } else if (["update", "cancel", "uncancel", "delete"].includes(action)) {
        const id = Number(body.id);
        const [item] = await db.sql`select id, kind, title, to_char(item_date, 'YYYY-MM-DD') as item_date, start_time, end_time, location, notes from calendar_items where id = ${id}`;
        if (!item) return json({ ok: false, error: "That item isn't on the calendar any more" }, 404);
        const label = `${item.title || item.kind} on ${item.item_date}`;
        if (action === "delete") {
          await db.sql`delete from calendar_items where id = ${id}`;
          message = "Removed.";
          await audit(`removed ${label}`, null, String(id));
        } else if (action === "cancel") {
          const reason = clean(body.reason, 200) || null;
          await db.sql`update calendar_items set cancelled = true, cancel_reason = ${reason}, updated_by = ${caller.id}, updated_at = now() where id = ${id}`;
          message = "Marked as cancelled.";
          await audit(`cancelled ${label}${reason ? " (" + reason + ")" : ""}`, { reason }, String(id));
        } else if (action === "uncancel") {
          await db.sql`update calendar_items set cancelled = false, cancel_reason = null, updated_by = ${caller.id}, updated_at = now() where id = ${id}`;
          message = "Back on.";
          await audit(`un-cancelled ${label}`, null, String(id));
        } else {
          const date = body.date !== undefined ? clean(body.date, 10) : item.item_date;
          const title = body.title !== undefined ? clean(body.title, 120) : item.title;
          const startTime = body.startTime !== undefined ? optTime(body.startTime) : item.start_time;
          const endTime = body.endTime !== undefined ? optTime(body.endTime) : item.end_time;
          const location = body.location !== undefined ? clean(body.location, 120) || null : item.location;
          const notes = body.notes !== undefined ? clean(body.notes, 500) || null : item.notes;
          if (!isISODate(date)) return json({ ok: false, error: "Pick a date" }, 400);
          if (item.kind === "event" && !title) return json({ ok: false, error: "Give the event a name" }, 400);
          if ((startTime && !isTime(startTime)) || (endTime && !isTime(endTime)) || (endTime && !startTime) || (startTime && endTime && endTime <= startTime)) return json({ ok: false, error: "Check the times" }, 400);
          if (item.kind === "game" && date !== item.item_date) {
            const [clash] = await db.sql`select 1 from calendar_items where kind = 'game' and item_date = ${date}::date and id <> ${id}`;
            if (clash) return json({ ok: false, error: "There's already a game night on that date" }, 400);
          }
          await db.sql`
            update calendar_items set item_date = ${date}::date, title = ${title || null}, start_time = ${startTime}, end_time = ${endTime},
              location = ${location}, notes = ${notes}, updated_by = ${caller.id}, updated_at = now()
            where id = ${id}`;
          message = "Saved.";
          await audit(`changed ${label}`, { date, title, startTime, endTime, location, notes }, String(id));
        }
      } else {
        return json({ ok: false, error: "Unknown action" }, 400);
      }
    }

    const range = defaultRange();
    const from = isISODate(url.searchParams.get("from")) ? (url.searchParams.get("from") as string) : range.from;
    const to = isISODate(url.searchParams.get("to")) ? (url.searchParams.get("to") as string) : range.to;
    const items = await listItems(db, from, to);
    return json({ ok: true, from, to, today: clubToday(), items, canEdit, message });
  } catch (err) {
    console.error("calendar request failed", err);
    return json({ ok: false, error: "Couldn't load or save the calendar. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/calendar",
};
