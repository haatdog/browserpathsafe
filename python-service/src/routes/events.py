# src/routes/events.py
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

events_bp = Blueprint('events', __name__)


@events_bp.route("/api/events", methods=["GET", "OPTIONS"])
def get_events():
    if request.method == "OPTIONS":
        return '', 200
    try:
        year  = request.args.get('year',  type=int)
        month = request.args.get('month', type=int)

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if year and month:
            cursor.execute('''
                SELECT e.*, u.email as creator_email FROM events e
                LEFT JOIN user_profiles u ON e.created_by = u.id
                WHERE EXTRACT(YEAR  FROM start_time) = %s
                  AND EXTRACT(MONTH FROM start_time) = %s
                ORDER BY start_time DESC
            ''', (year, month))
        else:
            cursor.execute('''
                SELECT e.*, u.email as creator_email FROM events e
                LEFT JOIN user_profiles u ON e.created_by = u.id
                ORDER BY start_time DESC LIMIT 100
            ''')

        events = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for e in events:
            d = dict(e)
            if d.get('start_time'): d['start_time'] = d['start_time'].isoformat()
            if d.get('end_time'):   d['end_time']   = d['end_time'].isoformat()
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            result.append(d)
        return jsonify(result)

    except Exception as e:
        print(f"❌ Error getting events: {e}")
        return jsonify({"error": str(e)}), 500


@events_bp.route("/api/events", methods=["POST", "OPTIONS"])
def create_event():
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
        if not user or user['role'] != 'coordinator':
            cursor.close(); conn.close()
            return jsonify({"error": "Only executives can create events"}), 403

        data = request.json
        cursor.execute('''
            INSERT INTO events (title, description, event_type, start_time, end_time, location, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *
        ''', (data.get('title'), data.get('description'), data.get('event_type'),
              data.get('start_time'), data.get('end_time'), data.get('location'), user_id))
        event = cursor.fetchone()
        conn.commit()

        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (user_id,))
        creator = cursor.fetchone()
        cursor.close(); conn.close()

        d = dict(event)
        d['creator_email'] = creator['email'] if creator else None
        if d.get('start_time'): d['start_time'] = d['start_time'].isoformat()
        if d.get('end_time'):   d['end_time']   = d['end_time'].isoformat()
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        return jsonify(d), 201

    except Exception as e:
        print(f"❌ Error creating event: {e}")
        return jsonify({"error": str(e)}), 500


@events_bp.route("/api/events/<int:event_id>", methods=["PUT", "OPTIONS"])
def update_event(event_id):
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
        if not user or user['role'] != 'coordinator':
            cursor.close(); conn.close()
            return jsonify({"error": "Only executives can update events"}), 403

        data = request.json
        cursor.execute('''
            UPDATE events SET title = %s, description = %s, event_type = %s,
                start_time = %s, end_time = %s, location = %s
            WHERE id = %s RETURNING *
        ''', (data.get('title'), data.get('description'), data.get('event_type'),
              data.get('start_time'), data.get('end_time'), data.get('location'), event_id))
        event = cursor.fetchone()
        conn.commit()

        if not event:
            cursor.close(); conn.close()
            return jsonify({"error": "Event not found"}), 404

        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (event['created_by'],))
        creator = cursor.fetchone()
        cursor.close(); conn.close()

        d = dict(event)
        d['creator_email'] = creator['email'] if creator else None
        if d.get('start_time'): d['start_time'] = d['start_time'].isoformat()
        if d.get('end_time'):   d['end_time']   = d['end_time'].isoformat()
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        return jsonify(d)

    except Exception as e:
        print(f"❌ Error updating event: {e}")
        return jsonify({"error": str(e)}), 500


@events_bp.route("/api/events/<int:event_id>", methods=["DELETE", "OPTIONS"])
def delete_event(event_id):
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
        if not user or user['role'] != 'coordinator':
            cursor.close(); conn.close()
            return jsonify({"error": "Only executives can delete events"}), 403

        cursor.execute('DELETE FROM events WHERE id = %s', (event_id,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500