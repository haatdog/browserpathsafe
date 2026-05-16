# src/routes/announcements.py
import json
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

announcements_bp = Blueprint('announcements', __name__)


def _notify_targeted(cursor, announcement_id, title, body, target_group_id, target_heads_only):
    """Notify only the users who are actually targeted by this announcement."""
    try:
        from src.routes.notifications import create_notification
        if target_heads_only:
            # Only group heads (any role)
            cursor.execute('''
                SELECT DISTINCT up.id FROM user_profiles up
                JOIN user_groups ug ON ug.user_id = up.id
                WHERE ug.is_head = TRUE AND up.status = 'approved'
            ''')
        elif target_group_id:
            # Only members of that specific group (any role)
            cursor.execute('''
                SELECT DISTINCT up.id FROM user_profiles up
                JOIN user_groups ug ON ug.user_id = up.id
                WHERE ug.group_id = %s AND up.status = 'approved'
            ''', (target_group_id,))
        else:
            # Everyone — all approved users regardless of role
            cursor.execute('''
                SELECT id FROM user_profiles WHERE status = 'approved'
            ''')
        for row in cursor.fetchall():
            create_notification(cursor, row['id'], 'announcement', title, body, 'home', announcement_id)
    except Exception as e:
        print(f'⚠️ Notification error: {e}')


@announcements_bp.route("/api/announcements", methods=["GET", "OPTIONS"])
def get_announcements():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT
                a.*,
                u.email        AS author_email,
                u.role         AS author_role,
                u.first_name   AS author_first_name,
                u.last_name    AS author_last_name,
                u.group_id     AS author_group_id,
                u.is_head      AS author_is_head,
                g.name         AS author_group_name,
                tg.name        AS target_group_name,
                (SELECT COUNT(*) FROM announcement_likes    WHERE announcement_id = a.id) AS likes_count,
                (SELECT COUNT(*) FROM announcement_likes    WHERE announcement_id = a.id AND user_id = %(uid)s) > 0 AS user_liked,
                (SELECT COUNT(*) FROM announcement_comments WHERE announcement_id = a.id) AS comments_count
            FROM announcements a
            LEFT JOIN user_profiles u  ON a.user_id = u.id
            LEFT JOIN groups g         ON u.group_id = g.id
            LEFT JOIN groups tg        ON a.target_group_id = tg.id
            WHERE (
                (SELECT role FROM user_profiles WHERE id = %(uid)s) IN ('coordinator', 'admin')
                OR (a.target_group_id IS NULL AND a.target_heads_only = FALSE)
                OR (a.target_group_id IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM user_groups
                        WHERE user_id = %(uid)s AND group_id = a.target_group_id
                    ))
                OR (a.target_heads_only = TRUE
                    AND EXISTS (
                        SELECT 1 FROM user_groups
                        WHERE user_id = %(uid)s AND is_head = TRUE
                    ))
            )
            ORDER BY a.is_pinned DESC, a.created_at DESC
        ''', {'uid': user_id})

        announcements = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for a in announcements:
            d = dict(a)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            if d.get('updated_at'): d['updated_at'] = d['updated_at'].isoformat()
            d['likes_count']       = int(d.get('likes_count') or 0)
            d['comments_count']    = int(d.get('comments_count') or 0)
            d['target_heads_only'] = bool(d.get('target_heads_only'))
            d['author_is_head']    = bool(d.get('author_is_head'))
            if not d.get('image_url'): d['image_url'] = None
            result.append(d)
        return jsonify(result)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements", methods=["POST", "OPTIONS"])
def create_announcement():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'SELECT role, email, first_name, last_name FROM user_profiles WHERE id = %s',
            (user_id,)
        )
        user = cursor.fetchone()

        if not user or user['role'] not in ('coordinator', 'admin'):
            cursor.close(); conn.close()
            return jsonify({"error": "Only coordinators or admins can create announcements"}), 403

        data            = request.json or {}
        title           = (data.get('title') or '').strip()
        content         = (data.get('content') or '').strip()
        target_group_id = data.get('target_group_id') or None
        target_heads    = bool(data.get('target_heads_only', False))

        if not title:
            cursor.close(); conn.close()
            return jsonify({"error": "Title is required"}), 400
        if not content:
            cursor.close(); conn.close()
            return jsonify({"error": "Content is required"}), 400

        cursor.execute('''
            INSERT INTO announcements
                (user_id, title, content, image_url, image_urls, target_group_id, target_heads_only)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
        ''', (
            user_id, title, content,
            data.get('image_url'),
            json.dumps(data.get('image_urls', [])),
            target_group_id,
            target_heads,
        ))
        announcement = cursor.fetchone()

        # ── Targeted notifications ────────────────────────────────────────────
        body = content[:120] + ('...' if len(content) > 120 else '')
        _notify_targeted(cursor, announcement['id'], f'New Announcement: {title}', body, target_group_id, target_heads)

        conn.commit(); cursor.close(); conn.close()

        d = dict(announcement)
        d.update({
            'author_email':      user['email'],
            'author_role':       user['role'],
            'author_first_name': user.get('first_name'),
            'author_last_name':  user.get('last_name'),
            'likes_count': 0, 'comments_count': 0, 'user_liked': False,
        })
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        if d.get('updated_at'): d['updated_at'] = d['updated_at'].isoformat()
        return jsonify(d), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>", methods=["PUT", "OPTIONS"])
def update_announcement(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        data    = request.json or {}
        title   = (data.get('title') or '').strip()
        content = (data.get('content') or '').strip()
        if not title:   return jsonify({"error": "Title is required"}), 400
        if not content: return jsonify({"error": "Content is required"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT user_id FROM announcements WHERE id = %s', (announcement_id,))
        existing = cursor.fetchone()
        if not existing:
            cursor.close(); conn.close()
            return jsonify({"error": "Announcement not found"}), 404

        if existing['user_id'] != user_id:
            cursor.close(); conn.close()
            return jsonify({"error": "You can only edit your own announcements"}), 403

        cursor.execute('''
            UPDATE announcements
            SET title = %s, content = %s, image_url = %s, image_urls = %s,
                target_group_id = %s, target_heads_only = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (
            title, content,
            data.get('image_url'),
            json.dumps(data.get('image_urls', [])),
            data.get('target_group_id') or None,
            bool(data.get('target_heads_only', False)),
            announcement_id,
        ))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>/pin", methods=["PUT", "OPTIONS"])
