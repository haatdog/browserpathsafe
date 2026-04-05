# src/routes/users.py
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

users_bp = Blueprint('users', __name__)


def _serialize_user(u: dict) -> dict:
    """Convert a user_profiles row + groups list into a clean dict."""
    return {
        'id':         u['id'],
        'email':      u['email'],
        'first_name': u['first_name'],
        'last_name':  u['last_name'],
        'role':       u['role'],
        # Legacy single-group fields — kept for backwards compat
        'group_id':   u.get('group_id'),
        'group_name': u.get('group_name'),
        'is_head':    bool(u.get('is_head')) if u.get('is_head') is not None else False,
        # New multi-group field
        'groups':     u.get('groups', []),
        'created_at': u['created_at'].isoformat() if u.get('created_at') else None,
        'updated_at': u['updated_at'].isoformat() if u.get('updated_at') else None,
    }


def _attach_groups(cursor, user_ids: list) -> dict:
    """Return {user_id: [{group_id, group_name, is_head}]} for a list of user IDs."""
    if not user_ids:
        return {}
    cursor.execute('''
        SELECT ug.user_id, ug.group_id, ug.is_head, g.name AS group_name
        FROM user_groups ug
        JOIN groups g ON g.id = ug.group_id
        WHERE ug.user_id = ANY(%s)
        ORDER BY g.name
    ''', (user_ids,))
    result: dict = {}
    for row in cursor.fetchall():
        uid = row['user_id']
        if uid not in result:
            result[uid] = []
        result[uid].append({
            'group_id':   row['group_id'],
            'group_name': row['group_name'],
            'is_head':    bool(row['is_head']),
        })
    return result


@users_bp.route('/api/users', methods=['GET', 'OPTIONS'])
def get_all_users():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Check caller permissions
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        me = cursor.fetchone()
        if not me:
            cursor.close(); conn.close()
            return jsonify({'error': 'User not found'}), 404

        is_admin = me['role'] == 'admin'

        # Check if caller is a head in any group
        cursor.execute('SELECT group_id FROM user_groups WHERE user_id = %s AND is_head = TRUE', (user_id,))
        head_groups = [r['group_id'] for r in cursor.fetchall()]
        is_unit_head = len(head_groups) > 0

        if not is_admin and not is_unit_head:
            cursor.close(); conn.close()
            return jsonify({'error': 'Access required'}), 403

        if is_admin:
            cursor.execute('''
                SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                       u.group_id, u.is_head, g.name AS group_name,
                       u.created_at, u.updated_at
                FROM user_profiles u
                LEFT JOIN groups g ON u.group_id = g.id
                ORDER BY u.created_at DESC
            ''')
        else:
            # Unit heads see members in their groups + unassigned members
            cursor.execute('''
                SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.role,
                       u.group_id, u.is_head, g.name AS group_name,
                       u.created_at, u.updated_at
                FROM user_profiles u
                LEFT JOIN groups g ON u.group_id = g.id
                LEFT JOIN user_groups ug ON ug.user_id = u.id
                WHERE u.role = 'member'
                  AND (ug.group_id = ANY(%s) OR ug.group_id IS NULL)
                ORDER BY u.created_at DESC
            ''', (head_groups,))

        users = cursor.fetchall()
        user_ids = [u['id'] for u in users]
        groups_map = _attach_groups(cursor, user_ids)
        cursor.close(); conn.close()

        result = []
        for u in users:
            d = _serialize_user(dict(u))
            d['groups'] = groups_map.get(u['id'], [])
            result.append(d)

        return jsonify(result)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@users_bp.route('/api/users/<string:uid>/role', methods=['PUT', 'OPTIONS'])
def update_user_role(uid):
    if request.method == 'OPTIONS':
        return '', 200
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        me = cursor.fetchone()
        if not me or me['role'] != 'admin':
            cursor.close(); conn.close()
            return jsonify({'error': 'Admin access required'}), 403

        new_role = request.json.get('role')
        if new_role not in ['admin', 'coordinator', 'member']:
            cursor.close(); conn.close()
            return jsonify({'error': 'Invalid role'}), 400

        cursor.execute('''
            UPDATE user_profiles SET role = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s RETURNING id, email, role, created_at, updated_at
        ''', (new_role, uid))
        updated = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not updated:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id':         updated['id'],
            'email':      updated['email'],
            'role':       updated['role'],
            'created_at': updated['created_at'].isoformat() if updated['created_at'] else None,
            'updated_at': updated['updated_at'].isoformat() if updated['updated_at'] else None,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/api/users/<string:uid>', methods=['DELETE', 'OPTIONS'])
