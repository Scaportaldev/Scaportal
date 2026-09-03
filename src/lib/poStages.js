// Stage definitions untuk PO Tracker + status helpers.
export const STAGE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const STAGE_NAMES = {
  1: "Menunggu PO Kertas / Single Face",
  2: "Menunggu Pesanan CTCP",
  3: "Menunggu Pesanan Pisau Plong",
  4: "Proses Potong Kertas",
  5: "Proses Cetak",
  6: "Proses Finishing",
  7: "Proses Plong",
  8: "Proses Kopek",
  9: "Proses Lem",
  10: "Proses Packing",
  11: "Selesai Cetak & Pengiriman",
};

export const stageName = (n) => STAGE_NAMES[n] || `Tahap ${n}`;

export const FINISHING_OPTIONS = ["Laminasi Flute", "UV Vernish", "Laminasi Glossy", "Laminasi Doff", "Hot Print"];
export const GLUE_OPTIONS = ["Lem Samping", "Lem Bottom"];
export const MACHINES = ["Mesin Cetak A1", "Mesin Cetak A2"];

export const BUCKET_LABELS = {
  waiting_1: "Menunggu Tahap 1",
  waiting_2: "Menunggu Tahap 2",
  waiting_3: "Menunggu Tahap 3",
  stage_4: "Potong Kertas",
  stage_5: "Proses Cetak",
  stage_6: "Finishing",
  stage_7: "Proses Plong",
  stage_8: "Proses Kopek",
  stage_9: "Proses Lem",
  stage_10: "Packing",
  printing: "Finalisasi Cetak",
  print_done_not_shipped: "Selesai Cetak, Belum Kirim",
  delivery_failed: "Gagal Kirim",
  completed: "Selesai & Terkirim",
  no_stages: "Tanpa Tahapan",
  unknown: "-",
};

export const BUCKET_META = {
  waiting_1: { color: "#EAB308", label: BUCKET_LABELS.waiting_1 },
  waiting_2: { color: "#EAB308", label: BUCKET_LABELS.waiting_2 },
  waiting_3: { color: "#EAB308", label: BUCKET_LABELS.waiting_3 },
  stage_4: { color: "#3B82F6", label: BUCKET_LABELS.stage_4 },
  stage_5: { color: "#3B82F6", label: BUCKET_LABELS.stage_5 },
  stage_6: { color: "#3B82F6", label: BUCKET_LABELS.stage_6 },
  stage_7: { color: "#3B82F6", label: BUCKET_LABELS.stage_7 },
  stage_8: { color: "#3B82F6", label: BUCKET_LABELS.stage_8 },
  stage_9: { color: "#3B82F6", label: BUCKET_LABELS.stage_9 },
  stage_10: { color: "#3B82F6", label: BUCKET_LABELS.stage_10 },
  printing: { color: "#8B5CF6", label: BUCKET_LABELS.printing },
  print_done_not_shipped: { color: "#0EA5E9", label: BUCKET_LABELS.print_done_not_shipped },
  delivery_failed: { color: "#EF4444", label: BUCKET_LABELS.delivery_failed },
  completed: { color: "#10B981", label: BUCKET_LABELS.completed },
  no_stages: { color: "#94A3B8", label: BUCKET_LABELS.no_stages },
};
