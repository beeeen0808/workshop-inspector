#!/usr/bin/env python3
"""
Backend API Testing for Machinery Inspection App
Tests all API endpoints with proper authentication flow
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://machinery-audit-app.preview.emergentagent.com/api"
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "password123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        self.test_machine_id = None
        self.test_template_id = None
        self.test_inspection_id = None
        self.results = []
        
    def log_result(self, test_name, success, message="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "data": response_data
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        
        # Add auth header if token exists
        if self.token and headers is None:
            headers = {"Authorization": f"Bearer {self.token}"}
        elif self.token and headers:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None

    def test_auth_register(self):
        """Test user registration"""
        test_user_data = {
            "username": f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
            "password": "testpass123"
        }
        
        response = self.make_request("POST", "/auth/register", test_user_data, headers={})
        
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.log_result("Auth Registration", True, f"User created: {data['user']['username']}")
                return True
            else:
                self.log_result("Auth Registration", False, "Missing token or user in response", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Auth Registration", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_auth_login(self):
        """Test user login"""
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, headers={})
        
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.token = data["token"]
                self.user_id = data["user"]["user_id"]
                self.log_result("Auth Login", True, f"Logged in as: {data['user']['email']}")
                return True
            else:
                self.log_result("Auth Login", False, "Missing token or user in response", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Auth Login", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_auth_me(self):
        """Test get current user info"""
        if not self.token:
            self.log_result("Auth Me", False, "No token available")
            return False
            
        response = self.make_request("GET", "/auth/me")
        
        if response and response.status_code == 200:
            data = response.json()
            if "user_id" in data and "email" in data:
                self.log_result("Auth Me", True, f"User info retrieved: {data['email']}")
                return True
            else:
                self.log_result("Auth Me", False, "Missing user info in response", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Auth Me", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machines_create(self):
        """Test machine creation"""
        machine_data = {
            "name": "Test CNC Router",
            "category": "woodworking",
            "description": "Test machine for API testing",
            "location": "Workshop A"
        }
        
        response = self.make_request("POST", "/machines", machine_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "machine_id" in data and "qr_code_data" in data:
                self.test_machine_id = data["machine_id"]
                self.log_result("Machine Create", True, f"Machine created: {data['name']} (ID: {data['machine_id']})")
                return True
            else:
                self.log_result("Machine Create", False, "Missing machine_id or qr_code_data", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine Create", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machines_list(self):
        """Test listing machines"""
        response = self.make_request("GET", "/machines")
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Machine List", True, f"Retrieved {len(data)} machines")
                return True
            else:
                self.log_result("Machine List", False, "Response is not a list", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine List", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machines_get(self):
        """Test getting specific machine"""
        if not self.test_machine_id:
            self.log_result("Machine Get", False, "No test machine ID available")
            return False
            
        response = self.make_request("GET", f"/machines/{self.test_machine_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "machine_id" in data and data["machine_id"] == self.test_machine_id:
                self.log_result("Machine Get", True, f"Retrieved machine: {data['name']}")
                return True
            else:
                self.log_result("Machine Get", False, "Machine ID mismatch", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine Get", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machines_qr(self):
        """Test getting machine by QR code"""
        if not self.test_machine_id:
            self.log_result("Machine QR", False, "No test machine ID available")
            return False
            
        qr_code = f"MACHINE:{self.test_machine_id}"
        response = self.make_request("GET", f"/machines/qr/{qr_code}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "machine_id" in data and data["machine_id"] == self.test_machine_id:
                self.log_result("Machine QR", True, f"Retrieved machine by QR: {data['name']}")
                return True
            else:
                self.log_result("Machine QR", False, "Machine ID mismatch", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine QR", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machines_update(self):
        """Test updating machine"""
        if not self.test_machine_id:
            self.log_result("Machine Update", False, "No test machine ID available")
            return False
            
        update_data = {
            "description": "Updated test machine description",
            "location": "Workshop B"
        }
        
        response = self.make_request("PUT", f"/machines/{self.test_machine_id}", update_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "machine_id" in data and data["description"] == update_data["description"]:
                self.log_result("Machine Update", True, f"Machine updated: {data['name']}")
                return True
            else:
                self.log_result("Machine Update", False, "Update not reflected", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine Update", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_templates_create(self):
        """Test template creation"""
        template_data = {
            "name": "Test Safety Checklist",
            "category": "general",
            "description": "Test template for API testing",
            "check_items": [
                {
                    "text": "Emergency stop accessible",
                    "check_type": "yesno"
                },
                {
                    "text": "Safety equipment condition",
                    "check_type": "multiple_choice",
                    "options": ["Good", "Fair", "Poor"]
                }
            ]
        }
        
        response = self.make_request("POST", "/templates", template_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "template_id" in data and "check_items" in data:
                self.test_template_id = data["template_id"]
                self.log_result("Template Create", True, f"Template created: {data['name']} (ID: {data['template_id']})")
                return True
            else:
                self.log_result("Template Create", False, "Missing template_id or check_items", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Template Create", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_templates_list(self):
        """Test listing templates"""
        response = self.make_request("GET", "/templates")
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Template List", True, f"Retrieved {len(data)} templates")
                return True
            else:
                self.log_result("Template List", False, "Response is not a list", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Template List", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_templates_get(self):
        """Test getting specific template"""
        if not self.test_template_id:
            self.log_result("Template Get", False, "No test template ID available")
            return False
            
        response = self.make_request("GET", f"/templates/{self.test_template_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "template_id" in data and data["template_id"] == self.test_template_id:
                self.log_result("Template Get", True, f"Retrieved template: {data['name']}")
                return True
            else:
                self.log_result("Template Get", False, "Template ID mismatch", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Template Get", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_inspections_create(self):
        """Test inspection creation"""
        if not self.test_machine_id or not self.test_template_id:
            self.log_result("Inspection Create", False, "Missing machine or template ID")
            return False
            
        inspection_data = {
            "machine_id": self.test_machine_id,
            "template_id": self.test_template_id,
            "check_responses": [
                {
                    "check_id": "check_test1",
                    "text": "Emergency stop accessible",
                    "check_type": "yesno",
                    "response": "yes"
                },
                {
                    "check_id": "check_test2",
                    "text": "Safety equipment condition",
                    "check_type": "multiple_choice",
                    "options": ["Good", "Fair", "Poor"],
                    "response": "Good"
                }
            ],
            "text_notes": "Test inspection notes",
            "photo_notes": [],
            "voice_notes": []
        }
        
        response = self.make_request("POST", "/inspections", inspection_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "inspection_id" in data and "machine_id" in data:
                self.test_inspection_id = data["inspection_id"]
                self.log_result("Inspection Create", True, f"Inspection created: {data['inspection_id']}")
                return True
            else:
                self.log_result("Inspection Create", False, "Missing inspection_id or machine_id", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Inspection Create", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_inspections_list(self):
        """Test listing inspections"""
        response = self.make_request("GET", "/inspections")
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Inspection List", True, f"Retrieved {len(data)} inspections")
                return True
            else:
                self.log_result("Inspection List", False, "Response is not a list", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Inspection List", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_inspections_get(self):
        """Test getting specific inspection"""
        if not self.test_inspection_id:
            self.log_result("Inspection Get", False, "No test inspection ID available")
            return False
            
        response = self.make_request("GET", f"/inspections/{self.test_inspection_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "inspection_id" in data and data["inspection_id"] == self.test_inspection_id:
                self.log_result("Inspection Get", True, f"Retrieved inspection: {data['inspection_id']}")
                return True
            else:
                self.log_result("Inspection Get", False, "Inspection ID mismatch", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Inspection Get", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def test_machine_inspections(self):
        """Test getting inspections for a specific machine"""
        if not self.test_machine_id:
            self.log_result("Machine Inspections", False, "No test machine ID available")
            return False
            
        response = self.make_request("GET", f"/machines/{self.test_machine_id}/inspections")
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Machine Inspections", True, f"Retrieved {len(data)} inspections for machine")
                return True
            else:
                self.log_result("Machine Inspections", False, "Response is not a list", data)
        else:
            error_msg = response.json() if response else "No response"
            self.log_result("Machine Inspections", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        return False

    def cleanup(self):
        """Clean up test data"""
        print("\n=== CLEANUP ===")
        
        # Delete test inspection (no delete endpoint, so skip)
        
        # Delete test template
        if self.test_template_id:
            response = self.make_request("DELETE", f"/templates/{self.test_template_id}")
            if response and response.status_code == 200:
                print("✅ Test template deleted")
            else:
                print("❌ Failed to delete test template")
        
        # Delete test machine
        if self.test_machine_id:
            response = self.make_request("DELETE", f"/machines/{self.test_machine_id}")
            if response and response.status_code == 200:
                print("✅ Test machine deleted")
            else:
                print("❌ Failed to delete test machine")

    def run_all_tests(self):
        """Run all API tests"""
        print("=== MACHINERY INSPECTION API TESTS ===")
        print(f"Base URL: {BASE_URL}")
        print(f"Test Email: {TEST_EMAIL}")
        print()
        
        # Authentication tests
        print("=== AUTHENTICATION TESTS ===")
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_me()
        
        # Machine tests
        print("=== MACHINE TESTS ===")
        self.test_machines_create()
        self.test_machines_list()
        self.test_machines_get()
        self.test_machines_qr()
        self.test_machines_update()
        
        # Template tests
        print("=== TEMPLATE TESTS ===")
        self.test_templates_create()
        self.test_templates_list()
        self.test_templates_get()
        
        # Inspection tests
        print("=== INSPECTION TESTS ===")
        self.test_inspections_create()
        self.test_inspections_list()
        self.test_inspections_get()
        self.test_machine_inspections()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        print("\n=== TEST SUMMARY ===")
        passed = sum(1 for r in self.results if "✅" in r["status"])
        failed = sum(1 for r in self.results if "❌" in r["status"])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)