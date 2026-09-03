#!/usr/bin/env python3
"""
Comprehensive API test for NEW TOOLS: Stok Klien + Jatuh Tempo Klien
Also verifies 0 REGRESSION on existing tools (Laporan Stok SCA, PO Tracker, HPP Calculator)
"""
import requests
import sys
from datetime import datetime, timedelta
import json

class KlienTempoAPITester:
    def __init__(self, base_url="https://quick-setup-env.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.superadmin_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Store created IDs for testing
        self.klien_ids = []
        self.po_ids = []
        self.item_ids = []
        self.mutation_ids = []
        self.invoice_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        
        # Use provided token or default to superadmin token
        if token:
            req_headers['Authorization'] = f'Bearer {token}'
        elif self.superadmin_token:
            req_headers['Authorization'] = f'Bearer {self.superadmin_token}'
        
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, params=params, timeout=60)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, params=params, timeout=60)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, params=params, timeout=60)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, params=params, timeout=60)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, params=params, timeout=60)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ PASS - Status: {response.status_code}")
                try:
                    return True, response.json()
                except Exception:
                    return True, response.text
            else:
                print(f"❌ FAIL - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                return False, {}

        except Exception as e:
            print(f"❌ FAIL - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    # ==================== AUTH TESTS ====================
    
    def test_login_superadmin(self):
        """Test superadmin login"""
        success, response = self.run_test(
            "Login Superadmin (Jeffsca/jeff3131 + role=superadmin)",
            "POST",
            "auth/login",
            200,
            data={"username": "Jeffsca", "password": "jeff3131", "role": "superadmin"}
        )
        if success and 'token' in response:
            self.superadmin_token = response['token']
            print(f"   Superadmin token obtained: {self.superadmin_token[:20]}...")
            return True
        return False

    def test_login_admin_pic(self):
        """Test Admin/PIC login"""
        success, response = self.run_test(
            "Login Admin/PIC (kadalgurun546/kadalgurun546 + role=admin)",
            "POST",
            "auth/login",
            200,
            data={"username": "kadalgurun546", "password": "kadalgurun546", "role": "admin"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    # ==================== STOK KLIEN TESTS (SUPERADMIN) ====================
    
    def test_klien_dashboard_superadmin(self):
        """Test Klien Dashboard as Superadmin"""
        success, response = self.run_test(
            "GET /api/klien/dashboard (Superadmin)",
            "GET",
            "klien/dashboard",
            200
        )
        if success:
            print(f"   Total Klien: {response.get('summary', {}).get('total_klien')}")
            print(f"   Total PO Aktif: {response.get('summary', {}).get('total_po_aktif')}")
            print(f"   Total Item Aktif: {response.get('summary', {}).get('total_item_aktif')}")
        return success

    def test_klien_create_client(self):
        """Test creating client"""
        data = {
            "nama": f"Test Client {datetime.now().strftime('%H%M%S')}"
        }
        success, response = self.run_test(
            "POST /api/klien/clients (Create Client)",
            "POST",
            "klien/clients",
            201,
            data=data
        )
        if success and 'id' in response:
            self.klien_ids.append(response['id'])
            print(f"   Created Client ID: {response['id']}")
        return success

    def test_klien_create_duplicate_client(self):
        """Test creating duplicate client (should fail)"""
        if not self.klien_ids:
            print("   ⚠️  Skipping - no client created")
            return False
        
        # Try to create client with same name
        data = {
            "nama": f"Test Client {datetime.now().strftime('%H%M%S')}"
        }
        # First create one
        self.run_test("Create client for duplicate test", "POST", "klien/clients", 201, data=data)
        # Try to create duplicate
        success, response = self.run_test(
            "POST /api/klien/clients (Duplicate - should 400)",
            "POST",
            "klien/clients",
            400,
            data=data
        )
        return success

    def test_klien_list_clients(self):
        """Test listing clients"""
        success, response = self.run_test(
            "GET /api/klien/clients (List Clients)",
            "GET",
            "klien/clients",
            200
        )
        if success:
            print(f"   Total clients: {len(response)}")
        return success

    def test_klien_create_po(self):
        """Test creating PO"""
        if not self.klien_ids:
            print("   ⚠️  Skipping - no client created")
            return False
        
        data = {
            "klien_id": self.klien_ids[0],
            "no_po": f"PO-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "tanggal_po": datetime.now().strftime('%Y-%m-%d')
        }
        success, response = self.run_test(
            "POST /api/klien/pos (Create PO)",
            "POST",
            "klien/pos",
            201,
            data=data
        )
        if success and 'id' in response:
            self.po_ids.append(response['id'])
            print(f"   Created PO ID: {response['id']}")
        return success

    def test_klien_create_duplicate_po(self):
        """Test creating duplicate PO in same client (should fail)"""
        if not self.klien_ids or not self.po_ids:
            print("   ⚠️  Skipping - no client/PO created")
            return False
        
        # Get the PO we just created
        success1, po_data = self.run_test(
            "Get PO for duplicate test",
            "GET",
            "klien/pos",
            200
        )
        
        if not success1 or not po_data:
            return False
        
        # Find our test PO
        test_po = None
        for po in po_data:
            if po.get('id') == self.po_ids[0]:
                test_po = po
                break
        
        if not test_po:
            return False
        
        # Try to create duplicate PO with same no_po in same client
        data = {
            "klien_id": self.klien_ids[0],
            "no_po": test_po['no_po'],
            "tanggal_po": datetime.now().strftime('%Y-%m-%d')
        }
        success, response = self.run_test(
            "POST /api/klien/pos (Duplicate no_po - should 400)",
            "POST",
            "klien/pos",
            400,
            data=data
        )
        return success

    def test_klien_list_pos(self):
        """Test listing POs"""
        success, response = self.run_test(
            "GET /api/klien/pos (List POs)",
            "GET",
            "klien/pos",
            200
        )
        if success:
            print(f"   Total POs: {len(response)}")
        return success

    def test_klien_create_item(self):
        """Test creating item"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
        
        data = {
            "po_id": self.po_ids[0],
            "jenis_item": "Box Packaging Test",
            "satuan": "pcs",
            "kuantiti": 100,
            "status": "aktif"
        }
        success, response = self.run_test(
            "POST /api/klien/items (Create Item)",
            "POST",
            "klien/items",
            201,
            data=data
        )
        if success and 'id' in response:
            self.item_ids.append(response['id'])
            print(f"   Created Item ID: {response['id']}")
            print(f"   Initial Stock: {response.get('kuantiti')}")
        return success

    def test_klien_list_items(self):
        """Test listing items"""
        success, response = self.run_test(
            "GET /api/klien/items (List Items)",
            "GET",
            "klien/items",
            200
        )
        if success:
            print(f"   Total items: {len(response)}")
        return success

    def test_klien_mutation_masuk(self):
        """Test creating mutation MASUK"""
        if not self.item_ids:
            print("   ⚠️  Skipping - no item created")
            return False
        
        data = {
            "item_id": self.item_ids[0],
            "jenis": "masuk",
            "jumlah": 50,
            "tanggal": datetime.now().strftime('%Y-%m-%d'),
            "keterangan": "Test mutation masuk"
        }
        success, response = self.run_test(
            "POST /api/klien/mutations (Mutation MASUK)",
            "POST",
            "klien/mutations",
            201,
            data=data
        )
        if success and 'id' in response:
            self.mutation_ids.append(response['id'])
            print(f"   Created Mutation ID: {response['id']}")
            print(f"   New Stock: {response.get('stok_setelah')}")
        return success

    def test_klien_mutation_keluar(self):
        """Test creating mutation KELUAR"""
        if not self.item_ids:
            print("   ⚠️  Skipping - no item created")
            return False
        
        data = {
            "item_id": self.item_ids[0],
            "jenis": "keluar",
            "jumlah": 20,
            "tanggal": datetime.now().strftime('%Y-%m-%d'),
            "keterangan": "Test mutation keluar"
        }
        success, response = self.run_test(
            "POST /api/klien/mutations (Mutation KELUAR)",
            "POST",
            "klien/mutations",
            201,
            data=data
        )
        if success and 'id' in response:
            self.mutation_ids.append(response['id'])
            print(f"   Created Mutation ID: {response['id']}")
            print(f"   New Stock: {response.get('stok_setelah')}")
        return success

    def test_klien_mutation_keluar_exceed_stock(self):
        """Test mutation KELUAR exceeding stock (should fail)"""
        if not self.item_ids:
            print("   ⚠️  Skipping - no item created")
            return False
        
        data = {
            "item_id": self.item_ids[0],
            "jenis": "keluar",
            "jumlah": 999999,
            "tanggal": datetime.now().strftime('%Y-%m-%d'),
            "keterangan": "Test exceed stock"
        }
        success, response = self.run_test(
            "POST /api/klien/mutations (KELUAR exceed stock - should 400)",
            "POST",
            "klien/mutations",
            400,
            data=data
        )
        return success

    def test_klien_mutation_on_selesai_item(self):
        """Test mutation on 'selesai' item (should fail)"""
        if not self.item_ids:
            print("   ⚠️  Skipping - no item created")
            return False
        
        # First, mark item as selesai
        success1, _ = self.run_test(
            "PUT /api/klien/items (Mark as selesai)",
            "PUT",
            f"klien/items/{self.item_ids[0]}",
            200,
            data={
                "po_id": self.po_ids[0],
                "jenis_item": "Box Packaging Test",
                "satuan": "pcs",
                "kuantiti": 130,
                "status": "selesai"
            }
        )
        
        if not success1:
            return False
        
        # Try to create mutation on selesai item
        data = {
            "item_id": self.item_ids[0],
            "jenis": "masuk",
            "jumlah": 10,
            "tanggal": datetime.now().strftime('%Y-%m-%d'),
            "keterangan": "Test on selesai item"
        }
        success, response = self.run_test(
            "POST /api/klien/mutations (On selesai item - should 400)",
            "POST",
            "klien/mutations",
            400,
            data=data
        )
        
        # Restore item to aktif for further tests
        self.run_test(
            "PUT /api/klien/items (Restore to aktif)",
            "PUT",
            f"klien/items/{self.item_ids[0]}",
            200,
            data={
                "po_id": self.po_ids[0],
                "jenis_item": "Box Packaging Test",
                "satuan": "pcs",
                "kuantiti": 130,
                "status": "aktif"
            }
        )
        
        return success

    def test_klien_list_mutations(self):
        """Test listing mutations"""
        success, response = self.run_test(
            "GET /api/klien/mutations (List Mutations)",
            "GET",
            "klien/mutations",
            200
        )
        if success:
            print(f"   Total mutations: {len(response)}")
        return success

    def test_klien_edit_mutation(self):
        """Test editing mutation"""
        if not self.mutation_ids:
            print("   ⚠️  Skipping - no mutation created")
            return False
        
        data = {
            "item_id": self.item_ids[0],
            "jenis": "masuk",
            "jumlah": 60,
            "tanggal": datetime.now().strftime('%Y-%m-%d'),
            "keterangan": "Test mutation edited"
        }
        success, response = self.run_test(
            "PUT /api/klien/mutations/{id} (Edit Mutation)",
            "PUT",
            f"klien/mutations/{self.mutation_ids[0]}",
            200,
            data=data
        )
        return success

    def test_klien_delete_mutation(self):
        """Test deleting mutation (should adjust stock)"""
        if not self.mutation_ids or len(self.mutation_ids) < 2:
            print("   ⚠️  Skipping - need at least 2 mutations")
            return False
        
        success, response = self.run_test(
            "DELETE /api/klien/mutations/{id} (Delete Mutation)",
            "DELETE",
            f"klien/mutations/{self.mutation_ids[1]}",
            200
        )
        return success

    def test_klien_pdf_stok(self):
        """Test PDF export for stok"""
        success, response = self.run_test(
            "GET /api/klien/pdf?kind=stok (PDF Export Stok)",
            "GET",
            "klien/pdf",
            200,
            params={"kind": "stok"}
        )
        return success

    def test_klien_pdf_riwayat(self):
        """Test PDF export for riwayat"""
        success, response = self.run_test(
            "GET /api/klien/pdf?kind=riwayat (PDF Export Riwayat)",
            "GET",
            "klien/pdf",
            200,
            params={"kind": "riwayat"}
        )
        return success

    # ==================== STOK KLIEN TESTS (ADMIN/PIC) ====================
    
    def test_klien_dashboard_admin(self):
        """Test Klien Dashboard as Admin/PIC (should 200)"""
        success, response = self.run_test(
            "GET /api/klien/dashboard (Admin/PIC - should 200)",
            "GET",
            "klien/dashboard",
            200,
            token=self.admin_token
        )
        return success

    def test_klien_clients_admin(self):
        """Test Klien Clients as Admin/PIC (should 200)"""
        success, response = self.run_test(
            "GET /api/klien/clients (Admin/PIC - should 200)",
            "GET",
            "klien/clients",
            200,
            token=self.admin_token
        )
        return success

    # ==================== JATUH TEMPO TESTS (SUPERADMIN) ====================
    
    def test_tempo_get_top_options(self):
        """Test getting TOP options"""
        success, response = self.run_test(
            "GET /api/tempo/top-options (Get TOP Options)",
            "GET",
            "tempo/top-options",
            200
        )
        if success:
            print(f"   TOP Options: {response}")
        return success

    def test_tempo_create_invoice_cash(self):
        """Test creating invoice with Cash TOP"""
        data = {
            "client_name": f"Test Client Invoice {datetime.now().strftime('%H%M%S')}",
            "top": "Cash",
            "po_date": datetime.now().strftime('%Y-%m-%d'),
            "po_number": f"PO-INV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "invoice_number": f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "invoice_date": datetime.now().strftime('%Y-%m-%d'),
            "total_amount": 5000000,
            "due_date": (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
            "status": "belum_lunas"
        }
        success, response = self.run_test(
            "POST /api/tempo/invoices (Create Invoice Cash)",
            "POST",
            "tempo/invoices",
            201,
            data=data
        )
        if success and 'id' in response:
            self.invoice_ids.append(response['id'])
            print(f"   Created Invoice ID: {response['id']}")
        return success

    def test_tempo_create_invoice_cicilan(self):
        """Test creating invoice with Cicilan TOP"""
        data = {
            "client_name": f"Test Client Cicilan {datetime.now().strftime('%H%M%S')}",
            "top": "Cicilan",
            "po_date": datetime.now().strftime('%Y-%m-%d'),
            "po_number": f"PO-CIC-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "invoice_number": f"INV-CIC-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "invoice_date": datetime.now().strftime('%Y-%m-%d'),
            "total_amount": 10000000,
            "due_date": (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            "status": "belum_lunas",
            "installments": [
                {"amount": 5000000, "date": datetime.now().strftime('%Y-%m-%d')},
                {"amount": 5000000, "date": (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d')}
            ]
        }
        success, response = self.run_test(
            "POST /api/tempo/invoices (Create Invoice Cicilan - auto lunas)",
            "POST",
            "tempo/invoices",
            201,
            data=data
        )
        if success and 'id' in response:
            self.invoice_ids.append(response['id'])
            print(f"   Created Invoice ID: {response['id']}")
            print(f"   Status: {response.get('status')} (should be lunas)")
        return success

    def test_tempo_create_invoice_empty_client_name(self):
        """Test creating invoice with empty client_name (should fail)"""
        data = {
            "client_name": "",
            "top": "Cash",
            "total_amount": 1000000,
            "invoice_date": datetime.now().strftime('%Y-%m-%d')
        }
        success, response = self.run_test(
            "POST /api/tempo/invoices (Empty client_name - should 400)",
            "POST",
            "tempo/invoices",
            400,
            data=data
        )
        return success

    def test_tempo_list_invoices(self):
        """Test listing invoices"""
        success, response = self.run_test(
            "GET /api/tempo/invoices (List Invoices)",
            "GET",
            "tempo/invoices",
            200
        )
        if success:
            print(f"   Total invoices: {len(response)}")
        return success

    def test_tempo_get_invoice_by_id(self):
        """Test getting invoice by ID"""
        if not self.invoice_ids:
            print("   ⚠️  Skipping - no invoice created")
            return False
        
        success, response = self.run_test(
            "GET /api/tempo/invoices/{id} (Get Invoice by ID)",
            "GET",
            f"tempo/invoices/{self.invoice_ids[0]}",
            200
        )
        if success:
            print(f"   Client: {response.get('client_name')}")
            print(f"   Total: {response.get('total_amount')}")
            print(f"   Paid: {response.get('paid_amount')}")
            print(f"   Remaining: {response.get('remaining_amount')}")
        return success

    def test_tempo_update_invoice_status(self):
        """Test updating invoice status"""
        if not self.invoice_ids:
            print("   ⚠️  Skipping - no invoice created")
            return False
        
        success, response = self.run_test(
            "PATCH /api/tempo/invoices/{id}/status (Update Status to Lunas)",
            "PATCH",
            f"tempo/invoices/{self.invoice_ids[0]}/status",
            200,
            data={"status": "lunas"}
        )
        return success

    def test_tempo_add_installment(self):
        """Test adding installment to invoice"""
        if len(self.invoice_ids) < 2:
            print("   ⚠️  Skipping - need cicilan invoice")
            return False
        
        data = {
            "amount": 2000000,
            "date": datetime.now().strftime('%Y-%m-%d')
        }
        success, response = self.run_test(
            "POST /api/tempo/invoices/{id}/installments (Add Installment)",
            "POST",
            f"tempo/invoices/{self.invoice_ids[1]}/installments",
            200,
            data=data
        )
        return success

    def test_tempo_reports_summary(self):
        """Test reports summary"""
        success, response = self.run_test(
            "GET /api/tempo/reports/summary (Reports Summary)",
            "GET",
            "tempo/reports/summary",
            200
        )
        if success:
            print(f"   Pemasukan Bulan Ini: {response.get('pemasukan_bulan_ini')}")
            print(f"   Total Piutang: {response.get('total_piutang')}")
            print(f"   Count Lunas: {response.get('count_lunas')}")
            print(f"   Count Belum Lunas: {response.get('count_belum_lunas')}")
        return success

    def test_tempo_reports_breakdown(self):
        """Test reports breakdown"""
        success, response = self.run_test(
            "GET /api/tempo/reports/breakdown (Reports Breakdown)",
            "GET",
            "tempo/reports/breakdown",
            200
        )
        if success:
            print(f"   Piutang by client: {len(response.get('piutang_by_client', []))} entries")
            print(f"   Pemasukan by client: {len(response.get('pemasukan_by_client', []))} entries")
        return success

    def test_tempo_reports_monthly(self):
        """Test reports monthly"""
        success, response = self.run_test(
            "GET /api/tempo/reports/monthly (Reports Monthly)",
            "GET",
            "tempo/reports/monthly",
            200,
            params={"year": datetime.now().year}
        )
        if success:
            print(f"   Year: {response.get('year')}")
            print(f"   Data points: {len(response.get('data', []))}")
        return success

    def test_tempo_add_top_option(self):
        """Test adding TOP option"""
        data = {
            "value": f"Net 45 Test {datetime.now().strftime('%H%M%S')}"
        }
        success, response = self.run_test(
            "POST /api/tempo/top-options (Add TOP Option)",
            "POST",
            "tempo/top-options",
            200,
            data=data
        )
        return success

    def test_tempo_rename_top_option(self):
        """Test renaming TOP option"""
        # Get current options
        success1, options = self.run_test(
            "Get TOP options for rename test",
            "GET",
            "tempo/top-options",
            200
        )
        
        if not success1 or not options:
            return False
        
        # Find a non-Cicilan option to rename
        test_option = None
        for opt in options:
            if opt != "Cicilan" and "Test" in opt:
                test_option = opt
                break
        
        if not test_option:
            return False
        
        data = {
            "old_value": test_option,
            "new_value": f"{test_option} Renamed"
        }
        success, response = self.run_test(
            "PUT /api/tempo/top-options (Rename TOP Option)",
            "PUT",
            "tempo/top-options",
            200,
            data=data
        )
        return success

    def test_tempo_rename_cicilan_forbidden(self):
        """Test renaming 'Cicilan' option (should fail)"""
        data = {
            "old_value": "Cicilan",
            "new_value": "Cicilan Renamed"
        }
        success, response = self.run_test(
            "PUT /api/tempo/top-options (Rename Cicilan - should 400)",
            "PUT",
            "tempo/top-options",
            400,
            data=data
        )
        return success

    def test_tempo_delete_cicilan_forbidden(self):
        """Test deleting 'Cicilan' option (should fail)"""
        success, response = self.run_test(
            "DELETE /api/tempo/top-options/Cicilan (Delete Cicilan - should 400)",
            "DELETE",
            "tempo/top-options/Cicilan",
            400
        )
        return success

    def test_tempo_pdf_all(self):
        """Test PDF export all invoices"""
        success, response = self.run_test(
            "GET /api/tempo/pdf?kind=all (PDF Export All)",
            "GET",
            "tempo/pdf",
            200,
            params={"kind": "all"}
        )
        return success

    # ==================== JATUH TEMPO TESTS (ADMIN/PIC - SHOULD 403) ====================
    
    def test_tempo_invoices_admin_forbidden(self):
        """Test that Admin/PIC cannot access tempo invoices"""
        success, response = self.run_test(
            "GET /api/tempo/invoices (Admin/PIC - should 403)",
            "GET",
            "tempo/invoices",
            403,
            token=self.admin_token
        )
        return success

    def test_tempo_create_invoice_admin_forbidden(self):
        """Test that Admin/PIC cannot create tempo invoice"""
        data = {
            "client_name": "Test",
            "top": "Cash",
            "total_amount": 1000000,
            "invoice_date": datetime.now().strftime('%Y-%m-%d')
        }
        success, response = self.run_test(
            "POST /api/tempo/invoices (Admin/PIC - should 403)",
            "POST",
            "tempo/invoices",
            403,
            data=data,
            token=self.admin_token
        )
        return success

    def test_tempo_reports_admin_forbidden(self):
        """Test that Admin/PIC cannot access tempo reports"""
        success, response = self.run_test(
            "GET /api/tempo/reports/summary (Admin/PIC - should 403)",
            "GET",
            "tempo/reports/summary",
            403,
            token=self.admin_token
        )
        return success

    def test_tempo_top_options_admin_forbidden(self):
        """Test that Admin/PIC cannot access TOP options"""
        success, response = self.run_test(
            "GET /api/tempo/top-options (Admin/PIC - should 403)",
            "GET",
            "tempo/top-options",
            403,
            token=self.admin_token
        )
        return success

    # ==================== REGRESSION TESTS (EXISTING TOOLS) ====================
    
    def test_regression_dashboard(self):
        """Test existing dashboard (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/dashboard (Superadmin)",
            "GET",
            "dashboard",
            200
        )
        return success

    def test_regression_paper_mutations(self):
        """Test existing paper mutations (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/paper/mutations (Superadmin)",
            "GET",
            "paper/mutations",
            200,
            params={"year": datetime.now().year}
        )
        return success

    def test_regression_reports_stock(self):
        """Test existing stock report (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/reports/stock (Superadmin)",
            "GET",
            "reports/stock",
            200
        )
        return success

    def test_regression_po_dashboard(self):
        """Test existing PO dashboard (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/po/dashboard (Superadmin)",
            "GET",
            "po/dashboard",
            200
        )
        return success

    def test_regression_po_pos(self):
        """Test existing PO list (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/po/pos (Superadmin)",
            "GET",
            "po/pos",
            200
        )
        return success

    def test_regression_hpp_calculations(self):
        """Test existing HPP calculations (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/hpp/calculations (Superadmin)",
            "GET",
            "hpp/calculations",
            200
        )
        return success

    def test_regression_admin_hpp_forbidden(self):
        """Test that Admin/PIC still cannot access HPP (regression)"""
        success, response = self.run_test(
            "REGRESSION: GET /api/hpp/calculations (Admin/PIC - should 403)",
            "GET",
            "hpp/calculations",
            403,
            token=self.admin_token
        )
        return success

    # ==================== MAIN TEST RUNNER ====================
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("STOK KLIEN + JATUH TEMPO KLIEN - COMPREHENSIVE API TEST")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print("=" * 80)
        
        # 1. Authentication
        print("\n" + "=" * 80)
        print("SECTION 1: AUTHENTICATION")
        print("=" * 80)
        if not self.test_login_superadmin():
            print("❌ CRITICAL: Superadmin login failed. Stopping tests.")
            self.print_summary()
            return 1
        if not self.test_login_admin_pic():
            print("❌ CRITICAL: Admin/PIC login failed. Stopping tests.")
            self.print_summary()
            return 1
        
        # 2. Stok Klien - Superadmin
        print("\n" + "=" * 80)
        print("SECTION 2: STOK KLIEN (SUPERADMIN)")
        print("=" * 80)
        self.test_klien_dashboard_superadmin()
        self.test_klien_create_client()
        self.test_klien_create_duplicate_client()
        self.test_klien_list_clients()
        self.test_klien_create_po()
        self.test_klien_create_duplicate_po()
        self.test_klien_list_pos()
        self.test_klien_create_item()
        self.test_klien_list_items()
        self.test_klien_mutation_masuk()
        self.test_klien_mutation_keluar()
        self.test_klien_mutation_keluar_exceed_stock()
        self.test_klien_mutation_on_selesai_item()
        self.test_klien_list_mutations()
        self.test_klien_edit_mutation()
        self.test_klien_delete_mutation()
        self.test_klien_pdf_stok()
        self.test_klien_pdf_riwayat()
        
        # 3. Stok Klien - Admin/PIC
        print("\n" + "=" * 80)
        print("SECTION 3: STOK KLIEN (ADMIN/PIC - SHOULD 200)")
        print("=" * 80)
        self.test_klien_dashboard_admin()
        self.test_klien_clients_admin()
        
        # 4. Jatuh Tempo - Superadmin
        print("\n" + "=" * 80)
        print("SECTION 4: JATUH TEMPO KLIEN (SUPERADMIN)")
        print("=" * 80)
        self.test_tempo_get_top_options()
        self.test_tempo_create_invoice_cash()
        self.test_tempo_create_invoice_cicilan()
        self.test_tempo_create_invoice_empty_client_name()
        self.test_tempo_list_invoices()
        self.test_tempo_get_invoice_by_id()
        self.test_tempo_update_invoice_status()
        self.test_tempo_add_installment()
        self.test_tempo_reports_summary()
        self.test_tempo_reports_breakdown()
        self.test_tempo_reports_monthly()
        self.test_tempo_add_top_option()
        self.test_tempo_rename_top_option()
        self.test_tempo_rename_cicilan_forbidden()
        self.test_tempo_delete_cicilan_forbidden()
        self.test_tempo_pdf_all()
        
        # 5. Jatuh Tempo - Admin/PIC (SHOULD 403)
        print("\n" + "=" * 80)
        print("SECTION 5: JATUH TEMPO KLIEN (ADMIN/PIC - SHOULD 403)")
        print("=" * 80)
        self.test_tempo_invoices_admin_forbidden()
        self.test_tempo_create_invoice_admin_forbidden()
        self.test_tempo_reports_admin_forbidden()
        self.test_tempo_top_options_admin_forbidden()
        
        # 6. Regression Tests
        print("\n" + "=" * 80)
        print("SECTION 6: REGRESSION TESTS (EXISTING TOOLS)")
        print("=" * 80)
        self.test_regression_dashboard()
        self.test_regression_paper_mutations()
        self.test_regression_reports_stock()
        self.test_regression_po_dashboard()
        self.test_regression_po_pos()
        self.test_regression_hpp_calculations()
        self.test_regression_admin_hpp_forbidden()
        
        # Print summary
        return self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        if self.tests_run > 0:
            print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n" + "=" * 80)
            print("FAILED TESTS:")
            print("=" * 80)
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"\n{i}. {failure.get('test')}")
                if 'error' in failure:
                    print(f"   Error: {failure['error']}")
                else:
                    print(f"   Expected: {failure.get('expected')}")
                    print(f"   Actual: {failure.get('actual')}")
                    print(f"   Response: {failure.get('response')}")
        
        print("\n" + "=" * 80)
        
        # Determine if we should stop (>50% failure)
        if self.tests_run > 0:
            failure_rate = len(self.failed_tests) / self.tests_run
            if failure_rate > 0.5:
                print("⚠️  WARNING: More than 50% of tests failed!")
                print("⚠️  Major functionality is broken. Please fix backend issues first.")
                return 1
        
        return 0 if len(self.failed_tests) == 0 else 1

def main():
    tester = KlienTempoAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
