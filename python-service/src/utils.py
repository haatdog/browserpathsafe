# src/utils.py — Shared utilities for all route blueprints
import os
import bcrypt
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import session, jsonify
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'dbname':   os.getenv('DB_NAME'),
    'user':     os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host':     os.getenv('DB_HOST'),
    'port':     os.getenv('DB_PORT', '5432'),
}


def get_db():
    return psycopg2.connect(**DB_CONFIG)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_user_id() -> str:
    return secrets.token_urlsafe(16)


def require_auth():
    """Return a 401 response if the session has no user_id, else None."""
    if not session.get('user_id'):
        return jsonify({"error": "Not authenticated"}), 401
    return None


def get_current_role(user_id: str) -> str | None:
    """Look up the role for user_id. Returns None if not found."""
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row['role'] if row else None