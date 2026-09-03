# LAPORAN STOK SCA

Sistem **mutasi & laporan stok** kertas, tinta, dan barang lain untuk percetakan SCA.
Full-stack **Next.js 15 (App Router)** + **MariaDB** (relasional, 19 tabel) + **Cloudflare R2**, siap deploy ke **VPS via Coolify** (Docker). Panduan lengkap: [`DEPLOY.md`](./DEPLOY.md).

Antarmuka sepenuhnya Bahasa Indonesia, responsive, mendukung mode terang & gelap.

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
| **PO Tracker** | Dashboard PO, daftar PO, tahapan/jadwal produksi, kalender jadwal |
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
  hapus klien/PO ikut menghapus item & mutasi di bawahnya (cascade).
- **Jatuh Tempo Klien** — invoice ber-TOP `Cicilan` otomatis berubah menjadi **Lunas**
  ketika akumulasi cicilan ≥ nominal total; mengganti nama opsi TOP ikut memperbarui
  seluruh invoice yang memakai opsi lama; opsi `Cicilan` terkunci (tidak bisa diubah/dihapus);
  tombol **Hapus Semua** baru aktif setelah backup PDF diunduh.
- Koleksi 2 tool ini **terpisah penuh** (`klien_*`, `tempo_invoices`) dari koleksi
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

---

## Stack

| Bagian | Teknologi |
| --- | --- |
| UI | React 19, Tailwind CSS, shadcn/ui, Recharts, next-themes, sonner |
| Routing halaman | react-router-dom sebagai SPA di dalam catch-all route `app/[[...slug]]` |
| API | Next.js Route Handlers (`app/api/**`), runtime Node.js |
| Database | **MariaDB / MySQL** via `mysql2` (pool koneksi, transaksi, FK cascade). Skema di `src/server/schema.js`, dibuat otomatis saat start |
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
│       ├── users.js / logs.js / settings.js / hpp.js / po/repo.js  # akses tabel per modul
│       ├── auth.js                   # JWT, bcrypt, guard role/section
│       ├── stock.js                  # perhitungan stok & harga
│       ├── mutations.js              # validasi + aturan edit/hapus
│       ├── reports.js                # dashboard, stok, detail
│       └── pdf/{core.js,builders.js}
├── scripts/migrate_mongo_to_mariadb.mjs  # migrasi data lama MongoDB -> MariaDB
├── scripts/seed.mjs                  # seed manual (opsional, versi Mongo lama)
├── package.json                      # aplikasi Next.js (root repo)
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── Dockerfile                        # image produksi (Next.js standalone) untuk Coolify
├── .dockerignore
├── .env.example
├── tests/test_core.sh                # smoke test API end-to-end (47 skenario)
├── backend/server.py                 # reverse proxy /api -> Next.js (khusus preview Emergent)
├── frontend/package.json             # shim preview Emergent (meneruskan ke root)
└── legacy_backend/                   # kode FastAPI lama, hanya referensi
```

> **Catatan 1:** aplikasi Next.js berada di **root repo**, jadi Base Directory di Coolify
> dibiarkan `/` (default) dan Dockerfile Location `/Dockerfile`.
>
> **Catatan 2:** folder halaman sengaja bernama `src/views`, **bukan** `src/pages`,
> karena `src/pages` akan dianggap Pages Router oleh Next.js dan membuat build gagal.
>
> **Catatan 3:** `frontend/package.json` hanya shim untuk preview Emergent (supervisor
> menjalankan `yarn start` di folder itu, lalu diteruskan ke root). Tidak dipakai di produksi/Docker.

---

## Environment variables

Wajib:

| Key | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string MariaDB/MySQL: `mysql://user:pass@host:3306/db` (Coolify: *MariaDB URL (internal)*) |
| `JWT_SECRET` | Kunci tanda tangan JWT — buat dengan `openssl rand -hex 32` |

Opsional (punya nilai default, dipakai saat seed pertama):

| Key | Default |
| --- | --- |
| `SUPERADMIN_USERNAME` | `Jeffsca` |
| `SUPERADMIN_PASSWORD` | `jeff3131` |
| `TEMP_ACCESS_PASSWORD` | `superadminsementara` |
| `OWNER_EMAIL` | *(kosong)* |
| `NEXT_PUBLIC_API_BASE` | `/api` (isi hanya bila API dipisah dari frontend) |

Contoh lengkap ada di `.env.example`. **File `.env` tidak pernah di-commit.**

---

## Menjalankan di lokal

```bash
cp .env.example .env.local        # isi MONGO_URL, DB_NAME, JWT_SECRET
yarn install
yarn dev                          # http://localhost:3000
```

Superadmin & password akses **dibuat otomatis** saat request API pertama.
Untuk seed manual (mis. menyiapkan Atlas dari lokal):

```bash
yarn seed
```

Perintah lain:

```bash
yarn build     # production build (dipakai Dockerfile)
yarn serve     # jalankan hasil build
```

---

## Deploy ke VPS (Coolify)

