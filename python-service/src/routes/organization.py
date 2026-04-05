# src/routes/organization.py
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db, require_auth

organization_bp = Blueprint('organization', __name__)


@organization_bp.route('/api/groups', methods=['GET', 'OPTIONS'])
def get_groups():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = [dict(g) for g in cursor.fetchall()]
        cursor.close(); conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@organization_bp.route('/api/groups', methods=['POST', 'OPTIONS'])
def create_group():
    if request.method == 'OPTIONS':
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        name = (request.json or {}).get('name', '').strip()
        if not name:
            return jsonify({'error': 'Name is required'}), 400
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('INSERT INTO groups (name, is_custom) VALUES (%s, TRUE) RETURNING *', (name,))
        group = dict(cursor.fetchone())
        conn.commit(); cursor.close(); conn.close()
        return jsonify(group), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@organization_bp.route('/api/groups/<int:group_id>', methods=['PATCH', 'OPTIONS'])
def rename_group(group_id):
    if request.method == 'OPTIONS':
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        new_name = ((request.json or {}).get('name') or '').strip()
        if not new_name:
            return jsonify({'error': 'Name is required'}), 400

        user_id = get_user_id()
        conn    = get_db()
        cursor  = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        profile = cursor.fetchone()
        if not profile:
            cursor.close(); conn.close()
            return jsonify({'error': 'Unauthorized'}), 403

        is_admin = profile['role'] == 'admin'

        # Check if user is head of this specific group
        cursor.execute('SELECT is_head FROM user_groups WHERE user_id = %s AND group_id = %s', (user_id, group_id))
        ug = cursor.fetchone()
        is_unit_head_of_group = ug and bool(ug['is_head'])

        if not is_admin and not is_unit_head_of_group:
            cursor.close(); conn.close()
            return jsonify({'error': 'Only admins or the head of this group can rename it'}), 403

        cursor.execute('UPDATE groups SET name = %s WHERE id = %s RETURNING id, name', (new_name, group_id))
        updated = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not updated:
            return jsonify({'error': 'Group not found'}), 404
        return jsonify({'id': updated['id'], 'name': updated['name']})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@organization_bp.route('/api/groups/<int:group_id>', methods=['DELETE', 'OPTIONS'])
def delete_group(group_id):
    if request.method == 'OPTIONS':
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
            return jsonify({'error': 'Group not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@organization_bp.route('/api/organization', methods=['GET', 'OPTIONS'])
def get_organization():
    if request.method == 'OPTIONS':
        return '', 200
    auth_err = require_auth()
    if auth_err:
        return auth_err
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Get all users
        cursor.execute('''
            SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                   u.group_id, u.is_head, g.name AS group_name
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.role DESC, u.email ASC
        ''')
        users_raw = cursor.fetchall()

        # Get all group memberships
        cursor.execute('''
            SELECT ug.user_id, ug.group_id, ug.is_head, g.name AS group_name
            FROM user_groups ug
            JOIN groups g ON g.id = ug.group_id
            ORDER BY g.name
        ''')
        memberships = cursor.fetchall()

        # Get all groups
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = cursor.fetchall()
        cursor.close(); conn.close()

        # Build groups map per user
        groups_map: dict = {}
        for m in memberships:
            uid = m['user_id']
            if uid not in groups_map:
                groups_map[uid] = []
            groups_map[uid].append({
                'group_id':   m['group_id'],
                'group_name': m['group_name'],
                'is_head':    bool(m['is_head']),
            })

        users_out = []
        for u in users_raw:
            d = dict(u)
            d['groups'] = groups_map.get(u['id'], [])
            users_out.append(d)

        return jsonify({
            'users':  users_out,
            'groups': [dict(g) for g in groups],
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500