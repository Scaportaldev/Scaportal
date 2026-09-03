#!/usr/bin/env bash
# Smoke test end-to-end API Next.js (dijalankan via proxy port 8001).
set -u
B="http://localhost:8001/api"
PASS=0; FAIL=0
ok(){ echo "  PASS $1"; PASS=$((PASS+1)); }
ko(){ echo "  FAIL $1 -> $2"; FAIL=$((FAIL+1)); }

j(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

echo "== 1. health =="
curl -s $B/health | grep -q '"ok"' && ok health || ko health "no ok"

echo "== 2. login superadmin =="
# Kredensial dibaca dari environment (jangan hardcode di repo).
SU_USER="${SUPERADMIN_USERNAME:-admin}"
SU_PASS="${SUPERADMIN_PASSWORD:-}"
LOGIN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"$SU_USER\",\"password\":\"$SU_PASS\",\"role\":\"superadmin\"}")
TOKEN=$(echo "$LOGIN" | j '["token"]')
[ -n "$TOKEN" ] && ok "login superadmin" || ko "login superadmin" "$LOGIN"
AUTH="Authorization: Bearer $TOKEN"

echo "== 3. login salah ditolak =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"Jeffsca","password":"salah"}')
[ "$code" = "401" ] && ok "login salah 401" || ko "login salah" "$code"

echo "== 4. /auth/me =="
curl -s $B/auth/me -H "$AUTH" | grep -q superadmin && ok "auth/me" || ko "auth/me" "?"

echo "== 5. tanpa token 401 =="
code=$(curl -s -o /dev/null -w '%{http_code}' $B/dashboard)
[ "$code" = "401" ] && ok "dashboard tanpa token 401" || ko "dashboard tanpa token" "$code"

echo "== 6. mutasi kertas MASUK =="
Y=$(date +%Y)
P1=$(curl -s -X POST $B/paper/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-02-10\",\"kode\":\"TEST-K1\",\"jenis_kertas\":\"Ivory\",\"gramatur\":230,\"panjang\":79,\"lebar\":109,\"jenis_transaksi\":\"masuk\",\"jumlah\":100,\"supplier\":\"PT Kertas Jaya\",\"pic_name\":\"Jeff\",\"price_mode\":\"per_kg\",\"price_input\":15000,\"ppn_ada\":true,\"ppn_nominal\":250000}")
P1ID=$(echo "$P1" | j '["id"]')
HPR=$(echo "$P1" | j '["harga_per_rim"]')
[ -n "$P1ID" ] && ok "create paper masuk (harga/rim=$HPR)" || ko "create paper masuk" "$P1"
# 230*79*109*15000/20000 = 1485397.5
[ "$HPR" = "1485397.5" ] && ok "hitung harga per rim mode per_kg" || ko "harga per rim" "$HPR"

echo "== 7. mutasi kertas KELUAR (dalam stok) =="
P2=$(curl -s -X POST $B/paper/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-02-15\",\"kode\":\"TEST-K2\",\"jenis_kertas\":\"Ivory\",\"gramatur\":230,\"panjang\":79,\"lebar\":109,\"jenis_transaksi\":\"keluar\",\"jumlah\":40,\"supplier\":\"PT Kertas Jaya\",\"pic_name\":\"Jeff\"}")
P2ID=$(echo "$P2" | j '["id"]')
[ -n "$P2ID" ] && ok "create paper keluar" || ko "create paper keluar" "$P2"

echo "== 8. keluar melebihi stok harus ditolak =="
R=$(curl -s -X POST $B/paper/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-02-16\",\"jenis_kertas\":\"Ivory\",\"gramatur\":230,\"panjang\":79,\"lebar\":109,\"jenis_transaksi\":\"keluar\",\"jumlah\":999,\"pic_name\":\"Jeff\"}")
echo "$R" | grep -q "Stok tidak cukup" && ok "validasi stok kertas" || ko "validasi stok kertas" "$R"

echo "== 9. retur kertas ref ke keluar =="
P3=$(curl -s -X POST $B/paper/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-02-20\",\"kode\":\"TEST-K2\",\"jenis_kertas\":\"Ivory\",\"gramatur\":230,\"panjang\":79,\"lebar\":109,\"jenis_transaksi\":\"retur\",\"jumlah\":5,\"pic_name\":\"Jeff\",\"ref_mutation_id\":\"$P2ID\"}")
echo "$P3" | grep -q "$P2ID" && ok "create paper retur + ref" || ko "create paper retur" "$P3"

