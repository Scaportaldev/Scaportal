import { handle, json, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nowIso } from "@/server/db";
import { getPo, updatePo, getFile, markFileDeleted } from "@/server/po/repo";
import { deleteObject, getObjectStream } from "@/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy foto dari R2 lewat domain aplikasi.
// Menghindari masalah URL pub-*.r2.dev (rate limit / lambat / diblokir di jaringan tertentu).
export const GET = handle(async (req, { params }) => {
  await requireAuth(req);
  const { fileId } = await params;
  const rec = await getFile(fileId);
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
  const rec = await getFile(fileId, { includeDeleted: true });
  if (rec && rec.r2_key) {
    try { await deleteObject(rec.r2_key); } catch (e) { console.warn("[r2] delete gagal:", e?.message); }
  }
  if (rec) await markFileDeleted(fileId);

  const po = await getPo(id);
  if (po) {
    const stageData = po.stage_data || {};
    const d = stageData[String(num)] || {};
    d.photos = (d.photos || []).filter((p) => p.id !== fileId);
    stageData[String(num)] = d;
    await updatePo(id, { stage_data: stageData, updated_at: nowIso() });
  }
  return json({ ok: true });
});
