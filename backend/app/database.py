import psycopg2
import os

DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "autoserver")
if "PYTEST_CURRENT_TEST" in os.environ or os.getenv("TESTING") == "true":
    DB_NAME = os.getenv("DB_TEST_NAME", "autoserver_test")
DB_USER = os.getenv("DB_USER", "autoserver_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "autoserver_password")

import time

def get_connection():
    retries = 10
    while retries > 0:
        try:
            return psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                connect_timeout=5
            )
        except psycopg2.OperationalError as e:
            retries -= 1
            if retries == 0:
                raise e
            time.sleep(2)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tabela de configurações globais e por host
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            server_host VARCHAR(255) DEFAULT 'global',
            key VARCHAR(255),
            value TEXT,
            PRIMARY KEY (server_host, key)
        )
    ''')
    
    # Tabela de servidores
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS servers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            host VARCHAR(255),
            username VARCHAR(255),
            password VARCHAR(255)
        )
    ''')
    
    # Tabela de nós do cluster
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cluster_nodes (
            id SERIAL PRIMARY KEY,
            parent_host VARCHAR(255),
            node_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
            role VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(parent_host, node_id)
        )
    ''')
    
    # Credenciais de Stacks
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stack_credentials (
            id SERIAL PRIMARY KEY,
            server_host VARCHAR(255),
            stack_name VARCHAR(255),
            admin_email VARCHAR(255),
            admin_password VARCHAR(255),
            UNIQUE(server_host, stack_name)
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()

def save_setting(key, value, server_host='global'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO settings (server_host, key, value) VALUES (%s, %s, %s)
        ON CONFLICT (server_host, key) DO UPDATE SET value = EXCLUDED.value
    ''', (server_host, key, value))
    conn.commit()
    cursor.close()
    conn.close()

def get_setting(key, server_host='global'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = %s AND server_host = %s', (key, server_host))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row else None

def get_all_settings(server_host='global'):
    conn = get_connection()
    cursor = conn.cursor()
    
    settings = {}
    # Sempre buscamos as globais primeiro
    cursor.execute("SELECT key, value FROM settings WHERE server_host = 'global'")
    rows = cursor.fetchall()
    settings.update({key: value for key, value in rows})
    
    # Se for um host específico, buscamos e sobrepomos
    if server_host != 'global':
        cursor.execute('SELECT key, value FROM settings WHERE server_host = %s', (server_host,))
        rows = cursor.fetchall()
        settings.update({key: value for key, value in rows})
        
    cursor.close()
    conn.close()
    return settings

# Server Management Functions
def add_server(name, host, username, password):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO servers (name, host, username, password) VALUES (%s, %s, %s, %s) RETURNING id',
        (name, host, username, password)
    )
    server_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return server_id

def get_servers():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, host, username, password FROM servers')
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "host": r[2], "username": r[3], "password": r[4]}
        for r in rows
    ]

def delete_server(server_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM servers WHERE id = %s', (server_id,))
    conn.commit()
    cursor.close()
    conn.close()

def update_server(server_id, name=None, host=None, username=None, password=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if host is not None:
        updates.append("host = %s")
        params.append(host)
    if username is not None:
        updates.append("username = %s")
        params.append(username)
    if password is not None:
        updates.append("password = %s")
        params.append(password)
        
    if not updates:
        cursor.close()
        conn.close()
        return
        
    params.append(server_id)
    query = f"UPDATE servers SET {', '.join(updates)} WHERE id = %s"
    cursor.execute(query, tuple(params))
    conn.commit()
    cursor.close()
    conn.close()

def get_server_by_id(server_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, host, username, password FROM servers WHERE id = %s', (server_id,))
    r = cursor.fetchone()
    cursor.close()
    conn.close()
    if r:
        return {"id": r[0], "name": r[1], "host": r[2], "username": r[3], "password": r[4]}
    return None

# Stack Credentials Functions
def save_stack_credentials(server_host, stack_name, admin_email, admin_password):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO stack_credentials (server_host, stack_name, admin_email, admin_password)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (server_host, stack_name) DO UPDATE 
        SET admin_email = EXCLUDED.admin_email, admin_password = EXCLUDED.admin_password
    ''', (server_host, stack_name, admin_email, admin_password))
    conn.commit()
    cursor.close()
    conn.close()

def get_stack_credentials(server_host, stack_name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT admin_email, admin_password FROM stack_credentials WHERE server_host = %s AND stack_name = %s', (server_host, stack_name))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if row:
        return {"user": row[0], "password": row[1]}
    return None

def get_all_stack_credentials(server_host):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT stack_name, admin_email, admin_password FROM stack_credentials WHERE server_host = %s', (server_host,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {r[0]: {"user": r[1], "password": r[2]} for r in rows}

def delete_stack_credentials(server_host, stack_name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM stack_credentials WHERE server_host = %s AND stack_name = %s', (server_host, stack_name))
    conn.commit()
    cursor.close()
    conn.close()

def get_next_install_id(server_host, stack_id):
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cluster_nodes (parent_host, node_id, role)
        VALUES (%s, %s, %s)
        ON CONFLICT (parent_host, node_id) DO UPDATE SET role = EXCLUDED.role
    ''', (parent_host, node_id, role))
    conn.commit()
    cursor.close()
    conn.close()

def get_cluster_nodes(parent_host):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cn.id, cn.parent_host, cn.node_id, cn.role, cn.created_at,
               s.name, s.host, s.username
        FROM cluster_nodes cn
        JOIN servers s ON cn.node_id = s.id
        WHERE cn.parent_host = %s
    ''', (parent_host,))
    rows = cursor.fetchall()
    cursor.close()
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cluster_nodes WHERE parent_host = %s AND node_id = %s', (parent_host, node_id))
    conn.commit()
    cursor.close()
    conn.close()

def get_cluster_node_by_id(parent_host, node_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cn.id, cn.parent_host, cn.node_id, cn.role, cn.created_at,
               s.name, s.host, s.username, s.password
        FROM cluster_nodes cn
        JOIN servers s ON cn.node_id = s.id
        WHERE cn.parent_host = %s AND cn.node_id = %s
    ''', (parent_host, node_id))
    r = cursor.fetchone()
    cursor.close()
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
