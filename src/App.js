import "@/App.css";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LangProvider } from "@/context/LangContext";
import AppShell from "@/components/AppShell";
import Login from "@/views/Login";
import AppSkeleton from "@/components/AppSkeleton";

// Lazy load: setiap halaman jadi chunk terpisah dan baru diunduh saat dibuka.
// Library berat (recharts di Dashboard/PO, dsb) otomatis ikut chunk halamannya,
// sehingga bundle awal (login + shell) jauh lebih kecil & first load lebih cepat.
// Stok
const Dashboard = lazy(() => import("@/views/Dashboard"));
const PaperMutations = lazy(() => import("@/views/PaperMutations"));
const InkMutations = lazy(() => import("@/views/InkMutations"));
const OtherMutations = lazy(() => import("@/views/OtherMutations"));
const StockReport = lazy(() => import("@/views/StockReport"));
const DetailReport = lazy(() => import("@/views/DetailReport"));
const LogsUsers = lazy(() => import("@/views/LogsUsers"));
const YearClose = lazy(() => import("@/views/YearClose"));
// HPP
const HppCalculator = lazy(() => import("@/views/hpp/Calculator"));
// PO Tracker
const PoDashboard = lazy(() => import("@/views/po/PoDashboard"));
const PoList = lazy(() => import("@/views/po/PoList"));
const PoForm = lazy(() => import("@/views/po/PoForm"));
const PoDetail = lazy(() => import("@/views/po/PoDetail"));
const PoCalendar = lazy(() => import("@/views/po/PoCalendar"));
// Stok Klien (tool baru)
const KlienDashboard = lazy(() => import("@/views/klien/Dashboard"));
const KlienHistory = lazy(() => import("@/views/klien/History"));
// Jatuh Tempo Klien (tool baru — Superadmin only)
const TempoInvoices = lazy(() => import("@/views/tempo/Invoices"));
const TempoReports = lazy(() => import("@/views/tempo/Reports"));

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <AppSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireSuper({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <AppSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "superadmin") return <Navigate to="/stok" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <LangProvider>
            <BrowserRouter>
              {/* Suspense level atas: fallback saat chunk halaman pertama dimuat.
                  Navigasi antar halaman setelah login memakai Suspense di dalam
                  AppShell (sidebar tetap terlihat). */}
              <Suspense fallback={<AppSkeleton />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Protected><AppShell /></Protected>}>
                    <Route index element={<Navigate to="/stok" replace />} />
                    {/* Stok tools */}
                    <Route path="stok" element={<Dashboard />} />
                    <Route path="stok/kertas" element={<PaperMutations />} />
                    <Route path="stok/tinta" element={<InkMutations />} />
                    <Route path="stok/lainnya" element={<OtherMutations />} />
                    <Route path="stok/laporan-stok" element={<StockReport />} />
                    <Route path="stok/laporan-detail" element={<RequireSuper><DetailReport /></RequireSuper>} />
                    <Route path="stok/log-user" element={<LogsUsers />} />
                    <Route path="stok/tutup-tahun" element={<YearClose />} />
                    {/* HPP tools — superadmin only */}
                    <Route path="hpp" element={<RequireSuper><HppCalculator /></RequireSuper>} />
                    {/* PO Tracker tools */}
                    <Route path="po" element={<PoDashboard />} />
                    <Route path="po/pos" element={<PoList />} />
                    <Route path="po/pos/new" element={<PoForm />} />
                    <Route path="po/pos/:id" element={<PoDetail />} />
                    <Route path="po/pos/:id/edit" element={<PoForm />} />
                    <Route path="po/kalender" element={<PoCalendar />} />
                    {/* Stok Klien tools — Superadmin + Admin/PIC */}
                    <Route path="stok-klien" element={<KlienDashboard />} />
                    <Route path="stok-klien/riwayat" element={<KlienHistory />} />
                    {/* Jatuh Tempo Klien tools — Superadmin only */}
                    <Route path="tempo" element={<RequireSuper><TempoInvoices /></RequireSuper>} />
                    <Route path="tempo/laporan" element={<RequireSuper><TempoReports /></RequireSuper>} />
                    {/* Legacy aliases (backward compat) */}
                    <Route path="kertas" element={<Navigate to="/stok/kertas" replace />} />
                    <Route path="tinta" element={<Navigate to="/stok/tinta" replace />} />
                    <Route path="lainnya" element={<Navigate to="/stok/lainnya" replace />} />
                    <Route path="laporan-stok" element={<Navigate to="/stok/laporan-stok" replace />} />
                    <Route path="laporan-detail" element={<Navigate to="/stok/laporan-detail" replace />} />
                    <Route path="log-user" element={<Navigate to="/stok/log-user" replace />} />
                    <Route path="tutup-tahun" element={<Navigate to="/stok/tutup-tahun" replace />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster richColors position="top-right" />
          </LangProvider>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
