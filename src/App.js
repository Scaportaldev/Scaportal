import "@/App.css";
import { lazy, Suspense } from "react";
import { preloadRoute } from "@/lib/routePreload";
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
// Chunk halaman dimuat lewat registry (src/lib/routePreload.js) supaya preload saat
// idle / hover menu memakai promise yang sama dengan React.lazy di sini.
const L = (path) => lazy(() => preloadRoute(path));
const Dashboard = L("/stok");
const PaperMutations = L("/stok/kertas");
const InkMutations = L("/stok/tinta");
const OtherMutations = L("/stok/lainnya");
const StockReport = L("/stok/laporan-stok");
const DetailReport = L("/stok/laporan-detail");
const LogsUsers = L("/stok/log-user");
const YearClose = L("/stok/tutup-tahun");

const HppCalculator = L("/hpp");

const PoDashboard = L("/po");
const PoList = L("/po/pos");
const PoForm = L("/po/pos/new");
const PoDetail = L("/po/pos/:id");
const PoCalendar = L("/po/kalender");
const PoClose = L("/po/tutup");

const KlienDashboard = L("/stok-klien");
const KlienHistory = L("/stok-klien/riwayat");
const KlienClose = L("/stok-klien/tutup");

const TempoInvoices = L("/tempo");
const TempoReports = L("/tempo/laporan");
const NoAccess = L("/tidak-ada-akses");

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <AppSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Guard per-tools: bila toggle permission `perm` OFF, user dilempar ke halaman
 * beranda yang diizinkan (atau halaman "belum ada akses"). Superadmin selalu lolos.
 */
function RequirePerm({ perm, children }) {
  const { user, perms, homePath } = useAuth();
  if (user === undefined) return <AppSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!perms[perm]) return <Navigate to={homePath} replace />;
  return children;
}

function HomeRedirect() {
  const { homePath } = useAuth();
  return <Navigate to={homePath} replace />;
}

const P = (perm, el) => <RequirePerm perm={perm}>{el}</RequirePerm>;

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
                    <Route index element={<HomeRedirect />} />
                    <Route path="tidak-ada-akses" element={<NoAccess />} />
                    {/* Stok SCA */}
                    <Route path="stok" element={P("canStok", <Dashboard />)} />
                    <Route path="stok/kertas" element={P("canStok", <PaperMutations />)} />
                    <Route path="stok/tinta" element={P("canStok", <InkMutations />)} />
                    <Route path="stok/lainnya" element={P("canStok", <OtherMutations />)} />
                    <Route path="stok/laporan-stok" element={P("canStok", <StockReport />)} />
                    <Route path="stok/laporan-detail" element={P("canStokDetail", <DetailReport />)} />
                    <Route path="stok/log-user" element={P("canStokLogs", <LogsUsers />)} />
                    <Route path="stok/tutup-tahun" element={P("canStokYearClose", <YearClose />)} />
                    {/* Kalkulator HPP */}
                    <Route path="hpp" element={P("canHpp", <HppCalculator />)} />
                    {/* PO Tracker */}
                    <Route path="po" element={P("canPo", <PoDashboard />)} />
                    <Route path="po/pos" element={P("canPo", <PoList />)} />
                    <Route path="po/pos/new" element={P("canPo", <PoForm />)} />
                    <Route path="po/pos/:id" element={P("canPo", <PoDetail />)} />
                    <Route path="po/pos/:id/edit" element={P("canPo", <PoForm />)} />
                    <Route path="po/kalender" element={P("canPo", <PoCalendar />)} />
                    <Route path="po/tutup" element={P("canPo", <PoClose />)} />
                    {/* Stok Klien */}
                    <Route path="stok-klien" element={P("canStokKlien", <KlienDashboard />)} />
                    <Route path="stok-klien/riwayat" element={P("canStokKlien", <KlienHistory />)} />
                    <Route path="stok-klien/tutup" element={P("canStokKlien", <KlienClose />)} />
                    {/* Jatuh Tempo Klien */}
                    <Route path="tempo" element={P("canTempo", <TempoInvoices />)} />
                    <Route path="tempo/laporan" element={P("canTempo", <TempoReports />)} />
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
