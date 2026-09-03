import axios from "axios";

// Full-stack Next.js: API berada pada origin yang sama (/api/*).
// Bisa dioverride via NEXT_PUBLIC_API_BASE bila backend dipisah.
export const API = process.env.NEXT_PUBLIC_API_BASE || "/api";

const api = axios.create({ baseURL: API, withCredentials: true });

let sectionPassword = "";
export const setSectionPassword = (p) => { sectionPassword = p || ""; };
export const getSectionPassword = () => sectionPassword;

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("stokku_token");
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }
  if (sectionPassword) config.headers["X-Section-Password"] = sectionPassword;
  return config;
});

export async function downloadPdf(path, params, filename) {
  const res = await api.get(path, { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default api;
