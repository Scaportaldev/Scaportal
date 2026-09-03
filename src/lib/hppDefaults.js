export const allEnabled = () => ({
  kertas: true, warna: true, ongkosCetak: true, design: true, ctp: true,
  finishing: true, laminasi: true, lem: true, pisauPlong: true, papanPlong: true,
  plong: true, ongkosPlong: true, other: true,
});

export const defaultState = () => ({
  kertas: {
    bahan: "Ivory", bahanCustom: "", gramatur: "230 Gr", ukuran: "65 x 100 cm",
    customHargaKg: "0", customPembagi: "20000", customIndeks: "0", customMetode: "1",
    qtyOrder: "2100", qtyPerPlano: "8", wes: "0.07",
  },
  warna: { harga: "100", qtyWarna: "1", qtyPerLembar: "8" },
  ongkosCetak: {
    bahan: "ivory", gramatur: "250 Gr", ukuranPlano: "90 x 120",
    ukuranLembarP: "72.1", ukuranLembarL: "30", qtyWarna: "4",
    qtyOrder: "12000", qtyPerLembar: "4",
    percetakan: "PERCETAKAN  (ASING)", mesin: "OLIVER 58 / 44 X 58 cm ",
    ukuranMax: "42,9 x 56,5 cm", gramaturMax: "350 gr",
    minLembar: "2500", hargaOngkos: "525000", hargaSetelahMin: "55", mesinCustom: "",
  },
  design: { nama: "", jasaDesign: "150000", qtyOrder: "2100" },
  ctp: { mesin: "KOMORI EXCELL", mesinCustom: "", ukuranP: "830", ukuranL: "645", biayaCTP: "50000", qtyWarna: "1", qtyOrder: "2100" },
  finishing: { jenis: "UV", ukuranP: "54", ukuranL: "61.7", hargaPerCm: "0.07", qtyPerLembar: "8" },
  laminasi: { jenis: "E Flute", ukuranP: "50", ukuranL: "70", hargaIndex: "3050", perPcs: "2", wes: "0.05" },
  lem: { jenis: "Lem Bottom", jenisCustom: "", spotP: "26.7", spotL: "1.5", biaya: "0", wes: "0.06" },
  pisauPapan: {
    pisauBiaya: "450", pisauUkuran: "38", pisauQtyLembar: "8", pisauQtyOrder: "2100",
    papanBiaya: "18", papanLembarP: "62", papanLembarL: "87", papanLebihan: "3", papanQtyOrder: "6000",
  },
  plong: { ukuranP: "66", ukuranL: "92", sistem: "Borongan", jenisLaminasi: "Laminasi Glossy PE", biayaLbr: "0", qtyPerLembar: "8" },
  ongkosPlong: {
    ukuranMesinP: "58", ukuranMesinL: "75", minLembarPlong: "2000", biayaMinimum: "250000", biayaSetelahMin: "80",
    ukuranLembarP: "55", ukuranLembarL: "73", qtyPerLembar: "10", qtyOrder: "50000",
  },
  other: {
    lokasi: "Surabaya", biayaTranspor: "80000", qtyOrderT: "2100",
    biayaPaking: "100000", qtyHari: "1000",
    biayaPotongRim: "5000", qtyLembarPlano: "1050", qtyOrderP: "2100",
    biayaKopekLbr: "5", qtyPcsLbr: "4",
    biayaRajangRim: "10000", qtyLembarRajang: "1050", qtyOrderR: "2100",
  },
  ukArea: { bahan: "Duplex Coat", planoP: "90", planoL: "120", cetakP: "69", cetakL: "58.5", kresP: "2", kresL: "1.4", anlegP: "1.4", sf: "0.5", arahSerat: "P" },
  total: { labaPct: "15", bungaPct: "1", ppnPct: "11" },
  enabled: allEnabled(),
});

export const emptyState = () => ({
  kertas: { bahan: "Ivory", bahanCustom: "", gramatur: "230 Gr", ukuran: "65 x 100 cm", customHargaKg: "", customPembagi: "", customIndeks: "", customMetode: "1", qtyOrder: "", qtyPerPlano: "", wes: "" },
  warna: { harga: "", qtyWarna: "", qtyPerLembar: "" },
  ongkosCetak: { bahan: "", gramatur: "", ukuranPlano: "", ukuranLembarP: "", ukuranLembarL: "", qtyWarna: "1", qtyOrder: "", qtyPerLembar: "", percetakan: "", mesin: "OLIVER 58 / 44 X 58 cm ", ukuranMax: "", gramaturMax: "", minLembar: "", hargaOngkos: "", hargaSetelahMin: "", mesinCustom: "" },
  design: { nama: "", jasaDesign: "", qtyOrder: "" },
  ctp: { mesin: "KOMORI EXCELL", mesinCustom: "", ukuranP: "", ukuranL: "", biayaCTP: "", qtyWarna: "", qtyOrder: "" },
  finishing: { jenis: "UV", ukuranP: "", ukuranL: "", hargaPerCm: "", qtyPerLembar: "" },
  laminasi: { jenis: "E Flute", ukuranP: "", ukuranL: "", hargaIndex: "", perPcs: "", wes: "" },
  lem: { jenis: "Lem Bottom", jenisCustom: "", spotP: "", spotL: "", biaya: "", wes: "" },
  pisauPapan: { pisauBiaya: "", pisauUkuran: "", pisauQtyLembar: "", pisauQtyOrder: "", papanBiaya: "", papanLembarP: "", papanLembarL: "", papanLebihan: "", papanQtyOrder: "" },
  plong: { ukuranP: "", ukuranL: "", sistem: "", jenisLaminasi: "", biayaLbr: "", qtyPerLembar: "" },
  ongkosPlong: { ukuranMesinP: "", ukuranMesinL: "", minLembarPlong: "", biayaMinimum: "", biayaSetelahMin: "", ukuranLembarP: "", ukuranLembarL: "", qtyPerLembar: "", qtyOrder: "" },
  other: { lokasi: "", biayaTranspor: "", qtyOrderT: "", biayaPaking: "", qtyHari: "", biayaPotongRim: "", qtyLembarPlano: "", qtyOrderP: "", biayaKopekLbr: "", qtyPcsLbr: "", biayaRajangRim: "", qtyLembarRajang: "", qtyOrderR: "" },
  ukArea: { bahan: "", planoP: "", planoL: "", cetakP: "", cetakL: "", kresP: "", kresL: "", anlegP: "", sf: "", arahSerat: "P" },
  total: { labaPct: "15", bungaPct: "1", ppnPct: "11" },
  enabled: allEnabled(),
});
