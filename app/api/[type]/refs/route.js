import { handle, json, qp } from "@/server/http";
import { requirePerm } from "@/server/auth";
import { refOptions } from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/:type/refs?year=&transaksi=masuk|keluar
 * Opsi referensi ringan untuk form mutasi (dropdown "Referensi Mutasi Keluar" /
 * "Ambil Kode dari Mutasi Masuk") — hanya kolom yang ditampilkan di label.
 */
export const GET = handle(async (req, { params }) => {
  await requirePerm(req, "stok");
  const { type } = await params;
  const year = qp(req, "year");
  const transaksi = qp(req, "transaksi");
  return json(await refOptions(type, { year: year ? Number(year) : null, transaksi }));
});
