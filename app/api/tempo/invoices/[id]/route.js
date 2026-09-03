import { handle, json, readJson } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { getInvoiceOr404, buildInvoicePayload, enrich, updateInvoice, deleteInvoice } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  return json(enrich(await getInvoiceOr404(id)));
});

export const PUT = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  const existing = await getInvoiceOr404(id);
  const body = await readJson(req);
  const update = buildInvoicePayload(body, existing);
  await updateInvoice(id, update);
  return json(enrich(await getInvoiceOr404(id)));
});

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { id } = await params;
  await getInvoiceOr404(id);
  await deleteInvoice(id);
  return json({ ok: true });
});
