#!/usr/bin/env python3
"""
Comprehensive API test for LAPORAN STOK SCA (Next.js full-stack)
Tests all endpoints via public URL
"""
import requests
import sys
from datetime import datetime, timedelta
import json

class StokSCAAPITester:
    def __init__(self, base_url="https://live-preview-stock.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.year = datetime.now().year
        
        # Store created IDs for cleanup
        self.paper_mutation_ids = []
        self.ink_mutation_ids = []
        self.other_mutation_ids = []
        self.user_ids = []
        self.po_ids = []
        self.hpp_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, params=params, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, params=params, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, params=params, timeout=30)

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
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ FAIL - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success and response.get('ok') == True

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
            self.token = response['token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login_invalid(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Login Invalid Credentials (should fail)",
            "POST",
            "auth/login",
            401,
            data={"username": "Jeffsca", "password": "wrongpassword", "role": "superadmin"}
        )
        return success

    def test_login_role_mismatch_superadmin_as_admin(self):
        """Test superadmin choosing admin role (should fail)"""
        success, response = self.run_test(
            "Login Role Mismatch: Superadmin as Admin (should 401)",
            "POST",
            "auth/login",
            401,
            data={"username": "Jeffsca", "password": "jeff3131", "role": "admin"}
        )
        return success

    def test_login_role_mismatch_admin_as_superadmin(self):
        """Test admin choosing superadmin role (should fail)"""
        success, response = self.run_test(
            "Login Role Mismatch: Admin as Superadmin (should 401)",
            "POST",
            "auth/login",
            401,
            data={"username": "adminpic", "password": "admin1234", "role": "superadmin"}
        )
        return success

    def test_login_missing_role(self):
        """Test login without role field (should fail)"""
        success, response = self.run_test(
            "Login Missing Role (should 400)",
            "POST",
            "auth/login",
            400,
            data={"username": "Jeffsca", "password": "jeff3131"}
        )
        return success

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        success, response = self.run_test(
            "Get Current User (/auth/me)",
            "GET",
            "auth/me",
            200
        )
        if success:
            print(f"   User: {response.get('username')} - Role: {response.get('role')}")
        return success

    def test_auth_guard_no_token(self):
        """Test that endpoints require authentication"""
        old_token = self.token
        self.token = None
        success, _ = self.run_test(
            "Dashboard without token (should 401)",
            "GET",
            "dashboard",
            401
        )
        self.token = old_token
        return success

    def test_dashboard(self):
        """Test dashboard endpoint"""
        success, response = self.run_test(
            "Dashboard",
            "GET",
            "dashboard",
            200
        )
        if success:
            print(f"   Total Paper Stock: {response.get('total_paper_stock')}")
            print(f"   Total Ink Stock: {response.get('total_ink_stock')}")
            print(f"   Mutations Today: {response.get('mutations_today')}")
            print(f"   Nominal Total: {response.get('nominal_total')}")
            print(f"   Trend data points: {len(response.get('trend', []))}")
            print(f"   Recent mutations: {len(response.get('recent_mutations', []))}")
        return success

    def test_paper_mutation_masuk(self):
        """Test creating paper mutation MASUK"""
        data = {
            "date": f"{self.year}-06-15",
            "kode": f"TEST-PAPER-{datetime.now().strftime('%H%M%S')}",
            "jenis_kertas": "Ivory",
            "gramatur": 230,
            "panjang": 79,
            "lebar": 109,
            "jenis_transaksi": "masuk",
            "jumlah": 100,
            "supplier": "PT Kertas Test",
            "pic_name": "Jeff",
            "price_mode": "per_kg",
            "price_input": 15000,
            "ppn_ada": True,
            "ppn_nominal": 250000
        }
        success, response = self.run_test(
            "Create Paper Mutation MASUK",
            "POST",
            "paper/mutations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.paper_mutation_ids.append(response['id'])
            print(f"   Created ID: {response['id']}")
            print(f"   Harga per Rim: {response.get('harga_per_rim')}")
        return success

    def test_paper_mutation_keluar(self):
        """Test creating paper mutation KELUAR"""
        data = {
            "date": f"{self.year}-06-16",
            "kode": f"TEST-KELUAR-{datetime.now().strftime('%H%M%S')}",
            "jenis_kertas": "Ivory",
            "gramatur": 230,
            "panjang": 79,
            "lebar": 109,
            "jenis_transaksi": "keluar",
            "jumlah": 20,
            "supplier": "PT Kertas Test",
            "pic_name": "Jeff"
        }
        success, response = self.run_test(
            "Create Paper Mutation KELUAR",
            "POST",
            "paper/mutations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.paper_mutation_ids.append(response['id'])
            print(f"   Created ID: {response['id']}")
        return success

    def test_paper_mutation_keluar_exceed_stock(self):
        """Test creating paper mutation KELUAR that exceeds stock"""
        data = {
            "date": f"{self.year}-06-17",
            "jenis_kertas": "Ivory",
            "gramatur": 230,
            "panjang": 79,
            "lebar": 109,
            "jenis_transaksi": "keluar",
            "jumlah": 999999,
            "pic_name": "Jeff"
        }
        success, response = self.run_test(
            "Create Paper Mutation KELUAR (exceed stock - should fail)",
            "POST",
            "paper/mutations",
            400,
            data=data
        )
        return success

    def test_paper_mutation_retur(self):
        """Test creating paper mutation RETUR"""
        if len(self.paper_mutation_ids) < 2:
            print("   ⚠️  Skipping - need keluar mutation ID")
            return False
            
        ref_id = self.paper_mutation_ids[1]  # Use the keluar mutation
        data = {
            "date": f"{self.year}-06-18",
            "kode": f"TEST-RETUR-{datetime.now().strftime('%H%M%S')}",
            "jenis_kertas": "Ivory",
            "gramatur": 230,
            "panjang": 79,
            "lebar": 109,
            "jenis_transaksi": "retur",
            "jumlah": 5,
            "supplier": "PT Kertas Test",
            "pic_name": "Jeff",
            "ref_mutation_id": ref_id
        }
        success, response = self.run_test(
            "Create Paper Mutation RETUR",
            "POST",
            "paper/mutations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.paper_mutation_ids.append(response['id'])
            print(f"   Created ID: {response['id']}")
            print(f"   Ref Mutation ID: {response.get('ref_mutation_id')}")
        return success

    def test_paper_mutation_list(self):
        """Test listing paper mutations"""
        success, response = self.run_test(
            "List Paper Mutations",
            "GET",
            "paper/mutations",
            200,
            params={"year": self.year}
        )
        if success:
            print(f"   Total mutations: {len(response)}")
        return success

    def test_paper_mutation_filter(self):
        """Test filtering paper mutations"""
        success, response = self.run_test(
            "Filter Paper Mutations (transaksi=masuk)",
            "GET",
            "paper/mutations",
            200,
            params={"year": self.year, "transaksi": "masuk"}
        )
        if success:
            print(f"   Filtered mutations: {len(response)}")
        return success

    def test_paper_mutation_search(self):
        """Test searching paper mutations"""
        success, response = self.run_test(
            "Search Paper Mutations (supplier)",
            "GET",
            "paper/mutations",
            200,
            params={"year": self.year, "search": "Test"}
        )
        if success:
            print(f"   Search results: {len(response)}")
        return success

    def test_paper_jenis(self):
        """Test getting distinct paper types"""
        success, response = self.run_test(
            "Get Paper Jenis (distinct)",
            "GET",
            "paper/jenis",
            200
        )
        if success:
            print(f"   Paper types: {response}")
        return success

    def test_paper_mutation_edit(self):
        """Test editing paper mutation"""
        if not self.paper_mutation_ids:
            print("   ⚠️  Skipping - no mutation to edit")
            return False
            
        mutation_id = self.paper_mutation_ids[0]
        data = {
            "date": f"{self.year}-06-15",
            "kode": f"TEST-EDITED-{datetime.now().strftime('%H%M%S')}",
            "jenis_kertas": "Ivory",
            "gramatur": 230,
            "panjang": 79,
            "lebar": 109,
            "jenis_transaksi": "masuk",
            "jumlah": 150,
            "supplier": "PT Kertas Test EDITED",
            "pic_name": "Jeff",
            "price_mode": "per_rim",
            "price_input": 1500000,
            "ppn_ada": True,
            "ppn_nominal": 300000
        }
        success, response = self.run_test(
            "Edit Paper Mutation",
            "PUT",
            f"paper/mutations/{mutation_id}",
            200,
            data=data
        )
        return success

    def test_ink_mutation_masuk(self):
        """Test creating ink mutation MASUK"""
        data = {
            "date": f"{self.year}-06-15",
            "kode": f"TEST-INK-{datetime.now().strftime('%H%M%S')}",
            "jenis_tinta": "Cyan",
            "jenis_transaksi": "masuk",
            "jumlah": 50,
            "supplier": "PT Tinta Test",
            "pic_name": "Jeff",
            "harga_per_kg": 120000,
            "ppn_ada": True,
            "ppn_nominal": 600000
        }
        success, response = self.run_test(
            "Create Ink Mutation MASUK",
            "POST",
            "ink/mutations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.ink_mutation_ids.append(response['id'])
            print(f"   Created ID: {response['id']}")
        return success

    def test_ink_mutation_keluar_exceed(self):
        """Test ink mutation KELUAR exceeding stock"""
        data = {
            "date": f"{self.year}-06-16",
            "jenis_tinta": "Cyan",
            "jenis_transaksi": "keluar",
            "jumlah": 999999,
            "pic_name": "Jeff"
        }
        success, response = self.run_test(
            "Create Ink Mutation KELUAR (exceed stock - should fail)",
            "POST",
            "ink/mutations",
            400,
            data=data
        )
        return success

    def test_ink_mutation_list(self):
        """Test listing ink mutations"""
        success, response = self.run_test(
            "List Ink Mutations",
            "GET",
            "ink/mutations",
            200,
            params={"year": self.year}
        )
        if success:
            print(f"   Total mutations: {len(response)}")
        return success

    def test_other_mutation_masuk(self):
        """Test creating other mutation MASUK"""
        data = {
            "date": f"{self.year}-06-15",
            "kode": f"TEST-OTHER-{datetime.now().strftime('%H%M%S')}",
            "nama_barang": "Lem Panas Test",
            "satuan": "box",
            "jenis_transaksi": "masuk",
            "jumlah": 10,
            "supplier": "PT Lain Test",
            "pic_name": "Jeff",
            "harga_per_satuan": 75000
        }
        success, response = self.run_test(
            "Create Other Mutation MASUK",
            "POST",
            "other/mutations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.other_mutation_ids.append(response['id'])
            print(f"   Created ID: {response['id']}")
        return success

    def test_other_mutation_list(self):
        """Test listing other mutations"""
        success, response = self.run_test(
            "List Other Mutations",
            "GET",
            "other/mutations",
            200,
            params={"year": self.year}
        )
        if success:
            print(f"   Total mutations: {len(response)}")
        return success

    def test_reports_stock(self):
        """Test stock report"""
        success, response = self.run_test(
            "Stock Report",
            "GET",
            "reports/stock",
            200
        )
        if success:
            print(f"   Paper items: {len(response.get('paper', []))}")
            print(f"   Ink items: {len(response.get('ink', []))}")
            print(f"   Other items: {len(response.get('other', []))}")
        return success

    def test_reports_detail(self):
        """Test detail report"""
        success, response = self.run_test(
            "Detail Report",
            "GET",
            "reports/detail",
            200,
            params={
                "start": f"{self.year}-01-01",
                "end": f"{self.year}-12-31"
            }
        )
        if success:
            print(f"   Total Nominal: {response.get('total_nominal')}")
            print(f"   Has comparison: {'comparison' in response}")
            print(f"   Has composition: {'composition' in response}")
            print(f"   PPN monthly entries: {len(response.get('ppn_monthly', []))}")
        return success

    def test_logs_activity(self):
        """Test activity logs"""
        success, response = self.run_test(
            "Activity Logs",
            "GET",
            "logs/activity",
            200
        )
        if success:
            print(f"   Activity log entries: {len(response)}")
        return success

    def test_logs_audit(self):
        """Test audit logs"""
        success, response = self.run_test(
            "Audit Logs",
            "GET",
            "logs/audit",
            200
        )
        if success:
            print(f"   Audit log entries: {len(response)}")
        return success

    def test_create_admin_user(self):
        """Test creating admin user"""
        data = {
            "name": "Admin Test",
            "username": f"admintest{datetime.now().strftime('%H%M%S')}",
            "password": "admin123",
            "role": "admin"
        }
        success, response = self.run_test(
            "Create Admin User",
            "POST",
            "users",
            200,
            data=data
        )
        if success and 'id' in response:
            self.user_ids.append({
                "id": response['id'],
                "username": data['username'],
                "password": data['password']
            })
            print(f"   Created user ID: {response['id']}")
        return success

    def test_list_users(self):
        """Test listing users"""
        success, response = self.run_test(
            "List Users",
            "GET",
            "users",
            200
        )
        if success:
            print(f"   Total users: {len(response)}")
        return success

    def test_login_admin_user(self):
        """Test login as admin user"""
        if not self.user_ids:
            print("   ⚠️  Skipping - no admin user created")
            return False
            
        user = self.user_ids[0]
        success, response = self.run_test(
            f"Login as Admin User ({user['username']})",
            "POST",
            "auth/login",
            200,
            data={"username": user['username'], "password": user['password'], "role": "admin"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
        return success

    def test_admin_section_protection(self):
        """Test section protection for admin role"""
        if not self.admin_token:
            print("   ⚠️  Skipping - no admin token")
            return False
            
        old_token = self.token
        self.token = self.admin_token
        
        # Test without password - should 403
        success1, _ = self.run_test(
            "Admin access detail report without password (should 403)",
            "GET",
            "reports/detail",
            403,
            params={"start": f"{self.year}-01-01", "end": f"{self.year}-12-31"}
        )
        
        # Test with password - should 200
        success2, _ = self.run_test(
            "Admin access detail report with password (should 200)",
            "GET",
            "reports/detail",
            200,
            params={"start": f"{self.year}-01-01", "end": f"{self.year}-12-31"},
            headers={"X-Section-Password": "ScaBuka2026"}
        )
        
        self.token = old_token
        return success1 and success2

    def test_admin_verify_temp_password(self):
        """Test verify temp password endpoint"""
        if not self.admin_token:
            print("   ⚠️  Skipping - no admin token")
            return False
            
        old_token = self.token
        self.token = self.admin_token
        
        success, response = self.run_test(
            "Verify Temp Password",
            "POST",
            "auth/verify-temp-password",
            200,
            data={"password": "ScaBuka2026"}
        )
        
        self.token = old_token
        if success:
            print(f"   Valid: {response.get('valid')}")
        return success

    def test_admin_cannot_access_users(self):
        """Test that admin role cannot access /users endpoint"""
        if not self.admin_token:
            print("   ⚠️  Skipping - no admin token")
            return False
            
        old_token = self.token
        self.token = self.admin_token
        
        success, _ = self.run_test(
            "Admin access /users (should 403)",
            "GET",
            "users",
            403
        )
        
        self.token = old_token
        return success

    def test_admin_dashboard_nominal_hidden(self):
        """Test that admin role cannot see nominal in dashboard"""
        if not self.admin_token:
            print("   ⚠️  Skipping - no admin token")
            return False
            
        old_token = self.token
        self.token = self.admin_token
        
        success, response = self.run_test(
            "Admin Dashboard (nominal should be hidden)",
            "GET",
            "dashboard",
            200
        )
        
        self.token = old_token
        if success:
            nominal = response.get('nominal_total')
            if nominal == "Terkunci" or nominal is None:
                print(f"   ✅ Nominal correctly hidden: {nominal}")
                return True
            else:
                print(f"   ❌ Nominal exposed to admin: {nominal}")
                return False
        return False

    def test_toggle_user(self):
        """Test toggling user active status"""
        if not self.user_ids:
            print("   ⚠️  Skipping - no user to toggle")
            return False
            
        user_id = self.user_ids[0]['id']
        success, response = self.run_test(
            "Toggle User (deactivate)",
            "PATCH",
            f"users/{user_id}/toggle",
            200
        )
        if success:
            print(f"   Active status: {response.get('active')}")
        return success

    def test_inactive_user_cannot_login(self):
        """Test that inactive user cannot login"""
        if not self.user_ids:
            print("   ⚠️  Skipping - no user to test")
            return False
            
        user = self.user_ids[0]
        success, _ = self.run_test(
            "Login as Inactive User (should 403)",
            "POST",
            "auth/login",
            403,
            data={"username": user['username'], "password": user['password']}
        )
        return success

    def test_delete_user(self):
        """Test deleting user"""
        if not self.user_ids:
            print("   ⚠️  Skipping - no user to delete")
            return False
            
        user_id = self.user_ids[0]['id']
        success, response = self.run_test(
            "Delete User",
            "DELETE",
            f"users/{user_id}",
            200
        )
        return success

    def test_change_temp_password(self):
        """Test changing temp password"""
        success1, _ = self.run_test(
            "Change Temp Password",
            "POST",
            "settings/temp-password",
            200,
            data={"new_password": "newpassword123"}
        )
        
        # Restore original
        success2, _ = self.run_test(
            "Restore Temp Password",
            "POST",
            "settings/temp-password",
            200,
            data={"new_password": "ScaBuka2026"}
        )
        
        return success1 and success2

    # ==================== PO TRACKER TESTS ====================
    
    def test_po_create(self):
        """Test creating PO"""
        data = {
            "po_number": f"TEST-PO-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "client_name": "PT Test Client",
            "item_type": "Box Test",
            "material": "Ivory 250gr",
            "paper_size": "65x100",
            "quantity": "5000",
            "po_date": f"{self.year}-08-01",
            "est_start": f"{self.year}-08-05",
            "est_end": f"{self.year}-08-15",
            "print_machine": "OLIVER 58",
            "enabled_stages": [1, 2, 3, 6, 11],
            "notes": "Test PO for regression testing"
        }
        success, response = self.run_test(
            "Create PO",
            "POST",
            "po/pos",
            200,
            data=data
        )
        if success and 'id' in response:
            self.po_ids.append(response['id'])
            print(f"   Created PO ID: {response['id']}")
            print(f"   PO Number: {response.get('po_number')}")
        return success

    def test_po_list(self):
        """Test listing POs"""
        success, response = self.run_test(
            "List POs",
            "GET",
            "po/pos",
            200
        )
        if success:
            print(f"   Total POs: {len(response)}")
        return success

    def test_po_dashboard(self):
        """Test PO dashboard"""
        success, response = self.run_test(
            "PO Dashboard",
            "GET",
            "po/dashboard",
            200
        )
        if success:
            print(f"   Total POs: {response.get('total')}")
            print(f"   Active: {response.get('total_active')}")
            print(f"   Completed: {response.get('total_completed')}")
        return success

    def test_po_stage_update(self):
        """Test updating PO stage"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
            
        po_id = self.po_ids[0]
        # Stage 1: paper arrived
        success, response = self.run_test(
            "Update PO Stage 1 (paper arrived)",
            "POST",
            f"po/pos/{po_id}/stages/1",
            200,
            data={"data": {"paper_arrived": True, "needs_single_face": False}}
        )
        if success:
            print(f"   Current stage: {response.get('computed', {}).get('current_stage')}")
        return success

    def test_po_stage_2_3(self):
        """Test updating PO stages 2 and 3"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
            
        po_id = self.po_ids[0]
        success1, _ = self.run_test(
            "Update PO Stage 2 (ink arrived)",
            "POST",
            f"po/pos/{po_id}/stages/2",
            200,
            data={"data": {"arrived": True}}
        )
        success2, _ = self.run_test(
            "Update PO Stage 3 (die arrived)",
            "POST",
            f"po/pos/{po_id}/stages/3",
            200,
            data={"data": {"arrived": True}}
        )
        return success1 and success2

    def test_po_stage_6_finishing(self):
        """Test updating PO stage 6 with multiple finishing"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
            
        po_id = self.po_ids[0]
        success, response = self.run_test(
            "Update PO Stage 6 (finishing)",
            "POST",
            f"po/pos/{po_id}/stages/6",
            200,
            data={"data": {"finishing": ["laminasi_glossy", "uv_spot"], "done": True}}
        )
        if success:
            stage_data = response.get('stage_data', {}).get('6', {})
            print(f"   Finishing options: {stage_data.get('finishing')}")
        return success

    def test_po_delivery_flow(self):
        """Test PO delivery flow (stage 11)"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
            
        po_id = self.po_ids[0]
        
        # Mark print completed
        success1, _ = self.run_test(
            "PO Stage 11: Print Completed",
            "POST",
            f"po/pos/{po_id}/stages/11",
            200,
            data={"data": {"print_completed": True}}
        )
        
        # Schedule delivery
        success2, _ = self.run_test(
            "PO Delivery: Schedule",
            "POST",
            f"po/pos/{po_id}/delivery/schedule",
            200,
            data={"scheduled_date": f"{self.year}-08-20", "driver_name": "Budi Test"}
        )
        
        # Mark delivery success
        success3, response = self.run_test(
            "PO Delivery: Result Success",
            "POST",
            f"po/pos/{po_id}/delivery/result",
            200,
            data={"status": "success"}
        )
        
        if success3:
            print(f"   PO Completed: {response.get('computed', {}).get('is_completed')}")
        
        return success1 and success2 and success3

    def test_po_check_conflict(self):
        """Test PO conflict checking"""
        success, response = self.run_test(
            "PO Check Conflict",
            "POST",
            "po/pos/check-conflict",
            200,
            data={
                "est_start": f"{self.year}-08-10",
                "est_end": f"{self.year}-08-12"
            }
        )
        if success:
            print(f"   Conflicts found: {len(response.get('conflicts', []))}")
        return success

    def test_po_schedules_create(self):
        """Test creating PO schedule"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO created")
            return False
            
        po_id = self.po_ids[0]
        success, response = self.run_test(
            "Create PO Schedule",
            "POST",
            "po/schedules",
            200,
            data={
                "po_id": po_id,
                "stage_number": 4,
                "date": f"{self.year}-08-08",
                "note": "Test schedule"
            }
        )
        return success

    def test_po_schedules_list(self):
        """Test listing PO schedules"""
        success, response = self.run_test(
            "List PO Schedules",
            "GET",
            "po/schedules",
            200
        )
        if success:
            print(f"   Total schedules: {len(response)}")
        return success

    def test_po_pdf_export(self):
        """Test PO PDF export"""
        success, response = self.run_test(
            "PO PDF Export",
            "GET",
            "po/pos/export/pdf",
            200
        )
        return success

    # ==================== HPP CALCULATOR TESTS ====================
    
    def test_hpp_create(self):
        """Test creating HPP calculation"""
        data = {
            "name": f"TEST HPP {datetime.now().strftime('%H%M%S')}",
            "customer": "PT Test Customer",
            "notes": "Test HPP calculation",
            "inputs": {
                "kertas": {"bahan": "Ivory", "gramatur": "250 Gr", "qtyOrder": "5000"},
                "enabled": {"kertas": True}
            },
            "result": {
                "subtotal": 5000000,
                "subtotalPerPcs": 1000,
                "laba": 750000,
                "bunga": 50000,
                "dpp": 5800000,
                "ppn": 638000,
                "total": 6438000,
                "hargaJualPerPcs": 1287.6,
                "qtyOrder": 5000
            }
        }
        success, response = self.run_test(
            "Create HPP Calculation",
            "POST",
            "hpp/calculations",
            200,
            data=data
        )
        if success and 'id' in response:
            self.hpp_ids.append(response['id'])
            print(f"   Created HPP ID: {response['id']}")
        return success

    def test_hpp_list(self):
        """Test listing HPP calculations"""
        success, response = self.run_test(
            "List HPP Calculations",
            "GET",
            "hpp/calculations",
            200
        )
        if success:
            print(f"   Total HPP calculations: {len(response)}")
        return success

    def test_hpp_get_by_id(self):
        """Test getting HPP calculation by ID"""
        if not self.hpp_ids:
            print("   ⚠️  Skipping - no HPP created")
            return False
            
        hpp_id = self.hpp_ids[0]
        success, response = self.run_test(
            "Get HPP Calculation by ID",
            "GET",
            f"hpp/calculations/{hpp_id}",
            200
        )
        if success:
            print(f"   HPP Name: {response.get('name')}")
            print(f"   Customer: {response.get('customer')}")
        return success

    def test_hpp_update(self):
        """Test updating HPP calculation"""
        if not self.hpp_ids:
            print("   ⚠️  Skipping - no HPP created")
            return False
            
        hpp_id = self.hpp_ids[0]
        data = {
            "name": f"TEST HPP UPDATED {datetime.now().strftime('%H%M%S')}",
            "customer": "PT Test Customer Updated",
            "notes": "Updated test HPP",
            "inputs": {
                "kertas": {"bahan": "Ivory", "gramatur": "250 Gr", "qtyOrder": "6000"},
                "enabled": {"kertas": True}
            },
            "result": {
                "subtotal": 6000000,
                "subtotalPerPcs": 1000,
                "laba": 900000,
                "bunga": 60000,
                "dpp": 6960000,
                "ppn": 765600,
                "total": 7725600,
                "hargaJualPerPcs": 1287.6,
                "qtyOrder": 6000
            }
        }
        success, response = self.run_test(
            "Update HPP Calculation",
            "PUT",
            f"hpp/calculations/{hpp_id}",
            200,
            data=data
        )
        return success

    def test_hpp_pdf(self):
        """Test HPP PDF generation"""
        data = {
            "name": "Test HPP PDF",
            "customer": "PT Test",
            "result": {
                "total": 5000000,
                "subtotalPerPcs": 1000,
                "hargaJualPerPcs": 1200
            }
        }
        success, response = self.run_test(
            "HPP PDF Generation",
            "POST",
            "hpp/pdf",
            200,
            data=data
        )
        return success

    def test_admin_hpp_forbidden(self):
        """Test that admin role cannot access HPP endpoints"""
        if not self.admin_token:
            print("   ⚠️  Skipping - no admin token")
            return False
            
        old_token = self.token
        self.token = self.admin_token
        
        success1, _ = self.run_test(
            "Admin access HPP list (should 403)",
            "GET",
            "hpp/calculations",
            403
        )
        
        success2, _ = self.run_test(
            "Admin create HPP (should 403)",
            "POST",
            "hpp/calculations",
            403,
            data={"name": "Test", "customer": "Test"}
        )
        
        self.token = old_token
        return success1 and success2

    def test_delete_hpp(self):
        """Test deleting HPP calculation"""
        if not self.hpp_ids:
            print("   ⚠️  Skipping - no HPP to delete")
            return False
            
        hpp_id = self.hpp_ids[0]
        success, response = self.run_test(
            "Delete HPP Calculation",
            "DELETE",
            f"hpp/calculations/{hpp_id}",
            200
        )
        return success

    def test_delete_po(self):
        """Test deleting PO"""
        if not self.po_ids:
            print("   ⚠️  Skipping - no PO to delete")
            return False
            
        po_id = self.po_ids[0]
        success, response = self.run_test(
            "Delete PO",
            "DELETE",
            f"po/pos/{po_id}",
            200
        )
        return success

    def test_pdf_endpoints(self):
        """Test all PDF generation endpoints"""
        pdf_kinds = [
            "paper-mutations",
            "ink-mutations",
            "other-mutations",
            "stock-ringkas",
            "detail",
            "stock-nominal"
        ]
        
        all_success = True
        for kind in pdf_kinds:
            success, response = self.run_test(
                f"PDF Generation: {kind}",
                "GET",
                f"pdf/{kind}",
                200,
                params={"start": f"{self.year}-01-01", "end": f"{self.year}-12-31"}
            )
            if not success:
                all_success = False
        
        return all_success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200,
            data={"type": "manual"}
        )
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("LAPORAN STOK SCA - COMPREHENSIVE API TEST")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Test Year: {self.year}")
        print("=" * 80)
        
        # 1. Health & Auth
        print("\n" + "=" * 80)
        print("SECTION 1: HEALTH & AUTHENTICATION")
        print("=" * 80)
        self.test_health()
        self.test_login_superadmin()
        self.test_login_invalid()
        self.test_login_role_mismatch_superadmin_as_admin()
        self.test_login_role_mismatch_admin_as_superadmin()
        self.test_login_missing_role()
        self.test_auth_me()
        self.test_auth_guard_no_token()
        
        # 2. Dashboard
        print("\n" + "=" * 80)
        print("SECTION 2: DASHBOARD")
        print("=" * 80)
        self.test_dashboard()
        
        # 3. Paper Mutations
        print("\n" + "=" * 80)
        print("SECTION 3: PAPER MUTATIONS")
        print("=" * 80)
        self.test_paper_mutation_masuk()
        self.test_paper_mutation_keluar()
        self.test_paper_mutation_keluar_exceed_stock()
        self.test_paper_mutation_retur()
        self.test_paper_mutation_list()
        self.test_paper_mutation_filter()
        self.test_paper_mutation_search()
        self.test_paper_jenis()
        self.test_paper_mutation_edit()
        
        # 4. Ink Mutations
        print("\n" + "=" * 80)
        print("SECTION 4: INK MUTATIONS")
        print("=" * 80)
        self.test_ink_mutation_masuk()
        self.test_ink_mutation_keluar_exceed()
        self.test_ink_mutation_list()
        
        # 5. Other Mutations
        print("\n" + "=" * 80)
        print("SECTION 5: OTHER MUTATIONS")
        print("=" * 80)
        self.test_other_mutation_masuk()
        self.test_other_mutation_list()
        
        # 6. Reports
        print("\n" + "=" * 80)
        print("SECTION 6: REPORTS")
        print("=" * 80)
        self.test_reports_stock()
        self.test_reports_detail()
        
        # 7. Logs
        print("\n" + "=" * 80)
        print("SECTION 7: LOGS")
        print("=" * 80)
        self.test_logs_activity()
        self.test_logs_audit()
        
        # 8. User Management
        print("\n" + "=" * 80)
        print("SECTION 8: USER MANAGEMENT")
        print("=" * 80)
        self.test_create_admin_user()
        self.test_list_users()
        self.test_login_admin_user()
        
        # 9. Admin Role Protection
        print("\n" + "=" * 80)
        print("SECTION 9: ADMIN ROLE PROTECTION")
        print("=" * 80)
        self.test_admin_section_protection()
        self.test_admin_verify_temp_password()
        self.test_admin_cannot_access_users()
        self.test_admin_dashboard_nominal_hidden()
        
        # 10. User Toggle & Delete
        print("\n" + "=" * 80)
        print("SECTION 10: USER TOGGLE & DELETE")
        print("=" * 80)
        self.test_toggle_user()
        self.test_inactive_user_cannot_login()
        self.test_delete_user()
        
        # 11. Settings
        print("\n" + "=" * 80)
        print("SECTION 11: SETTINGS")
        print("=" * 80)
        self.test_change_temp_password()
        
        # 12. PO Tracker
        print("\n" + "=" * 80)
        print("SECTION 12: PO TRACKER")
        print("=" * 80)
        self.test_po_create()
        self.test_po_list()
        self.test_po_dashboard()
        self.test_po_stage_update()
        self.test_po_stage_2_3()
        self.test_po_stage_6_finishing()
        self.test_po_delivery_flow()
        self.test_po_check_conflict()
        self.test_po_schedules_create()
        self.test_po_schedules_list()
        self.test_po_pdf_export()
        
        # 13. HPP Calculator
        print("\n" + "=" * 80)
        print("SECTION 13: HPP CALCULATOR")
        print("=" * 80)
        self.test_hpp_create()
        self.test_hpp_list()
        self.test_hpp_get_by_id()
        self.test_hpp_update()
        self.test_hpp_pdf()
        self.test_admin_hpp_forbidden()
        
        # 14. PDF Generation
        print("\n" + "=" * 80)
        print("SECTION 14: PDF GENERATION")
        print("=" * 80)
        self.test_pdf_endpoints()
        
        # 15. Cleanup
        print("\n" + "=" * 80)
        print("SECTION 15: CLEANUP")
        print("=" * 80)
        self.test_delete_hpp()
        self.test_delete_po()
        
        # 16. Logout
        print("\n" + "=" * 80)
        print("SECTION 16: LOGOUT")
        print("=" * 80)
        self.test_logout()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
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
        return 0 if len(self.failed_tests) == 0 else 1

def main():
    tester = StokSCAAPITester()
    tester.run_all_tests()
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
