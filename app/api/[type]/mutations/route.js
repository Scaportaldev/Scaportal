import { handle, json, qp, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDb, stripId } from "@/server/mongo";
import {
  collectionFor, buildDoc, assertStockAvailable, filterRows, stampCreate,
} from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await getCurrentUser(req);
  const { type } = await params;
  const collection = collectionFor(type);
  const db = await getDb();

  const year = qp(req, "year");
  const query = year ? { year: Number(year) } : {};
  const docs = (await db.collection(collection).find(query).toArray()).map(stripId);

  const rows = filterRows(
    docs,
    {
      start: qp(req, "start"), end: qp(req, "end"), jenis: qp(req, "jenis"),
      transaksi: qp(req, "transaksi"), supplier: qp(req, "supplier"), search: qp(req, "search"),
    },
    type,
  );
  return json(rows);
});

export const POST = handle(async (req, { params }) => {
  const current = await getCurrentUser(req);
  const { type } = await params;
  const collection = collectionFor(type);
  const body = await readJson(req);

  const doc = buildDoc(type, body);
  await assertStockAvailable(type, doc);
  const full = stampCreate(doc, current);

  const db = await getDb();
  await db.collection(collection).insertOne({ ...full });
  return json(full);
});
