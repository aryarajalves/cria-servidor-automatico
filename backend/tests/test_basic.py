import os
import sys
import pytest

# Adiciona o diretório backend ao path para os imports funcionarem
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.installer import get_stack_path

def test_get_stack_path():
    path = get_stack_path("traefik.yml")
    assert "traefik.yml" in path
    assert os.path.isabs(path)

# Teste básico para garantir que podemos carregar o app
def test_app_import():
    from app.main import app
    assert app is not None

