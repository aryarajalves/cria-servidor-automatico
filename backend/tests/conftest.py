import os
os.environ["TESTING"] = "true"
os.environ["DB_NAME"] = "autoserver_test"

import pytest
from app.database import init_db, get_connection, get_db_name
from app.auth_middleware import create_access_token, verify_jwt, TokenData
from app.main import app

@pytest.fixture(autouse=True, scope="function")
def setup_test_db():
    # Garante que está rodando estritamente no banco de testes isolado
    assert get_db_name() == "autoserver_test", f"ALERTA CRÍTICO: Testes estavam prestes a rodar no banco {get_db_name()} em vez de autoserver_test!"
    # Inicializa o schema no banco de testes
    init_db()
    # Limpa apenas as tabelas do banco autoserver_test
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("TRUNCATE TABLE cluster_nodes, stack_credentials, servers, settings, ssh_keys CASCADE;")
    conn.commit()
    cursor.close()
    conn.close()
    yield

@pytest.fixture
def auth_headers():
    os.environ["ADMIN_EMAIL"] = "admin@admin.com"
    token = create_access_token(data={"sub": "admin@admin.com"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def bypass_auth():
    app.dependency_overrides[verify_jwt] = lambda: TokenData(email="admin@admin.com")
    yield
    app.dependency_overrides.clear()
