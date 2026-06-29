import pytest
import os
from app.database import init_db
from app.auth_middleware import create_access_token, verify_jwt, TokenData
from app.main import app

@pytest.fixture(autouse=True, scope="function")
def setup_test_db():
    # Inicializa o banco de dados de testes para garantir que todas as tabelas existam
    init_db()
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
