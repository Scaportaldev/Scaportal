import { handle, json, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";
import { deleteObject, getObjectStream } from "@/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy foto dari R2 lewat domain aplikasi.
// Menghindari masalah URL pub-*.r2.dev (rate limit / lambat / diblokir di jaringan tertentu).
export const GET = handle(async (req, { params }) => {
  await requireAuth(req);
  const { fileId } = await params;
  const db = await getDb();
  const rec = await db.collection(COL.poFiles).findOne({ id: fileId, is_deleted: { $ne: true } });
  if (!rec || !rec.r2_key) throw new HttpError(404, "Foto tidak ditemukan");

  const obj = await getObjectStream(rec.r2_key);
  const body = obj.Body?.transformToWebStream ? obj.Body.transformToWebStream() : obj.Body;
  const headers = new Headers({
    "Content-Type": rec.content_type || obj.ContentType || "application/octet-stream",
    "Cache-Control": "private, max-age=86400",
  });
  const len = obj.ContentLength || rec.size;
  if (len) headers.set("Content-Length", String(len));
  return new Response(body, { status: 200, headers });
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id, num, fileId } = await params;
  const db = await getDb();
  const rec = await db.collection(COL.poFiles).findOne({ id: fileId });
  if (rec && rec.r2_key) {
    try { await deleteObject(rec.r2_key); } catch (e) { console.warn("[r2] delete gagal:", e?.message); }
  }
  await db.collection(COL.poFiles).updateOne({ id: fileId }, { $set: { is_deleted: true, deleted_at: nowIso() } });

  const po = await db.collection(COL.pos).findOne({ id });
  if (po) {
    const stageData = po.stage_data || {};
    const d = stageData[String(num)] || {};
    d.photos = (d.photos || []).filter((p) => p.id !== fileId);
    stageData[String(num)] = d;
    await db.collection(COL.pos).updateOne({ id }, { $set: { stage_data: stageData, updated_at: nowIso() } });
  }
  return json({ ok: true });
});
