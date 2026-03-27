# src/routes/incidents.py
import json
from flask import Blueprint, request, jsonify, session
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db

incidents_bp = Blueprint('incidents', __name__)


@incidents_bp.route("/api/incidents", methods=["POST", "OPTIONS"])
def create_incident():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.json
        required = ['title', 'description', 'incident_type', 'severity', 'incident_date']
        if not all(k in data for k in required):
            return jsonify({'error': 'Missing required fields'}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            INSERT INTO incidents
            (reporter_id, title, description, incident_type, severity, location, incident_date, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *
        ''', (
            user_id, data.get('title'), data.get('description'),
            data.get('incident_type'), data.get('severity'),
            data.get('location'), data.get('incident_date'),
            json.dumps(data.get('image_urls', [])),
        ))
        incident = cursor.fetchone()
        conn.commit()

        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (user_id,))
        reporter = cursor.fetchone()
        cursor.close(); conn.close()

        d = dict(incident)
        d['reporter_email'] = reporter['email'] if reporter else None
        d['remarks_count']  = 0
        if d.get('incident_date'): d['incident_date'] = d['incident_date'].isoformat()
        if d.get('created_at'):    d['created_at']    = d['created_at'].isoformat()
        if d.get('updated_at'):    d['updated_at']    = d['updated_at'].isoformat()
        return jsonify(d), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@incidents_bp.route("/api/incidents", methods=["GET", "OPTIONS"])
def get_incidents():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user      = cursor.fetchone()
        user_role = user['role'] if user else 'member'

        base_select = '''
            SELECT i.id, i.title, i.description, i.incident_type, i.severity,
                   i.location, i.incident_date, i.status, i.image_url, i.image_urls,
                   i.created_at, i.updated_at, u.email as reporter_email,
                   (SELECT COUNT(*) FROM incident_remarks WHERE incident_id = i.id) as remarks_count
            FROM incidents i JOIN user_profiles u ON i.reporter_id = u.id
        '''
        if user_role in ['executive', 'admin']:
            cursor.execute(base_select + ' ORDER BY i.incident_date DESC')
        else:
            cursor.execute(base_select + ' WHERE i.reporter_id = %s ORDER BY i.incident_date DESC', (user_id,))

        incidents = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for i in incidents:
            d = dict(i)
            if d.get('incident_date'): d['incident_date'] = d['incident_date'].isoformat()
            if d.get('created_at'):    d['created_at']    = d['created_at'].isoformat()
            if d.get('updated_at'):    d['updated_at']    = d['updated_at'].isoformat()
            d['remarks_count'] = int(d.get('remarks_count') or 0)
            result.append(d)
        return jsonify(result)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@incidents_bp.route("/api/incidents/<int:incident_id>", methods=["GET", "OPTIONS"])
def get_incident(incident_id):
    if request.method == "OPTIONS":
        return '', 200
    try:
        user_id = get_user_id()
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user      = cursor.fetchone()
        user_role = user['role'] if user else 'member'

        cursor.execute('''
            SELECT i.id, i.reporter_id, i.title, i.description, i.incident_type, i.severity,
                   i.location, i.incident_date, i.status, i.image_url, i.image_urls,
                   i.created_at, i.updated_at, u.email as reporter_email
            FROM incidents i JOIN user_profiles u ON i.reporter_id = u.id
            WHERE i.id = %s
        ''', (incident_id,))
        incident = cursor.fetchone()

        if not incident:
            cursor.close(); conn.close()
            return jsonify({'error': 'Incident not found'}), 404

        if user_role not in ['executive', 'admin'] and incident['reporter_id'] != user_id:
            cursor.close(); conn.close()
            return jsonify({'error': 'Access denied'}), 403

        d = dict(incident)
        if d.get('incident_date'): d['incident_date'] = d['incident_date'].isoformat()
        if d.get('created_at'):    d['created_at']    = d['created_at'].isoformat()
        if d.get('updated_at'):    d['updated_at']    = d['updated_at'].isoformat()

        cursor.execute('''
            SELECT r.id, r.remark, r.created_at, u.email as author_email, u.role as author_role
            FROM incident_remarks r JOIN user_profiles u ON r.user_id = u.id
            WHERE r.incident_id = %s ORDER BY r.created_at ASC
        ''', (incident_id,))
        d['remarks'] = [{**dict(r), 'created_at': r['created_at'].isoformat() if r.get('created_at') else None}
                        for r in cursor.fetchall()]
        cursor.close(); conn.close()
        return jsonify(d)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@incidents_bp.route("/api/incidents/<int:incident_id>/remarks", methods=["POST", "OPTIONS"])
def add_remark(incident_id):
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
        if not user or user['role'] not in ['executive', 'admin']:
            cursor.close(); conn.close()
            return jsonify({'error': 'Only executives can add remarks'}), 403

        data = request.json
        if 'remark' not in data:
            cursor.close(); conn.close()
            return jsonify({'error': 'Remark text required'}), 400

        cursor.execute('SELECT id FROM incidents WHERE id = %s', (incident_id,))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({'error': 'Incident not found'}), 404

        cursor.execute('''
            INSERT INTO incident_remarks (incident_id, user_id, remark)
            VALUES (%s, %s, %s) RETURNING *
        ''', (incident_id, user_id, data['remark']))
        remark = cursor.fetchone()
        conn.commit()

        cursor.execute('SELECT email, role FROM user_profiles WHERE id = %s', (user_id,))
        author = cursor.fetchone()
        cursor.close(); conn.close()

        d = dict(remark)
        d['author_email'] = author['email'] if author else None
        d['author_role']  = author['role']  if author else None
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        return jsonify(d), 201

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@incidents_bp.route("/api/incidents/<int:incident_id>/status", methods=["PATCH", "OPTIONS"])
def update_incident_status(incident_id):
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
        if not user or user['role'] not in ['executive', 'admin']:
            cursor.close(); conn.close()
            return jsonify({'error': 'Only executives can update status'}), 403

        data = request.json
        valid = ['pending', 'under_review', 'resolved', 'closed']
        if data.get('status') not in valid:
            cursor.close(); conn.close()
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid)}'}), 400

        cursor.execute('''
            UPDATE incidents SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s RETURNING *
        ''', (data['status'], incident_id))
        incident = cursor.fetchone()
        if not incident:
            cursor.close(); conn.close()
            return jsonify({'error': 'Incident not found'}), 404

        conn.commit(); cursor.close(); conn.close()
        d = dict(incident)
        if d.get('updated_at'): d['updated_at'] = d['updated_at'].isoformat()
        return jsonify(d)

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500