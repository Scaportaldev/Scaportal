import { handle, json, readJson, HttpError, qp } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { newId, nowIso, getKlienOr404 } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireAuth(req);
  const klienId = qp(req, "klien_id");
  const db = await getDb();
  const rows = await db
    .collection(COL.klienPos)
    .find(klienId ? { klien_id: klienId } : {}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(10000)
    .toArray();
  return json(rows);
});

export const POST = handle(async (req) => {
  await requireAuth(req);
  const body = await readJson(req);
  const klienId = String(body?.klien_id ?? "").trim();
  const noPo = String(body?.no_po ?? "").trim();
  if (!klienId) throw new HttpError(400, "Klien wajib dipilih");
  if (!noPo) throw new HttpError(400, "No PO wajib diisi");
  await getKlienOr404(klienId);

  const db = await getDb();
  const dup = await db.collection(COL.klienPos).findOne({ klien_id: klienId, no_po: noPo });
  if (dup) throw new HttpError(400, `No PO "${noPo}" sudah ada untuk klien ini`);

  const doc = {
    id: newId(),
    klien_id: klienId,
    no_po: noPo,
    tanggal_po: body?.tanggal_po || new Date().toISOString().slice(0, 10),
    created_at: nowIso(),
  };
  await db.collection(COL.klienPos).insertOne({ ...doc });
  return json(doc, 201);
});
