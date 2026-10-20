// Forum image attachments, stored in Netlify Blobs with a row in
// forum_attachments (20 Oct 2026). Same split as profile photos: bytes in
// Blobs, metadata in Postgres — images don't belong in a text column.
//
// GET  /api/forum/media?id=<id> -> raw image bytes, or 404
// POST /api/forum/media { dataUrl, fileName? } -> { ok, id }
//
// Who can do what:
//  - Viewing needs any logged-in member. The forum is members-only, and
//    these are club photos that can include juniors, so nothing here is
//    reachable signed out.
//  - Uploading needs the post_forum_media permission, which is every
//    operational role ("moderators and committee"). Because uploads are
//    limited to people the club already trusts, images appear immediately
//    rather than waiting in an approval queue.
//
// Moderators remove a bad image with the existing reject_media action in
// forum-moderation.mts, which deletes the row.
//
// dataUrl is a "data:image/jpeg;base64,..." string — the frontend reads the
// chosen file with FileReader and sends it as JSON, so there's no multipart
// parsing here. Same approach as profile-photo.mts.

import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";
import { ensureForumAttachments, ensureMember, getVerifiedUser, hasPermission, unauthorized } from "./_shared/roles.mts";

// Larger than a profile photo: these are game photos people will want to
// actually look at, not a thumbnail beside a name.
const MAX_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([\w./+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user);
  await ensureForumAttachments(db);
  const store = getStore("forum-media");

  if (req.method === "GET") {
    // Query string rather than a path parameter, matching profile-photo.mts.
    // The image is fetched with the member's credentials and shown via an
    // object URL (see forum.js), never as a plain <img src>, so there's no
    // reason to need a pretty URL here.
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "Invalid media id" }, 400);

    const [row] = await db.sql`select blob_key, content_type from forum_attachments where id = ${id}`;
    if (!row || !row.blob_key) return new Response(null, { status: 404 });

    const result = await store.getWithMetadata(row.blob_key, { type: "arrayBuffer" });
    if (!result) return new Response(null, { status: 404 });

    return new Response(result.data, {
      headers: {
        "content-type": row.content_type || "image/jpeg",
        // private: this is members-only content, so no shared cache should
        // ever hold a copy. Matches profile-photo.mts.
        "cache-control": "private, max-age=300",
      },
    });
  }

  if (req.method === "POST") {
    if (!hasPermission(caller.roles, "post_forum_media")) {
      return json({ ok: false, error: "Only moderators and committee can add images to the forum." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const decoded = decodeDataUrl(String((body as any).dataUrl || ""));
    if (!decoded) return json({ ok: false, error: "That file couldn't be read as an image." }, 400);
    if (!ALLOWED_TYPES.has(decoded.contentType)) {
      return json({ ok: false, error: "Images only — JPEG, PNG, WebP or GIF." }, 400);
    }
    if (decoded.bytes.byteLength > MAX_BYTES) {
      return json({ ok: false, error: "That image is too big — keep it under 6MB." }, 400);
    }

    const fileName = String((body as any).fileName || "").trim().slice(0, 200) || null;

    // The row is created first so its id names the blob. post_id stays null
    // until the post is written — the composer uploads before submitting —
    // and approved_at is set now because there is no approval queue.
    const [row] = await db.sql`
      insert into forum_attachments (kind, content_type, size_bytes, file_name, created_by, approved_at, approved_by)
      values ('image', ${decoded.contentType}, ${decoded.bytes.byteLength}, ${fileName}, ${caller.id}, now(), ${caller.id})
      returning id
    `;
    const blobKey = `post-image-${row.id}`;
    await store.set(blobKey, decoded.bytes, { metadata: { contentType: decoded.contentType } });
    await db.sql`update forum_attachments set blob_key = ${blobKey} where id = ${row.id}`;

    return json({ ok: true, id: row.id });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/forum/media",
};
