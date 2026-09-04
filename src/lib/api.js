import axios from "axios";
import { getToken, clearClientSession } from "@/lib/session";

// Full-stack Next.js: API berada pada origin yang sama (/api/*).
// Bisa dioverride via NEXT_PUBLIC_API_BASE bila backend dipisah.
export const API = process.env.NEXT_PUBLIC_API_BASE || "/api";

const api = axios.create({ baseURL: API, withCredentials: true });

let sectionPassword = "";
export const setSectionPassword = (p) => { sectionPassword = p || ""; };
export const getSectionPassword = () => sectionPassword;

// Callback dari AuthContext: dipanggil saat server menjawab 401 (sesi habis/token
// tidak valid) supaya UI langsung kembali ke halaman login, bukan diam di halaman lama.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = typeof fn === "function" ? fn : null; };

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }
  if (sectionPassword) config.headers["X-Section-Password"] = sectionPassword;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");
    // /auth/login & /auth/me & /auth/logout menangani 401 sendiri (login salah / cek sesi awal).
    const isAuthRoute = /\/auth\/(login|me|logout)$/.test(url);
    if (status === 401 && !isAuthRoute && typeof window !== "undefined") {
      clearClientSession();
      onUnauthorized?.(error);
    }
    return Promise.reject(error);
  },
);

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
