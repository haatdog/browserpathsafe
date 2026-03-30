# src/routes/evaluations.py
import json
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

evaluations_bp = Blueprint('evaluations', __name__)


@evaluations_bp.route("/api/evaluations/pending", methods=["GET", "OPTIONS"])
def get_pending():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT e.id, e.title, e.event_type, e.start_time, e.end_time, e.description
            FROM events e
            WHERE e.event_type IN ('drill','fire_drill','earthquake_drill','bomb_threat_drill')
              AND e.start_time <= NOW()
              AND e.start_time >= NOW() - INTERVAL '30 days'
              AND NOT EXISTS (
                  SELECT 1 FROM evacuation_evaluations ee
                  WHERE ee.event_id = e.id AND ee.submitted_by = %s
              )
            ORDER BY e.start_time DESC
        ''', (user_id,))
        events = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for e in events:
            d = dict(e)
            if d.get('start_time'): d['start_time'] = d['start_time'].isoformat()
            if d.get('end_time'):   d['end_time']   = d['end_time'].isoformat()
            result.append(d)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@evaluations_bp.route("/api/evaluations/my", methods=["GET", "OPTIONS"])
def get_my_evaluations():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT e.id, e.event_id, e.instructor_name, e.program_class,
                   e.classroom_office, e.male_count, e.female_count, e.comments,
                   e.submitted_by, e.submitted_at,
                   ev.title as event_title, ev.start_time as event_date, ev.event_type
            FROM evacuation_evaluations e
            JOIN events ev ON e.event_id = ev.id
            WHERE e.submitted_by = %s ORDER BY e.submitted_at DESC
        ''', (user_id,))
        evals = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for e in evals:
            d = dict(e)
            if d.get('submitted_at'): d['submitted_at'] = d['submitted_at'].isoformat()
            if d.get('event_date'):   d['event_date']   = d['event_date'].isoformat()
            result.append(d)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@evaluations_bp.route("/api/evaluations", methods=["POST", "OPTIONS"])
def submit_evaluation():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.json
        required = ['event_id', 'instructor_name', 'classroom_office', 'male_count', 'female_count']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

        try:
            male   = int(data['male_count'])
            female = int(data['female_count'])
        except (ValueError, TypeError):
            return jsonify({'error': 'Counts must be valid numbers'}), 400

        if male < 0 or female < 0:
            return jsonify({'error': 'Counts cannot be negative'}), 400
        if male + female == 0:
            return jsonify({'error': 'Total participants must be at least 1'}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('SELECT id FROM events WHERE id = %s', (data['event_id'],))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute(
            'SELECT id FROM evacuation_evaluations WHERE event_id = %s AND submitted_by = %s',
            (data['event_id'], user_id)
        )
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({'error': 'Already submitted for this event'}), 400

        cursor.execute('''
            INSERT INTO evacuation_evaluations (
                event_id, instructor_name, program_class, classroom_office,
                male_count, female_count, comments, image_url, image_urls, submitted_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, submitted_at
        ''', (
            data['event_id'],
            data['instructor_name'].strip(),
            (data.get('program_class') or '').strip() or 'N/A',
            data['classroom_office'].strip(),
            male, female,
            (data.get('comments') or '').strip(),
            data.get('image_url'),
            json.dumps(data.get('image_urls', [])),
            user_id,
        ))
        result = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        return jsonify({
            'id':           result['id'],
            'submitted_at': result['submitted_at'].isoformat(),
            'message':      'Evaluation submitted successfully',
        }), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@evaluations_bp.route("/api/evaluations/recent-drills", methods=["GET", "OPTIONS"])
def get_recent_drills():
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
            return jsonify({'error': 'Executive role required'}), 403

        cursor.execute('''
            SELECT e.id, e.title, e.event_type, e.start_time, e.end_time, e.description,
                   COUNT(ee.id) as evaluation_count,
                   COALESCE(SUM(ee.male_count), 0) as total_male,
                   COALESCE(SUM(ee.female_count), 0) as total_female
            FROM events e
            LEFT JOIN evacuation_evaluations ee ON e.id = ee.event_id
            WHERE e.event_type IN ('drill','fire_drill','earthquake_drill','bomb_threat_drill')
              AND e.start_time <= NOW()
              AND e.start_time >= NOW() - INTERVAL '30 days'
            GROUP BY e.id, e.title, e.event_type, e.start_time, e.end_time, e.description
            HAVING COUNT(ee.id) > 0
            ORDER BY e.start_time DESC
        ''')
        drills = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for d in drills:
            dd = dict(d)
            if dd.get('start_time'): dd['start_time'] = dd['start_time'].isoformat()
            if dd.get('end_time'):   dd['end_time']   = dd['end_time'].isoformat()
            dd['evaluation_count'] = int(dd['evaluation_count'])
            dd['total_male']       = int(dd['total_male'])
            dd['total_female']     = int(dd['total_female'])
            result.append(dd)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@evaluations_bp.route("/api/evaluations/event/<int:event_id>", methods=["GET", "OPTIONS"])
def get_event_evaluations(event_id):
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
            return jsonify({'error': 'Executive role required'}), 403

        cursor.execute('SELECT id, title FROM events WHERE id = %s', (event_id,))
        event = cursor.fetchone()
        if not event:
            cursor.close(); conn.close()
            return jsonify({'error': 'Event not found'}), 404

        cursor.execute('''
            SELECT e.*, u.email as submitted_by_email
            FROM evacuation_evaluations e
            JOIN user_profiles u ON e.submitted_by = u.id
            WHERE e.event_id = %s ORDER BY e.submitted_at DESC
        ''', (event_id,))
        evals = cursor.fetchall()
        cursor.close(); conn.close()

        result_evals = []
        for e in evals:
            d = dict(e)
            if d.get('submitted_at'): d['submitted_at'] = d['submitted_at'].isoformat()
            result_evals.append(d)

        return jsonify({'event': dict(event), 'evaluations': result_evals})
    except Exception as e:
        return jsonify({"error": str(e)}), 500