import { NextResponse } from "next/server";
import { handle, json, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL, nowIso } from "@/server/mongo";
import { putObject } from "@/server/r2";

// Kompres foto agar preview ringan di semua device/koneksi.
// Resize max 1600px sisi terpanjang, konversi ke JPEG quality 78.
// sharp di-import lazy agar build/start tidak pernah gagal bila binary
// platform tidak tersedia — upload tetap jalan dengan file asli.
async function compressImage(buf, contentType) {
  try {
    if (!String(contentType || "").startsWith("image/")) return null;
    if (contentType === "image/gif" || contentType === "image/svg+xml") return null;
    const sharp = (await import("sharp")).default;
    const out = await sharp(buf)
      .rotate() // hormati EXIF orientation (foto HP)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    // Pakai hasil kompresi hanya jika memang lebih kecil
    if (out.length < buf.length) return out;
    return null;
  } catch (e) {
    console.warn("[photo] kompresi gagal, pakai file asli:", e?.message);
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitize(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

function extOf(name) {
  const m = String(name || "").match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

export const POST = handle(async (req, { params }) => {
  const current = await requireAuth(req);
  const { id, num } = await params;
  const stageNum = Number(num);
  if (!(stageNum >= 1 && stageNum <= 11)) throw new HttpError(400, "Nomor tahap tidak valid");

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "File tidak ditemukan di form");

  const db = await getDb();
  const po = await db.collection(COL.pos).findOne({ id });
  if (!po) throw new HttpError(404, "PO tidak ditemukan");

  let buf = Buffer.from(await file.arrayBuffer());
  let contentType = file.type || "application/octet-stream";
  let ext = extOf(file.name);
  const safeName = sanitize(file.name);

  const compressed = await compressImage(buf, contentType);
  if (compressed) {
    buf = compressed;
    contentType = "image/jpeg";
    ext = "jpg";
  }

  const size = buf.length;
  const fileId = crypto.randomUUID();
  const key = `sca-production/uploads/${id}/${fileId}.${ext}`;

  const { publicUrl } = await putObject(key, buf, contentType);

  const fileDoc = {
    id: fileId,
    po_id: id,
    stage_number: stageNum,
    r2_key: key,
    public_url: publicUrl,
    original_filename: safeName,
    content_type: contentType,
    size,
    is_deleted: false,
    uploaded_by: current.username,
    created_at: nowIso(),
  };
  await db.collection(COL.poFiles).insertOne({ ...fileDoc });

  const stageData = po.stage_data || {};
  const d = stageData[String(stageNum)] || {};
  const photos = d.photos || [];
  photos.push({ id: fileId, filename: safeName, url: publicUrl });
  d.photos = photos;
  stageData[String(stageNum)] = d;
  await db.collection(COL.pos).updateOne({ id }, { $set: { stage_data: stageData, updated_at: nowIso() } });

  return json({ id: fileId, filename: safeName, url: publicUrl });
});
