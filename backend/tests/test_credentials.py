import unittest
import os
from app.database import init_db, save_stack_credentials, get_all_stack_credentials, get_stack_credentials

class TestCredentials(unittest.TestCase):
    # setup_test_db no conftest.py já inicializa e limpa o banco de dados antes de cada teste


    def test_save_and_get_credentials(self):
        host = "1.2.3.4"
        stack = "test_stack"
        user = "admin@test.com"
        password = "password123"
        
        # Salva
        save_stack_credentials(host, stack, user, password)
        
        # Busca individual
        creds = get_stack_credentials(host, stack)
        self.assertIsNotNone(creds)
        self.assertEqual(creds["user"], user)
        self.assertEqual(creds["password"], password)
        
        # Busca todos por host
        all_creds = get_all_stack_credentials(host)
        self.assertIn(stack, all_creds)
        self.assertEqual(all_creds[stack]["user"], user)

    def test_overwrite_credentials(self):
        host = "1.2.3.4"
        stack = "overwrite_stack"
        
        save_stack_credentials(host, stack, "user1", "pass1")
        save_stack_credentials(host, stack, "user2", "pass2")
        
        creds = get_stack_credentials(host, stack)
        self.assertEqual(creds["user"], "user2")
        self.assertEqual(creds["password"], "pass2")

    def test_multiple_stacks_on_host(self):
        host = "1.2.3.4"
        save_stack_credentials(host, "stack1", "u1", "p1")
        save_stack_credentials(host, "stack2", "u2", "p2")
        
        all_creds = get_all_stack_credentials(host)
        self.assertEqual(len(all_creds), 2)
        self.assertEqual(all_creds["stack1"]["user"], "u1")
        self.assertEqual(all_creds["stack2"]["user"], "u2")

    def test_save_stack_credentials_via_helper(self):
        # Este teste simula o que o endpoint faz
        host = "1.2.3.4"
        save_stack_credentials(host, "manual_stack", "manual@user.com", "manual_pass")
        creds = get_stack_credentials(host, "manual_stack")
        self.assertEqual(creds["user"], "manual@user.com")
        self.assertEqual(creds["password"], "manual_pass")

if __name__ == "__main__":
    unittest.main()
