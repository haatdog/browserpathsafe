# src/routes/notifications.py
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

notifications_bp = Blueprint('notifications', __name__)


def create_notification(cursor, user_id, ntype, title, body=None, link_type=None, ref_id=None):
    """Helper to insert a single notification."""
    cursor.execute('''
        INSERT INTO notifications (user_id, type, title, body, link_type, ref_id)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (user_id, ntype, title, body, link_type, ref_id))


def notify_all_members(cursor, ntype, title, body=None, link_type=None, ref_id=None):
    """Send a notification to every approved member."""
    cursor.execute("SELECT id FROM user_profiles WHERE role = 'member' AND status = 'approved'")
    for row in cursor.fetchall():
        create_notification(cursor, row['id'], ntype, title, body, link_type, ref_id)


def notify_user(cursor, user_id, ntype, title, body=None, link_type=None, ref_id=None):
    """Send a notification to one specific user."""
    create_notification(cursor, user_id, ntype, title, body, link_type, ref_id)


@notifications_bp.route('/api/notifications', methods=['GET', 'OPTIONS'])
def get_notifications():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT id, type, title, body, link_type, ref_id, is_read, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        ''', (user_id,))
        rows = cursor.fetchall()

        # Unread count
        cursor.execute('SELECT COUNT(*) FROM notifications WHERE user_id = %s AND is_read = FALSE', (user_id,))
        unread = cursor.fetchone()['count']
        cursor.close(); conn.close()

        result = []
        for r in rows:
            d = dict(r)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify({'notifications': result, 'unread_count': int(unread)})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST', 'OPTIONS'])
def mark_read(notif_id):
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s',
            (notif_id, user_id)
        )
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/api/notifications/read-all', methods=['POST', 'OPTIONS'])
def mark_all_read():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE',
            (user_id,)
        )
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/api/notifications/<int:notif_id>', methods=['DELETE', 'OPTIONS'])
def delete_notification(notif_id):
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_user_id()
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM notifications WHERE id = %s AND user_id = %s', (notif_id, user_id))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500