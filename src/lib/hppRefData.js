// Reference data mirrored from the Excel hidden sheets:
// "DB Kertas", "DB Ongkos Cetak", and "Validasi".

export const PAPER_DB = [
  { jenis: "Ivory", gramatur: "230 Gr", ukuran: "65 x 100 cm", hargaKg: 13600, pembagi: 20000, indeks: 0, minKg: 175 },
  { jenis: "Brown Kraft", gramatur: "250 gr", ukuran: "65 x 100 cm", hargaKg: 10000, pembagi: 20000, indeks: 0, minKg: 4000 },
  { jenis: "Ivory", gramatur: "250 Gr", ukuran: "70 x 100 cm", hargaKg: 2370, pembagi: 20000, indeks: 0, minKg: 4000 },
  { jenis: "Duplex Coat", gramatur: "400 Gr", ukuran: "70 x 100 cm", hargaKg: 2050, pembagi: 20000, indeks: 3.95, minKg: 4000 },
  { jenis: "Ivory", gramatur: "150 Gr", ukuran: "79 x 109 cm", hargaKg: 13700, pembagi: 20000, indeks: 0, minKg: 4000 },
  { jenis: "Duplex Coat", gramatur: "310 Gr", ukuran: "79 x 109 cm", hargaKg: 2173, pembagi: 20000, indeks: 3.3, minKg: 4000 },
  { jenis: "Art Paper", gramatur: "120 Gr", ukuran: "63 x 82 cm", hargaKg: 14000, pembagi: 20000, indeks: 0, minKg: 0 },
  { jenis: "Brown Kraft", gramatur: "350 Gr", ukuran: "79 x 109", hargaKg: 10000, pembagi: 20000, indeks: 0, minKg: 4000 },
  { jenis: "White Kraft", gramatur: "50 Gr", ukuran: "90 x 120", hargaKg: 37500, pembagi: 20000, indeks: 0, minKg: 4000 },
];

export const PAPER_METODE = {
  "ivory": 1, "Ivory": 1, "Art Paper": 1, "Brown Kraft": 1, "White Kraft": 1, "Duplex Coat": 2,
};

export const paperJenisList = () => [...new Set(PAPER_DB.map((r) => r.jenis))];
export const paperGramaturList = (jenis) =>
  [...new Set(PAPER_DB.filter((r) => r.jenis === jenis).map((r) => r.gramatur))];
export const paperUkuranList = (jenis, gramatur) =>
  [...new Set(PAPER_DB.filter((r) => r.jenis === jenis && r.gramatur === gramatur).map((r) => r.ukuran))];
export const findPaper = (jenis, gramatur, ukuran) =>
  PAPER_DB.find((r) => r.jenis === jenis && r.gramatur === gramatur && r.ukuran === ukuran) || null;

export const MACHINE_DB = [
  { percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 52 / 36,3 x 52 cm", ukuranMax: "35 x 50,5 cm ", gramaturMax: "350 gr", hargaOngkos: 300000, hargaSetelahMin: 25, minLembar: 2500 },
  { percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 58 / 44 X 58 cm ", ukuranMax: "42,9 x 56,5 cm", gramaturMax: "350 gr", hargaOngkos: 525000, hargaSetelahMin: 55, minLembar: 2500 },
  { percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 72 / 52 x 72 cm ", ukuranMax: "50,5 x 71 cm", gramaturMax: "400 gr", hargaOngkos: 600000, hargaSetelahMin: 55, minLembar: 2500 },
  { percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 82 / 56 x 82 cm", ukuranMax: "54,8 x 81 cm", gramaturMax: "400 gr", hargaOngkos: 800000, hargaSetelahMin: 50, minLembar: 3000 },
  { percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 94 / 64 x 94 cm", ukuranMax: "63 x 93 cm", gramaturMax: "400 gr", hargaOngkos: 1000000, hargaSetelahMin: 50, minLembar: 5000 },
  { percetakan: "PERCETAKAN  (ASING)", mesin: "SM - 102  / 72 x 102 cm", ukuranMax: "70,5 x 101 cm", gramaturMax: "500 gr", hargaOngkos: 1350000, hargaSetelahMin: 50, minLembar: 5000 },
  { percetakan: "PERCETAKAN HARVEST", mesin: "SM - 472 / 65 x 50 cm", ukuranMax: "65 x 50 cm", gramaturMax: "500 gr", hargaOngkos: 450000, hargaSetelahMin: 0, minLembar: 0 },
];
export const machineList = () => MACHINE_DB.map((m) => m.mesin);
export const findMachine = (mesin) => MACHINE_DB.find((m) => m.mesin === mesin) || null;

export const FINISHING_OPTIONS = [
  { name: "UV", harga: 0.07 },
  { name: "Vernish", harga: 0.035 },
  { name: "L.Glossy 12 Micron", harga: 0.035 },
  { name: "L.Glossy 20 Micron", harga: 0.035 },
  { name: "Laminating Doff", harga: 0.035 },
  { name: "HotPrint Gold", harga: 0.035 },
];
export const findFinishing = (name) => FINISHING_OPTIONS.find((f) => f.name === name) || null;

export const CTP_OPTIONS = [
  { name: "TOKO", biaya: 0 },
  { name: "RYOBI 48 / 500 k", biaya: 0 },
  { name: "O 52 / GTO 52 / RYOBI 52", biaya: 0 },
  { name: "LITHRONE", biaya: 0 },
  { name: "SM 52 / KOMORI 52", biaya: 0 },
  { name: "O 58 / RYOBI 560", biaya: 27000 },
  { name: "MO / SOLNA 125 / SAKURAI 66", biaya: 0 },
  { name: "KOMORI SPRINT / OLIVER 66", biaya: 0 },
  { name: "OLIVER 72", biaya: 0 },
  { name: "OLIVER 72 / SM72 LAMA", biaya: 0 },
  { name: "OLIVER 72 BARU / SORM", biaya: 0 },
  { name: "SM 74 / ROLAND FAVORITE", biaya: 0 },
  { name: "KOMORI EXCELL", biaya: 50000 },
  { name: "WEB 58 GOSS COMMUNITY", biaya: 0 },
  { name: "SORD / WEB HAMADA", biaya: 0 },
  { name: "ROLAND PARVA", biaya: 0 },
  { name: "SORS 77 / SM 102", biaya: 72500 },
];
export const findCTP = (name) => CTP_OPTIONS.find((c) => c.name === name) || null;

export const LAMINASI_OPTIONS = ["F Flute", "E Flute", "B Flute", "C Flute"];
export const LEM_OPTIONS = ["Lem Laminasi UVI", "Lem Laminasi Biasa", "Lem Flute", "Lem Bottom", "Lem Bottom Eflute"];
export const WARNA_OC_OPTIONS = ["1", "2", "3", "4", "Warna Khusus"];
