import { handle, json, readJson, HttpError } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { getInvoiceOr404, enrich, STATUSES, nowIso, updateInvoice } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handle(async (req, { params }) => {
  await requirePerm(req, "tempo");
  const { id } = await params;
  await getInvoiceOr404(id);
  const body = await readJson(req);
  const status = String(body?.status ?? "");
  if (!STATUSES.includes(status)) throw new HttpError(400, "Status harus 'lunas' atau 'belum_lunas'");

  await updateInvoice(id, { status, updated_at: nowIso() });
  return json(enrich(await getInvoiceOr404(id)));
});