def delete_user(uid):
    if request.method == 'OPTIONS':
        return '', 200
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        me = cursor.fetchone()
        if not me or me['role'] != 'admin':
            cursor.close(); conn.close()
            return jsonify({'error': 'Admin access required'}), 403
        if uid == current_user_id:
            cursor.close(); conn.close()
            return jsonify({'error': 'Cannot delete your own account'}), 400

        cursor.execute('DELETE FROM auth_users WHERE id = %s', (uid,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/api/users/<string:uid>/groups', methods=['GET', 'OPTIONS'])
def get_user_groups(uid):
    """Return all groups a user belongs to."""
    if request.method == 'OPTIONS':
        return '', 200
    if not get_user_id():
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT ug.group_id, ug.is_head, g.name AS group_name
            FROM user_groups ug
            JOIN groups g ON g.id = ug.group_id
            WHERE ug.user_id = %s
            ORDER BY g.name
        ''', (uid,))
        rows = cursor.fetchall()
        cursor.close(); conn.close()
        return jsonify([{
            'group_id':   r['group_id'],
            'group_name': r['group_name'],
            'is_head':    bool(r['is_head']),
        } for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/api/users/<string:uid>/groups', methods=['PUT', 'OPTIONS'])
def set_user_groups(uid):
    """
    Replace all group memberships for a user.
    Body: { groups: [{group_id: int, is_head: bool}] }
    """
    if request.method == 'OPTIONS':
        return '', 200
    caller_id = get_user_id()
    if not caller_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Permission: admin or head of one of the affected groups
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (caller_id,))
        me = cursor.fetchone()
        if not me:
            cursor.close(); conn.close()
            return jsonify({'error': 'Not found'}), 404

        if me['role'] not in ('admin', 'coordinator'):
            cursor.close(); conn.close()
            return jsonify({'error': 'Access denied'}), 403

        groups = request.json.get('groups', [])  # [{group_id, is_head}]

        # Delete all existing memberships for this user
        cursor.execute('DELETE FROM user_groups WHERE user_id = %s', (uid,))

        # Insert new memberships
        for g in groups:
            gid    = g.get('group_id')
            is_hd  = bool(g.get('is_head', False))
            if gid:
                cursor.execute('''
                    INSERT INTO user_groups (user_id, group_id, is_head)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, group_id) DO UPDATE SET is_head = EXCLUDED.is_head
                ''', (uid, gid, is_hd))

        # Keep legacy group_id/is_head in sync (first group, or NULL)
        if groups:
            first = groups[0]
            cursor.execute(
                'UPDATE user_profiles SET group_id = %s, is_head = %s WHERE id = %s',
                (first.get('group_id'), bool(first.get('is_head', False)), uid)
            )
        else:
            cursor.execute(
                'UPDATE user_profiles SET group_id = NULL, is_head = FALSE WHERE id = %s',
                (uid,)
            )

        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# Legacy single-group endpoint — kept so old frontend code doesn't break
@users_bp.route('/api/users/<string:uid>/group', methods=['PUT', 'OPTIONS'])
def update_user_group_legacy(uid):
    if request.method == 'OPTIONS':
        return '', 200
    if not get_user_id():
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        data     = request.json or {}
        group_id = data.get('group_id')
        is_head  = bool(data.get('is_head', False))

        conn   = get_db()
        cursor = conn.cursor()

        # Update legacy column
        cursor.execute(
            'UPDATE user_profiles SET group_id = %s, is_head = %s WHERE id = %s',
            (group_id, is_head, uid)
        )

        # Mirror into user_groups
        if group_id:
            cursor.execute('''
                INSERT INTO user_groups (user_id, group_id, is_head)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, group_id) DO UPDATE SET is_head = EXCLUDED.is_head
            ''', (uid, group_id, is_head))
        else:
            cursor.execute('DELETE FROM user_groups WHERE user_id = %s', (uid,))

        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500