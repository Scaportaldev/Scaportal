# LAPORAN STOK SCA

Sistem **mutasi & laporan stok** kertas, tinta, dan barang lain untuk percetakan SCA.
Full-stack **Next.js 15 (App Router)** + **MariaDB** (relasional, 19 tabel) + **Cloudflare R2**,
berjalan di **VPS Biznet Gio** (2 vCPU / 4 GB RAM / 60 GB) yang dikelola **Coolify** (Docker + Traefik).

Antarmuka sepenuhnya Bahasa Indonesia, responsive, mendukung mode terang & gelap.

> Repo ini **hanya** memakai MariaDB + Cloudflare R2 + Coolify. Tidak ada lagi MongoDB/Atlas maupun Vercel.

---

## Daftar isi

1. [Fitur](#fitur)
2. [Role & akses](#role--akses)
3. [Arsitektur produksi](#arsitektur-produksi)
4. [Stack](#stack)
5. [Struktur project](#struktur-project)
6. [Environment variables](#environment-variables)
7. [Menjalankan di lokal](#menjalankan-di-lokal)
8. [Deploy ke Coolify](#deploy-ke-coolify)
9. [Cloudflare R2](#cloudflare-r2)
10. [phpMyAdmin](#phpmyadmin)
11. [Database MariaDB](#database-mariadb)
12. [Backup & restore](#backup--restore)
13. [Referensi API](#referensi-api)
14. [Testing](#testing)
15. [Troubleshooting](#troubleshooting)
16. [Catatan preview Emergent](#catatan-preview-emergent)

---

## Fitur

| Modul | Keterangan |
| --- | --- |
| **Dashboard** | Total stok kertas (Rim) & tinta (Kg), jumlah mutasi hari ini, total nominal stok (khusus Superadmin), grafik tren 6 bulan, daftar mutasi terbaru |
| **Mutasi Kertas** | Masuk / Keluar / Retur. Identitas barang = jenis + gramatur + ukuran (panjang × lebar). Harga masuk 3 mode: Per Rim, Per Kg (`g × p × l × harga ÷ 20000`), Total Kiriman. PPN opsional |
| **Mutasi Tinta** | Masuk / Keluar / Retur dengan harga per Kg |
| **Mutasi Lain** | Barang bebas (nama + satuan sendiri, mis. box/pcs/roll) dengan harga per satuan |
| **Laporan Stok** | Rekap stok berjalan per item **beserta rincian per supplier**, ekspor PDF |
| **Laporan Detail** | Nominal rupiah, komposisi nominal, tren nilai stok bulanan, perbandingan dengan periode sebelumnya, rekap PPN per bulan, ekspor PDF *(section terproteksi)* |
| **Log & User** | Log aktivitas login/logout, log audit edit/hapus, CRUD user, aktif/nonaktif user, ubah password akses sementara *(section terproteksi)* |
| **Tutup Tahun** | Wajib unduh PDF laporan dulu, baru reset seluruh data mutasi. Data user & log tetap tersimpan *(section terproteksi)* |
| **Kalkulator HPP** | Perhitungan harga pokok produksi cetak *(khusus Superadmin)* |
| **PO Tracker** | Dashboard PO, daftar PO, tahapan/jadwal produksi, kalender jadwal, foto bukti tahap (Cloudflare R2) |
| **Stok Klien** | Stok barang **titipan klien**: hirarki Klien → PO → Item → Mutasi masuk/keluar, riwayat mutasi ber-filter, ekspor PDF |
| **Jatuh Tempo Klien** | Invoice klien: TOP dinamis (Cash/Net 30/60/90/Cicilan), tanggal jatuh tempo, cicilan bertahap, status lunas/belum lunas, laporan pemasukan & piutang + grafik omset bulanan, ekspor PDF *(khusus Superadmin)* |

Aturan bisnis penting:

- Stok **tidak boleh minus** — transaksi Keluar ditolak bila melebihi stok tersedia.
- Nominal stok dihitung dengan **rata-rata tertimbang (weighted average)** harga masuk.
- **Superadmin** bebas mengedit/menghapus mutasi apa pun.
  **Admin/PIC** hanya bisa mengubah mutasi miliknya sendiri **dan** di hari yang sama saat dibuat.
- Auto-logout setelah **60 menit** tidak aktif, dengan dialog peringatan di menit ke-58.
- Semua perubahan & penghapusan mutasi tercatat di **log audit**.

Aturan bisnis 2 tool klien:

- **Stok Klien** — stok item tidak boleh negatif; mutasi ditolak bila item berstatus
  *Selesai/Ditutup*; edit atau hapus mutasi otomatis merekonsiliasi kuantiti item;
  hapus klien/PO ikut menghapus item & mutasi di bawahnya (FK cascade).
- **Jatuh Tempo Klien** — invoice ber-TOP `Cicilan` otomatis berubah menjadi **Lunas**
  ketika akumulasi cicilan ≥ nominal total; mengganti nama opsi TOP ikut memperbarui
  seluruh invoice yang memakai opsi lama; opsi `Cicilan` terkunci (tidak bisa diubah/dihapus);
  tombol **Hapus Semua** baru aktif setelah backup PDF diunduh.
- Tabel 2 tool ini **terpisah penuh** (`klien_*`, `tempo_*`) dari tabel
  Stok SCA / HPP / PO Tracker, sehingga tidak ada risiko saling mengganggu.

---

## Role & akses

| Role | Akses |
| --- | --- |
| **Superadmin** | Semua modul, termasuk semua nominal rupiah dan kedua tool klien. Tanpa password tambahan |
| **Admin/PIC** | Dashboard, semua Mutasi, Laporan Stok, PO Tracker, **Stok Klien**. Nominal rupiah **disembunyikan** (kartu tampil "Terkunci"). **Tidak** punya akses Kalkulator HPP & Jatuh Tempo Klien |

Section terproteksi (**Laporan Detail**, **Log & User**, **Tutup Tahun**) bisa dibuka oleh
Admin/PIC dengan **password akses sementara**, berlaku selama sesi login saat itu
(dikirim ke API lewat header `X-Section-Password`).

> Saat login, **pilih role yang sesuai akun**. Akun superadmin yang login dengan role *Admin/PIC*
> akan ditolak.

---

## Arsitektur produksi

```
                 Cloudflare DNS (scaportal.cloud)
                          │
        ┌─────────────────┴──────────────────────────────────────────────┐
        │  VPS Biznet Gio — 2 vCPU · 4 GB RAM · 60 GB SSD · Ubuntu 22.04  │
        │                                                                 │
        │  Coolify (Docker + Traefik, SSL Let's Encrypt otomatis)         │
        │  ├── app  : Next.js 15 (image Dockerfile, port 3000)            │
        │  │         https://app.scaportal.cloud  (contoh)                │
        │  ├── db   : MariaDB 11 (resource Coolify, Private network)      │
        │  │         mysql://mariadb:***@<host-internal>:3306/default     │
        │  └── pma  : phpMyAdmin → https://db.scaportal.cloud             │
        └─────────────────────────────────────────────────────────────────┘
                          │
                          └──► Cloudflare R2 (bucket `sca-po-photos`, foto tahap PO)
```

| Komponen | Lokasi | Catatan |
| --- | --- | --- |
| Aplikasi Next.js | Container di VPS | Build multi-stage `Dockerfile` (standalone), ±150 MB RAM saat idle |
| MariaDB | Container di VPS yang sama | Data persisten di volume Docker Coolify; backup terjadwal dari menu Coolify → Backups |
| phpMyAdmin | Container di VPS | Kelola tabel lewat browser (`db.scaportal.cloud`) |
| Foto PO | Cloudflare R2 | Tidak membebani disk VPS |
| Reverse proxy & SSL | Traefik (bawaan Coolify) | Sertifikat otomatis per domain |

Estimasi pemakaian resource pada beban normal: RAM ±1,2 GB (Coolify ±500 MB, MariaDB ±300 MB, app ±150 MB,
phpMyAdmin ±50 MB) dari 4 GB; disk ±10 GB (OS + Docker image) dari 60 GB.

**Security headers** (diset di `next.config.js`, berlaku untuk semua response): `Strict-Transport-Security`
(1 tahun, includeSubDomains, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

---

## Stack

| Bagian | Teknologi |
| --- | --- |
| UI | React 19, Tailwind CSS, shadcn/ui, Recharts, next-themes, sonner |
| Routing halaman | react-router-dom sebagai SPA di dalam catch-all route `app/[[...slug]]` |
| API | Next.js Route Handlers (`app/api/**`), runtime Node.js |
| Database | **MariaDB / MySQL** via `mysql2` (pool koneksi, transaksi, FK cascade). Skema di `src/server/schema.js`, dibuat otomatis saat start |
| Object storage | **Cloudflare R2** (S3-compatible) untuk foto tahap PO |
| Auth | JWT `jose` (HS256, 12 jam) + cookie httpOnly, hash password `bcryptjs` |
| PDF | `pdf-lib` — tabel dengan header berulang & page-break, line/bar/komposisi chart. Murni JS, tanpa dependensi native |

---

## Struktur project

```
.
├── app/                              # Next.js App Router
│   ├── layout.js
│   ├── [[...slug]]/page.js           # shell SPA (ssr: false)
│   └── api/                          # seluruh endpoint REST
│       ├── health/
│       ├── auth/{login,logout,me,verify-temp-password}/
│       ├── [type]/mutations/[id]/    # type = paper | ink | other
│       ├── [type]/jenis/
│       ├── dashboard/
│       ├── reports/{stock,detail}/
│       ├── logs/{activity,audit}/
│       ├── users/[id]/toggle/
│       ├── settings/temp-password/
│       ├── year/close/
│       └── pdf/[kind]/
├── src/
│   ├── App.js                        # definisi route SPA
│   ├── views/                        # halaman (Login, Dashboard, dst.)
│   ├── components/                   # komponen + components/ui (shadcn)
│   ├── context/AuthContext.jsx
│   ├── lib/{api.js,format.js,utils.js}
│   └── server/                       # LAPISAN SERVER
│       ├── db.js                     # pool mysql2 + helper SQL (insertRow/updateRow/withTx)
│       ├── schema.js                 # DDL 19 tabel (CREATE TABLE IF NOT EXISTS)
│       ├── init.js                   # buat tabel & seed idempotent
│       ├── users.js / logs.js / settings.js / hpp.js / po/repo.js
│       ├── auth.js                   # JWT, bcrypt, guard role/section
│       ├── stock.js                  # perhitungan stok & harga
│       ├── mutations.js              # validasi + aturan edit/hapus
│       ├── reports.js                # dashboard, stok, detail
│       └── pdf/{core.js,builders.js}
├── deploy/dummy_data.sql             # dump SQL data awal/dummy (impor lewat phpMyAdmin)
├── deploy/phpmyadmin.compose.yml     # phpMyAdmin untuk db.scaportal.cloud
├── package.json                      # aplikasi Next.js (root repo)
├── next.config.js                    # standalone output + security headers
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── Dockerfile                        # image produksi (Next.js standalone) untuk Coolify
├── .dockerignore
├── .env.example
├── tests/test_core.sh                # smoke test API end-to-end (47 skenario)
├── backend/server.py                 # reverse proxy /api -> Next.js (khusus preview Emergent)
└── frontend/package.json             # shim preview Emergent (meneruskan ke root)
```

> **Catatan 1:** aplikasi Next.js berada di **root repo**, jadi Base Directory di Coolify
> dibiarkan `/` (default) dan Dockerfile Location `/Dockerfile`.
>
> **Catatan 2:** folder halaman sengaja bernama `src/views`, **bukan** `src/pages`,
> karena `src/pages` akan dianggap Pages Router oleh Next.js dan membuat build gagal.
>
> **Catatan 3:** `backend/` dan `frontend/package.json` hanya shim untuk preview Emergent.
> Tidak dipakai di produksi/Docker (sudah di-exclude lewat `.dockerignore`).

---

## Environment variables

Semua env dibaca saat **runtime** (bukan build). Di Coolify: **Application → Environment Variables**,
jangan centang *Build Variable*. Setelah menambah/mengubah env, wajib **Redeploy** (bukan hanya Restart).

Wajib:

| Key | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string MariaDB/MySQL: `mysql://user:pass@host:3306/db` — salin apa adanya dari Coolify → resource MariaDB → *MariaDB URL (internal)* |
| `JWT_SECRET` | Kunci tanda tangan JWT — buat dengan `openssl rand -hex 32` |

Opsional (punya nilai default, dipakai saat seed pertama):

| Key | Default |
| --- | --- |
| `SUPERADMIN_USERNAME` | `Jeffsca` |
| `SUPERADMIN_PASSWORD` | `jeff3131` — **wajib ganti di produksi** |
| `TEMP_ACCESS_PASSWORD` | `superadminsementara` |
| `OWNER_EMAIL` | *(kosong)* |
| `NEXT_PUBLIC_API_BASE` | `/api` (isi hanya bila API dipisah dari frontend) |

Cloudflare R2 (untuk foto PO — lihat [bagian R2](#cloudflare-r2)):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
Bila salah satu kosong, aplikasi tetap jalan; hanya upload foto PO yang menampilkan *R2 belum dikonfigurasi*.

Contoh lengkap ada di `.env.example`. **File `.env` tidak pernah di-commit.**

---

## Menjalankan di lokal

```bash
cp .env.example .env.local        # isi DATABASE_URL (MariaDB lokal), JWT_SECRET
yarn install
yarn dev                          # http://localhost:3000
```

Butuh MariaDB/MySQL lokal, mis.
`docker run -d -p 3306:3306 -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=sca_portal mariadb:11`
lalu `DATABASE_URL=mysql://root:root@127.0.0.1:3306/sca_portal`.
Tabel, superadmin & password akses **dibuat otomatis** saat request API pertama.

Perintah lain:

```bash
yarn build     # production build (dipakai Dockerfile)
yarn serve     # jalankan hasil build
```

---

## Deploy ke Coolify

### Prasyarat VPS (sekali saja, via SSH)

```bash
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8000/tcp && ufw enable
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Buka `http://<IP-VPS>:8000`, buat akun admin, lalu **Settings → Instance domain** (mis. `https://coolify.scaportal.cloud`)
dan tutup port 8000 setelah domain aktif. Hubungkan GitHub: **Sources → + Add → GitHub App** → install ke repo `Scaportaldev/Scaportal`.

### Database

1. **Project → + New Resource → Databases → MariaDB** → Create → **Start**.
2. Salin **MariaDB URL (internal)** (format `mysql://mariadb:<pass>@<host>:3306/default`).
   Biarkan resource **Private** (jangan expose port 3306 ke publik).
3. Nyalakan **Backups** terjadwal (tab Backups → mis. harian `0 3 * * *`).

### Aplikasi

1. **+ New Resource → GitHub App / Public Repository** → repo `Scaportaldev/Scaportal`, branch `main`.
2. Tab **General**:

   | Field | Nilai |
   | --- | --- |
   | Build Pack | **Dockerfile** |
   | Base Directory | `/` |
   | Dockerfile Location | `/Dockerfile` |
   | Ports Exposes | `3000` |
   | Domains | `https://app.scaportal.cloud` (DNS A record → IP VPS) |

3. Tab **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `SUPERADMIN_*`, `TEMP_ACCESS_PASSWORD`,
   `OWNER_EMAIL`, `R2_*` (lihat `.env.example`).
4. Tab **Healthcheck**: Enable → `GET /api/health`, Port `3000`, Interval `30`, Timeout `5`, Retries `5`, Start period `40`.
5. **Deploy**. Traefik menerbitkan SSL otomatis. Tabel & superadmin dibuat saat start.
6. Cek `https://app.scaportal.cloud/api/health` → `{"status":"ok"}` → login superadmin (pilih role **Superadmin**).

Setiap push/merge ke `main` memicu **auto-redeploy**. Redeploy manual: tombol **Redeploy** di halaman aplikasi.

### Checklist produksi

- [ ] `JWT_SECRET` acak dan **berbeda** dari yang dipakai saat development.
- [ ] `SUPERADMIN_PASSWORD` dan `TEMP_ACCESS_PASSWORD` bukan nilai default.
- [ ] Password MariaDB memakai yang digenerate Coolify; resource MariaDB tetap **Private**.
- [ ] Backup MariaDB terjadwal aktif (resource MariaDB → **Backups**), idealnya ke S3/R2.
- [ ] phpMyAdmin hanya lewat HTTPS; pertimbangkan Cloudflare Access / IP allowlist, atau **Stop** saat tidak dipakai.
- [ ] Token R2 dibatasi ke bucket `sca-po-photos` saja (Object Read & Write).
- [ ] Cloudflare SSL mode **Full (strict)** bila proxy (awan oranye) dinyalakan.

---

## Cloudflare R2

R2 dipakai **PO Tracker** untuk menyimpan foto bukti tahapan produksi. Upload dilakukan dari server
(API Next.js) → tidak butuh CORS. Foto diakses publik lewat `R2_PUBLIC_URL`.

1. **Aktifkan R2** — dash.cloudflare.com → **R2 Object Storage** → Get started (butuh metode pembayaran,
   gratis di bawah 10 GB / 1 juta operasi tulis per bulan, egress gratis).
2. **Buat bucket** — nama `sca-po-photos` (= `R2_BUCKET_NAME`), lokasi *Automatic* atau APAC.
3. **Akses publik** — bucket → **Settings → Public access**:
   - *Opsi A* — **R2.dev subdomain → Allow Access** → dapat `https://pub-xxxx.r2.dev`, atau
   - *Opsi B* — **Custom Domains → Connect Domain** (mis. `foto.scaportal.cloud`, domain harus di Cloudflare).

   Nilainya jadi `R2_PUBLIC_URL` (tanpa `/` di akhir).
4. **API token** — R2 → **Manage R2 API Tokens → Create API token**: Permissions **Object Read & Write**,
   *Apply to specific buckets only* → `sca-po-photos`, TTL Forever. Halaman hasil hanya tampil sekali — salin:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`
   - Endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` → bagian `<ACCOUNT_ID>` = `R2_ACCOUNT_ID`
5. Isi kelima env `R2_*` di Coolify → **Redeploy**.

---

## phpMyAdmin

1. Cloudflare DNS: A record `db` → IP VPS.
2. Coolify → **project yang sama dengan MariaDB** → **+ New Resource → Services → phpMyAdmin** → Create.
3. **Environment Variables** service:

   | Key | Value |
   | --- | --- |
   | `PMA_HOST` | host internal MariaDB (bagian antara `@` dan `:3306` pada *MariaDB URL (internal)*) |
   | `PMA_PORT` | `3306` |
   | `PMA_ABSOLUTE_URI` | `https://db.scaportal.cloud/` |
   | `UPLOAD_LIMIT` | `256M` (opsional, untuk import SQL besar) |

4. Tab **General → Domains** `https://db.scaportal.cloud` → Save → **Deploy**.
5. Login: user `mariadb`, password = *Normal user password* dari resource MariaDB. Database aplikasi = `default`.

Alternatif tanpa katalog: **+ New Resource → Docker Compose** → tempel isi
[`deploy/phpmyadmin.compose.yml`](./deploy/phpmyadmin.compose.yml).

> phpMyAdmin memberi akses penuh ke database. Batasi lewat Cloudflare Access / IP allowlist,
> atau **Stop** service ini setelah selesai dan nyalakan hanya saat dibutuhkan.

---

## Database MariaDB

Tabel dibuat otomatis saat aplikasi pertama kali menerima request (`src/server/init.js`, idempotent).
Superadmin di-seed dari `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.

| Modul | Tabel |
| --- | --- |
| Akun & sistem | `users`, `settings`, `activity_logs`, `audit_logs` |
| Stok SCA | `paper_mutations`, `ink_mutations`, `other_mutations` |
| Kalkulator HPP | `hpp_calculations` |
| PO Tracker | `pos` ⟵ `po_logs`, `po_schedules`, `po_files` (FK cascade) |
| Stok Klien | `klien_clients` ⟵ `klien_pos` ⟵ `klien_items` ⟵ `klien_mutations` (FK cascade) |
| Jatuh Tempo | `tempo_invoices` ⟵ `tempo_installments`, `tempo_top_options` |

### Impor data contoh / dummy

`deploy/dummy_data.sql` berisi 839 baris (users, mutasi kertas/tinta/lainnya, PO, klien, invoice tempo, log).

- **phpMyAdmin** → database `default` → tab **Import** → unggah `deploy/dummy_data.sql` → Import, **atau**
- Terminal container MariaDB di Coolify: `mariadb -u mariadb -p default < deploy/dummy_data.sql`

> Dump memakai `DROP TABLE IF EXISTS` + `CREATE TABLE`, jadi impor **menimpa** isi tabel yang ada.
> Jangan dijalankan di database produksi. Untuk membersihkan data dummy: drop database `default` → buat ulang →
> Redeploy app (tabel + superadmin dibuat otomatis).

---

## Backup & restore

- **Otomatis** — Coolify → resource MariaDB → **Backups** → jadwal (mis. `0 3 * * *`), simpan lokal atau ke S3/R2.
  Restore lewat **Import Backup** di tab yang sama.
- **Manual** (Terminal resource MariaDB):

  ```bash
  mariadb-dump -u mariadb -p --single-transaction --no-tablespaces default > backup-$(date +%F).sql
  mariadb -u mariadb -p default < backup-2026-01-01.sql
  ```

- **phpMyAdmin** — database `default` → **Export** (SQL) / **Import**.
- **Foto R2** — Cloudflare R2 → bucket → Objects, atau `rclone` dengan endpoint S3.

---

## Referensi API

Semua endpoint diawali `/api`. Autentikasi memakai cookie httpOnly
**atau** header `Authorization: Bearer <token>`.

| Method | Endpoint | Akses |
| --- | --- | --- |
| GET | `/health` | publik |
| POST | `/auth/login` | publik |
| POST | `/auth/logout` | login |
| GET | `/auth/me` | login |
| POST | `/auth/verify-temp-password` | login |
| GET · POST | `/{type}/mutations` | login |
| PUT · DELETE | `/{type}/mutations/{id}` | pemilik hari itu / superadmin |
| GET | `/{type}/jenis` | login |
| GET | `/dashboard` | login *(nominal hanya untuk superadmin)* |
| GET | `/reports/stock` | login |
| GET | `/reports/detail?start=&end=` | section |
| GET | `/logs/activity` · `/logs/audit` | section |
| GET · POST | `/users` | superadmin |
| DELETE | `/users/{id}` | superadmin |
| PATCH | `/users/{id}/toggle` | superadmin |
| POST | `/settings/temp-password` | superadmin |
| POST | `/year/close` | section |
| GET | `/pdf/{kind}` | login / section |

**Stok Klien** — akses: login (Superadmin + Admin/PIC)

| Method | Endpoint |
| --- | --- |
| GET · POST | `/klien/clients` |
| PUT · DELETE | `/klien/clients/{id}` *(delete = cascade PO + item + mutasi)* |
| GET · POST | `/klien/pos` *(GET filter `?klien_id=`)* |
| PUT · DELETE | `/klien/pos/{id}` |
| GET · POST | `/klien/items` *(GET filter `?po_id=`)* |
| PUT · DELETE | `/klien/items/{id}` |
| GET · POST | `/klien/mutations` *(GET filter `?klien_id=&po_id=&item_id=&jenis=&start=&end=`)* |
| PUT · DELETE | `/klien/mutations/{id}` *(stok item ikut direkonsiliasi)* |
| GET | `/klien/dashboard` |
| GET | `/klien/pdf?kind=stok\|riwayat` |

**Jatuh Tempo Klien** — akses: **superadmin saja**

| Method | Endpoint |
| --- | --- |
| GET · POST · DELETE | `/tempo/invoices` *(GET filter `?search=&status=&sort_by=&order=`, DELETE = hapus semua)* |
| GET · PUT · DELETE | `/tempo/invoices/{id}` |
| PATCH | `/tempo/invoices/{id}/status` |
| POST | `/tempo/invoices/{id}/installments` |
| DELETE | `/tempo/invoices/{id}/installments/{insId}` |
| GET · POST · PUT | `/tempo/top-options` |
| DELETE | `/tempo/top-options/{value}` *(`Cicilan` terkunci)* |
| GET | `/tempo/reports/summary` · `/tempo/reports/breakdown` *(filter `?start=&end=`)* |
| GET | `/tempo/reports/monthly?year=` |
| GET | `/tempo/pdf?kind=all\|detail\|report` |

`{type}` = `paper` · `ink` · `other`
`{kind}` = `paper-mutations` · `ink-mutations` · `other-mutations` · `stock-ringkas` · `detail` · `stock-nominal`

Keterangan akses: **login** = perlu token · **section** = superadmin, atau role lain
dengan header `X-Section-Password` yang benar · **superadmin** = khusus superadmin.

Error selalu dikembalikan sebagai `{ "detail": "pesan dalam Bahasa Indonesia" }`.

---

## Testing

```bash
bash tests/test_core.sh            # default: http://localhost:3000/api
B=https://app.scaportal.cloud/api bash tests/test_core.sh
```

47 skenario end-to-end: login & guard token, CRUD ketiga jenis mutasi, validasi
stok tidak cukup, retur beserta referensi, filter & pencarian, dashboard,
laporan stok & detail, log, CRUD user, proteksi section per role, 6 laporan PDF,
ubah password akses, dan tutup tahun.

Cek security headers setelah deploy:

```bash
curl -sI https://app.scaportal.cloud/ | grep -iE 'strict-transport|x-frame|x-content|referrer|permissions'
```

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Build gagal: `yarn install --frozen-lockfile` error | `yarn.lock` tidak sinkron dengan `package.json` | `yarn install` lokal, commit `yarn.lock` baru, push |
| Build gagal: *JavaScript heap out of memory* | RAM VPS < 2 GB | Tambah swap 2 GB atau upgrade VPS |
| Traefik: **`no available server`** | Tidak ada container sehat — deploy terakhir *rolling back* | **Deployments** → log; penyebab tersering `DATABASE_URL` salah/kosong |
| `[db] DATABASE_URL belum diset` + `ECONNREFUSED 127.0.0.1:3306` | Env `DATABASE_URL` tidak ada | Isi = *MariaDB URL (internal)* → **Redeploy** |
| `getaddrinfo ENOTFOUND <host>` | Host internal MariaDB tidak bisa di-resolve (beda project/network) | Taruh app & MariaDB di project yang sama, atau centang *Connect To Predefined Network* |
| `ER_ACCESS_DENIED_ERROR` / `Access denied for user 'mariadb'` | Password di `DATABASE_URL` aplikasi **berbeda** dengan password resource MariaDB saat ini (mis. password DB diganti tapi env app belum) | Salin ulang *MariaDB URL (internal)* apa adanya ke env aplikasi → **Redeploy** |
| `ER_BAD_DB_ERROR: Unknown database` | Nama DB di akhir URL salah (default `default`) | Perbaiki bagian setelah `:3306/` |
| Container *unhealthy* padahal app hidup | Healthcheck path/port salah | `/api/health`, port `3000`, start period ≥ 40 s |
| *404 page not found* dari Traefik | DNS belum ke VPS, atau Domains belum `https://...` | `nslookup domain` → IP VPS; perbaiki Domains → Redeploy |
| SSL tidak terbit | Port 80 tertutup, atau DNS masih Proxied saat penerbitan pertama | Buka 80/443; set DNS **DNS only** dulu → Restart |
| *Too many redirects* | Cloudflare SSL mode **Flexible** | Ubah ke **Full (strict)** |
| Login gagal padahal DB terhubung | Role yang dipilih tidak sesuai akun, atau `SUPERADMIN_*` diubah tanpa redeploy | Pilih role **Superadmin** untuk akun superadmin; samakan env → **Redeploy** |
| Upload foto PO: `R2 config: ... belum diset` | Env `R2_*` kosong | Lengkapi → Redeploy |
| Foto ter-upload tapi 403/404 | Public access bucket belum aktif / `R2_PUBLIC_URL` salah | Bucket → Settings → Public access; URL tanpa `/` di akhir |
| Upload foto `AccessDenied` | Token R2 tanpa izin Write / salah bucket | Buat token **Object Read & Write** untuk `sca-po-photos` |
| phpMyAdmin: `php_network_getaddresses` | `PMA_HOST` salah / beda network | Isi host internal MariaDB; pastikan satu project |

Log runtime: Coolify → aplikasi → **Logs**. Log build: **Deployments** → klik deployment.

---

## Catatan preview Emergent

Ingress preview Emergent mengarahkan semua request `/api/*` ke port **8001**,
sedangkan Next.js berjalan di port **3000**. Karena itu `backend/server.py`
hanya berisi reverse proxy tipis (`/api/*` → `localhost:3000/api/*`), dan
`frontend/package.json` hanya shim (`cd .. && yarn start`) supaya supervisor Emergent
tetap mem-boot Next.js di root.

> **Jangan jalankan `yarn build` saat dev server (`next dev`) masih hidup.**
> Build menimpa folder `.next` milik dev server dan menyebabkan error
> `Cannot find module './xxxx.js'`. Bila terjadi:
> `supervisorctl stop frontend && rm -rf .next && supervisorctl start frontend`.

Di produksi (Docker/Coolify) proxy ini **tidak dipakai** — Next.js melayani `/api/*` secara native.
