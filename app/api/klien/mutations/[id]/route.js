import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import {
  num, validateMutasiJenis, getMutationOr404, getItemOr404, updateMutationTx, deleteMutationTx,
} from "@/server/klien";
import { queryOne, fromRow } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findItem(id) {
  return fromRow(await queryOne("SELECT * FROM `klien_items` WHERE `id`=?", [id]));
}

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const m = await getMutationOr404(id);
  const body = await readJson(req);

  const item = await findItem(m.item_id);
  if (!item) throw new HttpError(404, "Item terkait tidak ditemukan");

  const newJenis = body?.jenis || m.jenis;
  validateMutasiJenis(newJenis);
  const newJumlah = body?.jumlah !== undefined && body.jumlah !== null ? num(body.jumlah, 0) : num(m.jumlah);
  if (newJumlah <= 0) throw new HttpError(400, "Jumlah harus lebih dari 0");

  const oldEffect = m.jenis === "masuk" ? num(m.jumlah) : -num(m.jumlah);
  const newEffect = newJenis === "masuk" ? newJumlah : -newJumlah;
  const newQty = num(item.kuantiti) - oldEffect + newEffect;
  if (newQty < 0) {
    throw new HttpError(
      400,
      `Perubahan ditolak: stok akan menjadi negatif. Stok saat ini: ${num(item.kuantiti)} ${item.satuan || ""}`.trim(),
    );
  }

  const updates = { jenis: newJenis, jumlah: newJumlah };
  if (body?.tanggal !== undefined && body.tanggal !== null) updates.tanggal = body.tanggal;
  if (body?.keterangan !== undefined && body.keterangan !== null) updates.keterangan = String(body.keterangan);

  await updateMutationTx(id, updates, item.id, newQty);
  return json(await getMutationOr404(id));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const m = await getMutationOr404(id);
  const item = await findItem(m.item_id);

  let newQty = null;
  if (item) {
    const effect = m.jenis === "masuk" ? num(m.jumlah) : -num(m.jumlah);
    newQty = num(item.kuantiti) - effect;
    if (newQty < 0) throw new HttpError(400, "Tidak dapat menghapus mutasi karena stok akan menjadi negatif");
  }
  await deleteMutationTx(id, item ? item.id : null, newQty);
  return json({ ok: true });
});
