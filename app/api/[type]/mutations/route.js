import { handle, json, qp, readJson, pageParams, paged } from "@/server/http";
import { requirePerm } from "@/server/auth";
import {
  buildDoc, assertStockAvailable, stampCreate, queryMutations, insertMutation,
} from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/:type/mutations?year=&start=&end=&jenis=&transaksi=&supplier=&search=[&page=&page_size=]
 * Semua filter dijalankan di SQL. Tanpa ?page -> array (kompatibel lama);
 * dengan ?page -> { items, total, page, page_size, page_count }.
 */
export const GET = handle(async (req, { params }) => {
  await requirePerm(req, "stok");
  const { type } = await params;

  const year = qp(req, "year");
  const filters = {
    year: year ? Number(year) : null,
    start: qp(req, "start"), end: qp(req, "end"), jenis: qp(req, "jenis"),
    transaksi: qp(req, "transaksi"), supplier: qp(req, "supplier"), search: qp(req, "search"),
  };
  const pg = pageParams(req);
  const { items, total } = await queryMutations(type, filters, pg);
  return json(pg ? paged(items, total, pg) : items);
});

export const POST = handle(async (req, { params }) => {
  const current = await requirePerm(req, "stok");
  const { type } = await params;
  const body = await readJson(req);

  const doc = buildDoc(type, body);
  await assertStockAvailable(type, doc);
  const full = stampCreate(doc, current);

  await insertMutation(type, full);
  return json(full);
});
