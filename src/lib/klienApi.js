import api from "@/lib/api";

// ---- Klien ----
export const listKliens = () => api.get("/klien/clients").then((r) => r.data);
export const createKlien = (payload) => api.post("/klien/clients", payload).then((r) => r.data);
export const updateKlien = (id, payload) => api.put(`/klien/clients/${id}`, payload).then((r) => r.data);
export const deleteKlien = (id) => api.delete(`/klien/clients/${id}`).then((r) => r.data);

// ---- PO ----
export const listKlienPos = (params = {}) => api.get("/klien/pos", { params }).then((r) => r.data);
export const createKlienPo = (payload) => api.post("/klien/pos", payload).then((r) => r.data);
export const updateKlienPo = (id, payload) => api.put(`/klien/pos/${id}`, payload).then((r) => r.data);
export const deleteKlienPo = (id) => api.delete(`/klien/pos/${id}`).then((r) => r.data);

// ---- Item ----
export const listKlienItems = (params = {}) => api.get("/klien/items", { params }).then((r) => r.data);
export const createKlienItem = (payload) => api.post("/klien/items", payload).then((r) => r.data);
export const updateKlienItem = (id, payload) => api.put(`/klien/items/${id}`, payload).then((r) => r.data);
export const deleteKlienItem = (id) => api.delete(`/klien/items/${id}`).then((r) => r.data);

// ---- Mutasi ----
export const listKlienMutations = (params = {}) => api.get("/klien/mutations", { params }).then((r) => r.data);
export const createKlienMutation = (payload) => api.post("/klien/mutations", payload).then((r) => r.data);
export const updateKlienMutation = (id, payload) => api.put(`/klien/mutations/${id}`, payload).then((r) => r.data);
export const deleteKlienMutation = (id) => api.delete(`/klien/mutations/${id}`).then((r) => r.data);

// ---- Dashboard ----
export const klienDashboard = () => api.get("/klien/dashboard").then((r) => r.data);

// ---- PDF ----
async function download(params, filename) {
  const res = await api.get("/klien/pdf", { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const exportKlienStokPdf = (status = "semua") =>
  download({ kind: "stok", status }, `Stok_Klien_SCA_${new Date().toISOString().slice(0, 10)}.pdf`);

export const exportKlienRiwayatPdf = (filters = {}) =>
  download(
    { kind: "riwayat", ...filters },
    `Riwayat_Mutasi_Klien_${new Date().toISOString().slice(0, 10)}.pdf`,
  );

export const fmtQty = (v) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(v) || 0);
