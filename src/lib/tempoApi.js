import api from "@/lib/api";

// ---- Invoices ----
export const getInvoices = (params = {}) => api.get("/tempo/invoices", { params }).then((r) => r.data);
export const getInvoice = (id) => api.get(`/tempo/invoices/${id}`).then((r) => r.data);
export const createInvoice = (data) => api.post("/tempo/invoices", data).then((r) => r.data);
export const updateInvoice = (id, data) => api.put(`/tempo/invoices/${id}`, data).then((r) => r.data);
export const deleteInvoice = (id) => api.delete(`/tempo/invoices/${id}`).then((r) => r.data);
export const deleteAllInvoices = () => api.delete("/tempo/invoices").then((r) => r.data);
export const setInvoiceStatus = (id, status) =>
  api.patch(`/tempo/invoices/${id}/status`, { status }).then((r) => r.data);
export const addInstallment = (id, data) =>
  api.post(`/tempo/invoices/${id}/installments`, data).then((r) => r.data);
export const deleteInstallment = (id, insId) =>
  api.delete(`/tempo/invoices/${id}/installments/${insId}`).then((r) => r.data);

// ---- TOP options ----
export const getTopOptions = () => api.get("/tempo/top-options").then((r) => r.data.values);
export const addTopOption = (value) => api.post("/tempo/top-options", { value }).then((r) => r.data.values);
export const renameTopOption = (old_value, new_value) =>
  api.put("/tempo/top-options", { old_value, new_value }).then((r) => r.data.values);
export const deleteTopOption = (value) =>
  api.delete(`/tempo/top-options/${encodeURIComponent(value)}`).then((r) => r.data.values);

// ---- Reports ----
export const getSummary = (params = {}) => api.get("/tempo/reports/summary", { params }).then((r) => r.data);
export const getBreakdown = (params = {}) => api.get("/tempo/reports/breakdown", { params }).then((r) => r.data);
export const getMonthly = (year) => api.get("/tempo/reports/monthly", { params: { year } }).then((r) => r.data);

// ---- PDF ----
async function download(params, filename) {
  const res = await api.get("/tempo/pdf", { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export const exportInvoicesPdf = (params = {}) =>
  download({ kind: "all", ...params }, `Jatuh_Tempo_Klien_${stamp()}.pdf`);

export const exportInvoiceDetailPdf = (inv) =>
  download(
    { kind: "detail", id: inv.id },
    `Invoice_${String(inv.invoice_number || inv.client_name || "detail").replace(/[^\w.-]+/g, "-")}.pdf`,
  );

export const exportTempoReportPdf = (params = {}) =>
  download({ kind: "report", ...params }, `Laporan_Jatuh_Tempo_${stamp()}.pdf`);
