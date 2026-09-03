# Panduan Deploy — LAPORAN STOK SCA (5 Tools)

Panduan lengkap dari nol sampai aplikasi live di **VPS sendiri** memakai
**Coolify self-hosted**, database **MariaDB (resource Coolify)**, penyimpanan foto **Cloudflare R2**,
dan **domain sendiri** ber-HTTPS.

> Stack: Next.js 15 (App Router, full-stack) → di-build jadi Docker image lewat
> `Dockerfile` di root repo (Next.js *standalone*, ±200 MB).
> Tools di dalamnya: Stok SCA · Kalkulator HPP · PO Tracker · Stok Klien · Jatuh Tempo Klien.

---

## Daftar Isi

1. [Gambaran Arsitektur](#1-gambaran-arsitektur)
2. [Prasyarat](#2-prasyarat)
3. [Database MariaDB di Coolify](#3-database-mariadb-di-coolify)
4. [Cloudflare R2 dari Nol](#4-cloudflare-r2-dari-nol)
5. [Siapkan VPS & Coolify](#5-siapkan-vps--coolify)
6. [Deploy Aplikasi di Coolify](#6-deploy-aplikasi-di-coolify)
7. [Tambah Domain & HTTPS](#7-tambah-domain--https)
8. [Verifikasi Setelah Deploy](#8-verifikasi-setelah-deploy)
9. [Apa yang Terjadi Saat First Deploy](#9-apa-yang-terjadi-saat-first-deploy)
10. [Update Aplikasi (Redeploy)](#10-update-aplikasi-redeploy)
11. [Backup, Restore & Data Contoh](#11-backup-restore--data-contoh)
12. [Checklist Serah Terima ke Client](#12-checklist-serah-terima-ke-client)
13. [Troubleshooting](#13-troubleshooting)
14. [Referensi Cepat](#14-referensi-cepat)
15. [phpMyAdmin di subdomain sendiri](#15-phpmyadmin-di-subdomain-sendiri-contoh-dbscaportalcloud)

---

## 1. Gambaran Arsitektur

```
 Browser ──HTTPS──► Cloudflare DNS ──► VPS (Coolify)
                                        │
                                        ├─ Traefik (proxy bawaan Coolify, SSL Let's Encrypt)
                                        │      └─ Container "laporan-stok-sca" : Next.js :3000
                                        │              ├─ /            → UI (SPA)
                                        │              └─ /api/*       → Route Handlers
                                        │                     ├─► MariaDB (Coolify) (data)
                                        │                     └─► Cloudflare R2   (foto PO)
```

| Komponen | Dimana | Biaya |
| --- | --- | --- |
| Aplikasi (Next.js) | VPS Anda, dikelola Coolify | biaya VPS |
| Database | MariaDB (one-click resource Coolify, di VPS yang sama) | termasuk biaya VPS |
| Foto bukti PO | Cloudflare R2 | gratis s/d 10 GB (butuh kartu untuk aktivasi) |
| Domain + DNS | Cloudflare | gratis (domain beli sendiri) |

Semua konfigurasi rahasia (**DATABASE_URL**, **JWT_SECRET**, **R2_\***) diisi di
**Coolify → Environment Variables**, **tidak** ditulis di dalam kode/image.

### 1.1 Catatan Coolify self-hosted & Docker

Panduan ini untuk **Coolify self-hosted** (Coolify diinstal sendiri di VPS Anda,
bukan Coolify Cloud). Soal Docker **tidak ada perbedaan**:

- Installer Coolify memasang **Docker Engine** standar di VPS. Build pack **Dockerfile**
  hanya menjalankan `docker build` terhadap `Dockerfile` di root repo → image yang sama
  persis dengan yang Anda dapat kalau menjalankan `docker build -t sca-tools .` manual.
- Dockerfile ini **tidak** bergantung pada fitur khusus Coolify/Vercel/Nixpacks: basis
  `node:20-bookworm-slim`, output Next.js *standalone*, listen di `0.0.0.0:3000`.
  Jadi image ini juga bisa jalan di Docker biasa, Portainer, Dokploy, dsb. (lihat bagian 14).
- Traefik (reverse proxy + SSL) sudah otomatis ikut terpasang bersama Coolify — tidak
  perlu install Nginx/Certbot sendiri.
- Coolify self-hosted **tidak** perlu membuka port aplikasi (3000) ke publik; container
  berbicara ke Traefik lewat network Docker internal. Yang dibuka ke internet hanya 80/443.

### 1.2 Daftar lengkap Environment Variables

Semua variabel di bawah diisi di **Coolify → aplikasi → Environment Variables**
(tanpa centang *Build Variable*). File `.env.example` di repo berisi template yang sama.

| Variable | Wajib | Sumber / cara dapat | Contoh |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | Coolify → resource MariaDB → **MariaDB URL (internal)** | `mysql://mariadb:xxx@abcdef:3306/default` |
| `JWT_SECRET` | ✅ | `openssl rand -hex 32` | `9f3c…64 karakter hex` |
| `SUPERADMIN_USERNAME` | ✅ (produksi) | Ditentukan sendiri | `Jeffsca` |
| `SUPERADMIN_PASSWORD` | ✅ (produksi) | Ditentukan sendiri, kuat | `Sc@Prod!2025` |
| `TEMP_ACCESS_PASSWORD` | ✅ (produksi) | Password buka section terkunci Admin/PIC | `BukaSection2025` |
| `OWNER_EMAIL` | opsional | Email pemilik | `owner@domain.com` |
| `R2_ACCOUNT_ID` | ✅ untuk foto PO | Cloudflare → R2 → Account ID (bagian 4.4) | `74c0…32 hex` |
| `R2_ACCESS_KEY_ID` | ✅ untuk foto PO | R2 API Token (bagian 4.4) | `606a…` |
| `R2_SECRET_ACCESS_KEY` | ✅ untuk foto PO | R2 API Token (bagian 4.4) | `70fb…64 hex` |
| `R2_BUCKET_NAME` | ✅ untuk foto PO | Nama bucket (bagian 4.2) | `sca-po-photos` |
| `R2_PUBLIC_URL` | ✅ untuk foto PO | r2.dev subdomain / custom domain (bagian 4.3) | `https://pub-xxxx.r2.dev` |
| `PORT` / `HOSTNAME` / `NODE_ENV` | ❌ | Sudah di Dockerfile (`3000` / `0.0.0.0` / `production`) | — |
| `NEXT_PUBLIC_API_BASE` | ❌ | Hanya bila API dipisah domain; default `/api` | — |

---

## 2. Prasyarat

- [ ] **VPS** aktif (minimal **2 vCPU / 2 GB RAM / 20 GB**, disarankan 4 GB agar build
      Next.js lancar), OS Ubuntu 22.04/24.04, akses SSH root.
- [ ] **Coolify** sudah terinstal dan dashboard bisa dibuka (`http://IP-VPS:8000`).
      Bila belum: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
- [ ] Akun **GitHub** — repo aplikasi ini (upload isi ZIP ke repo Anda, private boleh).
- [ ] Resource **MariaDB** di Coolify (one-click, bagian 3) — tidak butuh layanan database eksternal.
- [ ] Akun **Cloudflare** + domain yang nameserver-nya sudah diarahkan ke Cloudflare.
- [ ] Di komputer lokal: `git` (untuk push repo) — Node.js opsional (hanya untuk seed data contoh).

> **Kenapa harus lewat GitHub?** Coolify menarik (pull) kode dari Git untuk di-build.
> Cukup: buat repo baru → ekstrak ZIP → `git init && git add . && git commit -m "init" && git push`.
> File `.env` **tidak** ikut ter-push (sudah ada di `.gitignore`) — itu memang benar.

---

## 3. Database MariaDB di Coolify

> Aplikasi memakai **MariaDB sepenuhnya**. Tidak ada lagi MongoDB/Atlas di kode maupun dependensi.

1. Coolify → Project → **+ New Resource** → **Databases** → **MariaDB** → Create.
2. Di halaman resource MariaDB: biarkan *Access* = **Private** (aman; aplikasi konek lewat
   network internal Docker). *Public port* hanya perlu dinyalakan sementara bila Anda mau
   konek dari laptop — matikan lagi setelah selesai.
3. Salin **MariaDB URL (internal)** (format `mysql://mariadb:PASSWORD@host:3306/default`).
4. **WAJIB:** tempel nilai itu ke aplikasi → **Environment Variables** → key **`DATABASE_URL`**.
   Bila `DATABASE_URL` kosong, aplikasi jatuh ke `127.0.0.1:3306` → `ECONNREFUSED`,
   container tidak pernah *healthy*, dan Traefik menjawab **"no available server"**.
5. Tabel (19 tabel) dan akun superadmin dibuat **otomatis** saat request pertama —
   tidak perlu import skema manual.
6. phpMyAdmin untuk melihat/mengelola isi database: lihat **bagian 15**
   (`https://db.scaportal.cloud`).
7. Data contoh/dummy (opsional, sekali saja): phpMyAdmin → database `default` → **Import** →
   unggah `deploy/dummy_data.sql`. Berisi 839 baris (users, mutasi kertas/tinta/lainnya,
   PO + jadwal + foto, klien, invoice tempo, log).
   Dump memakai `DROP TABLE` + `CREATE TABLE` → **menimpa** tabel yang ada, jangan dipakai
   di database yang sudah berisi data produksi.

---

## 4. Cloudflare R2 dari Nol

R2 dipakai **PO Tracker** untuk menyimpan foto bukti tahapan produksi.
Upload dilakukan dari server (API Next.js) → tidak butuh CORS. Foto diakses publik
lewat `R2_PUBLIC_URL`.

### 4.1 Aktifkan R2

1. Login <https://dash.cloudflare.com> → menu kiri **R2 Object Storage**.
2. Klik **Purchase R2 Plan / Get started**. Cloudflare meminta **metode pembayaran**
   (kartu/PayPal) untuk aktivasi — **tidak ditagih** selama pemakaian di bawah kuota
   gratis (10 GB penyimpanan, 1 juta operasi tulis/bulan, egress gratis).

### 4.2 Buat bucket

1. **R2** → **Create bucket**.
2. **Bucket name**: `sca-po-photos` (harus sama dengan env `R2_BUCKET_NAME`).
3. **Location**: *Automatic* atau **Asia-Pacific (APAC)**.
4. **Default storage class**: Standard → **Create bucket**.

### 4.3 Aktifkan akses publik (untuk menampilkan foto)

Pilih **salah satu**:

**Opsi A — R2.dev subdomain (paling cepat, cocok untuk mulai):**
1. Buka bucket → tab **Settings** → bagian **Public access** → **R2.dev subdomain** → **Allow Access**.
2. Ketik `allow` → Confirm. Akan muncul URL seperti `https://pub-xxxxxxxxxxxxxxxx.r2.dev`.
3. Nilai ini untuk env **`R2_PUBLIC_URL`** (tanpa garis miring di akhir).

**Opsi B — Custom domain (lebih rapi, ada cache/CDN Cloudflare):**
1. Bucket → **Settings** → **Public access** → **Custom Domains** → **Connect Domain**.
2. Masukkan mis. `foto.domain-anda.com` (domain harus sudah di Cloudflare) → Continue → **Connect domain**.
   Cloudflare otomatis membuat DNS record-nya. Tunggu status **Active** (± 1–5 menit).
3. `R2_PUBLIC_URL` = `https://foto.domain-anda.com`.

### 4.4 Buat API Token (kredensial S3)

1. Kembali ke halaman **R2 Object Storage** → kanan atas **Manage R2 API Tokens** (atau **{ } API** → *Manage API tokens*).
2. **Create API token**:
   | Kolom | Isi |
   | --- | --- |
   | Token name | `sca-app-prod` |
   | Permissions | **Object Read & Write** |
   | Specify bucket(s) | **Apply to specific buckets only** → pilih `sca-po-photos` |
   | TTL | Forever |
   | Client IP filtering | kosongkan (atau isi IP VPS untuk keamanan ekstra) |
3. **Create API Token**. Halaman berikutnya **hanya tampil sekali** — salin:
   - **Access Key ID** → env `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → env `R2_SECRET_ACCESS_KEY`
   - **Endpoint** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` → bagian `<ACCOUNT_ID>`
     adalah env `R2_ACCOUNT_ID` (juga terlihat di halaman utama R2, kanan: *Account ID*).

### 4.5 Rekap env R2

```
R2_ACCOUNT_ID=74c0xxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=sca-po-photos
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

> Bila salah satu env R2 kosong, aplikasi tetap jalan; hanya fitur **upload foto PO**
> yang menampilkan pesan *R2 belum dikonfigurasi*.

---

## 5. Siapkan VPS & Coolify

### 5.1 Firewall (sekali saja, via SSH)

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (redirect + verifikasi Let's Encrypt)
ufw allow 443/tcp     # HTTPS
ufw allow 8000/tcp    # dashboard Coolify (bisa ditutup setelah pasang domain dashboard)
ufw allow 6001/tcp    # Coolify realtime
ufw allow 6002/tcp    # Coolify terminal
ufw enable
```

> Provider VPS tertentu (Contabo, Hetzner, DO) juga punya firewall di panel mereka —
> buka port yang sama di sana.

### 5.2 Login Coolify pertama kali

1. Buka `http://IP-VPS:8000` → buat akun admin (email + password kuat) — **simpan**.
2. Onboarding: pilih **Localhost** sebagai server → **Create project** boleh dilewati.
3. (Disarankan) **Settings** (menu kiri) → **Instance's Domain**: `https://coolify.domain-anda.com`
   → Save. Buat dulu DNS A record `coolify` → IP VPS (lihat bagian 7.1). Setelah aktif,
   dashboard bisa diakses via HTTPS dan port 8000 boleh ditutup (`ufw delete allow 8000/tcp`).

### 5.3 Hubungkan GitHub ke Coolify

**Cara A — GitHub App (disarankan; auto-deploy tiap push):**
1. Coolify → **Sources** → **+ Add** → **GitHub App** → beri nama → **Register Now**.
2. Anda diarahkan ke GitHub → **Install** → pilih *Only select repositories* → repo aplikasi → Install.
3. Kembali ke Coolify, status Source menjadi terhubung.

**Cara B — Deploy Key (repo private tanpa GitHub App):**
1. Coolify → **Keys & Tokens** → **+ Add** → generate SSH key → salin public key.
2. GitHub → repo → **Settings** → **Deploy keys** → **Add deploy key** → tempel (read-only cukup).
3. Saat menambah resource pilih **Private Repository (with deploy key)** dan URL `git@github.com:USER/REPO.git`.

---

## 6. Deploy Aplikasi di Coolify

### 6.1 Buat resource

1. **Projects** → **+ Add** → nama `SCA Tools` → masuk environment **production**.
2. **+ New Resource** → bagian *Git Based* → **Private Repository (with GitHub App)**
   (atau *Public Repository* bila repo publik).
3. Pilih GitHub App → pilih repo → **Branch**: `main` → **Build Pack**: **Dockerfile** → **Continue**.

### 6.2 Pengaturan (tab General)

| Field | Nilai |
| --- | --- |
| Name | `laporan-stok-sca` |
| Build Pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | isi nanti di bagian 7 (boleh sementara kosong → Coolify beri `*.sslip.io`) |

Klik **Save**.

### 6.3 Environment Variables

Tab **Environment Variables** → klik **Developer view** → tempel blok berikut
(sesuaikan nilainya) → **Save**:

```
DATABASE_URL=mysql://mariadb:PASSWORD@host-internal-mariadb:3306/default
JWT_SECRET=<hasil openssl rand -hex 32>
SUPERADMIN_USERNAME=Jeffsca
SUPERADMIN_PASSWORD=<password kuat>
TEMP_ACCESS_PASSWORD=<password kuat>
OWNER_EMAIL=email@anda.com
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=sca-po-photos
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

| Name | Wajib? | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | **MariaDB URL (internal)** dari resource MariaDB (bagian 3). Tanpa ini deploy gagal. |
| `JWT_SECRET` | ✅ | `openssl rand -hex 32` (jalankan di VPS/laptop) |
| `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` | disarankan | Default `Jeffsca` / `jeff3131` — **wajib ganti di produksi** |
| `TEMP_ACCESS_PASSWORD` | disarankan | Password pembuka section terproteksi untuk Admin/PIC |
| `OWNER_EMAIL` | opsional | Disimpan di profil superadmin |
| `R2_*` | untuk foto PO | Bagian 4.5 |

> Semua env di atas dibaca saat **runtime** — **jangan** centang *Build Variable*.
> `PORT`, `HOSTNAME`, `NODE_ENV` sudah diset di Dockerfile, tidak perlu ditambah.
> Setelah menambah/mengubah env, wajib **Redeploy** (bukan hanya Restart) agar container
> baru membawa `.env` terbaru.

### 6.4 Health check (disarankan)

Tab **Healthcheck** → Enable → Method `GET`, Path `/api/health`, Port `3000`,
Interval `30`, Timeout `5`, Retries `5`, Start period `40`. Dengan ini Coolify hanya
mengalihkan traffic ke container baru bila sudah benar-benar siap (*zero-downtime*).

> `/api/health` **sengaja tidak menyentuh MariaDB** (hanya membuktikan proses Next.js hidup).
> Kalau healthcheck ikut mengetes database, satu gangguan DB membuat Coolify menganggap
> container baru *unhealthy* → rolling back → container lama juga dihapus → domain menjawab
> **"no available server"**. Untuk memeriksa database, buka `/api/health?deep=1` secara manual
> (mengembalikan `{"status":"ok","db":"ok"}` atau `{"status":"degraded","db":"error",...}`).

### 6.5 Deploy

Klik **Deploy** (kanan atas). Build pertama ± **3–6 menit** (install dependency +
`next build`). Pantau di tab **Deployments** → klik log. Selesai bila status **Running**
dan warna hijau.

---

## 7. Tambah Domain & HTTPS

Contoh: aplikasi di `https://stok.domain-anda.com`.

### 7.1 Buat DNS record di Cloudflare

Cloudflare → pilih domain → **DNS** → **Records** → **Add record**:

| Type | Name | IPv4 address | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| `A` | `stok` | IP publik VPS | **DNS only** (awan abu-abu) — *saat penerbitan SSL pertama* | Auto |

Ulangi untuk `coolify` (dashboard) bila ingin — dan `foto` **tidak perlu** dibuat manual
(dibuat otomatis oleh R2 saat *Connect Domain*).

> Mengapa **DNS only** dulu? Agar Let's Encrypt (lewat Traefik di Coolify) bisa
> memverifikasi domain langsung ke VPS. Setelah sertifikat terbit (± 1 menit),
> Anda **boleh** mengubah ke **Proxied** (awan oranye) — lihat 7.3.

Cek propagasi: `nslookup stok.domain-anda.com` harus mengembalikan IP VPS.

### 7.2 Set domain di Coolify

1. Coolify → aplikasi `laporan-stok-sca` → tab **General** → **Domains**:
   ```
   https://stok.domain-anda.com
   ```
   (wajib pakai `https://`; beberapa domain dipisah koma).
2. **Save** → **Redeploy** (atau **Restart**). Traefik otomatis meminta sertifikat
   Let's Encrypt dan mengarahkan HTTP → HTTPS.
3. Buka `https://stok.domain-anda.com` — gembok hijau harus muncul dalam 1–2 menit.

### 7.3 (Opsional) Nyalakan proxy Cloudflare (awan oranye)

Manfaat: sembunyikan IP VPS, anti-DDoS, cache statis.

1. Cloudflare → **SSL/TLS** → **Overview** → mode **Full (strict)**.
   *(Jangan "Flexible" — menyebabkan redirect loop.)*
2. **DNS** → ubah record `stok` ke **Proxied**.
3. **SSL/TLS** → **Edge Certificates** → **Always Use HTTPS**: On.

> Untuk dashboard Coolify (`coolify.domain-anda.com`) disarankan tetap **DNS only**,
> karena fitur terminal/realtime (websocket port 6001/6002) lebih stabil tanpa proxy.

### 7.4 Domain dashboard Coolify

**Settings** → **Instance's Domain** → `https://coolify.domain-anda.com` → Save.
Buka URL tersebut; jika sudah bisa, tutup port 8000: `ufw delete allow 8000/tcp`.

---

## 8. Verifikasi Setelah Deploy

1. Health: `https://scaportal.cloud/api/health` → `{"status":"ok"}`.
2. Health + database: `https://scaportal.cloud/api/health?deep=1` → `{"status":"ok","db":"ok"}`.
3. Login **Superadmin** (sesuai `SUPERADMIN_USERNAME/PASSWORD`).
4. Sidebar menampilkan **5 tool**: Stok SCA (Dashboard/Mutasi/Laporan), Kalkulator HPP,
   PO Tracker, Stok Klien, Jatuh Tempo Klien.
5. **PO Tracker** → buka salah satu PO → upload foto tahap → foto tampil (memastikan R2 OK).
6. Buat akun **Admin/PIC** dari **Log & User** → login dengan akun itu → pastikan:
   hanya melihat **Stok Klien** (nominal rupiah *Terkunci*), tanpa HPP & Jatuh Tempo.
7. phpMyAdmin (`https://db.scaportal.cloud`) → database `default` → harus ada **19 tabel**
   (`users`, `settings`, `paper_mutations`, `pos`, `klien_*`, `tempo_*`, dst).

---

## 9. Apa yang Terjadi Saat First Deploy

Skema dibuat **otomatis** — tidak perlu import SQL manual. Pada request API pertama,
aplikasi menjalankan auto-init (`src/server/init.js`), sekali per start container
dan idempotent:

- Menjalankan seluruh DDL di `src/server/schema.js`: **19 tabel** `CREATE TABLE IF NOT EXISTS`
  (InnoDB, utf8mb4, primary key CHAR(36) UUID, foreign key ON DELETE CASCADE).
- **Seed superadmin** sesuai `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.
- **Seed password akses sementara** sesuai `TEMP_ACCESS_PASSWORD`.
- **Seed opsi TOP** Jatuh Tempo Klien (`tempo_top_options`).

Mengubah `SUPERADMIN_PASSWORD` lalu **Redeploy** akan menyinkronkan password superadmin
di database. Mengubah `SUPERADMIN_USERNAME` membuat superadmin **baru** (yang lama tetap ada).

Peta tabel per modul:

| Modul | Tabel |
| --- | --- |
| Akun & sistem | `users`, `settings`, `activity_logs`, `audit_logs` |
| Stok SCA | `paper_mutations`, `ink_mutations`, `other_mutations` |
| Kalkulator HPP | `hpp_calculations` |
| PO Tracker | `pos` ⟵ `po_logs`, `po_schedules`, `po_files` |
| Stok Klien | `klien_clients` ⟵ `klien_pos` ⟵ `klien_items` ⟵ `klien_mutations` |
| Jatuh Tempo | `tempo_invoices` ⟵ `tempo_installments`, `tempo_top_options` |

---

## 10. Update Aplikasi (Redeploy)

| Situasi | Yang dilakukan |
| --- | --- |
| Ada perubahan kode | `git push` ke `main` → Coolify (GitHub App) auto-build & deploy. Tanpa GitHub App: klik **Deploy** manual |
| Ubah env variable | Edit di tab Environment Variables → **Save** → **Redeploy** (Restart saja tidak selalu memuat `.env` baru) |
| Rollback | Tab **Deployments** → pilih deployment lama yang sukses → **Redeploy** |
| Lihat log runtime | Tab **Logs** (container) — error MariaDB/R2 muncul di sini |
| Masuk ke container | Tab **Terminal** (untuk debugging) |

---

## 11. Backup, Restore & Data Contoh

### 11.1 Backup database (MariaDB di Coolify)

- **Otomatis (disarankan):** resource MariaDB → tab **Backups** → tambah jadwal
  (mis. harian `0 3 * * *`), simpan lokal atau ke S3/R2. Bisa juga **Import Backup**
  untuk restore.
- **Manual dari Terminal** resource MariaDB:
  ```bash
  mariadb-dump -u mariadb -p --single-transaction --no-tablespaces default > backup-$(date +%F).sql
  mariadb -u mariadb -p default < backup-2026-01-01.sql
  ```
- **Manual dari phpMyAdmin:** database `default` → tab **Export** (format SQL) untuk backup,
  tab **Import** untuk restore.
- Backup R2: **Cloudflare R2 → bucket → Objects** (unduh) atau `rclone` dengan endpoint S3.

### 11.2 Data contoh / dummy

Repo menyertakan `deploy/dummy_data.sql` (839 baris: users, mutasi kertas/tinta/lainnya,
PO + jadwal + foto, klien + item + mutasi, invoice tempo + cicilan, activity & audit log).

- phpMyAdmin → database `default` → **Import** → unggah `deploy/dummy_data.sql` → Import.
- atau Terminal resource MariaDB: `mariadb -u mariadb -p default < deploy/dummy_data.sql`

Dump memakai `DROP TABLE IF EXISTS` + `CREATE TABLE`, jadi **menimpa** tabel yang ada.
Untuk serah terima ke client, **jangan** impor file ini — biarkan aplikasi membuat
database kosong dengan superadmin saja.

---

## 12. Checklist Serah Terima ke Client

- [ ] `DATABASE_URL` menunjuk database **fresh** (resource MariaDB baru atau database kosong).
- [ ] `deploy/dummy_data.sql` **tidak** diimpor (dashboard bersih, 0 data).
- [ ] `SUPERADMIN_USERNAME` & `SUPERADMIN_PASSWORD` final & kuat (bukan default).
- [ ] `JWT_SECRET` baru (bukan bekas masa testing).
- [ ] `TEMP_ACCESS_PASSWORD` diganti dari default.
- [ ] Token R2 dibatasi ke bucket `sca-po-photos`; kredensial lama (jika pernah bocor) di-**rotate**:
      Cloudflare → Manage R2 API Tokens → *Roll* / hapus & buat baru → update env → Redeploy.
- [ ] Password MariaDB kuat (pakai yang digenerate Coolify), *Access* kembali ke **Private**
      (public port dimatikan).
- [ ] Backup terjadwal MariaDB aktif di Coolify.
- [ ] Domain `https://scaportal.cloud` aktif, gembok hijau, `/api/health?deep=1` OK.
- [ ] Akun **Admin/PIC** untuk staf client dibuat lewat **Log & User**.
- [ ] phpMyAdmin (`db.scaportal.cloud`) dibatasi (Cloudflare Access / IP allowlist) atau
      dimatikan setelah setup.
- [ ] Port 8000 ditutup setelah dashboard Coolify punya domain sendiri.
- [ ] Akun Coolify admin memakai password kuat (+ 2FA di Profile bila tersedia).

---

## 13. Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Build gagal: `yarn install --frozen-lockfile` error | `yarn.lock` tidak sinkron dengan `package.json` | Jalankan `yarn install` lokal, commit `yarn.lock` baru, push |
| Build gagal: *JavaScript heap out of memory* | RAM VPS < 2 GB | Tambah swap 2 GB (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`) atau upgrade VPS |
| Traefik: **`no available server`** | Tidak ada container sehat — biasanya deploy terakhir *rolling back* | Cek **Deployments** → log; penyebab tersering `DATABASE_URL` belum diisi (lihat baris berikut) |
| Log: `[db] DATABASE_URL belum diset` + `connect ECONNREFUSED 127.0.0.1:3306` | Env `DATABASE_URL` tidak ada di aplikasi | Isi `DATABASE_URL` = *MariaDB URL (internal)* → **Redeploy** |
| `getaddrinfo ENOTFOUND <host>` | Host internal MariaDB tidak bisa di-resolve (beda project/network Coolify) | Taruh app & MariaDB di project yang sama, atau centang *Connect To Predefined Network* |
| `ER_ACCESS_DENIED_ERROR` | User/password di `DATABASE_URL` salah, atau karakter spesial belum di-URL-encode | Salin ulang **MariaDB URL (internal)** apa adanya → Redeploy |
| `ER_BAD_DB_ERROR: Unknown database` | Nama database di akhir URL salah (default `default`) | Perbaiki bagian setelah `:3306/` |
| Container *unhealthy* padahal app hidup | Healthcheck menembak path/port salah | Path `/api/health`, Port `3000`, Start period ≥ 40 s |
| Domain tidak bisa dibuka / *404 page not found* dari Traefik | DNS belum mengarah ke VPS, atau Domains di Coolify belum sesuai | `nslookup domain` → harus IP VPS; pastikan Domains berformat `https://...` → Redeploy |
| SSL tidak terbit (*ERR_SSL_PROTOCOL_ERROR*) | Port 80 tertutup, atau DNS masih Proxied saat penerbitan pertama | Buka port 80/443 di ufw & panel VPS; set DNS **DNS only** dulu → Restart app |
| *Too many redirects* | Cloudflare SSL mode **Flexible** | Ubah ke **Full (strict)** |
| Upload foto PO gagal: `R2 config: ... belum diset` | Salah satu env `R2_*` kosong | Lengkapi env → Redeploy |
| Upload sukses tapi foto tidak tampil (403/404) | Public access bucket belum aktif, atau `R2_PUBLIC_URL` salah | Bucket → Settings → Public access → Allow (r2.dev) atau Connect Domain; pastikan URL tanpa `/` di akhir |
| Upload foto gagal `AccessDenied` | Token R2 tidak punya izin Write / salah bucket | Buat token baru **Object Read & Write** untuk bucket `sca-po-photos` |
| Login gagal padahal DB terhubung | Kredensial tidak sesuai env, atau env diubah tanpa redeploy | Samakan dengan `SUPERADMIN_*` → **Redeploy** |
| Data dummy masih terlihat | `deploy/dummy_data.sql` pernah diimpor | phpMyAdmin → drop database `default` → buat ulang → Redeploy app (tabel + superadmin dibuat otomatis) |
| phpMyAdmin: *mysqli::real_connect(): php_network_getaddresses* | `PMA_HOST` salah / beda network | Isi `PMA_HOST` dengan host internal MariaDB, pastikan satu project |
| Coolify dashboard tidak bisa dibuka setelah set domain | DNS `coolify` belum ada / port 8000 sudah ditutup | Buat A record `coolify` → IP VPS; sementara buka lagi `ufw allow 8000/tcp` |

Log runtime container: Coolify → aplikasi → **Logs**. Log build: **Deployments** → klik deployment.

---

## 14. Referensi Cepat

```bash
# Format DATABASE_URL yang benar (salin dari "MariaDB URL (internal)" di Coolify):
mysql://mariadb:PASSWORD@host-internal-mariadb:3306/default

# Generate JWT_SECRET:
openssl rand -hex 32

# IP publik VPS (untuk DNS):
curl ifconfig.me

# Tes kesehatan setelah deploy:
curl https://scaportal.cloud/api/health
curl https://scaportal.cloud/api/health?deep=1

# Cek isi database dari Terminal resource MariaDB di Coolify:
mariadb -u mariadb -p -e "USE \`default\`; SHOW TABLES; SELECT username, role FROM users;"

# Impor data dummy:
mariadb -u mariadb -p default < deploy/dummy_data.sql

# Build & jalankan image secara manual di VPS (tanpa Coolify, untuk debugging):
docker build -t sca-tools .
docker run -d --name sca-tools -p 3000:3000 --env-file .env sca-tools
curl http://localhost:3000/api/health
```


Struktur env lengkap: lihat [`.env.example`](./.env.example). Dokumentasi fitur & API: [`README.md`](./README.md).

---

## 15. phpMyAdmin di subdomain sendiri (contoh `db.scaportal.cloud`)

1. **Cloudflare DNS** — sudah ada record `A  db  103.150.191.186` (DNS only / proxied keduanya boleh).
2. **Coolify** → project yang sama → **+ New Resource** → **Services** → cari **phpMyAdmin** → Create.
3. Di service phpMyAdmin → **Environment Variables** tambahkan:
   | Key | Value |
   | --- | --- |
   | `PMA_HOST` | host internal MariaDB (bagian sebelum `:3306` di *MariaDB URL (internal)*, contoh `04ufjpxd8weyexh5ffwmap6o`) |
   | `PMA_PORT` | `3306` |
   | `PMA_ABSOLUTE_URI` | `https://db.scaportal.cloud/` |
   | `UPLOAD_LIMIT` | `256M` (opsional, untuk import SQL besar) |
4. Tab **General** → kolom **Domains** isi `https://db.scaportal.cloud` → Save → **Deploy**.
   Traefik otomatis menerbitkan sertifikat Let's Encrypt.
5. Pastikan phpMyAdmin dan MariaDB berada di **project/network Coolify yang sama** agar host internal bisa di-resolve
   (bila beda project: di resource MariaDB centang *Connect To Predefined Network* atau pakai Public Access + IP VPS).
6. Login phpMyAdmin: user `mariadb`, password = *Normal user password* dari resource MariaDB. Database `default`
   berisi 19 tabel aplikasi (`users`, `paper_mutations`, `pos`, `klien_*`, `tempo_*`, dst.).
7. (Opsional) Impor data contoh: pilih database `default` → tab **Import** → unggah
   `deploy/dummy_data.sql` → **Import**. Untuk backup: tab **Export** → format **SQL**.

Alternatif tanpa katalog: **+ New Resource → Docker Compose** lalu tempel isi
[`deploy/phpmyadmin.compose.yml`](./deploy/phpmyadmin.compose.yml) (sudah lengkap dengan
`UPLOAD_LIMIT`, `MEMORY_LIMIT`, dan healthcheck).

> Keamanan: phpMyAdmin memberi akses penuh ke database. Gunakan password MariaDB yang kuat, dan bila perlu batasi
> akses lewat Cloudflare Access / IP allowlist di Traefik. Setelah selesai setup, service ini boleh di-**Stop**
> dan dinyalakan hanya saat dibutuhkan.
