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

        print("Checking and adding port column to servers table...")
        cursor.execute('''
            ALTER TABLE servers 
            ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 22;
        ''')

        # Garante que registros existentes tenham port = 22 caso estejam nulos
        cursor.execute('''
            UPDATE servers SET port = 22 WHERE port IS NULL;
        ''')

        conn.commit()
        cursor.close()
        conn.close()
        print("Migration add_ssh_port_column completed successfully!")
    except Exception as e:
        print(f"Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
