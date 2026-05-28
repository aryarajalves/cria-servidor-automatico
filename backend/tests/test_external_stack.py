import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_setting, get_stack_credentials

class TestExternalStack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_mark_and_unmark_external_stack(self):
        client = TestClient(app)
        
        host = "external-test-host"
        stack_id = "zapvoice"
        stack_name = "zapvoice"
        url = "zapvoice.external.com"
        email = "admin@zapvoice.com"
        password = "secretpassword"
        
        # 1. Post request to mark stack as external
        response = client.post("/mark-external-stack", json={
            "host": host,
            "username": "root",
            "password": "sshpassword",
            "stack_name": stack_name,
            "url": url,
            "email": email,
            "password": password,
            "version": "2.1.0"
        })
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")
        
        # Verify db records
        self.assertEqual(get_setting(f"external_installed_{stack_name}", host), "true")
        self.assertEqual(get_setting(f"external_urls_{stack_name}", host), url)
        self.assertEqual(get_setting(f"external_version_{stack_name}", host), "2.1.0")
        self.assertEqual(get_stack_credentials(host, stack_name), {"user": email, "password": password})
        
        # 2. Post request to system status (mock SSH response first)
        with patch('app.installer.get_full_system_status') as mock_status:
            mock_status.return_value = {
                "docker": "Docker version 20.10.7",
                "swarm": True,
                "network": True,
                "ctop": True,
                "active_stacks": [],
                "stack_urls": {},
                "stack_credentials": {},
                "stack_versions": {}
            }
            
            status_resp = client.post("/system-status", json={
                "host": host,
                "username": "root",
                "password": "sshpassword"
            })
            
            self.assertEqual(status_resp.status_code, 200)
            data = status_resp.json()
            
            # Zapvoice should be injected in detected_stacks, stack_urls, credentials and versions
            self.assertIn(stack_name, data["detected_stacks"])
            self.assertIn(url, data["stack_urls"][stack_name])
            self.assertEqual(data["stack_credentials"][stack_name], {"user": email, "password": password})
            self.assertEqual(data["stack_versions"][stack_name], "2.1.0")

        # 3. Post request to uninstall (should clear DB settings)
        response_uninstall = client.post("/uninstall-stack", json={
            "host": host,
            "username": "root",
            "password": "sshpassword",
            "stack_id": stack_id,
            "stack_name": stack_name
        })
        
        self.assertEqual(response_uninstall.status_code, 200)
        self.assertEqual(get_setting(f"external_installed_{stack_name}", host), "false")
        self.assertEqual(get_setting(f"external_version_{stack_name}", host), "")
        self.assertIsNone(get_stack_credentials(host, stack_name))

if __name__ == '__main__':
    unittest.main()
