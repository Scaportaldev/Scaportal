import api from "@/lib/api";

export const listPos = (params = {}) => api.get("/po/pos", { params }).then((r) => r.data);
export const getPo = (id) => api.get(`/po/pos/${id}`).then((r) => r.data);
export const createPo = (payload) => api.post("/po/pos", payload).then((r) => r.data);
export const updatePo = (id, payload) => api.put(`/po/pos/${id}`, payload).then((r) => r.data);
export const deletePo = (id) => api.delete(`/po/pos/${id}`).then((r) => r.data);
export const checkConflict = (payload) => api.post("/po/pos/check-conflict", payload).then((r) => r.data);
export const updateStage = (poId, num, data) => api.post(`/po/pos/${poId}/stages/${num}`, { data }).then((r) => r.data);
export const scheduleDelivery = (poId, payload) => api.post(`/po/pos/${poId}/delivery/schedule`, payload).then((r) => r.data);
export const deliveryResult = (poId, payload) => api.post(`/po/pos/${poId}/delivery/result`, payload).then((r) => r.data);

export const uploadPhoto = (poId, num, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/po/pos/${poId}/stages/${num}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const deletePhoto = (poId, num, fileId) => api.delete(`/po/pos/${poId}/stages/${num}/photo/${fileId}`).then((r) => r.data);

export const listSchedules = () => api.get("/po/schedules").then((r) => r.data);
export const createSchedule = (payload) => api.post("/po/schedules", payload).then((r) => r.data);
export const deleteSchedule = (id) => api.delete(`/po/schedules/${id}`).then((r) => r.data);

export const poDashboard = () => api.get("/po/dashboard").then((r) => r.data);

export async function exportPoRekapPdf(params = {}) {
  const res = await api.get("/po/pos/export/pdf", { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rekap_PO_SCA${params.month ? "_" + params.month : ""}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
