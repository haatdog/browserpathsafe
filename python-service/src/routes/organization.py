# src/routes/organization.py  — Groups + Org chart
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db, require_auth

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
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        name = (request.json or {}).get('name', '').strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'INSERT INTO groups (name, is_custom) VALUES (%s, TRUE) RETURNING *',
            (name,)
        )
        group = dict(cursor.fetchone())
        conn.commit(); cursor.close(); conn.close()
        return jsonify(group), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/groups/<int:group_id>", methods=["PATCH", "OPTIONS"])
def rename_group(group_id):
    if request.method == "OPTIONS":
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        new_name = ((request.json or {}).get('name') or '').strip()
        if not new_name:
            return jsonify({"error": "Name is required"}), 400

        user_id = get_user_id()
        conn    = get_db()
        cursor  = conn.cursor()

        # Check caller's role — only admins or the Unit Head of this group can rename
        cursor.execute(
            "SELECT role, group_id, is_head FROM user_profiles WHERE id = %s",
            (user_id,)
        )
        profile = cursor.fetchone()
        if not profile:
            cursor.close(); conn.close()
            return jsonify({"error": "Unauthorized"}), 403

        role, user_group_id, is_head = profile
        is_admin             = (role == 'admin')
        is_unit_head_of_group = (is_head and user_group_id == group_id)

        if not is_admin and not is_unit_head_of_group:
            cursor.close(); conn.close()
            return jsonify({"error": "Only admins or the Unit Head of this group can rename it"}), 403

        cursor.execute(
            "UPDATE groups SET name = %s WHERE id = %s RETURNING id, name",
            (new_name, group_id)
        )
        updated = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not updated:
            return jsonify({"error": "Group not found"}), 404

        return jsonify({"id": updated[0], "name": updated[1]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/groups/<int:group_id>", methods=["DELETE", "OPTIONS"])
def delete_group(group_id):
    if request.method == "OPTIONS":
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM groups WHERE id = %s', (group_id,))
        conn.commit()
        rows = cursor.rowcount
        cursor.close(); conn.close()
        if rows == 0:
            return jsonify({"error": "Group not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@organization_bp.route("/api/organization", methods=["GET", "OPTIONS"])
def get_organization():
    if request.method == "OPTIONS":
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.group_id, u.is_head, g.name AS group_name
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.role DESC, u.email ASC
        ''')
        users = cursor.fetchall()
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = cursor.fetchall()
        cursor.close(); conn.close()
        return jsonify({
            "users":  [dict(u) for u in users],
            "groups": [dict(g) for g in groups],
        })
    except Exception as e:
        print(f"❌ Error getting organization: {e}")
        return jsonify({"error": str(e)}), 500