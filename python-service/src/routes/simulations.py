# src/routes/simulations.py
import json
import threading
import uuid
import time as _time
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_user_id, get_db, require_auth

simulations_bp = Blueprint('simulations', __name__)

# ── In-memory job store ────────────────────────────────────────────────────────
_simulation_jobs: dict = {}
_jobs_lock = threading.Lock()


def _cleanup_old_jobs():
    cutoff = _time.time() - 600
    with _jobs_lock:
        stale = [jid for jid, job in _simulation_jobs.items()
                 if job.get('started_at', 0) < cutoff]
        for jid in stale:
            del _simulation_jobs[jid]


def _run_simulation_thread(job_id: str, project_data, disaster_type: str,
                            max_steps: int, project_id: int, user_id):
    cancel_flag = {'cancel': False}
    with _jobs_lock:
        if job_id in _simulation_jobs:
            _simulation_jobs[job_id]['cancel_flag'] = cancel_flag

    from src.simulation import run_simulation as _run_sim

    def on_progress(info: dict):
        with _jobs_lock:
            if job_id in _simulation_jobs:
                _simulation_jobs[job_id]['progress'] = info

    try:
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'running'

        results = _run_sim(
            project_data, max_steps=max_steps,
            disaster_type=disaster_type,
            progress_callback=on_progress,
            cancel_flag=cancel_flag,
        )

        # Don't save if cancelled
        if cancel_flag.get('cancel', False):
            with _jobs_lock:
                if job_id in _simulation_jobs:
                    _simulation_jobs[job_id]['status'] = 'cancelled'
                    _simulation_jobs[job_id]['progress'] = {
                        **(_simulation_jobs[job_id].get('progress') or {}),
                        'cancelled': True,
                        'pct': 0,
                    }
            return

        # Save to DB
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO simulations (
                    user_id, project_id, disaster_type, status, config, results,
                    steps, elapsed_s, evacuation_time,
                    agents_spawned, agents_evacuated, agents_trapped
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            ''', (
                user_id, project_id, disaster_type, 'completed',
                json.dumps({'disaster_type': disaster_type, 'max_steps': max_steps}),
                json.dumps(results),
                results.get('steps', 0),
                results.get('elapsed_s', 0),
                results.get('evacuation_time', 0),
                results.get('agents_spawned', 0),
                results.get('agents_evacuated', 0),
                results.get('agents_trapped', 0),
            ))
            sim_id = cursor.fetchone()[0]
            conn.commit(); cursor.close(); conn.close()
            results['simulation_id'] = sim_id
        except Exception as db_err:
            print(f"⚠️  DB save failed for job {job_id}: {db_err}")

        with _jobs_lock:
            _simulation_jobs[job_id]['status']   = 'completed'
            _simulation_jobs[job_id]['results']  = results
            _simulation_jobs[job_id]['progress'] = {
                'pct': 100,
                'evacuated':  results.get('agents_evacuated', 0),
                'remaining':  0,
                'queued':     0,
                'step':       results.get('steps', 0),
                'max_steps':  max_steps,
                'total':      results.get('agents_spawned', 0),
            }

        print(f"✅ Job {job_id} done: "
              f"{results.get('agents_evacuated')}/{results.get('agents_spawned')} evacuated")

    except Exception as e:
        import traceback; traceback.print_exc()
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'failed'
            _simulation_jobs[job_id]['error']  = str(e)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@simulations_bp.route("/api/simulations/run", methods=["POST", "OPTIONS"])
def run_simulation():
    if request.method == "OPTIONS":
        return '', 200

    auth_err = require_auth()
    if auth_err:
        return auth_err

    try:
        data          = request.json
        project_id    = data.get('project_id')
        disaster_type = data.get('disaster_type', 'fire')
        max_steps     = int(data.get('max_steps', 10000))
        user_id       = get_user_id

        if not project_id:
            return jsonify({"error": "project_id required"}), 400
        if disaster_type not in ('fire', 'earthquake', 'bomb'):
            return jsonify({"error": "Invalid disaster_type"}), 400

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT project_data FROM projects WHERE id = %s', (project_id,))
        row = cursor.fetchone()
        cursor.close(); conn.close()

        if not row:
            return jsonify({"error": "Project not found"}), 404

        project_data = row[0]
        if isinstance(project_data, str):
            project_data = json.loads(project_data)

        _cleanup_old_jobs()
        job_id = str(uuid.uuid4())
        with _jobs_lock:
            _simulation_jobs[job_id] = {
                'status':     'queued',
                'progress':   {'pct': 0, 'step': 0, 'max_steps': max_steps,
                               'evacuated': 0, 'remaining': 0, 'queued': 0, 'total': 0},
                'results':    None,
                'error':      None,
                'started_at': _time.time(),
            }

        t = threading.Thread(
            target=_run_simulation_thread,
            args=(job_id, project_data, disaster_type, max_steps, project_id, user_id),
            daemon=True,
        )
        t.start()

        print(f"🚀 Started simulation job {job_id} ({disaster_type}) for project {project_id}")
        return jsonify({"success": True, "job_id": job_id}), 202

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@simulations_bp.route("/api/simulations/progress/<job_id>", methods=["GET", "OPTIONS"])
def get_simulation_progress(job_id):
    if request.method == "OPTIONS":
        return '', 200
    with _jobs_lock:
        job = _simulation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({
        "status":   job['status'],
        "progress": job['progress'],
        "results":  job['results'],
        "error":    job['error'],
    })


@simulations_bp.route("/api/simulations/cancel/<job_id>", methods=["POST", "OPTIONS"])
def cancel_simulation(job_id):
    if request.method == "OPTIONS":
        return '', 200
    with _jobs_lock:
        job = _simulation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job['status'] not in ('queued', 'running'):
        return jsonify({"error": "Job is not running"}), 400
    with _jobs_lock:
        if 'cancel_flag' in job:
            job['cancel_flag']['cancel'] = True
        job['status'] = 'cancelled'
    print(f"⛔ Job {job_id} cancel requested")
    return jsonify({"success": True})


@simulations_bp.route("/api/simulations", methods=["GET", "OPTIONS"])
def get_simulations():
    if request.method == "OPTIONS":
        return '', 200

    auth_err = require_auth()
    if auth_err:
        return auth_err

    try:
        project_id = request.args.get('project_id')
        limit      = int(request.args.get('limit', 100))

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if project_id:
            cursor.execute('''
                SELECT s.*, p.name as project_name
                FROM simulations s LEFT JOIN projects p ON s.project_id = p.id
                WHERE s.project_id = %s ORDER BY s.created_at DESC LIMIT %s
            ''', (project_id, limit))
        else:
            cursor.execute('''
                SELECT s.*, p.name as project_name
                FROM simulations s LEFT JOIN projects p ON s.project_id = p.id
                ORDER BY s.created_at DESC LIMIT %s
            ''', (limit,))

        simulations = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for sim in simulations:
            d = dict(sim)
            if d.get('created_at'):      d['created_at']      = d['created_at'].isoformat()
            if d.get('completed_at'):    d['completed_at']    = d['completed_at'].isoformat()
            if d.get('elapsed_s'):       d['elapsed_s']       = float(d['elapsed_s'])
            if d.get('evacuation_time'): d['evacuation_time'] = float(d['evacuation_time'])
            # Parse JSON columns so frontend receives objects, not strings
            if isinstance(d.get('config'),  str): d['config']  = json.loads(d['config'])
            if isinstance(d.get('results'), str): d['results'] = json.loads(d['results'])
            result.append(d)
        return jsonify(result)

    except Exception as e:
        print(f"❌ Error listing simulations: {e}")
        return jsonify({"error": str(e)}), 500


@simulations_bp.route("/api/simulations/<int:sim_id>", methods=["GET", "OPTIONS"])
def get_simulation(sim_id):
    if request.method == "OPTIONS":
        return '', 200

    auth_err = require_auth()
    if auth_err:
        return auth_err

    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT s.*, p.name as project_name, p.project_data
            FROM simulations s LEFT JOIN projects p ON s.project_id = p.id
            WHERE s.id = %s
        ''', (sim_id,))
        simulation = cursor.fetchone()
        cursor.close(); conn.close()

        if not simulation:
            return jsonify({"error": "Simulation not found"}), 404

        d = dict(simulation)
        if d.get('created_at'):      d['created_at']      = d['created_at'].isoformat()
        if d.get('completed_at'):    d['completed_at']    = d['completed_at'].isoformat()
        if d.get('elapsed_s'):       d['elapsed_s']       = float(d['elapsed_s'])
        if d.get('evacuation_time'): d['evacuation_time'] = float(d['evacuation_time'])
        # Parse JSON columns
        if isinstance(d.get('config'),       str): d['config']       = json.loads(d['config'])
        if isinstance(d.get('results'),      str): d['results']      = json.loads(d['results'])
        if isinstance(d.get('project_data'), str): d['project_data'] = json.loads(d['project_data'])
        return jsonify(d)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@simulations_bp.route("/api/simulations/<int:sim_id>", methods=["DELETE", "OPTIONS"])
def delete_simulation(sim_id):
    if request.method == "OPTIONS":
        return '', 200

    auth_err = require_auth()
    if auth_err:
        return auth_err

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM simulations WHERE id = %s', (sim_id,))
        conn.commit()
        rows = cursor.rowcount
        cursor.close(); conn.close()
        if rows == 0:
            return jsonify({"error": "Simulation not found"}), 404
        print(f"✅ Deleted simulation #{sim_id}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500