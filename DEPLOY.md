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
3. [MongoDB Atlas dari Nol](#3-mongodb-atlas-dari-nol)
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

Semua konfigurasi rahasia (**MONGO_URL**, **JWT_SECRET**, **R2_\***) diisi di
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
- [ ] Akun **MongoDB Atlas** (gratis).
- [ ] Akun **Cloudflare** + domain yang nameserver-nya sudah diarahkan ke Cloudflare.
- [ ] Di komputer lokal: `git` (untuk push repo) — Node.js opsional (hanya untuk seed data contoh).

> **Kenapa harus lewat GitHub?** Coolify menarik (pull) kode dari Git untuk di-build.
> Cukup: buat repo baru → ekstrak ZIP → `git init && git add . && git commit -m "init" && git push`.
> File `.env` **tidak** ikut ter-push (sudah ada di `.gitignore`) — itu memang benar.

---

## 3. Database MariaDB di Coolify

> Bagian ini menggantikan MongoDB Atlas. Aplikasi sekarang memakai MariaDB.

1. Coolify → Project → **+ New Resource** → **Databases** → **MariaDB** → Create.
2. Di halaman resource MariaDB: biarkan *Access* = **Private** (aman; aplikasi konek lewat network internal Docker).
3. Salin **MariaDB URL (internal)** (format `mysql://mariadb:PASSWORD@host:3306/default`) → isi ke env `DATABASE_URL` aplikasi.
4. (Opsional) Tambah service **phpMyAdmin** (New Resource → Services) untuk melihat tabel:
   host = nama host internal di URL di atas, user `mariadb`, password = *Normal user password*.
5. Tabel dibuat otomatis oleh aplikasi saat pertama diakses. Migrasi data lama dari Atlas:
   buka **Terminal** container aplikasi di Coolify lalu jalankan
   `MONGO_URL="mongodb+srv://..." MONGO_DB_NAME="laporan_stok_sca" node scripts/migrate_mongo_to_mariadb.mjs`
   (DATABASE_URL sudah tersedia dari env container).

### 3.x (Arsip) MongoDB Atlas dari Nol — tidak dipakai lagi

### 3.1 Buat akun & cluster

1. Daftar di <https://www.mongodb.com/cloud/atlas/register>.
2. **Build a Database** → tier **M0 (FREE)**.
3. Provider **AWS**, region **Singapore (ap-southeast-1)** — paling dekat ke VPS Indonesia/SG.
4. **Create Deployment**, tunggu 1–3 menit.

### 3.2 Buat Database User

Menu **Database Access** → **Add New Database User**:

| Kolom | Isi |
| --- | --- |
| Authentication | Password |
| Username | mis. `scaadmin` |
| Password | **Autogenerate Secure Password** → salin & simpan |
| Role | **Read and write to any database** |

> Hindari password manual berisi `@ : / # %`. Kalau terpaksa, karakter tersebut
> wajib di-URL-encode di connection string (mis. `@` → `%40`).

### 3.3 Network Access (whitelist IP VPS)

Menu **Network Access** → **Add IP Address**:

- **Disarankan:** masukkan **IP publik VPS** Anda (cek dengan `curl ifconfig.me` di VPS) → Confirm.
- Alternatif cepat: **ALLOW ACCESS FROM ANYWHERE** (`0.0.0.0/0`). Tetap aman karena
  butuh username+password, tapi whitelist IP VPS lebih rapat.

> Jika VPS pindah/IP berubah → tambahkan IP baru di sini, kalau tidak aplikasi
> akan error *Server selection timed out*.

### 3.4 Ambil Connection String

1. **Database** → **Connect** → **Drivers** → salin string:
   ```
   mongodb+srv://scaadmin:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
2. Ganti `<db_password>` dengan password asli — **tanda `<` `>` ikut dihapus**.
3. Ini nilai untuk env **`MONGO_URL`**. Nama database diisi terpisah di **`DB_NAME`**
   (mis. `laporan_stok_sca`) — database & collection dibuat otomatis oleh aplikasi.

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
MONGO_URL=mongodb+srv://scaadmin:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=laporan_stok_sca
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
| `MONGO_URL` | ✅ | Bagian 3.4 |
| `DB_NAME` | ✅ | Ganti nama = database baru yang kosong |
| `JWT_SECRET` | ✅ | `openssl rand -hex 32` (jalankan di VPS/laptop) |
| `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` | disarankan | Default `Jeffsca` / `jeff3131` — **wajib ganti di produksi** |
| `TEMP_ACCESS_PASSWORD` | disarankan | Password pembuka section terproteksi untuk Admin/PIC |
| `OWNER_EMAIL` | opsional | Disimpan di profil superadmin |
| `R2_*` | untuk foto PO | Bagian 4.5 |

> Semua env di atas dibaca saat **runtime** — **jangan** centang *Build Variable*.
> `PORT`, `HOSTNAME`, `NODE_ENV` sudah diset di Dockerfile, tidak perlu ditambah.

### 6.4 Health check (opsional tapi disarankan)

Tab **Healthcheck** → Enable → Method `GET`, Path `/api/health`, Port `3000`,
Interval `30`, Timeout `5`, Retries `3`, Start period `30`. Dengan ini Coolify hanya
mengalihkan traffic ke container baru bila sudah benar-benar siap (*zero-downtime*).

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

1. Health: `https://stok.domain-anda.com/api/health` → `{"status":"ok"}`.
2. Login **Superadmin** (sesuai `SUPERADMIN_USERNAME/PASSWORD`).
3. Sidebar menampilkan **5 tool**: Stok SCA (Dashboard/Mutasi/Laporan), Kalkulator HPP,
   PO Tracker, Stok Klien, Jatuh Tempo Klien.
4. **PO Tracker** → buka salah satu PO → upload foto tahap → foto tampil (memastikan R2 OK).
5. Buat akun **Admin/PIC** dari **Log & User** → login dengan akun itu → pastikan:
   hanya melihat **Stok Klien** (nominal rupiah *Terkunci*), tanpa HPP & Jatuh Tempo.
6. Atlas → **Browse Collections** → database `DB_NAME` berisi `users`, `settings`, dst.

---

## 9. Apa yang Terjadi Saat First Deploy

MongoDB **schemaless** — tidak perlu membuat tabel manual. Pada request API pertama,
aplikasi menjalankan auto-init (`src/server/init.js`), sekali per start container
dan idempotent:

- Membuat **index**: `users.username` (unique), index `year` mutasi, index tanggal log.
- **Seed superadmin** sesuai `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.
- **Seed password akses sementara** sesuai `TEMP_ACCESS_PASSWORD`.

Mengubah `SUPERADMIN_PASSWORD` lalu **Redeploy** akan menyinkronkan password superadmin
di database. Mengubah `SUPERADMIN_USERNAME` membuat superadmin **baru** (yang lama tetap ada).

Collection tool baru (`klien_clients`, `klien_pos`, `klien_items`, `klien_mutations`,
`tempo_invoices`, `tempo_top_options`) terbentuk otomatis pada transaksi pertama —
**terpisah** dari koleksi Stok SCA / HPP / PO Tracker.

---

## 10. Update Aplikasi (Redeploy)

| Situasi | Yang dilakukan |
| --- | --- |
| Ada perubahan kode | `git push` ke `main` → Coolify (GitHub App) auto-build & deploy. Tanpa GitHub App: klik **Deploy** manual |
| Ubah env variable | Edit di tab Environment Variables → **Save** → **Restart** (env baru tidak aktif tanpa restart) |
| Rollback | Tab **Deployments** → pilih deployment lama yang sukses → **Redeploy** |
| Lihat log runtime | Tab **Logs** (container) — error MongoDB/R2 muncul di sini |
| Masuk ke container | Tab **Terminal** (untuk debugging) |

---

## 11. Backup, Restore & Data Contoh

### 11.1 Backup database (Atlas)

- **Otomatis:** M0 tidak punya snapshot otomatis. Upgrade ke M2/M10 bila butuh.
- **Manual (dari laptop/VPS):**
  ```bash
  mongodump --uri="mongodb+srv://scaadmin:PASSWORD@cluster0.xxxxx.mongodb.net/laporan_stok_sca" --out=backup-$(date +%F)
  mongorestore --uri="..." backup-2025-01-01/
  ```
  (`mongodb-database-tools` dari <https://www.mongodb.com/try/download/database-tools>)
- Backup R2: **Cloudflare R2 → bucket → Objects** (unduh) atau `rclone` dengan endpoint S3.

### 11.2 Data contoh 2 tool klien (opsional, dari laptop)

```bash
cp .env.example .env            # isi MONGO_URL & DB_NAME yang sama dengan produksi
yarn install
node scripts/seed_klien_tempo.mjs           # tambah data contoh (aman diulang)
node scripts/seed_klien_tempo.mjs --wipe    # kosongkan lalu isi ulang
```

Script **hanya** menyentuh koleksi `klien_*` dan `tempo_*`. Untuk serah terima ke
client, **jangan** jalankan seed ini (atau gunakan `DB_NAME` berbeda).

---

## 12. Checklist Serah Terima ke Client

- [ ] `MONGO_URL` menunjuk database **fresh** (cluster baru atau `DB_NAME` baru).
- [ ] `SUPERADMIN_USERNAME` & `SUPERADMIN_PASSWORD` final & kuat (bukan default).
- [ ] `JWT_SECRET` baru (bukan bekas masa testing).
- [ ] `TEMP_ACCESS_PASSWORD` diganti dari default.
- [ ] Token R2 dibatasi ke bucket `sca-po-photos`; kredensial lama (jika pernah bocor) di-**rotate**:
      Cloudflare → Manage R2 API Tokens → *Roll* / hapus & buat baru → update env → Restart.
- [ ] Password Atlas di-rotate bila pernah dibagikan (Database Access → Edit → Autogenerate).
- [ ] Domain `https://stok...` aktif, gembok hijau, `/api/health` OK.
- [ ] Login OK, dashboard bersih (0 data) untuk database fresh.
- [ ] Akun **Admin/PIC** untuk staf client dibuat lewat **Log & User**.
- [ ] Port 8000 ditutup setelah dashboard Coolify punya domain sendiri.
- [ ] Akun Coolify admin memakai password kuat (+ 2FA di Profile bila tersedia).

---

## 13. Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Build gagal: `yarn install --frozen-lockfile` error | `yarn.lock` tidak sinkron dengan `package.json` | Jalankan `yarn install` lokal, commit `yarn.lock` baru, push |
| Build gagal: *JavaScript heap out of memory* | RAM VPS < 2 GB | Tambah swap 2 GB (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`) atau upgrade VPS |
| Container terus restart / *unhealthy* | Env `MONGO_URL` salah / Atlas belum whitelist IP | Cek tab **Logs**; perbaiki env → Restart. Pastikan IP VPS ada di Atlas Network Access |
| `bad auth : authentication failed` | User/password DB salah, `<db_password>` belum diganti, karakter spesial belum di-encode | Atlas → Database Access → Edit user → Autogenerate → update `MONGO_URL` → Restart |
| `Server selection timed out` | Network Access Atlas belum dibuka untuk IP VPS | Tambah IP VPS atau `0.0.0.0/0` |
| Domain tidak bisa dibuka / *404 page not found* dari Traefik | DNS belum mengarah ke VPS, atau Domains di Coolify belum sesuai | `nslookup domain` → harus IP VPS; pastikan Domains berformat `https://...` → Redeploy |
| SSL tidak terbit (*ERR_SSL_PROTOCOL_ERROR*) | Port 80 tertutup, atau DNS masih Proxied saat penerbitan pertama | Buka port 80/443 di ufw & panel VPS; set DNS **DNS only** dulu → Restart app |
| *Too many redirects* | Cloudflare SSL mode **Flexible** | Ubah ke **Full (strict)** |
| Upload foto PO gagal: `R2 config: ... belum diset` | Salah satu env `R2_*` kosong | Lengkapi env → Restart |
| Upload sukses tapi foto tidak tampil (403/404) | Public access bucket belum aktif, atau `R2_PUBLIC_URL` salah | Bucket → Settings → Public access → Allow (r2.dev) atau Connect Domain; pastikan URL tanpa `/` di akhir |
| Upload foto gagal `AccessDenied` | Token R2 tidak punya izin Write / salah bucket | Buat token baru **Object Read & Write** untuk bucket `sca-po-photos` |
| Login gagal padahal `MONGO_URL` benar | Kredensial tidak sesuai env, atau env diubah tanpa restart | Samakan dengan `SUPERADMIN_*` → **Restart** |
| Data dummy masih terlihat | Masih memakai `DB_NAME` lama | Ganti `DB_NAME` (mis. `laporan_stok_sca_prod`) → Restart, atau drop database lama di Atlas |
| Coolify dashboard tidak bisa dibuka setelah set domain | DNS `coolify` belum ada / port 8000 sudah ditutup | Buat A record `coolify` → IP VPS; sementara buka lagi `ufw allow 8000/tcp` |

Log runtime container: Coolify → aplikasi → **Logs**. Log build: **Deployments** → klik deployment.

---

## 14. Referensi Cepat

```bash
# Format MONGO_URL yang benar (tanpa < >, tanpa spasi):
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Generate JWT_SECRET:
openssl rand -hex 32

# IP publik VPS (untuk whitelist Atlas & DNS):
curl ifconfig.me

# Tes kesehatan setelah deploy:
curl https://stok.domain-anda.com/api/health

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

> Keamanan: phpMyAdmin memberi akses penuh ke database. Gunakan password MariaDB yang kuat, dan bila perlu batasi
> akses lewat Cloudflare Access / IP allowlist di Traefik.