echo "== 10. mutasi tinta & lain =="
I1=$(curl -s -X POST $B/ink/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-03-01\",\"kode\":\"TEST-T1\",\"jenis_tinta\":\"Cyan\",\"jenis_transaksi\":\"masuk\",\"jumlah\":50,\"supplier\":\"Tinta Abadi\",\"pic_name\":\"Jeff\",\"harga_per_kg\":120000,\"ppn_ada\":true,\"ppn_nominal\":600000}")
echo "$I1" | grep -q '"id"' && ok "create ink masuk" || ko "create ink masuk" "$I1"
O1=$(curl -s -X POST $B/other/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-03-05\",\"kode\":\"TEST-L1\",\"nama_barang\":\"Lem Panas\",\"satuan\":\"box\",\"jenis_transaksi\":\"masuk\",\"jumlah\":10,\"supplier\":\"Chem Store\",\"pic_name\":\"Jeff\",\"harga_per_satuan\":75000}")
echo "$O1" | grep -q '"id"' && ok "create other masuk" || ko "create other masuk" "$O1"
IK=$(curl -s -X POST $B/ink/mutations -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-03-10\",\"jenis_tinta\":\"Cyan\",\"jenis_transaksi\":\"keluar\",\"jumlah\":900,\"pic_name\":\"Jeff\"}")
echo "$IK" | grep -q "Stok tidak cukup" && ok "validasi stok tinta" || ko "validasi stok tinta" "$IK"

