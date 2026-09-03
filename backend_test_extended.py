#!/usr/bin/env python3
"""
Extended E2E Backend API Test for LAPORAN STOK SCA
Covers: Role mismatch, HPP module, PO Tracker module
"""

import requests
import sys
from datetime import datetime, timedelta
import json

class ExtendedSCAAPITester:
    def __init__(self, base_url="https://live-preview-stock.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.superadmin_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data IDs for cleanup
        self.created_hpp_ids = []
        self.created_po_ids = []
        self.created_schedule_ids = []

    def log_result(self, category, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ [{category}] {name}")
        else:
            print(f"❌ [{category}] {name} - {details}")
        
        self.test_results.append({
            "category": category,
            "name": name,
            "passed": passed,
            "details": details
        })

    def request(self, method, endpoint, token=None, data=None, headers=None, expect_status=200):
        """Make HTTP request"""
        url = f"{self.base_url}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        
        if token:
            req_headers['Authorization'] = f'Bearer {token}'
        
        if headers:
            req_headers.update(headers)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=60)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=60)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=60)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=60)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, timeout=60)
            
            success = response.status_code == expect_status
            return success, response
        except requests.exceptions.Timeout as e:
            print(f"⚠️  Request timeout: {str(e)}")
            return False, None
        except Exception as e:
            print(f"⚠️  Request error: {str(e)}")
            return False, None

    # ==================== AUTH EXTENDED TESTS ====================
    
    def test_auth_login_adminpic(self):
        """AUTH: Login with existing adminpic user"""
        success, resp = self.request('POST', 'auth/login', data={
            "username": "adminpic",
            "password": "admin1234",
            "role": "admin"
        })
        
        if success and resp:
            data = resp.json()
            if 'token' in data and data.get('role') == 'admin':
                self.admin_token = data['token']
                self.log_result("AUTH", "Login adminpic (adminpic/admin1234 + role=admin)", True)
                return True
        
        self.log_result("AUTH", "Login adminpic", False, f"Status: {resp.status_code if resp else 'N/A'}")
        return False

    def test_auth_role_mismatch_superadmin_as_admin(self):
        """AUTH: Role mismatch - Jeffsca with role=admin should fail with specific message"""
        success, resp = self.request('POST', 'auth/login', data={
            "username": "Jeffsca",
            "password": "jeff3131",
            "role": "admin"
        }, expect_status=401)
        
        if success and resp:
            data = resp.json()
            if 'Role tidak sesuai dengan akun ini' in data.get('detail', ''):
                self.log_result("AUTH", "Role mismatch Jeffsca+role=admin -> 401 'Role tidak sesuai dengan akun ini'", True)
                return True
            else:
                self.log_result("AUTH", "Role mismatch Jeffsca+role=admin", False, f"Wrong error message: {data.get('detail')}")
                return False
        
        self.log_result("AUTH", "Role mismatch Jeffsca+role=admin", False, f"Expected 401, got {resp.status_code if resp else 'N/A'}")
        return False

    def test_auth_role_mismatch_admin_as_superadmin(self):
        """AUTH: Role mismatch - adminpic with role=superadmin should fail"""
        success, resp = self.request('POST', 'auth/login', data={
            "username": "adminpic",
            "password": "admin1234",
            "role": "superadmin"
        }, expect_status=401)
        
        if success and resp:
            data = resp.json()
            if 'Role tidak sesuai dengan akun ini' in data.get('detail', ''):
                self.log_result("AUTH", "Role mismatch adminpic+role=superadmin -> 401 'Role tidak sesuai dengan akun ini'", True)
                return True
        
        self.log_result("AUTH", "Role mismatch adminpic+role=superadmin", False, f"Expected 401, got {resp.status_code if resp else 'N/A'}")
        return False

    def test_auth_no_role_sent(self):
        """AUTH: No role sent should return 400 with specific message"""
        success, resp = self.request('POST', 'auth/login', data={
            "username": "Jeffsca",
            "password": "jeff3131"
        }, expect_status=400)
        
        if success and resp:
            data = resp.json()
            if 'Pilih role terlebih dahulu' in data.get('detail', ''):
                self.log_result("AUTH", "No role sent -> 400 'Pilih role terlebih dahulu'", True)
                return True
            else:
                self.log_result("AUTH", "No role sent", False, f"Wrong error message: {data.get('detail')}")
                return False
        
        self.log_result("AUTH", "No role sent", False, f"Expected 400, got {resp.status_code if resp else 'N/A'}")
        return False

    def test_auth_logout(self):
        """AUTH: POST /auth/logout"""
        # Login first to get a token
        success, resp = self.request('POST', 'auth/login', data={
            "username": "Jeffsca",
            "password": "jeff3131",
            "role": "superadmin"
        })
        
        if success and resp:
            token = resp.json().get('token')
            success2, resp2 = self.request('POST', 'auth/logout', token=token, data={"type": "manual"})
            
            if success2:
                self.log_result("AUTH", "POST /auth/logout -> 200", True)
                return True
        
        self.log_result("AUTH", "POST /auth/logout", False)
        return False

    # ==================== HPP TESTS ====================
    
    def test_hpp_create_calculation(self):
        """HPP: Create calculation as superadmin"""
        success, resp = self.request('POST', 'hpp/calculations', 
                                    token=self.superadmin_token,
                                    data={
                                        "name": "Test HPP Calculation E2E",
                                        "data": {
                                            "paper": {"jenis": "Art Paper", "gramatur": 150, "harga": 500000},
                                            "ink": {"cyan": 10, "magenta": 10, "yellow": 10, "black": 10},
                                            "finishing": ["laminating", "cutting"],
                                            "quantity": 1000
                                        }
                                    }, expect_status=200)
        
        if success and resp:
            data = resp.json()
            hpp_id = data.get('id')
            if hpp_id:
                self.created_hpp_ids.append(hpp_id)
                self.log_result("HPP", "POST /hpp/calculations (create) -> 200", True)
                return True
        
        self.log_result("HPP", "Create HPP calculation", False, f"Status: {resp.status_code if resp else 'N/A'}")
        return False

    def test_hpp_get_list(self):
        """HPP: GET list of calculations"""
        success, resp = self.request('GET', 'hpp/calculations', token=self.superadmin_token)
        
        if success:
            self.log_result("HPP", "GET /hpp/calculations (list) -> 200", True)
            return True
        
        self.log_result("HPP", "GET HPP calculations list", False)
        return False

    def test_hpp_get_by_id(self):
        """HPP: GET calculation by ID"""
        if not self.created_hpp_ids:
            self.log_result("HPP", "GET HPP by ID", False, "No HPP created")
            return False
        
        success, resp = self.request('GET', f'hpp/calculations/{self.created_hpp_ids[0]}', 
                                    token=self.superadmin_token)
        
        if success:
            self.log_result("HPP", "GET /hpp/calculations/[id] -> 200", True)
            return True
        
        self.log_result("HPP", "GET HPP by ID", False)
        return False

    def test_hpp_update(self):
        """HPP: PUT update calculation"""
        if not self.created_hpp_ids:
            self.log_result("HPP", "Update HPP", False, "No HPP created")
            return False
        
        success, resp = self.request('PUT', f'hpp/calculations/{self.created_hpp_ids[0]}', 
                                    token=self.superadmin_token,
                                    data={
                                        "name": "Test HPP Calculation E2E Updated",
                                        "data": {
                                            "paper": {"jenis": "Art Paper", "gramatur": 150, "harga": 550000},
                                            "ink": {"cyan": 12, "magenta": 12, "yellow": 12, "black": 12},
                                            "finishing": ["laminating", "cutting", "binding"],
                                            "quantity": 1200
                                        }
                                    })
        
        if success:
            self.log_result("HPP", "PUT /hpp/calculations/[id] (update) -> 200", True)
            return True
        
        self.log_result("HPP", "Update HPP", False)
        return False

    def test_hpp_pdf_export(self):
        """HPP: PDF export"""
        if not self.created_hpp_ids:
            self.log_result("HPP", "HPP PDF export", False, "No HPP created")
            return False
        
        success, resp = self.request('GET', f'hpp/pdf?id={self.created_hpp_ids[0]}', 
                                    token=self.superadmin_token)
        
        if success and resp:
            content_type = resp.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                self.log_result("HPP", "GET /hpp/pdf -> 200 application/pdf", True)
                return True
            else:
                self.log_result("HPP", "HPP PDF export", False, f"Wrong content-type: {content_type}")
                return False
        
        self.log_result("HPP", "HPP PDF export", False)
        return False

    def test_hpp_admin_forbidden_list(self):
        """HPP: Admin access to GET /hpp/calculations must be 403"""
        success, resp = self.request('GET', 'hpp/calculations', 
                                    token=self.admin_token,
                                    expect_status=403)
        
        if success:
            self.log_result("HPP", "Admin GET /hpp/calculations -> 403", True)
            return True
        
        self.log_result("HPP", "Admin access HPP list", False, f"Expected 403, got {resp.status_code if resp else 'N/A'}")
        return False

    def test_hpp_admin_forbidden_create(self):
        """HPP: Admin POST to /hpp/calculations must be 403"""
        success, resp = self.request('POST', 'hpp/calculations', 
                                    token=self.admin_token,
                                    data={"name": "Test", "data": {}},
                                    expect_status=403)
        
        if success:
            self.log_result("HPP", "Admin POST /hpp/calculations -> 403", True)
            return True
        
        self.log_result("HPP", "Admin create HPP", False, f"Expected 403, got {resp.status_code if resp else 'N/A'}")
        return False

    def test_hpp_admin_forbidden_pdf(self):
        """HPP: Admin access to /hpp/pdf must be 403"""
        success, resp = self.request('GET', 'hpp/pdf?id=test', 
                                    token=self.admin_token,
                                    expect_status=403)
        
        if success:
            self.log_result("HPP", "Admin GET /hpp/pdf -> 403", True)
            return True
        
        self.log_result("HPP", "Admin access HPP PDF", False, f"Expected 403, got {resp.status_code if resp else 'N/A'}")
        return False

    # ==================== PO TRACKER TESTS ====================
    
    def test_po_create(self):
        """PO: Create PO"""
        success, resp = self.request('POST', 'po/pos', 
                                    token=self.superadmin_token,
                                    data={
                                        "po_number": f"PO-E2E-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                                        "client_name": "Test Customer E2E",
                                        "item_type": "Test Product E2E",
                                        "quantity": "1000",
                                        "est_end": (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
                                        "notes": "E2E test PO"
                                    }, expect_status=200)
        
        if success and resp:
            data = resp.json()
            po_id = data.get('id')
            if po_id:
                self.created_po_ids.append(po_id)
                self.log_result("PO", "POST /po/pos (create) -> 200", True)
                return True
        
        self.log_result("PO", "Create PO", False, f"Status: {resp.status_code if resp else 'N/A'}")
        return False

    def test_po_get_list(self):
        """PO: GET list of POs"""
        success, resp = self.request('GET', 'po/pos', token=self.superadmin_token)
        
        if success:
            self.log_result("PO", "GET /po/pos (list) -> 200", True)
            return True
        
        self.log_result("PO", "GET PO list", False)
        return False

    def test_po_get_by_id(self):
        """PO: GET PO by ID"""
        if not self.created_po_ids:
            self.log_result("PO", "GET PO by ID", False, "No PO created")
            return False
        
        success, resp = self.request('GET', f'po/pos/{self.created_po_ids[0]}', 
                                    token=self.superadmin_token)
        
        if success:
            self.log_result("PO", "GET /po/pos/[id] -> 200", True)
            return True
        
        self.log_result("PO", "GET PO by ID", False)
        return False

    def test_po_update(self):
        """PO: PUT update PO"""
        if not self.created_po_ids:
            self.log_result("PO", "Update PO", False, "No PO created")
            return False
        
        success, resp = self.request('PUT', f'po/pos/{self.created_po_ids[0]}', 
                                    token=self.superadmin_token,
                                    data={
                                        "po_number": f"PO-E2E-UPD-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                                        "client_name": "Test Customer E2E Updated",
                                        "item_type": "Test Product E2E Updated",
                                        "quantity": "1200",
                                        "est_end": (datetime.now() + timedelta(days=35)).strftime('%Y-%m-%d'),
                                        "notes": "E2E test PO updated"
                                    })
        
        if success:
            self.log_result("PO", "PUT /po/pos/[id] (update) -> 200", True)
            return True
        
        self.log_result("PO", "Update PO", False)
        return False

    def test_po_stage_1_single_face(self):
        """PO: Stage 1 update with single_face option"""
        if not self.created_po_ids:
            self.log_result("PO", "Stage 1 update", False, "No PO created")
            return False
        
        success, resp = self.request('PUT', f'po/pos/{self.created_po_ids[0]}/stages/1', 
                                    token=self.superadmin_token,
                                    data={
                                        "completed": True,
                                        "options": {"single_face": True}
                                    })
        
        if success:
            self.log_result("PO", "PUT /po/pos/[id]/stages/1 (single_face option) -> 200", True)
            return True
        
        self.log_result("PO", "Stage 1 update", False)
        return False

    def test_po_stage_2_arrived(self):
        """PO: Stage 2 update with arrived flag"""
        if not self.created_po_ids:
            self.log_result("PO", "Stage 2 update", False, "No PO created")
            return False
        
        success, resp = self.request('PUT', f'po/pos/{self.created_po_ids[0]}/stages/2', 
                                    token=self.superadmin_token,
                                    data={
                                        "completed": True,
                                        "arrived": True
                                    })
        
        if success:
            self.log_result("PO", "PUT /po/pos/[id]/stages/2 (arrived flag) -> 200", True)
            return True
        
        self.log_result("PO", "Stage 2 update", False)
        return False

    def test_po_stage_6_multi_finishing(self):
        """PO: Stage 6 update with multiple finishing options"""
        if not self.created_po_ids:
            self.log_result("PO", "Stage 6 update", False, "No PO created")
            return False
        
        success, resp = self.request('PUT', f'po/pos/{self.created_po_ids[0]}/stages/6', 
                                    token=self.superadmin_token,
                                    data={
                                        "completed": True,
                                        "finishing": ["laminating", "cutting", "binding"]
                                    })
        
        if success:
            self.log_result("PO", "PUT /po/pos/[id]/stages/6 (multi finishing) -> 200", True)
            return True
        
        self.log_result("PO", "Stage 6 update", False)
        return False

    def test_po_delivery_schedule(self):
        """PO: Delivery schedule"""
        if not self.created_po_ids:
            self.log_result("PO", "Delivery schedule", False, "No PO created")
            return False
        
        schedule_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        success, resp = self.request('POST', f'po/pos/{self.created_po_ids[0]}/delivery/schedule', 
                                    token=self.superadmin_token,
                                    data={
                                        "scheduled_date": schedule_date,
                                        "notes": "E2E test delivery"
                                    })
        
        if success:
            self.log_result("PO", "POST /po/pos/[id]/delivery/schedule -> 200", True)
            return True
        
        self.log_result("PO", "Delivery schedule", False)
        return False

    def test_po_delivery_result_fail(self):
        """PO: Delivery result (failed)"""
        if not self.created_po_ids:
            self.log_result("PO", "Delivery result fail", False, "No PO created")
            return False
        
        success, resp = self.request('POST', f'po/pos/{self.created_po_ids[0]}/delivery/result', 
                                    token=self.superadmin_token,
                                    data={
                                        "success": False,
                                        "notes": "Customer not available - E2E test"
                                    })
        
        if success:
            self.log_result("PO", "POST /po/pos/[id]/delivery/result (failed) -> 200", True)
            return True
        
        self.log_result("PO", "Delivery result fail", False)
        return False

    def test_po_delivery_reschedule(self):
        """PO: Reschedule after failed delivery"""
        if not self.created_po_ids:
            self.log_result("PO", "Delivery reschedule", False, "No PO created")
            return False
        
        reschedule_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        success, resp = self.request('POST', f'po/pos/{self.created_po_ids[0]}/delivery/schedule', 
                                    token=self.superadmin_token,
                                    data={
                                        "scheduled_date": reschedule_date,
                                        "notes": "Rescheduled after failure - E2E test"
                                    })
        
        if success:
            self.log_result("PO", "Reschedule after failure -> 200", True)
            
            # Verify attempt is recorded
            success2, resp2 = self.request('GET', f'po/pos/{self.created_po_ids[0]}', 
                                          token=self.superadmin_token)
            if success2 and resp2:
                data = resp2.json()
                delivery_attempts = data.get('delivery_attempts', 0)
                if delivery_attempts >= 1:
                    self.log_result("PO", "Delivery attempts recorded", True)
                else:
                    self.log_result("PO", "Delivery attempts", False, f"Expected >= 1, got {delivery_attempts}")
            
            return True
        
        self.log_result("PO", "Delivery reschedule", False)
        return False

    def test_po_conflict_check(self):
        """PO: Conflict checking"""
        conflict_date = (datetime.now() + timedelta(days=10)).strftime('%Y-%m-%d')
        
        success, resp = self.request('POST', 'po/pos/check-conflict', 
                                    token=self.superadmin_token,
                                    data={
                                        "date": conflict_date,
                                        "exclude_po_id": None
                                    })
        
        if success:
            self.log_result("PO", "POST /po/pos/check-conflict -> 200", True)
            return True
        
        self.log_result("PO", "Conflict check", False)
        return False

    def test_po_dashboard(self):
        """PO: Dashboard counts"""
        success, resp = self.request('GET', 'po/dashboard', token=self.superadmin_token)
        
        if success:
            self.log_result("PO", "GET /po/dashboard -> 200", True)
            return True
        
        self.log_result("PO", "GET PO dashboard", False)
        return False

    def test_po_schedules_create(self):
        """PO: Create schedule"""
        schedule_date = (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d')
        success, resp = self.request('POST', 'po/schedules', 
                                    token=self.superadmin_token,
                                    data={
                                        "date": schedule_date,
                                        "title": "E2E Test Schedule",
                                        "description": "E2E test schedule event",
                                        "type": "delivery"
                                    }, expect_status=200)
        
        if success and resp:
            data = resp.json()
            schedule_id = data.get('id')
            if schedule_id:
                self.created_schedule_ids.append(schedule_id)
                self.log_result("PO", "POST /po/schedules (create) -> 200", True)
                return True
        
        self.log_result("PO", "Create schedule", False)
        return False

    def test_po_schedules_get_list(self):
        """PO: GET schedules list"""
        success, resp = self.request('GET', 'po/schedules', token=self.superadmin_token)
        
        if success:
            self.log_result("PO", "GET /po/schedules (list) -> 200", True)
            return True
        
        self.log_result("PO", "GET schedules list", False)
        return False

    def test_po_schedules_update(self):
        """PO: Update schedule"""
        if not self.created_schedule_ids:
            self.log_result("PO", "Update schedule", False, "No schedule created")
            return False
        
        schedule_date = (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d')
        success, resp = self.request('PUT', f'po/schedules/{self.created_schedule_ids[0]}', 
                                    token=self.superadmin_token,
                                    data={
                                        "date": schedule_date,
                                        "title": "E2E Test Schedule Updated",
                                        "description": "E2E test schedule updated",
                                        "type": "production"
                                    })
        
        if success:
            self.log_result("PO", "PUT /po/schedules/[id] (update) -> 200", True)
            return True
        
        self.log_result("PO", "Update schedule", False)
        return False

    def test_po_pdf_export(self):
        """PO: PDF export"""
        year = datetime.now().year
        month = datetime.now().month
        
        success, resp = self.request('GET', f'po/pos/export/pdf?year={year}&month={month}', 
                                    token=self.superadmin_token)
        
        if success and resp:
            content_type = resp.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                self.log_result("PO", "GET /po/pos/export/pdf -> 200 application/pdf", True)
                return True
            else:
                self.log_result("PO", "PO PDF export", False, f"Wrong content-type: {content_type}")
                return False
        
        self.log_result("PO", "PO PDF export", False)
        return False

    def test_po_admin_access_list(self):
        """PO: Admin/PIC must be able to access PO list"""
        success, resp = self.request('GET', 'po/pos', token=self.admin_token)
        
        if success:
            self.log_result("PO", "Admin GET /po/pos -> 200 (not 403)", True)
            return True
        
        self.log_result("PO", "Admin access PO list", False, "Admin should have access to PO Tracker")
        return False

    def test_po_admin_access_dashboard(self):
        """PO: Admin/PIC must be able to access PO dashboard"""
        success, resp = self.request('GET', 'po/dashboard', token=self.admin_token)
        
        if success:
            self.log_result("PO", "Admin GET /po/dashboard -> 200 (not 403)", True)
            return True
        
        self.log_result("PO", "Admin access PO dashboard", False)
        return False

    # ==================== CLEANUP ====================
    
    def cleanup(self):
        """Cleanup test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete schedules
        for schedule_id in self.created_schedule_ids:
            self.request('DELETE', f'po/schedules/{schedule_id}', token=self.superadmin_token)
        
        # Delete POs
        for po_id in self.created_po_ids:
            self.request('DELETE', f'po/pos/{po_id}', token=self.superadmin_token)
        
        # Delete HPP calculations
        for hpp_id in self.created_hpp_ids:
            self.request('DELETE', f'hpp/calculations/{hpp_id}', token=self.superadmin_token)
        
        print("✅ Cleanup completed")

    # ==================== MAIN TEST RUNNER ====================
    
    def run_all_tests(self):
        """Run all extended tests"""
        print("=" * 80)
        print("LAPORAN STOK SCA - Extended E2E Backend API Test")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # AUTH EXTENDED TESTS
        print("\n📋 AUTH EXTENDED TESTS")
        print("-" * 80)
        
        # First login as superadmin to get token
        success, resp = self.request('POST', 'auth/login', data={
            "username": "Jeffsca",
            "password": "jeff3131",
            "role": "superadmin"
        })
        
        if success and resp:
            self.superadmin_token = resp.json().get('token')
            print("✅ Superadmin login successful (for testing)")
        else:
            print("❌ CRITICAL: Cannot login as superadmin. Stopping tests.")
            return False
        
        # Test with existing adminpic user
        self.test_auth_login_adminpic()
        
        # Role mismatch tests
        self.test_auth_role_mismatch_superadmin_as_admin()
        self.test_auth_role_mismatch_admin_as_superadmin()
        self.test_auth_no_role_sent()
        self.test_auth_logout()
        
        # HPP TESTS
        print("\n📋 HPP TESTS (Superadmin only)")
        print("-" * 80)
        self.test_hpp_create_calculation()
        self.test_hpp_get_list()
        self.test_hpp_get_by_id()
        self.test_hpp_update()
        self.test_hpp_pdf_export()
        self.test_hpp_admin_forbidden_list()
        self.test_hpp_admin_forbidden_create()
        self.test_hpp_admin_forbidden_pdf()
        
        # PO TRACKER TESTS
        print("\n📋 PO TRACKER TESTS")
        print("-" * 80)
        self.test_po_create()
        self.test_po_get_list()
        self.test_po_get_by_id()
        self.test_po_update()
        self.test_po_stage_1_single_face()
        self.test_po_stage_2_arrived()
        self.test_po_stage_6_multi_finishing()
        self.test_po_delivery_schedule()
        self.test_po_delivery_result_fail()
        self.test_po_delivery_reschedule()
        self.test_po_conflict_check()
        self.test_po_dashboard()
        self.test_po_schedules_create()
        self.test_po_schedules_get_list()
        self.test_po_schedules_update()
        self.test_po_pdf_export()
        self.test_po_admin_access_list()
        self.test_po_admin_access_dashboard()
        
        # CLEANUP
        self.cleanup()
        
        # SUMMARY
        print("\n" + "=" * 80)
        print("EXTENDED TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        print("=" * 80)
        
        return self.tests_run == self.tests_passed


def main():
    tester = ExtendedSCAAPITester()
    success = tester.run_all_tests()
    
    # Save results to JSON
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed": tester.tests_passed,
        "failed": tester.tests_run - tester.tests_passed,
        "success_rate": f"{(tester.tests_passed / tester.tests_run * 100):.1f}%",
        "test_results": tester.test_results
    }
    
    with open('/app/backend_test_extended_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_extended_results.json")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
