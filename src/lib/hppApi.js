import api from "@/lib/api";

export const listCalculations = () => api.get("/hpp/calculations").then((r) => r.data);
export const getCalculation = (id) => api.get(`/hpp/calculations/${id}`).then((r) => r.data);
export const saveCalculation = (payload) => api.post("/hpp/calculations", payload).then((r) => r.data);
export const updateCalculation = (id, payload) => api.put(`/hpp/calculations/${id}`, payload).then((r) => r.data);
export const deleteCalculation = (id) => api.delete(`/hpp/calculations/${id}`).then((r) => r.data);

export async function exportHppPdf(payload) {
  const res = await api.post("/hpp/pdf", payload, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  const name = String(payload?.name || "hpp").replace(/\s+/g, "_");
  a.download = `HPP_${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
