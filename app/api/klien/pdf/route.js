import { handle, pdfResponse, qp, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { loadTree, listMutations } from "@/server/klien";
import { buildKlienStockPdf, buildKlienHistoryPdf } from "@/server/pdf/klienPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmt = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

export const GET = handle(async (req) => {
  await requireAuth(req);
  const kind = qp(req, "kind") || "stok";

  if (kind === "stok") {
    const status = qp(req, "status") || "semua";
    const { summary, kliens } = await loadTree();
    const filtered =
      status === "semua"
        ? kliens
        : kliens.map((k) => ({
            ...k,
            pos: (k.pos || []).map((p) => ({ ...p, items: (p.items || []).filter((i) => i.status === status) })),
          }));
    const bytes = await buildKlienStockPdf({ summary, kliens: filtered, statusFilter: status });
    return pdfResponse(bytes, `Stok_Klien_SCA_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (kind === "riwayat") {
    const start = qp(req, "start");
    const end = qp(req, "end");
    const mutations = await listMutations({
      klien_id: qp(req, "klien_id"),
      po_id: qp(req, "po_id"),
      jenis: qp(req, "jenis"),
      start,
      end,
    });
    const label =
      start || end ? `${fmt(start) || "awal"} s.d. ${fmt(end) || "sekarang"}` : "Semua periode";
    const bytes = await buildKlienHistoryPdf({ mutations, periodLabel: label });
    return pdfResponse(bytes, `Riwayat_Mutasi_Klien_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  throw new HttpError(404, "Jenis PDF tidak dikenal");
});
