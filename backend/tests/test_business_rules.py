import unittest
import sqlite3
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import init_db, save_setting, get_all_settings, get_db_path

class TestBusinessRules(unittest.TestCase):
    def setUp(self):
        # Garante que o banco está inicializado
        init_db()
        self.db_path = get_db_path()

    def test_cloudflare_token_is_global(self):
        """
        Regra: O Token da Cloudflare deve ser configurado globalmente para todos os servidores.
        """
        test_token = "cf_test_token_123"
        
        # Simula o comportamento do main.py (salva sempre como 'global')
        save_setting("cloudflare_token", test_token, 'global')
        
        # Verifica se um host aleatório consegue recuperar o token
        settings_host_a = get_all_settings("1.1.1.1")
        settings_host_b = get_all_settings("2.2.2.2")
        
        self.assertEqual(settings_host_a.get("cloudflare_token"), test_token)
        self.assertEqual(settings_host_b.get("cloudflare_token"), test_token)
        
    def test_save_stack_credentials(self):
        """
        Regra: Deve ser possível salvar e recuperar credenciais de uma stack.
        """
        from app.database import save_stack_credentials, get_all_stack_credentials
        
        host = "1.2.3.4"
        stack = "portainer"
        user = "admin_test"
        pwd = "password_test"
        
        save_stack_credentials(host, stack, user, pwd)
        
        creds = get_all_stack_credentials(host)
        self.assertIn(stack, creds)
        self.assertEqual(creds[stack]['user'], user)
        self.assertEqual(creds[stack]['password'], pwd)

    def test_settings_fallback_logic(self):
        """
        Verifica se configurações específicas do host sobrepõem as globais,
        mas as globais persistem se não houver sobreposição.
        """
        save_setting("global_key", "global_val", "global")
        save_setting("override_key", "original", "global")
        save_setting("override_key", "overridden", "host_x")
        
        settings = get_all_settings("host_x")
        
        self.assertEqual(settings.get("global_key"), "global_val")
        self.assertEqual(settings.get("override_key"), "overridden")

if __name__ == '__main__':
    unittest.main()
