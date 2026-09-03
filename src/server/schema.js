/**
 * Skema relasional LAPORAN STOK SCA (MariaDB 10.6+ / MySQL 8).
 * Dijalankan idempotent (CREATE TABLE IF NOT EXISTS) saat aplikasi start.
 *
 * Konvensi:
 * - Primary key CHAR(36) UUID (sama seperti field `id` lama) agar URL/API tidak berubah.
 * - DATETIME(3) = waktu UTC (dikirim ke API sebagai ISO string), DATE = tanggal saja.
 * - Kolom JSON hanya untuk data yang memang berbentuk form bebas (stage_data PO,
 *   inputs/result kalkulator HPP, snapshot before/after audit log).
 */

const T = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

const MUTATION_BASE = `
  \`id\` CHAR(36) NOT NULL PRIMARY KEY,
  \`date\` DATE NOT NULL,
  \`year\` SMALLINT NOT NULL,
  \`kode\` VARCHAR(64) NOT NULL DEFAULT '',
  \`jenis_transaksi\` ENUM('masuk','keluar','retur') NOT NULL,
  \`jumlah\` DECIMAL(14,3) NOT NULL DEFAULT 0,
  \`supplier\` VARCHAR(191) NOT NULL DEFAULT '',
  \`pic_name\` VARCHAR(191) NOT NULL DEFAULT '',
  \`ppn_ada\` TINYINT(1) NOT NULL DEFAULT 0,
  \`ppn_nominal\` DECIMAL(16,2) NOT NULL DEFAULT 0,
  \`ref_mutation_id\` CHAR(36) NULL,
  \`created_by\` CHAR(36) NULL,
  \`created_by_name\` VARCHAR(191) NULL,
  \`created_at\` DATETIME(3) NOT NULL,
  \`updated_at\` DATETIME(3) NULL,`;

