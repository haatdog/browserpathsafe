# src/routes/auth.py
from flask import Blueprint, request, jsonify, session
import jwt as pyjwt
import os
from datetime import datetime, timedelta, timezone
from psycopg2.extras import RealDictCursor
from src.utils import get_db, hash_password, check_password, generate_user_id

def generate_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email':   email,
        'role':    role,
        'exp':     datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, os.getenv('SECRET_KEY', 'dev-secret'), algorithm='HS256')

def decode_token(token: str) -> dict | None:
    try:
        return pyjwt.decode(token, os.getenv('SECRET_KEY', 'dev-secret'), algorithms=['HS256'])
    except Exception:
        return None

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/api/auth/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return '', 200
    try:
        data     = request.json
        email    = data.get('email')
        password = data.get('password')
        role     = data.get('role', 'member')

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('SELECT id FROM auth_users WHERE email = %s', (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "Email already registered"}), 400

        user_id       = generate_user_id()
        password_hash = hash_password(password)

        cursor.execute(
            'INSERT INTO auth_users (id, email, password_hash) VALUES (%s, %s, %s)',
            (user_id, email, password_hash)
        )
        first_name = data.get('first_name', '').strip() or None
        last_name  = data.get('last_name', '').strip() or None
        group_id   = data.get('group_id') or None
        is_head    = bool(data.get('is_head', False))

        cursor.execute(
            '''INSERT INTO user_profiles (id, email, role, first_name, last_name, group_id, is_head)
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (user_id, email, role, first_name, last_name, group_id, is_head)
        )
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ User registered: {email} ({role})")
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "user": {"id": user_id, "email": email, "role": role}
        }), 201

    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return '', 200
    try:
        data     = request.json
        email    = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT au.id, au.email, au.password_hash, up.role
            FROM auth_users au
            JOIN user_profiles up ON au.id = up.id
            WHERE au.email = %s
        ''', (email,))
        user = cursor.fetchone()
        cursor.close(); conn.close()

        if not user or not check_password(password, user['password_hash']):
            return jsonify({"error": "Invalid email or password"}), 401

        session['user_id'] = user['id']
        session['email']   = user['email']
        session['role']    = user['role']
        token = generate_token(user['id'], user['email'], user['role'])

        print(f"✅ User logged in: {email}")
        return jsonify({
            "success": True,
            "user": {"id": user['id'], "email": user['email'], "role": user['role']}
        })

    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return '', 200
    try:
        session.clear()
        return jsonify({"success": True, "message": "Logged out"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/me", methods=["GET", "OPTIONS"])
def get_current_user():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.group_id, u.is_head,
                   g.name AS group_name, u.created_at, u.updated_at
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            WHERE u.id = %s
        ''', (user_id,))
        user = cursor.fetchone()
        cursor.close(); conn.close()

        if not user:
            session.clear()
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         user['id'],
            "email":      user['email'],
            "first_name": user['first_name'],
            "last_name":  user['last_name'],
            "role":       user['role'],
            "group_id":   user['group_id'],
            "group_name": user['group_name'],
            "is_head":    bool(user['is_head']) if user['is_head'] is not None else False,
            "created_at": user['created_at'].isoformat() if user['created_at'] else None,
            "updated_at": user['updated_at'].isoformat() if user['updated_at'] else None,
        })

    except Exception as e:
        print(f"❌ Error getting current user: {e}")
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/api/auth/profile", methods=["PATCH", "OPTIONS"])
def update_profile():
    if request.method == "OPTIONS":
        return '', 200
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        data       = request.json or {}
        first_name = data.get('first_name', '').strip() or None
        last_name  = data.get('last_name',  '').strip() or None

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """UPDATE user_profiles
               SET first_name = %s, last_name = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, email, first_name, last_name, role, group_id, is_head""",
            (first_name, last_name, user_id)
        )
        user = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         user['id'],
            "email":      user['email'],
            "first_name": user['first_name'],
            "last_name":  user['last_name'],
            "role":       user['role'],
            "group_id":   user['group_id'],
            "is_head":    bool(user['is_head']) if user['is_head'] is not None else False,
        })
    except Exception as e:
        print(f"❌ Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500