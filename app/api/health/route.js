import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck DANGKAL — sengaja TIDAK menyentuh database.
 *
 * Dipakai oleh HEALTHCHECK Docker / Coolify. Bila endpoint ini ikut membuka
 * koneksi MariaDB, satu gangguan database (atau DATABASE_URL yang belum diisi)
 * membuat container dianggap unhealthy lalu Coolify melakukan rolling back —
 * hasilnya Traefik kehilangan semua container dan domain menjawab
 * "no available server". Endpoint ini hanya membuktikan proses Next.js hidup.
 *
 * Untuk memeriksa database, panggil /api/health?deep=1 (tidak dipakai healthcheck).
 */
export async function GET(req) {
  const deep = new URL(req.url).searchParams.get("deep");
  if (!deep) return NextResponse.json({ status: "ok" });

  try {
    const { queryOne } = await import("@/server/db");
    const row = await queryOne("SELECT 1 AS ok");
    return NextResponse.json({ status: "ok", db: row?.ok === 1 ? "ok" : "unknown" });
  } catch (e) {
    return NextResponse.json(
      { status: "degraded", db: "error", detail: e?.message || "gagal konek database" },
      { status: 200 },
    );
  }
}
