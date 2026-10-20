import pytest
import io
import paramiko
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.ssh_keys import parse_private_key, extract_public_key, generate_key_pair
from app.database import (
    add_ssh_key,
    get_ssh_keys,
    get_ssh_key_by_id,
    update_ssh_key,
    delete_ssh_key,
    add_server,
    get_servers,
    delete_server
)

client = TestClient(app)

@pytest.fixture
def auth_headers():
    from app.auth_middleware import create_access_token
    token = create_access_token(data={"sub": "admin@admin.com"})
    return {"Authorization": f"Bearer {token}"}

def test_generate_and_parse_rsa_key():
    key_data = generate_key_pair("Test RSA Key", key_type="RSA", bits=2048)
    assert key_data["name"] == "Test RSA Key"
    assert "BEGIN RSA PRIVATE KEY" in key_data["private_key"] or "BEGIN OPENSSH PRIVATE KEY" in key_data["private_key"]
    assert key_data["public_key"].startswith("ssh-rsa")
    assert key_data["key_type"] == "RSA-2048"

    pkey, detected_type = parse_private_key(key_data["private_key"])
    assert detected_type == "RSA"
    assert pkey.get_name() == "ssh-rsa"

def test_generate_and_parse_ed25519_key():
    key_data = generate_key_pair("Test ED25519 Key", key_type="ED25519")
    assert key_data["name"] == "Test ED25519 Key"
    assert "BEGIN OPENSSH PRIVATE KEY" in key_data["private_key"] or "BEGIN PRIVATE KEY" in key_data["private_key"]
    assert "ssh-ed25519" in key_data["public_key"]
    assert key_data["key_type"] == "ED25519"

    pkey, detected_type = parse_private_key(key_data["private_key"])
    assert detected_type == "ED25519"
    assert pkey.get_name() == "ssh-ed25519"

def test_invalid_key_parsing():
    with pytest.raises(ValueError, match="conteúdo da chave privada não pode ser vazio"):
        parse_private_key("")
        
    with pytest.raises(ValueError, match="Formato de chave privada inválido"):
        parse_private_key("CHAVE_INVALIDA_MOCK_12345")

def test_ssh_keys_crud_database():
    key_data = generate_key_pair("DB Test Key", key_type="RSA")
    
    # 1. Add
    key_id = add_ssh_key(
        name="DB Test Key",
        private_key=key_data["private_key"],
        public_key=key_data["public_key"],
        key_type=key_data["key_type"]
    )
    assert key_id is not None
    
    # 2. Get by ID
    key = get_ssh_key_by_id(key_id)
    assert key is not None
    assert key["name"] == "DB Test Key"
    assert key["key_type"] == key_data["key_type"]
    
    # 3. List
    all_keys = get_ssh_keys()
    assert any(k["id"] == key_id for k in all_keys)
    
    # 4. Update
    update_ssh_key(key_id, name="Updated DB Key")
    updated_key = get_ssh_key_by_id(key_id)
    assert updated_key["name"] == "Updated DB Key"
    
    # 5. Delete
    delete_ssh_key(key_id)
    deleted_key = get_ssh_key_by_id(key_id)
    assert deleted_key is None

def test_ssh_keys_api_endpoints(auth_headers):
    # 1. Generate Key API
    gen_resp = client.post(
        "/ssh-keys/generate",
        json={"name": "API Gen Key", "key_type": "RSA", "bits": 2048},
        headers=auth_headers
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert gen_data["status"] == "success"
    key_id = gen_data["id"]
    
    # 2. List Keys API
    list_resp = client.get("/ssh-keys", headers=auth_headers)
    assert list_resp.status_code == 200
    keys = list_resp.json()
    assert any(k["id"] == key_id for k in keys)
    
    # 3. Get Key Detail API
    detail_resp = client.get(f"/ssh-keys/{key_id}", headers=auth_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["name"] == "API Gen Key"
    
    # 4. Update Key API
    up_resp = client.put(
        f"/ssh-keys/{key_id}",
        json={"name": "API Renamed Key"},
        headers=auth_headers
    )
    assert up_resp.status_code == 200
    
    # 5. Delete Key API
    del_resp = client.delete(f"/ssh-keys/{key_id}", headers=auth_headers)
    assert del_resp.status_code == 200

def test_add_server_with_ssh_key(auth_headers):
    # Cria uma chave SSH
    key_data = generate_key_pair("Server Key Test", key_type="RSA")
    key_id = add_ssh_key(
        name="Server Key Test",
        private_key=key_data["private_key"],
        public_key=key_data["public_key"],
        key_type="RSA"
    )

    try:
        # Cadastra servidor usando a chave
        resp = client.post(
            "/servers",
            json={
                "name": "VPS Chave SSH",
                "host": "198.51.100.20",
                "username": "root",
                "auth_type": "key",
                "key_id": key_id
            },
            headers=auth_headers
        )
        assert resp.status_code == 200
        server_id = resp.json()["id"]

        # Busca servidores e confere associação
        list_resp = client.get("/servers", headers=auth_headers)
        assert list_resp.status_code == 200
        servers = list_resp.json()
        target = next((s for s in servers if s["id"] == server_id), None)
        assert target is not None
        assert target["auth_type"] == "key"
        assert target["key_id"] == key_id
        assert target["key_name"] == "Server Key Test"

        # Cleanup
        delete_server(server_id)
    finally:
        delete_ssh_key(key_id)

@patch("app.services.base_ssh.paramiko.SSHClient")
def test_verify_connection_with_key(mock_ssh, auth_headers):
    mock_instance = MagicMock()
    mock_ssh.return_value = mock_instance

    key_data = generate_key_pair("Verify Key", key_type="RSA")
    key_id = add_ssh_key(
        name="Verify Key",
        private_key=key_data["private_key"],
        public_key=key_data["public_key"],
        key_type="RSA"
    )

    try:
        resp = client.post(
            "/verify-connection",
            json={
                "host": "192.0.2.1",
                "username": "root",
                "auth_type": "key",
                "key_id": key_id
            },
            headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Conectado com sucesso!"
    finally:
        delete_ssh_key(key_id)
