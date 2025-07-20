#!/usr/bin/env python3
"""
PixelCrafter Backend API Test Suite
Tests all backend endpoints for the PixelCrafter application
"""

import requests
import json
import base64
import io
from PIL import Image
import time
import uuid

# Configuration
BACKEND_URL = "https://590238ec-1b21-4478-8e02-6636b73f2f13.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test data
TEST_USER_DATA = {
    "username": "sarah_designer",
    "email": "sarah.designer@pixelcraft.com", 
    "password": "SecureDesign2024!"
}

TEST_USER_LOGIN = {
    "email": "sarah.designer@pixelcraft.com",
    "password": "SecureDesign2024!"
}

TEST_PROJECT_DATA = {
    "name": "Digital Art Portfolio Cover",
    "width": 1920,
    "height": 1080,
    "background_color": "#2a2a2a"
}

# Global variables for test state
auth_token = None
user_id = None
project_id = None

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def create_test_image():
    """Create a simple test image for upload testing"""
    img = Image.new('RGB', (200, 200), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes

def test_health_endpoint():
    """Test the health check endpoint"""
    print("🔍 Testing Health Endpoint...")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        success = response.status_code == 200
        
        if success:
            data = response.json()
            expected_keys = ["status", "service"]
            has_expected_keys = all(key in data for key in expected_keys)
            success = has_expected_keys and data.get("status") == "healthy"
            details = f"Status: {data.get('status')}, Service: {data.get('service')}"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Health endpoint", success, details)
        return success
        
    except Exception as e:
        print_test_result("Health endpoint", False, f"Exception: {str(e)}")
        return False

def test_user_registration():
    """Test user registration endpoint"""
    print("🔍 Testing User Registration...")
    global auth_token, user_id
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/register",
            json=TEST_USER_DATA,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            required_keys = ["access_token", "token_type", "user"]
            has_required_keys = all(key in data for key in required_keys)
            
            if has_required_keys:
                auth_token = data["access_token"]
                user_id = data["user"]["id"]
                user_data = data["user"]
                details = f"User created: {user_data['username']} ({user_data['email']})"
            else:
                success = False
                details = f"Missing required keys in response: {list(data.keys())}"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("User registration", success, details)
        return success
        
    except Exception as e:
        print_test_result("User registration", False, f"Exception: {str(e)}")
        return False

def test_user_login():
    """Test user login endpoint"""
    print("🔍 Testing User Login...")
    global auth_token, user_id
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json=TEST_USER_LOGIN,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            required_keys = ["access_token", "token_type", "user"]
            has_required_keys = all(key in data for key in required_keys)
            
            if has_required_keys:
                auth_token = data["access_token"]
                user_id = data["user"]["id"]
                details = f"Login successful for: {data['user']['username']}"
            else:
                success = False
                details = f"Missing required keys in response: {list(data.keys())}"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("User login", success, details)
        return success
        
    except Exception as e:
        print_test_result("User login", False, f"Exception: {str(e)}")
        return False

def test_get_current_user():
    """Test getting current user info with JWT token"""
    print("🔍 Testing Get Current User...")
    
    if not auth_token:
        print_test_result("Get current user", False, "No auth token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{API_BASE}/auth/me",
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            required_keys = ["id", "username", "email", "created_at"]
            has_required_keys = all(key in data for key in required_keys)
            
            if has_required_keys:
                details = f"User info retrieved: {data['username']} ({data['email']})"
            else:
                success = False
                details = f"Missing required keys in response: {list(data.keys())}"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Get current user", success, details)
        return success
        
    except Exception as e:
        print_test_result("Get current user", False, f"Exception: {str(e)}")
        return False

def test_create_project():
    """Test creating a new project"""
    print("🔍 Testing Create Project...")
    global project_id
    
    if not auth_token:
        print_test_result("Create project", False, "No auth token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{API_BASE}/projects",
            json=TEST_PROJECT_DATA,
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            required_keys = ["id", "name", "width", "height", "owner_id", "created_at"]
            has_required_keys = all(key in data for key in required_keys)
            
            if has_required_keys:
                project_id = data["id"]
                details = f"Project created: {data['name']} ({data['width']}x{data['height']})"
            else:
                success = False
                details = f"Missing required keys in response: {list(data.keys())}"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Create project", success, details)
        return success
        
    except Exception as e:
        print_test_result("Create project", False, f"Exception: {str(e)}")
        return False

def test_get_projects():
    """Test getting user's projects"""
    print("🔍 Testing Get Projects...")
    
    if not auth_token:
        print_test_result("Get projects", False, "No auth token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{API_BASE}/projects",
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            if isinstance(data, list):
                details = f"Retrieved {len(data)} projects"
                if len(data) > 0:
                    project_names = [p.get('name', 'Unknown') for p in data]
                    details += f": {', '.join(project_names)}"
            else:
                success = False
                details = "Response is not a list"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Get projects", success, details)
        return success
        
    except Exception as e:
        print_test_result("Get projects", False, f"Exception: {str(e)}")
        return False

def test_get_single_project():
    """Test getting a specific project"""
    print("🔍 Testing Get Single Project...")
    
    if not auth_token or not project_id:
        print_test_result("Get single project", False, "No auth token or project ID available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{API_BASE}/projects/{project_id}",
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            required_keys = ["id", "name", "width", "height", "owner_id"]
            has_required_keys = all(key in data for key in required_keys)
            
            if has_required_keys and data["id"] == project_id:
                details = f"Project retrieved: {data['name']}"
            else:
                success = False
                details = "Project data validation failed"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Get single project", success, details)
        return success
        
    except Exception as e:
        print_test_result("Get single project", False, f"Exception: {str(e)}")
        return False

def test_update_project():
    """Test updating a project"""
    print("🔍 Testing Update Project...")
    
    if not auth_token or not project_id:
        print_test_result("Update project", False, "No auth token or project ID available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        update_data = {
            "name": "Updated Digital Art Portfolio Cover",
            "background_color": "#1a1a1a"
        }
        
        response = requests.put(
            f"{API_BASE}/projects/{project_id}",
            json=update_data,
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            if data.get("name") == update_data["name"]:
                details = f"Project updated: {data['name']}"
            else:
                success = False
                details = "Project update validation failed"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Update project", success, details)
        return success
        
    except Exception as e:
        print_test_result("Update project", False, f"Exception: {str(e)}")
        return False

def test_image_upload():
    """Test image upload to project"""
    print("🔍 Testing Image Upload...")
    
    if not auth_token or not project_id:
        print_test_result("Image upload", False, "No auth token or project ID available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create test image
        test_image = create_test_image()
        files = {
            'file': ('test_image.png', test_image, 'image/png')
        }
        
        response = requests.post(
            f"{API_BASE}/projects/{project_id}/upload-image",
            files=files,
            headers=headers,
            timeout=15
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            if "layer" in data and "message" in data:
                layer = data["layer"]
                details = f"Image uploaded as layer: {layer.get('name', 'Unknown')}"
            else:
                success = False
                details = "Invalid response format"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Image upload", success, details)
        return success
        
    except Exception as e:
        print_test_result("Image upload", False, f"Exception: {str(e)}")
        return False

def test_ai_chat():
    """Test AI chat integration (expecting configuration error)"""
    print("🔍 Testing AI Chat Integration...")
    
    try:
        chat_data = {
            "message": "What are some good color combinations for a modern website design?",
            "session_id": str(uuid.uuid4())
        }
        
        response = requests.post(
            f"{API_BASE}/chat",
            json=chat_data,
            timeout=15
        )
        
        # We expect either a successful response (if GEMINI_API_KEY is set) 
        # or a 503 error (if not configured)
        if response.status_code == 200:
            data = response.json()
            if "response" in data and "session_id" in data:
                details = "AI chat working (API key configured)"
                success = True
            else:
                details = "Invalid response format"
                success = False
        elif response.status_code == 503:
            # Expected when GEMINI_API_KEY is not configured
            details = "AI chat properly handles missing API key configuration"
            success = True
        else:
            details = f"Unexpected HTTP {response.status_code}: {response.text}"
            success = False
            
        print_test_result("AI chat integration", success, details)
        return success
        
    except Exception as e:
        print_test_result("AI chat integration", False, f"Exception: {str(e)}")
        return False

def test_invalid_authentication():
    """Test authentication with invalid credentials"""
    print("🔍 Testing Invalid Authentication...")
    
    try:
        invalid_login = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(
            f"{API_BASE}/auth/login",
            json=invalid_login,
            timeout=10
        )
        
        # Should return 401 for invalid credentials
        success = response.status_code == 401
        
        if success:
            details = "Properly rejects invalid credentials"
        else:
            details = f"Unexpected HTTP {response.status_code}: {response.text}"
            
        print_test_result("Invalid authentication", success, details)
        return success
        
    except Exception as e:
        print_test_result("Invalid authentication", False, f"Exception: {str(e)}")
        return False

def test_unauthorized_access():
    """Test accessing protected endpoints without authentication"""
    print("🔍 Testing Unauthorized Access...")
    
    try:
        # Try to access projects without auth token
        response = requests.get(f"{API_BASE}/projects", timeout=10)
        
        # Should return 403 or 401 for unauthorized access
        success = response.status_code in [401, 403]
        
        if success:
            details = f"Properly blocks unauthorized access (HTTP {response.status_code})"
        else:
            details = f"Unexpected HTTP {response.status_code}: {response.text}"
            
        print_test_result("Unauthorized access", success, details)
        return success
        
    except Exception as e:
        print_test_result("Unauthorized access", False, f"Exception: {str(e)}")
        return False

def test_delete_project():
    """Test deleting a project"""
    print("🔍 Testing Delete Project...")
    
    if not auth_token or not project_id:
        print_test_result("Delete project", False, "No auth token or project ID available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.delete(
            f"{API_BASE}/projects/{project_id}",
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        if success:
            data = response.json()
            if "message" in data:
                details = data["message"]
            else:
                details = "Project deleted successfully"
        else:
            details = f"HTTP {response.status_code}: {response.text}"
            
        print_test_result("Delete project", success, details)
        return success
        
    except Exception as e:
        print_test_result("Delete project", False, f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting PixelCrafter Backend API Tests")
    print("=" * 50)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 50)
    print()
    
    test_results = {}
    
    # Core functionality tests
    test_results["health"] = test_health_endpoint()
    test_results["register"] = test_user_registration()
    test_results["login"] = test_user_login()
    test_results["get_user"] = test_get_current_user()
    test_results["create_project"] = test_create_project()
    test_results["get_projects"] = test_get_projects()
    test_results["get_single_project"] = test_get_single_project()
    test_results["update_project"] = test_update_project()
    test_results["image_upload"] = test_image_upload()
    test_results["ai_chat"] = test_ai_chat()
    
    # Security tests
    test_results["invalid_auth"] = test_invalid_authentication()
    test_results["unauthorized"] = test_unauthorized_access()
    
    # Cleanup
    test_results["delete_project"] = test_delete_project()
    
    # Summary
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print()
    print(f"Overall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend API is working correctly.")
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please check the details above.")
    
    return test_results

if __name__ == "__main__":
    run_all_tests()