def toggle_pin(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        if not user or user['role'] not in ('coordinator', 'admin'):
            cursor.close(); conn.close()
            return jsonify({"error": "Only coordinators or admins can pin"}), 403

        cursor.execute(
            'UPDATE announcements SET is_pinned = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            (request.json.get('is_pinned'), announcement_id)
        )
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>/like", methods=["POST", "OPTIONS"])
def toggle_like(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM announcement_likes WHERE announcement_id = %s AND user_id = %s',
            (announcement_id, user_id)
        )
        if cursor.fetchone():
            cursor.execute('DELETE FROM announcement_likes WHERE announcement_id = %s AND user_id = %s',
                           (announcement_id, user_id))
        else:
            cursor.execute('INSERT INTO announcement_likes (announcement_id, user_id) VALUES (%s, %s)',
                           (announcement_id, user_id))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>", methods=["DELETE", "OPTIONS"])
def delete_announcement(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT user_id FROM announcements WHERE id = %s', (announcement_id,))
        ann = cursor.fetchone()
        if not ann:
            cursor.close(); conn.close()
            return jsonify({"error": "Announcement not found"}), 404
        if ann['user_id'] != user_id:
            cursor.close(); conn.close()
            return jsonify({"error": "You can only delete your own announcements"}), 403

        cursor.execute('DELETE FROM notifications WHERE type = %s AND ref_id = %s', ('announcement', announcement_id))
        cursor.execute('DELETE FROM announcements WHERE id = %s', (announcement_id,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>/comments", methods=["GET", "OPTIONS"])
def get_comments(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT c.*, u.email AS user_email, u.role AS user_role,
                   u.first_name AS user_first_name, u.last_name AS user_last_name
            FROM announcement_comments c
            LEFT JOIN user_profiles u ON c.user_id = u.id
            WHERE c.announcement_id = %s ORDER BY c.created_at ASC
        ''', (announcement_id,))
        comments = cursor.fetchall()
        cursor.close(); conn.close()
        result = []
        for c in comments:
            d = dict(c)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@announcements_bp.route("/api/announcements/<int:announcement_id>/comments", methods=["POST", "OPTIONS"])
def add_comment(announcement_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            INSERT INTO announcement_comments (announcement_id, user_id, content)
            VALUES (%s, %s, %s) RETURNING *
        ''', (announcement_id, user_id, request.json.get('content')))
        comment = cursor.fetchone()
        conn.commit()

        cursor.execute(
            'SELECT email, role, first_name, last_name FROM user_profiles WHERE id = %s',
            (user_id,)
        )
        user = cursor.fetchone()
        cursor.close(); conn.close()

        d = dict(comment)
        d['user_email']      = user['email']      if user else None
        d['user_role']       = user['role']       if user else None
        d['user_first_name'] = user['first_name'] if user else None
        d['user_last_name']  = user['last_name']  if user else None
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        return jsonify(d), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500