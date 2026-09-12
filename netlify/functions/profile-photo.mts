// Real profile photos, stored in Netlify Blobs (not Postgres — images don't
// belong in a text column). Visibility: any logged-in member can view any
// member's photo (e.g. to recognise teammates on This Week's Game); nobody
// signed out ever can. Only a member can upload or remove their own photo.
//
// GET    /api/profile-photo?memberId=<id> -> raw image bytes, or 404
// POST   /api/profile-photo { dataUrl } -> { ok, photoVersion } — uploads/replaces the caller's own photo
// DELETE /api/profile-photo -> { ok, photoVersion } — removes the caller's own photo
//
// dataUrl is a "data:image/jpeg;base64,..." string — the frontend reads the
// chosen file with FileReader and sends it as JSON, no multipart parsing
// needed here.

import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";
import { ensureMember, getVerifiedUser, unauthorized } from "./_shared/roles.mts";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([\w./+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export default async (req: Request, context: Context) => {
  const user = await getVerifiedUser(req);
  if (!user) return unauthorized();

  const db = getDatabase();
  const caller = await ensureMember(db, user); // any registered member — read access is intentionally broad
  const store = getStore("member-photos");

  if (req.method === "GET") {
    const memberId = new URL(req.url).searchParams.get("memberId") || caller.id;
    const result = await store.getWithMetadata(memberId, { type: "arrayBuffer" });
    if (!result) return new Response(null, { status: 404 });
    const contentType = (result.metadata && (result.metadata as any).contentType) || "image/jpeg";
    return new Response(result.data, {
      headers: { "content-type": contentType, "cache-control": "private, max-age=300" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const decoded = decodeDataUrl(String(body.dataUrl || ""));
    if (!decoded) {
      return new Response(JSON.stringify({ ok: false, error: "No image data received" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!ALLOWED_TYPES.has(decoded.contentType)) {
      return new Response(JSON.stringify({ ok: false, error: "Only JPEG, PNG or WEBP photos are allowed" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (decoded.bytes.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "Photo is too large — 2MB max" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    await store.set(caller.id, decoded.bytes, { metadata: { contentType: decoded.contentType } });
    const [row] = await db.sql`update members set photo_version = photo_version + 1 where id = ${caller.id} returning photo_version`;
    return new Response(JSON.stringify({ ok: true, photoVersion: row.photo_version }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "DELETE") {
    await store.delete(caller.id);
    const [row] = await db.sql`update members set photo_version = photo_version + 1 where id = ${caller.id} returning photo_version`;
    return new Response(JSON.stringify({ ok: true, photoVersion: row.photo_version }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/profile-photo",
};
