/**
 * Seed data contoh untuk 2 tool baru: Stok Klien & Jatuh Tempo Klien.
 *
 *   node scripts/seed_klien_tempo.mjs            # tambah data contoh (idempotent per nama)
 *   node scripts/seed_klien_tempo.mjs --wipe     # hapus dulu SEMUA data 2 tool ini, lalu isi ulang
 *
 * Hanya menyentuh koleksi klien_* dan tempo_invoices.
 * Data Stok SCA, HPP Calculator, dan PO Tracker TIDAK disentuh.
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// --- load .env sederhana (tanpa dependensi tambahan) ---
try {
  const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  raw.split("\n").forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) return;
    const key = m[1];
    let val = (m[2] || "").trim();
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  });
} catch {
  /* .env opsional */
}

const WIPE = process.argv.includes("--wipe");
const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || "laporan_stok_sca";
if (!uri) {
  console.error("MONGO_URL belum diset");
  process.exit(1);
}

const COL = {
  clients: "klien_clients",
  pos: "klien_pos",
  items: "klien_items",
  mutations: "klien_mutations",
  invoices: "tempo_invoices",
};

const iso = (d) => new Date(d).toISOString();
const dayStr = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const isoOffset = (days, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const KLIEN_SEED = [
  {
    nama: "PT Maju Bersama",
    pos: [
      {
        no_po: "MB-001",
        tanggal_po: dayStr(-40),
        items: [
          { jenis_item: "Kertas Art Carton 260gr", satuan: "rim", kuantiti: 40, keterangan: "Titipan cetak brosur", status: "aktif" },
          { jenis_item: "Tinta Cyan", satuan: "kg", kuantiti: 8, keterangan: "", status: "aktif" },
        ],
      },
      {
        no_po: "MB-002",
        tanggal_po: dayStr(-18),
        items: [
          { jenis_item: "Box Packing Ukuran M", satuan: "box", kuantiti: 120, keterangan: "Siap kirim", status: "aktif" },
        ],
      },
    ],
  },
  {
    nama: "CV Sumber Rezeki",
    pos: [
      {
        no_po: "SR-2026-07",
        tanggal_po: dayStr(-30),
        items: [
          { jenis_item: "Kain Katun Roll", satuan: "roll", kuantiti: 15, keterangan: "Bahan tas", status: "aktif" },
          { jenis_item: "Label Woven", satuan: "pcs", kuantiti: 2500, keterangan: "", status: "aktif" },
        ],
      },
    ],
  },
  {
    nama: "Toko Anugerah Jaya",
    pos: [
      {
        no_po: "AJ-11",
        tanggal_po: dayStr(-60),
        items: [
          { jenis_item: "Stiker Vinyl A3", satuan: "lembar", kuantiti: 0, keterangan: "Sudah diambil semua", status: "selesai" },
          { jenis_item: "Plastik OPP", satuan: "pack", kuantiti: 30, keterangan: "", status: "aktif" },
        ],
      },
    ],
  },
  {
    nama: "PT Sinar Kemasan",
    pos: [
      {
        no_po: "SK-450",
        tanggal_po: dayStr(-9),
        items: [
          { jenis_item: "Single Face E-Flute", satuan: "sheet", kuantiti: 800, keterangan: "Titipan bahan dus", status: "aktif" },
        ],
      },
    ],
  },
  {
    nama: "UD Berkah Mandiri",
    pos: [
      {
        no_po: "BM-07",
        tanggal_po: dayStr(-4),
        items: [
          { jenis_item: "Kertas Duplex 350gr", satuan: "rim", kuantiti: 25, keterangan: "", status: "aktif" },
          { jenis_item: "Lem Kuning", satuan: "kg", kuantiti: 12, keterangan: "Titipan produksi", status: "aktif" },
        ],
      },
    ],
  },
];

const INVOICE_SEED = [
  {
    client_name: "PT Maju Bersama", top: "Net 30", invoice_number: "INV-2026-001",
    invoice_date: dayStr(-35), due_date: dayStr(-5), total_amount: 18500000,
    po_number: "MB-001", po_date: dayStr(-40), delivery_note_number: "SJ-1101",
    status: "belum_lunas", installments: [],
  },
  {
    client_name: "CV Sumber Rezeki", top: "Net 60", invoice_number: "INV-2026-002",
    invoice_date: dayStr(-28), due_date: dayStr(2), total_amount: 7250000,
    po_number: "SR-2026-07", po_date: dayStr(-30), delivery_note_number: "SJ-1102",
    status: "belum_lunas", installments: [],
  },
  {
    client_name: "Toko Anugerah Jaya", top: "Cash", invoice_number: "INV-2026-003",
    invoice_date: dayStr(-12), due_date: dayStr(-12), total_amount: 3400000,
    po_number: "AJ-11", po_date: dayStr(-60), delivery_note_number: "SJ-1103",
    status: "lunas", installments: [],
  },
  {
    client_name: "PT Sinar Kemasan", top: "Cicilan", invoice_number: "INV-2026-004",
    invoice_date: dayStr(-20), due_date: dayStr(20), total_amount: 42000000,
    po_number: "SK-450", po_date: dayStr(-9), delivery_note_number: "SJ-1104",
    status: "belum_lunas",
    installments: [
      { sequence: 1, amount: 15000000, date: dayStr(-14) },
      { sequence: 2, amount: 10000000, date: dayStr(-3) },
    ],
  },
  {
    client_name: "UD Berkah Mandiri", top: "Net 30", invoice_number: "INV-2026-005",
    invoice_date: dayStr(-6), due_date: dayStr(6), total_amount: 9800000,
    po_number: "BM-07", po_date: dayStr(-4), delivery_note_number: "SJ-1105",
    status: "belum_lunas", installments: [],
  },
  {
    client_name: "PT Maju Bersama", top: "Cicilan", invoice_number: "INV-2026-006",
    invoice_date: dayStr(-15), due_date: dayStr(45), total_amount: 12000000,
    po_number: "MB-002", po_date: dayStr(-18), delivery_note_number: "SJ-1106",
    status: "lunas",
    installments: [
      { sequence: 1, amount: 6000000, date: dayStr(-10) },
      { sequence: 2, amount: 6000000, date: dayStr(-1) },
    ],
  },
  {
    client_name: "CV Sumber Rezeki", top: "Cash", invoice_number: "INV-2026-007",
    invoice_date: dayStr(-2), due_date: dayStr(-2), total_amount: 2150000,
    po_number: "SR-2026-08", po_date: dayStr(-3), delivery_note_number: "SJ-1107",
    status: "lunas", installments: [],
  },
  {
    client_name: "Toko Anugerah Jaya", top: "Net 90", invoice_number: "INV-2026-008",
    invoice_date: dayStr(-1), due_date: dayStr(89), total_amount: 27500000,
    po_number: "AJ-12", po_date: dayStr(-1), delivery_note_number: "SJ-1108",
    status: "belum_lunas", installments: [],
  },
];

function computeStatus(inv) {
  if (inv.top === "Cicilan" && inv.total_amount > 0) {
    const paid = (inv.installments || []).reduce((s, i) => s + i.amount, 0);
    if (paid >= inv.total_amount) return "lunas";
  }
  return inv.status;
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db(dbName);

  if (WIPE) {
    for (const c of Object.values(COL)) {
      const r = await db.collection(c).deleteMany({});
      console.log(`[wipe] ${c}: ${r.deletedCount} dokumen dihapus`);
    }
  }

  // ---------- Stok Klien ----------
  let nk = 0; let np = 0; let ni = 0; let nm = 0;
  for (const k of KLIEN_SEED) {
    let klien = await db.collection(COL.clients).findOne({ nama: k.nama });
    if (!klien) {
      klien = { id: randomUUID(), nama: k.nama, created_at: iso(Date.now()) };
      await db.collection(COL.clients).insertOne({ ...klien });
      nk += 1;
    }
    for (const p of k.pos) {
      let po = await db.collection(COL.pos).findOne({ klien_id: klien.id, no_po: p.no_po });
      if (!po) {
        po = {
          id: randomUUID(), klien_id: klien.id, no_po: p.no_po,
          tanggal_po: p.tanggal_po, created_at: iso(Date.now()),
        };
        await db.collection(COL.pos).insertOne({ ...po });
        np += 1;
      }
      for (const it of p.items) {
        const exist = await db.collection(COL.items).findOne({ po_id: po.id, jenis_item: it.jenis_item });
        if (exist) continue;
        const item = {
          id: randomUUID(), po_id: po.id, jenis_item: it.jenis_item,
          satuan: it.satuan, kuantiti: it.kuantiti, keterangan: it.keterangan,
          status: it.status, created_at: iso(Date.now()),
        };
        await db.collection(COL.items).insertOne({ ...item });
        ni += 1;

        // Riwayat mutasi contoh: 1 masuk (stok awal + selisih) + 1 keluar bila memungkinkan
        const masuk = {
          id: randomUUID(), item_id: item.id, po_id: po.id, klien_id: klien.id,
          jenis: "masuk", jumlah: Math.max(it.kuantiti, 1) + 5,
          tanggal: isoOffset(-Math.floor(Math.random() * 20) - 5, 10),
          keterangan: "Barang masuk dari klien", pic_name: "Seed", created_at: iso(Date.now()),
        };
        const keluar = {
          id: randomUUID(), item_id: item.id, po_id: po.id, klien_id: klien.id,
          jenis: "keluar", jumlah: 5,
          tanggal: isoOffset(-Math.floor(Math.random() * 4) - 1, 14),
          keterangan: "Diambil klien", pic_name: "Seed", created_at: iso(Date.now()),
        };
        await db.collection(COL.mutations).insertMany([masuk, keluar]);
        nm += 2;
      }
    }
  }

  // ---------- Jatuh Tempo Klien ----------
  let nv = 0;
  for (const inv of INVOICE_SEED) {
    const exist = await db.collection(COL.invoices).findOne({ invoice_number: inv.invoice_number });
    if (exist) continue;
    await db.collection(COL.invoices).insertOne({
      id: randomUUID(),
      ...inv,
      installments: (inv.installments || []).map((i) => ({ id: randomUUID(), ...i })),
      status: computeStatus(inv),
      created_at: iso(Date.now()),
      updated_at: iso(Date.now()),
    });
    nv += 1;
  }

  console.log(`\nSelesai. Stok Klien: +${nk} klien, +${np} PO, +${ni} item, +${nm} mutasi. Jatuh Tempo: +${nv} invoice.`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
