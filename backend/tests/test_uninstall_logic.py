import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Adiciona o diretório backend ao path para importar app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import uninstall_stack
from app.database import init_db, save_stack_credentials, get_stack_credentials

class TestUninstallLogic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.database import get_db_path
        db_path = get_db_path()
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except:
                pass
        init_db()

    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.delete_postgres_database')
    @patch('app.services.web_apps.time.sleep')
    def test_uninstall_stack_removes_credentials(self, mock_sleep, mock_del_pg, mock_run, mock_get_ssh):
        # Mock SSH Client
        mock_client = MagicMock()
        mock_get_ssh.return_value = mock_client
        mock_run.return_value = "Success"
        
        host = "1.2.3.4"
        stack_id = "redis"
        stack_name = "redis"
        
        # 1. Save dummy credentials
        save_stack_credentials(host, stack_name, "user", "pass")
        self.assertIsNotNone(get_stack_credentials(host, stack_name))
        
        # 2. Run uninstall
        result = uninstall_stack(host, "root", "pass", stack_id, stack_name)
        
        # 3. Verify
        self.assertEqual(result["status"], "success")
        self.assertIsNone(get_stack_credentials(host, stack_name))
        
        # Verify SSH commands
        calls = [c.args[1] for c in mock_run.call_args_list]
        self.assertIn(f"docker stack rm {stack_name}", calls)
        self.assertIn(f"docker volume rm redis_data", calls)

if __name__ == '__main__':
    unittest.main()
