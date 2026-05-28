import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.state import system_status_cache

client = TestClient(app)

def test_create_network_clears_cache():
    # Prepara o cache para o host
    cache_key = "1.2.3.4_root"
    system_status_cache[cache_key] = ({"system_status": {}}, 9999999999)
    
    payload = {
        "host": "1.2.3.4",
        "username": "root",
        "password": "password123",
        "network_name": "network_swarm_public"
    }
    
    with patch("app.routes.installer.infra.check_network_exists", return_value=False), \
         patch("app.routes.installer.infra.run_create_network_task") as mock_task:
        
        response = client.post("/create-network", json=payload)
        assert response.status_code == 200

    # Fora do bloco de patch do run_create_network_task
    from app.routes.installer.infra import run_create_network_task
    with patch("app.installer.create_network") as mock_create_network:
        mock_create_network.return_value = {"status": "success", "message": "Rede criada"}
        run_create_network_task("1.2.3.4", "root", "password123", "network_swarm_public")
        
        # O cache para 1.2.3.4 deve ter sido limpo
        assert cache_key not in system_status_cache

