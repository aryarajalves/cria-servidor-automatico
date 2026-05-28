import pytest
import os
from app.database import init_db

@pytest.fixture(autouse=True, scope="function")
def setup_test_db():
    # Inicializa o banco de dados de testes para garantir que todas as tabelas existam
    init_db()
    yield
