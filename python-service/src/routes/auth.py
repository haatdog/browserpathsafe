# src/routes/auth.py
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_db, hash_password, check_password, generate_user_id

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
        cursor.execute(
            'INSERT INTO user_profiles (id, email, role) VALUES (%s, %s, %s)',
            (user_id, email, role)
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
        cursor.execute(
            'SELECT id, email, role, created_at, updated_at FROM user_profiles WHERE id = %s',
            (user_id,)
        )
        user = cursor.fetchone()
        cursor.close(); conn.close()

        if not user:
            session.clear()
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         user['id'],
            "email":      user['email'],
            "role":       user['role'],
            "created_at": user['created_at'].isoformat() if user['created_at'] else None,
            "updated_at": user['updated_at'].isoformat() if user['updated_at'] else None,
        })

    except Exception as e:
        print(f"❌ Error getting current user: {e}")
        return jsonify({"error": str(e)}), 500