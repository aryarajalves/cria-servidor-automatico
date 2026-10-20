# Log de Alterações de Esquema do Banco de Dados (DATABASE_SCHEMA_LOG.md)

Este arquivo registra todas as migrações e modificações estruturais nas tabelas do banco de dados (PostgreSQL/SQLite).

---

### [2026-08-18] Adição da Coluna `port` na Tabela `servers`

- **Tabelas Afetadas**:
  - `servers` (Coluna Adicionada)
    - `port`: `INTEGER DEFAULT 22` (Porta do serviço SSH do servidor)
- **Script de Migração**: `backend/scripts/add_ssh_port_column.py`
- **Motivação**: Permitir a configuração e alteração de portas SSH customizadas em servidores VPS.

---

### [2026-08-18] Criação da Tabela `ssh_keys` e Suporte a Autenticação por Chave SSH em `servers`

- **Tabelas Afetadas**:
  - `ssh_keys` (Nova Tabela)
    - `id`: `SERIAL PRIMARY KEY`
    - `name`: `VARCHAR(255) NOT NULL` (Nome descritivo da chave)
    - `private_key`: `TEXT NOT NULL` (Conteúdo da chave privada)
    - `passphrase`: `VARCHAR(255)` (Senha de proteção da chave, se houver)
    - `public_key`: `TEXT` (Chave pública OpenSSH correspondente)
    - `key_type`: `VARCHAR(50) DEFAULT 'RSA'` (Tipo: RSA, ED25519, ECDSA)
    - `created_at`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - `servers` (Colunas Adicionadas)
    - `auth_type`: `VARCHAR(50) DEFAULT 'password'` ('password' ou 'key')
    - `key_id`: `INTEGER REFERENCES ssh_keys(id) ON DELETE SET NULL`
- **Script de Migração**: `backend/scripts/add_ssh_keys_table.py`
- **Motivação**: Permitir o gerenciamento seguro de chaves SSH privadas e conexão a servidores VPS via chave privada ou senha.
