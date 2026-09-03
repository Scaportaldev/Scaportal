import { handle, json, readJson, HttpError, qp } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { newId, nowIso, num, validateItemStatus, getPoOr404 } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const poId = qp(req, "po_id");
  const db = await getDb();
  const rows = await db
    .collection(COL.klienItems)
    .find(poId ? { po_id: poId } : {}, { projection: { _id: 0 } })
    .sort({ created_at: 1 })
    .limit(100000)
    .toArray();
  return json(rows);
});

export const POST = handle(async (req) => {
  await requireAuth(req);
  const body = await readJson(req);
  const poId = String(body?.po_id ?? "").trim();
  if (!poId) throw new HttpError(400, "PO wajib dipilih");
  await getPoOr404(poId);

  const jenisItem = String(body?.jenis_item ?? "").trim();
  if (!jenisItem) throw new HttpError(400, "Jenis item wajib diisi");
  const kuantiti = num(body?.kuantiti, 0);
  if (kuantiti < 0) throw new HttpError(400, "Kuantiti tidak boleh negatif");
  const status = body?.status || "aktif";
  validateItemStatus(status);

  const doc = {
    id: newId(),
    po_id: poId,
    jenis_item: jenisItem,
    satuan: String(body?.satuan ?? "").trim(),
    kuantiti,
    keterangan: String(body?.keterangan ?? ""),
    status,
    created_at: nowIso(),
  };
  const db = await getDb();
  await db.collection(COL.klienItems).insertOne({ ...doc });
  return json(doc, 201);
});
