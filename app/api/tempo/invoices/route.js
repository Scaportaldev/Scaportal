import { handle, json, readJson, qp } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { sortedInvoices, buildInvoicePayload, enrich } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSuperadmin(req);
  const rows = await sortedInvoices({
    search: qp(req, "search"),
    status: qp(req, "status"),
    sort_by: qp(req, "sort_by") || "due_date",
    order: qp(req, "order") || "asc",
  });
  return json(rows);
});

export const POST = handle(async (req) => {
  await requireSuperadmin(req);
  const body = await readJson(req);
  const doc = buildInvoicePayload(body);
  const db = await getDb();
  await db.collection(COL.tempoInvoices).insertOne({ ...doc });
  return json(enrich(doc), 201);
});

/** Hapus semua invoice (UI mewajibkan backup PDF terlebih dahulu). */
export const DELETE = handle(async (req) => {
  await requireSuperadmin(req);
  const db = await getDb();
  const res = await db.collection(COL.tempoInvoices).deleteMany({});
  return json({ deleted: res.deletedCount });
});
