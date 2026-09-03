import { handle, json, readJson, HttpError, qp } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { nowIso } from "@/server/db";
import { listPos, findPoByNumber, insertPo } from "@/server/po/repo";
import { enrichPo, filterPos } from "@/server/po/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "po");
  const search = qp(req, "search");
  const bucket = qp(req, "bucket");
  const month = qp(req, "month");
  const docs = await listPos({ limit: 2000, withLogs: true });
  const enriched = docs.map(enrichPo);
  const filtered = filterPos(enriched, search, bucket, month);
  return json(filtered);
});

export const POST = handle(async (req) => {
  const current = await requirePerm(req, "po");
  const body = await readJson(req);
  const poNumber = String(body.po_number || "").trim();
  const clientName = String(body.client_name || "").trim();
  if (!poNumber) throw new HttpError(400, "Nomor PO wajib diisi");
  if (!clientName) throw new HttpError(400, "Nama Klien wajib diisi");

  const dup = await findPoByNumber(poNumber);
  if (dup) throw new HttpError(400, "Nomor PO sudah ada");

  const now = nowIso();
  const enabledStages = Array.isArray(body.enabled_stages)
    ? body.enabled_stages.map(Number).filter((n) => n >= 1 && n <= 11)
    : [];
  const stageData = body.stage_data && typeof body.stage_data === "object" ? body.stage_data : {};
  enabledStages.forEach((n) => { if (!stageData[String(n)]) stageData[String(n)] = {}; });

  const doc = {
    id: crypto.randomUUID(),
    po_number: poNumber,
    client_name: clientName,
    item_type: String(body.item_type || ""),
    material: String(body.material || ""),
    paper_size: String(body.paper_size || ""),
    quantity: String(body.quantity || ""),
    po_date: body.po_date || null,
    est_start: body.est_start || null,
    est_end: body.est_end || null,
    print_machine: body.print_machine || null,
    enabled_stages: enabledStages,
    stage_data: stageData,
    notes: String(body.notes || ""),
    logs: [{ timestamp: now, message: `PO dibuat oleh ${current.name || current.username}`, user: current.username }],
    created_by: current.name || current.username,
    created_by_username: current.username,
    created_at: now,
    updated_at: now,
  };
  await insertPo(doc);
  return json(enrichPo({ ...doc }));
});
