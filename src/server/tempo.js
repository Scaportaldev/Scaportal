/**
 * Jatuh Tempo Klien — helper server.
 *
 * Melacak invoice klien: TOP (term of payment), jatuh tempo, cicilan, status
 * lunas/belum, dan laporan (ringkasan, rincian per klien, omset bulanan).
 * Koleksi terpisah: tempo_invoices + settings key `tempo_top_options`.
 */
import { getDb, COL, TEMPO_TOP_KEY, nowIso } from "@/server/mongo";
import { HttpError } from "@/server/http";

export const DEFAULT_TOP_OPTIONS = ["Cash", "Net 30", "Net 60", "Net 90", "Cicilan"];
export const STATUSES = ["lunas", "belum_lunas"];

export const newId = () => crypto.randomUUID();

export function num(v) {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

const round2 = (v) => Math.round(v * 100) / 100;

export function computePaid(inv) {
  if (inv?.top === "Cicilan") {
    return round2((inv.installments || []).reduce((s, i) => s + num(i.amount), 0));
  }
  return inv?.status === "lunas" ? num(inv.total_amount) : 0;
}

/** Buang _id + tambahkan paid_amount / remaining_amount. */
export function enrich(inv) {
  if (!inv) return inv;
  const { _id, ...rest } = inv;
  const total = num(rest.total_amount);
  const paid = computePaid(rest);
  return { ...rest, paid_amount: paid, remaining_amount: round2(total - paid) };
}

export function normalizeInstallments(list) {
  return (Array.isArray(list) ? list : []).map((i, idx) => ({
    id: i?.id || newId(),
    sequence: Number(i?.sequence) || idx + 1,
    amount: num(i?.amount),
    date: i?.date || null,
  }));
}

export function buildInvoicePayload(body, existing = null) {
  const clientName = String(body?.client_name ?? "").trim();
  if (!clientName) throw new HttpError(400, "Nama Klien wajib diisi");
  const status = STATUSES.includes(body?.status) ? body.status : "belum_lunas";
  const payload = {
    client_name: clientName,
    top: String(body?.top || "Cash"),
    po_date: body?.po_date || null,
    po_number: body?.po_number ?? null,
    delivery_note_number: body?.delivery_note_number ?? null,
    invoice_number: body?.invoice_number ?? null,
    invoice_date: body?.invoice_date || null,
    total_amount: num(body?.total_amount),
    due_date: body?.due_date || null,
    status,
    installments: normalizeInstallments(body?.installments),
    updated_at: nowIso(),
  };
  // Auto-lunas bila cicilan sudah menutup total tagihan.
  if (payload.top === "Cicilan" && payload.total_amount > 0) {
    const paid = payload.installments.reduce((s, i) => s + num(i.amount), 0);
    if (paid >= payload.total_amount) payload.status = "lunas";
  }
  if (!existing) {
    payload.id = newId();
    payload.created_at = nowIso();
  }
  return payload;
}

// ---------- TOP options ----------
export async function ensureTopSeed() {
  const db = await getDb();
  const doc = await db.collection(COL.settings).findOne({ key: TEMPO_TOP_KEY });
  if (!doc) {
    await db.collection(COL.settings).insertOne({
      key: TEMPO_TOP_KEY,
      values: DEFAULT_TOP_OPTIONS,
      updated_at: nowIso(),
    });
    return [...DEFAULT_TOP_OPTIONS];
  }
  return Array.isArray(doc.values) && doc.values.length ? doc.values : [...DEFAULT_TOP_OPTIONS];
}

export async function saveTopOptions(values) {
  const db = await getDb();
  await db.collection(COL.settings).updateOne(
    { key: TEMPO_TOP_KEY },
    { $set: { values, updated_at: nowIso() } },
    { upsert: true },
  );
  return values;
}

// ---------- Reports ----------
export const monthKey = (d) => (d ? String(d).slice(0, 7) : null);

async function allInvoices() {
  const db = await getDb();
  const docs = await db.collection(COL.tempoInvoices).find({}).limit(20000).toArray();
  return docs.map(enrich);
}

function inRange(d, start, end) {
  const idate = d.invoice_date;
  if (!idate) return true;
  if (start && idate < start) return false;
  if (end && idate > end) return false;
  return true;
}

export async function computeSummary(start, end) {
  const docs = await allInvoices();
  const filtered = docs.filter((d) => inRange(d, start, end));
  const curMonth = new Date().toISOString().slice(0, 7);

  let pemasukanBulanIni = 0;
  for (const d of docs) {
    if (d.top === "Cicilan") {
      for (const i of d.installments || []) {
        if (monthKey(i.date) === curMonth) pemasukanBulanIni += num(i.amount);
      }
    } else if (d.status === "lunas" && monthKey(d.invoice_date) === curMonth) {
      pemasukanBulanIni += num(d.total_amount);
    }
  }

  const totalPiutang = filtered
    .filter((d) => d.status !== "lunas")
    .reduce((s, d) => s + num(d.remaining_amount), 0);

  return {
    pemasukan_bulan_ini: round2(pemasukanBulanIni),
    total_piutang: round2(totalPiutang),
    total_nilai_invoice: round2(filtered.reduce((s, d) => s + num(d.total_amount), 0)),
    total_terbayar: round2(filtered.reduce((s, d) => s + num(d.paid_amount), 0)),
    count_lunas: filtered.filter((d) => d.status === "lunas").length,
    count_belum_lunas: filtered.filter((d) => d.status !== "lunas").length,
    count_total: filtered.length,
  };
}

export async function computeBreakdown(start, end) {
  const docs = await allInvoices();
  const filtered = docs.filter((d) => inRange(d, start, end));
  const curMonth = new Date().toISOString().slice(0, 7);

  const piutang = new Map();
  filtered.forEach((d) => {
    if (d.status !== "lunas" && num(d.remaining_amount) > 0) {
      const name = d.client_name || "-";
      piutang.set(name, (piutang.get(name) || 0) + num(d.remaining_amount));
    }
  });

  const pemasukan = new Map();
  const lunas = new Map();
  docs.forEach((d) => {
    const name = d.client_name || "-";
    if (d.top === "Cicilan") {
      (d.installments || []).forEach((i) => {
        if (monthKey(i.date) === curMonth) pemasukan.set(name, (pemasukan.get(name) || 0) + num(i.amount));
      });
    } else if (d.status === "lunas" && monthKey(d.invoice_date) === curMonth) {
      pemasukan.set(name, (pemasukan.get(name) || 0) + num(d.total_amount));
    }

    if (d.status === "lunas") {
      let lunasMonth;
      if (d.top === "Cicilan") {
        const dates = (d.installments || []).map((i) => i.date).filter(Boolean);
        lunasMonth = dates.length ? monthKey(dates.sort().at(-1)) : monthKey(d.invoice_date);
      } else {
        lunasMonth = monthKey(d.invoice_date);
      }
      if (lunasMonth === curMonth) lunas.set(name, (lunas.get(name) || 0) + num(d.total_amount));
    }
  });

  const toList = (m) =>
    [...m.entries()]
      .filter(([, v]) => v > 0)
      .map(([client, amount]) => ({ client, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);

  return {
    piutang_by_client: toList(piutang),
    pemasukan_by_client: toList(pemasukan),
    lunas_by_client: toList(lunas),
  };
}

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export async function computeMonthly(yearInput) {
  const year = Number(yearInput) || new Date().getFullYear();
  const docs = await allInvoices();
  const months = {};
  for (let m = 1; m <= 12; m += 1) {
    months[`${year}-${String(m).padStart(2, "0")}`] = { omset: 0, pembayaran: 0 };
  }

  docs.forEach((d) => {
    const mk = monthKey(d.invoice_date);
    if (mk && months[mk]) months[mk].omset += num(d.total_amount);
    if (d.top === "Cicilan") {
      (d.installments || []).forEach((i) => {
        const imk = monthKey(i.date);
        if (imk && months[imk]) months[imk].pembayaran += num(i.amount);
      });
    } else if (d.status === "lunas" && mk && months[mk]) {
      months[mk].pembayaran += num(d.total_amount);
    }
  });

  const data = [];
  for (let m = 1; m <= 12; m += 1) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    data.push({
      month: MONTH_LABELS[m - 1],
      omset: round2(months[key].omset),
      pembayaran: round2(months[key].pembayaran),
    });
  }
  return { year, data };
}

export async function sortedInvoices({ search, status, sort_by = "due_date", order = "asc" } = {}) {
  const db = await getDb();
  const query = {};
  if (search) {
    const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    query.$or = [{ client_name: rx }, { invoice_number: rx }, { po_number: rx }];
  }
  if (STATUSES.includes(status)) query.status = status;

  const docs = (await db.collection(COL.tempoInvoices).find(query).limit(5000).toArray()).map(enrich);

  const keyMap = {
    due_date: (d) => d.due_date || "",
    invoice_date: (d) => d.invoice_date || "",
    total_amount: (d) => num(d.total_amount),
    client_name: (d) => String(d.client_name || "").toLowerCase(),
    remaining_amount: (d) => num(d.remaining_amount),
  };
  const keyfn = keyMap[sort_by] || keyMap.due_date;
  const reverse = order === "desc" ? -1 : 1;
  docs.sort((a, b) => {
    const ka = keyfn(a);
    const kb = keyfn(b);
    if (ka < kb) return -1 * reverse;
    if (ka > kb) return 1 * reverse;
    return 0;
  });
  return docs;
}

export async function getInvoiceOr404(id) {
  const db = await getDb();
  const inv = await db.collection(COL.tempoInvoices).findOne({ id });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  return inv;
}

export { nowIso };
