import os
import psycopg2
import sys

DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "autoserver")
DB_USER = os.getenv("DB_USER", "autoserver_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "autoserver_password")

def run_migration():
    print(f"Connecting to database {DB_NAME} at {DB_HOST}:{DB_PORT}...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        cursor = conn.cursor()

        print("Creating table ssh_keys if not exists...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ssh_keys (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                private_key TEXT NOT NULL,
                passphrase VARCHAR(255),
                public_key TEXT,
                key_type VARCHAR(50) DEFAULT 'RSA',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        print("Checking and adding columns to servers table...")
        cursor.execute('''
            ALTER TABLE servers 
            ADD COLUMN IF NOT EXISTS auth_type VARCHAR(50) DEFAULT 'password';
        ''')
        
        cursor.execute('''
            ALTER TABLE servers 
            ADD COLUMN IF NOT EXISTS key_id INTEGER REFERENCES ssh_keys(id) ON DELETE SET NULL;
        ''')

        conn.commit()
        cursor.close()
        conn.close()
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