export const DDL = [
  // ---------------- Akun & sistem ----------------
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`name\` VARCHAR(191) NOT NULL,
    \`username\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL DEFAULT '',
    \`phone\` VARCHAR(64) NOT NULL DEFAULT '',
    \`note\` TEXT NULL,
    \`password_hash\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('superadmin','admin') NOT NULL,
    \`permissions\` JSON NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`password_changed_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    \`updated_at\` DATETIME(3) NULL,
    UNIQUE KEY \`uq_users_username\` (\`username\`)
  ) ${T}`,

  // Migrasi idempotent untuk database yang dibuat sebelum kolom `permissions` ada.
  // Hak akses per-user (JSON {stok, stok_detail, ...}); NULL = semua OFF (khusus non-superadmin).
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`permissions\` JSON NULL AFTER \`role\``,

  `CREATE TABLE IF NOT EXISTS \`settings\` (
    \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
    \`value\` TEXT NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`activity_logs\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`user_id\` CHAR(36) NULL,
    \`name\` VARCHAR(191) NULL,
    \`username\` VARCHAR(191) NULL,
    \`login_time\` DATETIME(3) NOT NULL,
    \`logout_time\` DATETIME(3) NULL,
    \`logout_type\` VARCHAR(64) NULL,
    KEY \`ix_activity_login\` (\`login_time\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`user_id\` CHAR(36) NULL,
    \`name\` VARCHAR(191) NULL,
    \`action\` VARCHAR(64) NOT NULL,
    \`mutation_type\` VARCHAR(32) NULL,
    \`mutation_id\` VARCHAR(64) NULL,
    \`before_data\` JSON NULL,
    \`after_data\` JSON NULL,
    \`timestamp\` DATETIME(3) NOT NULL,
    KEY \`ix_audit_ts\` (\`timestamp\`)
  ) ${T}`,

  // ---------------- Stok SCA: mutasi ----------------
  `CREATE TABLE IF NOT EXISTS \`paper_mutations\` (${MUTATION_BASE}
    \`jenis_kertas\` VARCHAR(191) NOT NULL,
    \`gramatur\` DECIMAL(10,2) NOT NULL DEFAULT 0,
    \`panjang\` DECIMAL(10,2) NOT NULL DEFAULT 0,
    \`lebar\` DECIMAL(10,2) NOT NULL DEFAULT 0,
    \`price_mode\` ENUM('per_rim','per_kg','total') NULL,
    \`price_input\` DECIMAL(16,2) NULL,
    \`harga_per_rim\` DECIMAL(16,2) NOT NULL DEFAULT 0,
    KEY \`ix_paper_year\` (\`year\`),
    KEY \`ix_paper_date\` (\`date\`),
    KEY \`ix_paper_jenis\` (\`jenis_kertas\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`ink_mutations\` (${MUTATION_BASE}
    \`jenis_tinta\` VARCHAR(191) NOT NULL,
    \`harga_per_kg\` DECIMAL(16,2) NOT NULL DEFAULT 0,
    KEY \`ix_ink_year\` (\`year\`),
    KEY \`ix_ink_date\` (\`date\`),
    KEY \`ix_ink_jenis\` (\`jenis_tinta\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`other_mutations\` (${MUTATION_BASE}
    \`nama_barang\` VARCHAR(191) NOT NULL,
    \`satuan\` VARCHAR(64) NOT NULL DEFAULT '',
    \`harga_per_satuan\` DECIMAL(16,2) NOT NULL DEFAULT 0,
    KEY \`ix_other_year\` (\`year\`),
    KEY \`ix_other_date\` (\`date\`),
    KEY \`ix_other_nama\` (\`nama_barang\`)
  ) ${T}`,

  // ---------------- Kalkulator HPP ----------------
  `CREATE TABLE IF NOT EXISTS \`hpp_calculations\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`name\` VARCHAR(191) NOT NULL,
    \`customer\` VARCHAR(191) NOT NULL DEFAULT '',
    \`notes\` TEXT NULL,
    \`inputs\` JSON NULL,
    \`result\` JSON NULL,
    \`owner_id\` CHAR(36) NULL,
    \`owner_name\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    KEY \`ix_hpp_updated\` (\`updated_at\`)
  ) ${T}`,

  // ---------------- PO Tracker ----------------
  `CREATE TABLE IF NOT EXISTS \`pos\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`po_number\` VARCHAR(191) NOT NULL,
    \`client_name\` VARCHAR(191) NOT NULL,
    \`item_type\` VARCHAR(191) NOT NULL DEFAULT '',
    \`material\` VARCHAR(191) NOT NULL DEFAULT '',
    \`paper_size\` VARCHAR(191) NOT NULL DEFAULT '',
    \`quantity\` VARCHAR(64) NOT NULL DEFAULT '',
    \`po_date\` DATE NULL,
    \`est_start\` DATE NULL,
    \`est_end\` DATE NULL,
    \`print_machine\` VARCHAR(191) NULL,
    \`enabled_stages\` JSON NOT NULL,
    \`stage_data\` JSON NOT NULL,
    \`notes\` TEXT NULL,
    \`created_by\` VARCHAR(191) NULL,
    \`created_by_username\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE KEY \`uq_pos_number\` (\`po_number\`),
    KEY \`ix_pos_created\` (\`created_at\`),
    KEY \`ix_pos_client\` (\`client_name\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`po_logs\` (
    \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`po_id\` CHAR(36) NOT NULL,
    \`timestamp\` DATETIME(3) NOT NULL,
    \`message\` TEXT NOT NULL,
    \`user_name\` VARCHAR(191) NULL,
    KEY \`ix_polog_po\` (\`po_id\`, \`timestamp\`),
    CONSTRAINT \`fk_polog_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`pos\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`po_schedules\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`po_id\` CHAR(36) NOT NULL,
    \`po_number\` VARCHAR(191) NOT NULL,
    \`client_name\` VARCHAR(191) NOT NULL,
    \`stage_number\` TINYINT NOT NULL,
    \`stage_name\` VARCHAR(191) NOT NULL DEFAULT '',
    \`date\` DATE NOT NULL,
    \`note\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    KEY \`ix_sched_date\` (\`date\`),
    KEY \`ix_sched_po\` (\`po_id\`),
    CONSTRAINT \`fk_sched_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`pos\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`po_files\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`po_id\` CHAR(36) NOT NULL,
    \`stage_number\` TINYINT NOT NULL,
    \`r2_key\` VARCHAR(512) NOT NULL,
    \`public_url\` TEXT NULL,
    \`original_filename\` VARCHAR(191) NOT NULL DEFAULT '',
    \`content_type\` VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
    \`size\` INT UNSIGNED NOT NULL DEFAULT 0,
    \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
    \`uploaded_by\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    \`deleted_at\` DATETIME(3) NULL,
    KEY \`ix_files_po\` (\`po_id\`, \`is_deleted\`),
    CONSTRAINT \`fk_files_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`pos\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  // ---------------- Stok Klien ----------------
  `CREATE TABLE IF NOT EXISTS \`klien_clients\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`nama\` VARCHAR(191) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    UNIQUE KEY \`uq_klien_nama\` (\`nama\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`klien_pos\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`klien_id\` CHAR(36) NOT NULL,
    \`no_po\` VARCHAR(191) NOT NULL,
    \`tanggal_po\` DATE NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    UNIQUE KEY \`uq_klienpo\` (\`klien_id\`, \`no_po\`),
    CONSTRAINT \`fk_klienpo_klien\` FOREIGN KEY (\`klien_id\`) REFERENCES \`klien_clients\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`klien_items\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`po_id\` CHAR(36) NOT NULL,
    \`jenis_item\` VARCHAR(191) NOT NULL,
    \`satuan\` VARCHAR(64) NOT NULL DEFAULT '',
    \`kuantiti\` DECIMAL(14,3) NOT NULL DEFAULT 0,
    \`keterangan\` TEXT NULL,
    \`status\` ENUM('aktif','selesai') NOT NULL DEFAULT 'aktif',
    \`created_at\` DATETIME(3) NOT NULL,
    KEY \`ix_klienitem_po\` (\`po_id\`),
    CONSTRAINT \`fk_klienitem_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`klien_pos\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`klien_mutations\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`item_id\` CHAR(36) NOT NULL,
    \`po_id\` CHAR(36) NOT NULL,
    \`klien_id\` CHAR(36) NULL,
    \`jenis\` ENUM('masuk','keluar') NOT NULL,
    \`jumlah\` DECIMAL(14,3) NOT NULL,
    \`tanggal\` DATETIME(3) NOT NULL,
    \`keterangan\` TEXT NULL,
    \`pic_name\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL,
    KEY \`ix_klienmut_item\` (\`item_id\`),
    KEY \`ix_klienmut_tanggal\` (\`tanggal\`),
    KEY \`ix_klienmut_klien\` (\`klien_id\`),
    KEY \`ix_klienmut_po\` (\`po_id\`),
    CONSTRAINT \`fk_klienmut_item\` FOREIGN KEY (\`item_id\`) REFERENCES \`klien_items\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  // ---------------- Jatuh Tempo Klien ----------------
  `CREATE TABLE IF NOT EXISTS \`tempo_invoices\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`client_name\` VARCHAR(191) NOT NULL,
    \`top\` VARCHAR(64) NOT NULL DEFAULT 'Cash',
    \`po_date\` DATE NULL,
    \`po_number\` VARCHAR(191) NULL,
    \`delivery_note_number\` VARCHAR(191) NULL,
    \`invoice_number\` VARCHAR(191) NULL,
    \`invoice_date\` DATE NULL,
    \`total_amount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
    \`due_date\` DATE NULL,
    \`status\` ENUM('lunas','belum_lunas') NOT NULL DEFAULT 'belum_lunas',
    \`created_at\` DATETIME(3) NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    KEY \`ix_tempo_due\` (\`due_date\`),
    KEY \`ix_tempo_status\` (\`status\`),
    KEY \`ix_tempo_client\` (\`client_name\`)
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`tempo_installments\` (
    \`id\` CHAR(36) NOT NULL PRIMARY KEY,
    \`invoice_id\` CHAR(36) NOT NULL,
    \`sequence\` INT NOT NULL DEFAULT 1,
    \`amount\` DECIMAL(18,2) NOT NULL DEFAULT 0,
    \`date\` DATE NULL,
    KEY \`ix_inst_invoice\` (\`invoice_id\`, \`sequence\`),
    CONSTRAINT \`fk_inst_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`tempo_invoices\`(\`id\`) ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS \`tempo_top_options\` (
    \`value\` VARCHAR(64) NOT NULL PRIMARY KEY,
    \`sort_order\` INT NOT NULL DEFAULT 0
  ) ${T}`,
];

export const TABLES = [
  "users", "settings", "activity_logs", "audit_logs",
  "paper_mutations", "ink_mutations", "other_mutations",
  "hpp_calculations",
  "pos", "po_logs", "po_schedules", "po_files",
  "klien_clients", "klien_pos", "klien_items", "klien_mutations",
  "tempo_invoices", "tempo_installments", "tempo_top_options",
];
