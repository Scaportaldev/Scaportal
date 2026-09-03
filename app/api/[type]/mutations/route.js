import { handle, json, qp, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  buildDoc, assertStockAvailable, filterRows, stampCreate, listMutations, insertMutation,
} from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await getCurrentUser(req);
  const { type } = await params;

  const year = qp(req, "year");
  const docs = await listMutations(type, year ? { year: Number(year) } : {});

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
  const body = await readJson(req);

  const doc = buildDoc(type, body);
  await assertStockAvailable(type, doc);
  const full = stampCreate(doc, current);

  await insertMutation(type, full);
  return json(full);
});
