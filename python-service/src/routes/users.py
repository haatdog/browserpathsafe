# src/routes/users.py
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_db

users_bp = Blueprint('users', __name__)


@users_bp.route("/api/users", methods=["GET", "OPTIONS"])
def get_all_users():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'SELECT role, group_id, is_head FROM user_profiles WHERE id = %s',
            (user_id,)
        )
        me = cursor.fetchone()

        if not me:
            cursor.close(); conn.close()
            return jsonify({"error": "User not found"}), 404

        is_admin     = me['role'] == 'admin'
        is_unit_head = bool(me['is_head']) and me['group_id'] is not None

        if not is_admin and not is_unit_head:
            cursor.close(); conn.close()
            return jsonify({"error": "Access required"}), 403

        if is_admin:
            cursor.execute('''
                SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.group_id, u.is_head,
                       g.name as group_name, u.created_at, u.updated_at
                FROM user_profiles u
                LEFT JOIN groups g ON u.group_id = g.id
                ORDER BY u.created_at DESC
            ''')
        else:
            # Unit Heads: their group members + unassigned members (for the add-member picker)
            cursor.execute('''
                SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.group_id, u.is_head,
                       g.name as group_name, u.created_at, u.updated_at
                FROM user_profiles u
                LEFT JOIN groups g ON u.group_id = g.id
                WHERE u.role = 'member'
                  AND (u.group_id = %s OR u.group_id IS NULL)
                ORDER BY u.group_id NULLS LAST, u.created_at DESC
            ''', (me['group_id'],))

        users = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify([{
            "id":         u['id'],
            "email":      u['email'],
            "role":       u['role'],
            "group_id":   u['group_id'],
            "first_name": u['first_name'],
            "last_name":  u['last_name'],
            "group_name": u['group_name'],
            "is_head":    bool(u['is_head']) if u['is_head'] is not None else False,
            "created_at": u['created_at'].isoformat() if u['created_at'] else None,
            "updated_at": u['updated_at'].isoformat() if u['updated_at'] else None,
        } for u in users])

    except Exception as e:
        print(f"❌ Error getting users: {e}")
        return jsonify({"error": str(e)}), 500


@users_bp.route("/api/users/<string:uid>/role", methods=["PUT", "OPTIONS"])
def update_user_role(uid):
    if request.method == "OPTIONS":
        return '', 200
    try:
        current_user_id = session.get('user_id')
        if not current_user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        me = cursor.fetchone()

        if not me or me['role'] != 'admin':
            cursor.close(); conn.close()
            return jsonify({"error": "Admin access required"}), 403

        new_role = request.json.get('role')
        if new_role not in ['admin', 'executive', 'member']:
            cursor.close(); conn.close()
            return jsonify({"error": "Invalid role"}), 400

        cursor.execute('''
            UPDATE user_profiles SET role = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, email, role, created_at, updated_at
        ''', (new_role, uid))
        updated = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not updated:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         updated['id'],
            "email":      updated['email'],
            "role":       updated['role'],
            "created_at": updated['created_at'].isoformat() if updated['created_at'] else None,
            "updated_at": updated['updated_at'].isoformat() if updated['updated_at'] else None,
        })

    except Exception as e:
        print(f"❌ Error updating user role: {e}")
        return jsonify({"error": str(e)}), 500


@users_bp.route("/api/users/<string:uid>", methods=["DELETE", "OPTIONS"])
def delete_user(uid):
    if request.method == "OPTIONS":
        return '', 200
    try:
        current_user_id = session.get('user_id')
        if not current_user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        me = cursor.fetchone()

        if not me or me['role'] != 'admin':
            cursor.close(); conn.close()
            return jsonify({"error": "Admin access required"}), 403

        if uid == current_user_id:
            cursor.close(); conn.close()
            return jsonify({"error": "Cannot delete your own account"}), 400

        cursor.execute('DELETE FROM auth_users WHERE id = %s', (uid,))
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ Deleted user {uid}")
        return jsonify({"success": True})

    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        return jsonify({"error": str(e)}), 500


@users_bp.route("/api/users/<string:uid>/group", methods=["PUT", "OPTIONS"])
def update_user_group(uid):
    if request.method == "OPTIONS":
        return '', 200
    if not session.get('user_id'):
        return jsonify({"error": "Not authenticated"}), 401
    try:
        data   = request.json
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE user_profiles SET group_id = %s, is_head = %s WHERE id = %s',
            (data.get('group_id'), data.get('is_head', False), uid)
        )
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500