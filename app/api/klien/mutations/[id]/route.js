import { handle, json, readJson, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";
import { num, validateMutasiJenis } from "@/server/klien";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getMutationOr404(id) {
  const db = await getDb();
  const m = await db.collection(COL.klienMutations).findOne({ id }, { projection: { _id: 0 } });
  if (!m) throw new HttpError(404, "Mutasi tidak ditemukan");
  return m;
}

export const PUT = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const m = await getMutationOr404(id);
  const body = await readJson(req);

  const db = await getDb();
  const item = await db.collection(COL.klienItems).findOne({ id: m.item_id }, { projection: { _id: 0 } });
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

  await db.collection(COL.klienMutations).updateOne({ id }, { $set: updates });
  await db.collection(COL.klienItems).updateOne({ id: item.id }, { $set: { kuantiti: newQty } });

  return json(await db.collection(COL.klienMutations).findOne({ id }, { projection: { _id: 0 } }));
});

export const DELETE = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const m = await getMutationOr404(id);
  const db = await getDb();
  const item = await db.collection(COL.klienItems).findOne({ id: m.item_id }, { projection: { _id: 0 } });

  if (item) {
    const effect = m.jenis === "masuk" ? num(m.jumlah) : -num(m.jumlah);
    const newQty = num(item.kuantiti) - effect;
    if (newQty < 0) throw new HttpError(400, "Tidak dapat menghapus mutasi karena stok akan menjadi negatif");
    await db.collection(COL.klienItems).updateOne({ id: item.id }, { $set: { kuantiti: newQty } });
  }
  await db.collection(COL.klienMutations).deleteOne({ id });
  return json({ ok: true });
});