echo "== 11. list + filter =="
N=$(curl -s "$B/paper/mutations?year=$Y" -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$N" -ge 3 ] && ok "list paper ($N baris)" || ko "list paper" "$N"
NF=$(curl -s "$B/paper/mutations?year=$Y&transaksi=keluar" -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$NF" = "1" ] && ok "filter transaksi" || ko "filter transaksi" "$NF"
NS=$(curl -s "$B/paper/mutations?year=$Y&search=jaya" -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$NS" -ge 2 ] && ok "search supplier" || ko "search supplier" "$NS"
curl -s $B/paper/jenis -H "$AUTH" | grep -q Ivory && ok "distinct jenis kertas" || ko "distinct jenis" "?"

echo "== 12. edit & hapus =="
E=$(curl -s -X PUT $B/paper/mutations/$P1ID -H "$AUTH" -H 'Content-Type: application/json' -d "{\"date\":\"$Y-02-10\",\"kode\":\"TEST-K1B\",\"jenis_kertas\":\"Ivory\",\"gramatur\":230,\"panjang\":79,\"lebar\":109,\"jenis_transaksi\":\"masuk\",\"jumlah\":120,\"supplier\":\"PT Kertas Jaya\",\"pic_name\":\"Jeff\",\"price_mode\":\"per_rim\",\"price_input\":1500000,\"ppn_ada\":true,\"ppn_nominal\":250000}")
echo "$E" | grep -q "TEST-K1B" && ok "edit paper" || ko "edit paper" "$E"

echo "== 13. dashboard =="
D=$(curl -s $B/dashboard -H "$AUTH")
echo "$D" | grep -q nominal_total && ok "dashboard nominal (superadmin)" || ko "dashboard nominal" "$D"
echo "$D" | python3 -c 'import sys,json;d=json.load(sys.stdin);assert len(d["trend"])==6;assert d["total_paper_stock"]>0;print("")' >/dev/null 2>&1 && ok "dashboard trend & stok" || ko "dashboard trend" "$(echo $D | head -c 200)"

echo "== 14. laporan stok & detail =="
S=$(curl -s $B/reports/stock -H "$AUTH")
echo "$S" | grep -q '"suppliers"' && ok "laporan stok + per supplier" || ko "laporan stok" "$(echo $S|head -c 200)"
DT=$(curl -s "$B/reports/detail?start=$Y-01-01&end=$Y-12-31" -H "$AUTH")
echo "$DT" | grep -q ppn_monthly && ok "laporan detail" || ko "laporan detail" "$(echo $DT|head -c 200)"
echo "$DT" | grep -q '"comparison"' && ok "perbandingan periode" || ko "perbandingan" "?"

echo "== 15. logs =="
curl -s $B/logs/activity -H "$AUTH" | grep -q login_time && ok "log aktivitas" || ko "log aktivitas" "?"
curl -s $B/logs/audit -H "$AUTH" | grep -q '"action"' && ok "log audit" || ko "log audit" "?"

echo "== 16. users CRUD + role admin =="
U=$(curl -s -X POST $B/users -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Admin Test","username":"admintest","password":"admin123","role":"admin"}')
NEWUID=$(echo "$U" | j '["id"]')
[ -n "$NEWUID" ] && ok "create user admin" || ko "create user" "$U"
ALOGIN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"admintest","password":"admin123"}')
ATOKEN=$(echo "$ALOGIN" | j '["token"]')
[ -n "$ATOKEN" ] && ok "login admin baru" || ko "login admin baru" "$ALOGIN"
AH="Authorization: Bearer $ATOKEN"

echo "== 17. proteksi section untuk admin =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/reports/detail" -H "$AH")
[ "$code" = "403" ] && ok "admin tanpa password -> 403" || ko "admin section" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/reports/detail" -H "$AH" -H 'X-Section-Password: superadminsementara')
[ "$code" = "200" ] && ok "admin + password akses -> 200" || ko "admin section pwd" "$code"
curl -s -X POST $B/auth/verify-temp-password -H "$AH" -H 'Content-Type: application/json' -d '{"password":"superadminsementara"}' | grep -q true && ok "verify temp password" || ko "verify temp" "?"
code=$(curl -s -o /dev/null -w '%{http_code}' $B/users -H "$AH")
[ "$code" = "403" ] && ok "admin tidak bisa akses /users" || ko "users role guard" "$code"
D2=$(curl -s $B/dashboard -H "$AH")
echo "$D2" | grep -q nominal_total && ko "nominal disembunyikan utk admin" "bocor" || ok "nominal disembunyikan utk admin"

echo "== 18. admin tidak bisa hapus mutasi orang lain =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $B/paper/mutations/$P2ID -H "$AH")
[ "$code" = "403" ] && ok "guard edit/hapus milik user lain" || ko "guard hapus" "$code"

echo "== 19. PDF =="
for k in paper-mutations ink-mutations other-mutations stock-ringkas detail stock-nominal; do
  f=/tmp/pdf-$k.pdf
  curl -s "$B/pdf/$k?start=$Y-01-01&end=$Y-12-31" -H "$AUTH" -o $f
  head -c4 $f | grep -q '%PDF' && ok "pdf $k ($(stat -c%s $f) bytes)" || ko "pdf $k" "$(head -c 120 $f)"
done

echo "== 20. toggle & hapus user =="
curl -s -X PATCH $B/users/$NEWUID/toggle -H "$AUTH" | grep -q '"active": false\|"active":false' && ok "nonaktifkan user" || ko "toggle user" "?"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"admintest","password":"admin123"}')
[ "$code" = "403" ] && ok "user nonaktif tidak bisa login" || ko "user nonaktif" "$code"
curl -s -X DELETE $B/users/$NEWUID -H "$AUTH" | grep -q success && ok "hapus user" || ko "hapus user" "?"

echo "== 21. ubah password akses sementara =="
curl -s -X POST $B/settings/temp-password -H "$AUTH" -H 'Content-Type: application/json' -d '{"new_password":"barusekali"}' | grep -q success && ok "ubah temp password" || ko "ubah temp password" "?"
curl -s -X POST $B/settings/temp-password -H "$AUTH" -H 'Content-Type: application/json' -d '{"new_password":"superadminsementara"}' >/dev/null && ok "restore temp password" || ko "restore temp password" "?"

echo "== 22. logout =="
curl -s -X POST $B/auth/logout -H "$AUTH" -H 'Content-Type: application/json' -d '{"type":"manual"}' | grep -q success && ok logout || ko logout "?"

echo "== 23. tutup tahun (hapus semua mutasi) =="
TC=$(curl -s -X POST $B/year/close -H "$AUTH")
echo "$TC" | grep -q paper_deleted && ok "tutup tahun" || ko "tutup tahun" "$TC"
LEFT=$(curl -s "$B/paper/mutations?year=$Y" -H "$AUTH" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$LEFT" = "0" ] && ok "data mutasi bersih setelah tutup tahun" || ko "tutup tahun sisa" "$LEFT"

echo
echo "==================== HASIL: $PASS PASS / $FAIL FAIL ===================="
[ "$FAIL" = "0" ]