Ringkasan — langkah detail (Atlas, Cloudflare R2, domain, troubleshooting) ada di **[DEPLOY.md](./DEPLOY.md)**.

1. Push repo ke GitHub (private boleh; hubungkan GitHub App di Coolify).
2. Coolify → **Project** → **+ New Resource** → **Public/Private Repository** → pilih repo & branch `main`.
3. **Build Pack: Dockerfile** (Dockerfile ada di root). Port: `3000`.
4. **Environment Variables**: isi semua key di `.env.example`
   (`MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `SUPERADMIN_*`, `TEMP_ACCESS_PASSWORD`, `R2_*`).
5. MongoDB Atlas → **Network Access** → tambahkan **IP publik VPS** (atau `0.0.0.0/0`).
6. **Domains**: `https://stok.domain-anda.com` → DNS A record ke IP VPS → **Deploy**.
   SSL Let's Encrypt otomatis oleh Traefik bawaan Coolify.
7. Cek `https://stok.domain-anda.com/api/health` → `{"status":"ok"}` → login superadmin.

### Checklist produksi

- [ ] `JWT_SECRET` acak dan **berbeda** dari yang dipakai saat development.
- [ ] `SUPERADMIN_PASSWORD` bukan nilai default.
- [ ] Password user MongoDB Atlas kuat (bukan sama dengan username).
- [ ] `TEMP_ACCESS_PASSWORD` diganti, lalu bisa diubah lagi kapan pun dari
      menu **Log & User → Password Akses** tanpa perlu redeploy.
- [ ] Token R2 dibatasi ke bucket `sca-po-photos` saja (Object Read & Write).

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
bash tests/test_core.sh
```
47 skenario end-to-end: login & guard token, CRUD ketiga jenis mutasi, validasi
stok tidak cukup, retur beserta referensi, filter & pencarian, dashboard,
laporan stok & detail, log, CRUD user, proteksi section per role, 6 laporan PDF,
ubah password akses, dan tutup tahun.

Status terakhir: **47/47 PASS**, `yarn build` sukses, testing agent melaporkan
backend 44/44 dan seluruh alur UI utama berjalan normal tanpa bug kritis.

### Data contoh 2 tool klien

```bash
node scripts/seed_klien_tempo.mjs           # tambah data contoh (aman dijalankan berulang)
node scripts/seed_klien_tempo.mjs --wipe    # kosongkan dulu, lalu isi ulang
```

Menghasilkan 5 klien, 6 PO, 10 item, 20 mutasi, dan 8 invoice (mencakup skenario
lewat jatuh tempo, mendekati tempo, lunas, dan cicilan). Script ini **hanya** menyentuh
koleksi `klien_*` dan `tempo_invoices`.

---

## Catatan preview Emergent

Ingress preview Emergent mengarahkan semua request `/api/*` ke port **8001**,
sedangkan Next.js berjalan di port **3000**. Karena itu `backend/server.py`
hanya berisi reverse proxy tipis (`/api/*` → `localhost:3000/api/*`).

`frontend/package.json` hanya berisi shim (`cd .. && yarn start`) supaya supervisor
Emergent yang menjalankan `yarn start` di folder `frontend/` tetap mem-boot Next.js di root.

> **Jangan jalankan `yarn build` saat dev server (`next dev`) masih hidup.**
> Build produksi menimpa folder `.next` milik dev server dan menyebabkan error
> `Cannot find module './xxxx.js'` pada semua route. Bila terjadi:
> `supervisorctl stop frontend && rm -rf .next && supervisorctl start frontend`.

Di produksi (Docker/Coolify) proxy ini **tidak dipakai** — Next.js melayani `/api/*` secara native.


---

## Database MariaDB

Tabel dibuat otomatis saat aplikasi pertama kali menerima request (`src/server/init.js`).
Struktur bisa dilihat/diedit lewat **phpMyAdmin** (one-click service di Coolify).

| Modul | Tabel |
| --- | --- |
| Akun & sistem | `users`, `settings`, `activity_logs`, `audit_logs` |
| Stok SCA | `paper_mutations`, `ink_mutations`, `other_mutations` |
| Kalkulator HPP | `hpp_calculations` |
| PO Tracker | `pos` ⟵ `po_logs`, `po_schedules`, `po_files` (FK cascade) |
| Stok Klien | `klien_clients` ⟵ `klien_pos` ⟵ `klien_items` ⟵ `klien_mutations` (FK cascade) |
| Jatuh Tempo | `tempo_invoices` ⟵ `tempo_installments`, `tempo_top_options` |

### Migrasi data lama dari MongoDB

```bash
MONGO_URL="mongodb+srv://..." MONGO_DB_NAME="laporan_stok_sca" \
DATABASE_URL="mysql://user:pass@host:3306/db" \
node scripts/migrate_mongo_to_mariadb.mjs
```

Script mengosongkan tabel tujuan lalu menyalin seluruh koleksi (users, mutasi, PO, klien, invoice, log).
Tambahkan `--keep` bila tidak ingin mengosongkan tabel tujuan.
