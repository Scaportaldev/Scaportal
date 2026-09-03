import { handle, json, readJson, qp } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { sortedInvoices, buildInvoicePayload, enrich, insertInvoice, deleteAllInvoices } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "tempo");
  const rows = await sortedInvoices({
    search: qp(req, "search"),
    status: qp(req, "status"),
    sort_by: qp(req, "sort_by") || "due_date",
    order: qp(req, "order") || "asc",
  });
  return json(rows);
});

export const POST = handle(async (req) => {
  await requirePerm(req, "tempo");
  const body = await readJson(req);
  const doc = buildInvoicePayload(body);
  await insertInvoice(doc);
  return json(enrich(doc), 201);
});

/** Hapus semua invoice (UI mewajibkan backup PDF terlebih dahulu). */
export const DELETE = handle(async (req) => {
  await requirePerm(req, "tempo");
  const deleted = await deleteAllInvoices();
  return json({ deleted });
});
