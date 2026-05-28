
import pytest
from fastapi.testclient import TestClient
import os
import sys

# Adiciona o diretório raiz ao path para importar o app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_login_success():
    os.environ["ADMIN_EMAIL"] = "test@test.com"
    os.environ["ADMIN_PASSWORD"] = "password123"
    
    response = client.post("/login", json={
        "email": "test@test.com",
        "password": "password123"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_login_fail():
    os.environ["ADMIN_EMAIL"] = "test@test.com"
    os.environ["ADMIN_PASSWORD"] = "password123"
    
    response = client.post("/login", json={
        "email": "wrong@test.com",
        "password": "wrong"
    })
    assert response.status_code == 401

def test_server_crud():
    # 1. Add server
    response = client.post("/servers", json={
        "name": "Test VPS",
        "host": "1.2.3.4",
        "username": "root",
        "password": "vps_password"
    })
    assert response.status_code == 200
    server_id = response.json()["id"]
    
    # 2. List servers
    response = client.get("/servers")
    assert response.status_code == 200
    servers = response.json()
    assert any(s["id"] == server_id for s in servers)
    
    # 3. Delete server
    response = client.delete(f"/servers/{server_id}")
    assert response.status_code == 200
    
    # 4. Verify deletion
    response = client.get("/servers")
    servers = response.json()
    assert not any(s["id"] == server_id for s in servers)

def test_update_server():
    # 1. Add server
    response = client.post("/servers", json={
        "name": "Update Test",
        "host": "1.1.1.1",
        "username": "root",
        "password": "old_password"
    })
    server_id = response.json()["id"]
    
    # 2. Update password
    response = client.put(f"/servers/{server_id}", json={
        "password": "new_password"
    })
    assert response.status_code == 200
    
    # 3. Verify update
    response = client.get("/servers")
    servers = response.json()
    server = next(s for s in servers if s["id"] == server_id)
    assert server["password"] == "new_password"
    
    # Cleanup
    client.delete(f"/servers/{server_id}")
