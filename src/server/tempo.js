/**
 * Jatuh Tempo Klien — helper server (MariaDB).
 *
 * Tabel: tempo_invoices (1) --< tempo_installments (n), tempo_top_options.
 */
import {
  query, queryOne, insertRow, updateRow, deleteRows, withTx,
  fromRow, fromRows, toDateTime, toDate, nowIso, newId,
} from "@/server/db";
import { HttpError } from "@/server/http";

export { nowIso, newId };

export const DEFAULT_TOP_OPTIONS = ["Cash", "Net 30", "Net 60", "Net 90", "Cicilan"];
export const STATUSES = ["lunas", "belum_lunas"];

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

/** Tambahkan paid_amount / remaining_amount. */
export function enrich(inv) {
  if (!inv) return inv;
  const total = num(inv.total_amount);
  const paid = computePaid(inv);
  return { ...inv, installments: inv.installments || [], paid_amount: paid, remaining_amount: round2(total - paid) };
}

export function normalizeInstallments(list) {
  return (Array.isArray(list) ? list : []).map((i, idx) => ({
    id: i?.id || newId(),
    sequence: Number(i?.sequence) || idx + 1,
    amount: num(i?.amount),
    date: toDate(i?.date) || null,
  }));
}

export function buildInvoicePayload(body, existing = null) {
  const clientName = String(body?.client_name ?? "").trim();
  if (!clientName) throw new HttpError(400, "Nama Klien wajib diisi");
  const status = STATUSES.includes(body?.status) ? body.status : "belum_lunas";
  const payload = {
    client_name: clientName,
    top: String(body?.top || "Cash"),
    po_date: toDate(body?.po_date),
    po_number: body?.po_number ?? null,
    delivery_note_number: body?.delivery_note_number ?? null,
    invoice_number: body?.invoice_number ?? null,
    invoice_date: toDate(body?.invoice_date),
    total_amount: num(body?.total_amount),
    due_date: toDate(body?.due_date),
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

// ---------- Akses tabel ----------
const INVOICE_COLS = [
  "id", "client_name", "top", "po_date", "po_number", "delivery_note_number", "invoice_number",
  "invoice_date", "total_amount", "due_date", "status", "created_at", "updated_at",
];

function invoiceRow(obj) {
  const row = {};
  for (const c of INVOICE_COLS) {
    if (obj[c] === undefined) continue;
    let v = obj[c];
    if (c === "created_at" || c === "updated_at") v = toDateTime(v);
    else if (c === "po_date" || c === "invoice_date" || c === "due_date") v = toDate(v);
    row[c] = v;
  }
  return row;
}

async function attachInstallments(invoices) {
  if (!invoices.length) return invoices;
  const ids = invoices.map((i) => i.id);
  const rows = await query(
    `SELECT * FROM \`tempo_installments\` WHERE \`invoice_id\` IN (${ids.map(() => "?").join(",")}) ORDER BY \`sequence\` ASC, \`date\` ASC`,
    ids,
  );
  const byInv = new Map();
  for (const r of rows) {
    if (!byInv.has(r.invoice_id)) byInv.set(r.invoice_id, []);
    byInv.get(r.invoice_id).push({ id: r.id, sequence: r.sequence, amount: r.amount, date: r.date });
  }
  return invoices.map((inv) => ({ ...inv, installments: byInv.get(inv.id) || [] }));
}

async function replaceInstallments(invoiceId, installments, conn) {
  await deleteRows("tempo_installments", { invoice_id: invoiceId }, conn);
  for (const i of installments) {
    await insertRow("tempo_installments", {
      id: i.id || newId(),
      invoice_id: invoiceId,
      sequence: Number(i.sequence) || 1,
      amount: num(i.amount),
      date: toDate(i.date),
    }, conn);
  }
}

export async function getInvoiceOr404(id) {
  const inv = fromRow(await queryOne("SELECT * FROM `tempo_invoices` WHERE `id`=?", [id]));
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  return (await attachInstallments([inv]))[0];
}

export async function insertInvoice(payload) {
  await withTx(async (conn) => {
    await insertRow("tempo_invoices", invoiceRow(payload), conn);
    await replaceInstallments(payload.id, payload.installments || [], conn);
  });
  return payload;
}

/** Update kolom invoice; bila payload.installments ada, daftar cicilan diganti seluruhnya. */
export async function updateInvoice(id, payload) {
  await withTx(async (conn) => {
    const row = invoiceRow(payload);
    if (Object.keys(row).length) await updateRow("tempo_invoices", row, { id }, conn);
    if (payload.installments !== undefined) await replaceInstallments(id, payload.installments, conn);
  });
}

export async function deleteInvoice(id) {
  return await deleteRows("tempo_invoices", { id });
}

export async function deleteAllInvoices() {
  const res = await deleteRows("tempo_invoices", {});
  return res.affectedRows;
}

export async function renameTopInInvoices(oldValue, newValue) {
  await query("UPDATE `tempo_invoices` SET `top`=?, `updated_at`=? WHERE `top`=?", [newValue, toDateTime(nowIso()), oldValue]);
}

// ---------- TOP options ----------
export async function ensureTopSeed() {
  const rows = await query("SELECT `value` FROM `tempo_top_options` ORDER BY `sort_order` ASC, `value` ASC");
  if (rows.length) return rows.map((r) => r.value);
  await saveTopOptions(DEFAULT_TOP_OPTIONS);
  return [...DEFAULT_TOP_OPTIONS];
}

export async function saveTopOptions(values) {
  const list = [...new Set((values || []).map((v) => String(v).trim()).filter(Boolean))];
  await withTx(async (conn) => {
    await deleteRows("tempo_top_options", {}, conn);
    for (let i = 0; i < list.length; i += 1) {
      await insertRow("tempo_top_options", { value: list[i], sort_order: i }, conn);
    }
  });
  return list;
}

// ---------- Reports ----------
export const monthKey = (d) => (d ? String(d).slice(0, 7) : null);

async function allInvoices() {
  const invs = fromRows(await query("SELECT * FROM `tempo_invoices` LIMIT 20000"));
  return (await attachInstallments(invs)).map(enrich);
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
  const where = [];
  const params = [];
  if (search) {
    const like = `%${String(search).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push("(`client_name` LIKE ? OR `invoice_number` LIKE ? OR `po_number` LIKE ?)");
    params.push(like, like, like);
  }
  if (STATUSES.includes(status)) { where.push("`status`=?"); params.push(status); }

  const invs = fromRows(await query(
    `SELECT * FROM \`tempo_invoices\`${where.length ? ` WHERE ${where.join(" AND ")}` : ""} LIMIT 5000`, params,
  ));
  const docs = (await attachInstallments(invs)).map(enrich);

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
