/**
 * Konfigurasi koneksi MariaDB untuk skrip-skrip di folder tests/.
 *
 * Kredensial TIDAK PERNAH ditulis di kode. Sumbernya `DATABASE_URL`, dibaca dari
 * environment atau dari file `.env` di root repo (yang sudah di-gitignore).
 * Formatnya sama dengan yang dipakai aplikasi:
 *   mysql://user:password@host:port/database
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Parser .env minimal (repo ini tidak memakai dotenv). */
function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function getDbConfig() {
  const fileEnv = loadEnvFile(resolve(here, "..", ".env"));
  const url = process.env.DATABASE_URL || fileEnv.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL tidak ditemukan.\n" +
        "Set lewat environment atau isi di file .env pada root repo, contoh:\n" +
        "  DATABASE_URL=\"mysql://user:password@host:3306/default\"\n" +
        "Catatan: dari luar jaringan Coolify pakai host + PORT PUBLIK MariaDB, " +
        "bukan hostname internal Coolify."
    );
  }

  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "default",
    connectTimeout: 20000,
  };
}
