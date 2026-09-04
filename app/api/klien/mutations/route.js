import { handle, json, readJson, HttpError, qp } from "@/server/http";
import { requirePerm } from "@/server/auth";
import {
  newId, nowIso, num, validateMutasiJenis, getItemOr404, getPoOr404, listMutations, insertMutationTx,
} from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requirePerm(req, "klien");
  const rows = await listMutations({
    klien_id: qp(req, "klien_id"),
    po_id: qp(req, "po_id"),
    item_id: qp(req, "item_id"),
    jenis: qp(req, "jenis"),
    start: qp(req, "start"),
    end: qp(req, "end"),
  });
  return json(rows);
});

export const POST = handle(async (req) => {
  const current = await requirePerm(req, "klien");
  const body = await readJson(req);
  const jenis = String(body?.jenis || "");
  validateMutasiJenis(jenis);

  const jumlah = num(body?.jumlah, 0);
  if (jumlah <= 0) throw new HttpError(400, "Jumlah harus lebih dari 0");

  const item = await getItemOr404(String(body?.item_id ?? ""));
  if (item.status !== "aktif") {
    throw new HttpError(400, "Item berstatus Selesai/Ditutup. Ubah status ke Aktif untuk melakukan mutasi.");
  }

  const delta = jenis === "masuk" ? jumlah : -jumlah;
  const newQty = num(item.kuantiti) + delta;
  if (newQty < 0) {
    throw new HttpError(400, `Stok tidak mencukupi. Stok saat ini: ${num(item.kuantiti)} ${item.satuan || ""}`.trim());
  }

  const po = await getPoOr404(item.po_id);

  const doc = {
    id: newId(),
    item_id: item.id,
    po_id: item.po_id,
    klien_id: po?.klien_id ?? null,
    jenis,
    jumlah,
    tanggal: body?.tanggal || nowIso(),
    keterangan: String(body?.keterangan ?? ""),
    pic_name: current.name || current.username,
    user_id: current.id,
    user_name: current.username,
    created_at: nowIso(),
  };
  await insertMutationTx(doc, newQty);

  return json({ ...doc, kuantiti_baru: newQty }, 201);
});
