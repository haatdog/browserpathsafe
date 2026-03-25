# src/routes/organization.py  — Groups + Org chart
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_db

organization_bp = Blueprint('organization', __name__)


@organization_bp.route("/api/groups", methods=["GET", "OPTIONS"])
def get_groups():
    if request.method == "OPTIONS":
        return '', 200
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = [dict(g) for g in cursor.fetchall()]
        cursor.close(); conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/groups", methods=["POST", "OPTIONS"])
def create_group():
    if request.method == "OPTIONS":
        return '', 200
    if not session.get('user_id'):
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'INSERT INTO groups (name, is_custom) VALUES (%s, TRUE) RETURNING *',
            (request.json.get('name'),)
        )
        group = dict(cursor.fetchone())
        conn.commit(); cursor.close(); conn.close()
        return jsonify(group), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/groups/<int:group_id>", methods=["DELETE", "OPTIONS"])
def delete_group(group_id):
    if request.method == "OPTIONS":
        return '', 200
    if not session.get('user_id'):
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM groups WHERE id = %s', (group_id,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/organization", methods=["GET", "OPTIONS"])
def get_organization():
    if request.method == "OPTIONS":
        return '', 200
    if not session.get('user_id'):
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT u.id, u.email, u.role, u.group_id, u.is_head, g.name AS group_name
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.role DESC, u.email ASC
        ''')
        users = cursor.fetchall()
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = cursor.fetchall()
        cursor.close(); conn.close()
        return jsonify({"users": [dict(u) for u in users], "groups": [dict(g) for g in groups]})
    except Exception as e:
        print(f"❌ Error getting organization: {e}")
        return jsonify({"error": str(e)}), 500