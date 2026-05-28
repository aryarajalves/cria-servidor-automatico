import sqlite3
import os

DB_NAME = "settings.db"

def get_db_path():
    db_name = "test_settings.db" if "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "true" else DB_NAME
    # Prioritizes /app/data if running in Docker
    data_dir = "/app/data"
    if not os.path.exists(data_dir):
        # Fallback for local development outside Docker
        base_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "data"))
        
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
        
    return os.path.join(data_dir, db_name)

def init_db():
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    
    # Tabela de configurações globais e por host
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            server_host TEXT DEFAULT 'global',
            key TEXT,
            value TEXT,
            PRIMARY KEY (server_host, key)
        )
    ''')
    
    # Tabela de servidores
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            host TEXT,
            username TEXT,
            password TEXT
        )
    ''')
    
    # Tabela de nós do cluster
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cluster_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_host TEXT,
            node_id INTEGER,
            role TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(node_id) REFERENCES servers(id) ON DELETE CASCADE,
            UNIQUE(parent_host, node_id)
        )
    ''')
    
    # NOVA TABELA: Credenciais de Stacks
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stack_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_host TEXT,
            stack_name TEXT,
            admin_email TEXT,
            admin_password TEXT,
            UNIQUE(server_host, stack_name)
        )
    ''')
    
    # Migração simples se a tabela antiga existir sem server_host
    try:
        cursor.execute('ALTER TABLE settings ADD COLUMN server_host TEXT DEFAULT "global"')
    except:
        pass
        
    conn.commit()
    conn.close()

def save_setting(key, value, server_host='global'):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO settings (server_host, key, value) VALUES (?, ?, ?)', (server_host, key, value))
    conn.commit()
    conn.close()

def get_setting(key, server_host='global'):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ? AND server_host = ?', (key, server_host))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

def get_all_settings(server_host='global'):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    
    settings = {}
    # Sempre buscamos as globais primeiro
    cursor.execute('SELECT key, value FROM settings WHERE server_host = "global"')
    rows = cursor.fetchall()
    settings.update({key: value for key, value in rows})
    
    # Se for um host específico, buscamos e sobrepomos
    if server_host != 'global':
        cursor.execute('SELECT key, value FROM settings WHERE server_host = ?', (server_host,))
        rows = cursor.fetchall()
        settings.update({key: value for key, value in rows})
        
    conn.close()
    return settings

# Server Management Functions
def add_server(name, host, username, password):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO servers (name, host, username, password) VALUES (?, ?, ?, ?)',
        (name, host, username, password)
    )
    conn.commit()
    server_id = cursor.lastrowid
    conn.close()
    return server_id

def get_servers():
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, host, username, password FROM servers')
    rows = cursor.fetchall()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "host": r[2], "username": r[3], "password": r[4]}
        for r in rows
    ]

def delete_server(server_id):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM servers WHERE id = ?', (server_id,))
    conn.commit()
    conn.close()

def update_server(server_id, name=None, host=None, username=None, password=None):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if host is not None:
        updates.append("host = ?")
        params.append(host)
    if username is not None:
        updates.append("username = ?")
        params.append(username)
    if password is not None:
        updates.append("password = ?")
        params.append(password)
        
    if not updates:
        conn.close()
        return
        
    params.append(server_id)
    query = f"UPDATE servers SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

def get_server_by_id(server_id):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, host, username, password FROM servers WHERE id = ?', (server_id,))
    r = cursor.fetchone()
    conn.close()
    if r:
        return {"id": r[0], "name": r[1], "host": r[2], "username": r[3], "password": r[4]}
    return None

# Stack Credentials Functions
def save_stack_credentials(server_host, stack_name, admin_email, admin_password):
    print(f"DEBUG DB: Salvando credenciais para {stack_name} no host {server_host}: {admin_email} / [OCULTADO]", flush=True)
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO stack_credentials (server_host, stack_name, admin_email, admin_password)
        VALUES (?, ?, ?, ?)
    ''', (server_host, stack_name, admin_email, admin_password))
    conn.commit()
    conn.close()

def get_stack_credentials(server_host, stack_name):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('SELECT admin_email, admin_password FROM stack_credentials WHERE server_host = ? AND stack_name = ?', (server_host, stack_name))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"user": row[0], "password": row[1]}
    return None

def get_all_stack_credentials(server_host):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('SELECT stack_name, admin_email, admin_password FROM stack_credentials WHERE server_host = ?', (server_host,))
    rows = cursor.fetchall()
    conn.close()
    return {r[0]: {"user": r[1], "password": r[2]} for r in rows}

def delete_stack_credentials(server_host, stack_name):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM stack_credentials WHERE server_host = ? AND stack_name = ?', (server_host, stack_name))
    conn.commit()
    conn.close()

def get_next_install_id(server_host, stack_id):
    """
    Retorna o próximo ID sequencial (01, 02...) para uma stack em um host específico.
    """
    key = f"last_install_id_{stack_id}"
    current = get_setting(key, server_host)
    if current:
        next_id = int(current) + 1
    else:
        next_id = 1
    
    save_setting(key, str(next_id), server_host)
    return f"{next_id:02d}"

# Cluster Swarm Functions
def add_cluster_node(parent_host, node_id, role):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO cluster_nodes (parent_host, node_id, role)
        VALUES (?, ?, ?)
    ''', (parent_host, node_id, role))
    conn.commit()
    conn.close()

def get_cluster_nodes(parent_host):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cn.id, cn.parent_host, cn.node_id, cn.role, cn.created_at,
               s.name, s.host, s.username
        FROM cluster_nodes cn
        JOIN servers s ON cn.node_id = s.id
        WHERE cn.parent_host = ?
    ''', (parent_host,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "parent_host": r[1],
            "node_id": r[2],
            "role": r[3],
            "created_at": r[4],
            "name": r[5],
            "host": r[6],
            "username": r[7]
        }
        for r in rows
    ]

def remove_cluster_node(parent_host, node_id):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cluster_nodes WHERE parent_host = ? AND node_id = ?', (parent_host, node_id))
    conn.commit()
    conn.close()

def get_cluster_node_by_id(parent_host, node_id):
    conn = sqlite3.connect(get_db_path(), timeout=20)
    conn.execute('PRAGMA journal_mode=WAL')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cn.id, cn.parent_host, cn.node_id, cn.role, cn.created_at,
               s.name, s.host, s.username, s.password
        FROM cluster_nodes cn
        JOIN servers s ON cn.node_id = s.id
        WHERE cn.parent_host = ? AND cn.node_id = ?
    ''', (parent_host, node_id))
    r = cursor.fetchone()
    conn.close()
    if r:
        return {
            "id": r[0],
            "parent_host": r[1],
            "node_id": r[2],
            "role": r[3],
            "created_at": r[4],
            "name": r[5],
            "host": r[6],
            "username": r[7],
            "password": r[8]
        }
    return None
