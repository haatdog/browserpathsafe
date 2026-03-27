# src/utils.py — Shared utilities for all route blueprints
import os
import bcrypt
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import session, jsonify, request
from dotenv import load_dotenv

load_dotenv()


def get_db():
    # On Render: DATABASE_URL is set in the Environment Variables tab
    # Locally:   falls back to individual DB_* variables from .env
    database_url = os.getenv('DATABASE_URL')

    if database_url:
        # Render provides postgres:// but psycopg2 requires postgresql://
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        return psycopg2.connect(database_url)

    # Local development fallback — reads from .env
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=os.getenv('DB_PORT', '5432'),
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_user_id() -> str:
    return secrets.token_urlsafe(16)

def get_user_id() -> str | None:
    """
    Get current user ID from session OR JWT Bearer token.
    Call this instead of session.get('user_id') in every route.
    Works for both local (session cookie) and production (JWT token).
    """
    # Check session first (local dev)
    uid = session.get('user_id')
    if uid:
        return uid

    # Check JWT Bearer token (production)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        try:
            import jwt as pyjwt
            payload = pyjwt.decode(
                auth_header[7:],
                os.getenv('SECRET_KEY', 'dev-secret'),
                algorithms=['HS256']
            )
            return payload.get('user_id')
        except Exception:
            pass
    return None


def require_auth():
    """Check session cookie OR Authorization: Bearer token. Returns 401 or None."""
    # 1. Check session cookie (local dev)
    if get_user_id():
        return None

    # 2. Check Authorization: Bearer <token> (production cross-domain)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        try:
            import jwt as pyjwt, os
            from datetime import timezone
            payload = pyjwt.decode(
                token,
                os.getenv('SECRET_KEY', 'dev-secret'),
                algorithms=['HS256']
            )
            # Inject into session so route handlers can use session['user_id']
            session['user_id'] = payload['user_id']
            session['email']   = payload.get('email', '')
            session['role']    = payload.get('role', 'member')
            return None
        except Exception:
            pass

    return jsonify({"error": "Not authenticated"}), 401

def get_current_role(user_id: str) -> str | None:
    """Look up the role for user_id. Returns None if not found."""
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row['role'] if row else None