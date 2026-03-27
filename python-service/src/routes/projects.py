# src/routes/projects.py
import json
from flask import Blueprint, request, jsonify
from psycopg2.extras import RealDictCursor
from src.utils import get_db
from src.map_object import validate_project_structure, reconstruct_objects_from_project

projects_bp = Blueprint('projects', __name__)


@projects_bp.route("/api/projects", methods=["POST"])
def create_project():
    try:
        data         = request.json
        project_data = data.get('project_data', {})

        is_valid, error = validate_project_structure(project_data)
        if not is_valid:
            return jsonify({"error": f"Invalid project structure: {error}"}), 400

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO projects (
                name, description, grid_width, grid_height,
                cell_size, project_data, building_count, total_floors
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            data.get('name', 'Untitled Project'),
            data.get('description', ''),
            data.get('grid_width', 80),
            data.get('grid_height', 60),
            data.get('cell_size', 10),
            json.dumps(project_data),
            data.get('building_count', 0),
            data.get('total_floors', 0),
        ))
        project_id = cursor.fetchone()[0]
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ Created project #{project_id}: {data.get('name')}")
        return jsonify({"id": project_id, "success": True, "message": "Project created successfully"}), 201

    except Exception as e:
        print(f"❌ Error creating project: {e}")
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/api/projects", methods=["GET"])
def list_projects():
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT id, name, description, grid_width, grid_height,
                   cell_size, building_count, total_floors, created_at, updated_at
            FROM projects ORDER BY updated_at DESC
        ''')
        projects = cursor.fetchall()
        cursor.close(); conn.close()

        result = []
        for p in projects:
            d = dict(p)
            if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
            if d.get('updated_at'): d['updated_at'] = d['updated_at'].isoformat()
            result.append(d)
        return jsonify(result)

    except Exception as e:
        print(f"❌ Error listing projects: {e}")
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/api/projects/<int:project_id>", methods=["GET"])
def get_project(project_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM projects WHERE id = %s', (project_id,))
        project = cursor.fetchone()
        cursor.close(); conn.close()

        if not project:
            return jsonify({"error": "Project not found"}), 404

        d = dict(project)
        if d.get('created_at'): d['created_at'] = d['created_at'].isoformat()
        if d.get('updated_at'): d['updated_at'] = d['updated_at'].isoformat()
        # Parse JSON columns — psycopg2 returns TEXT as strings
        if isinstance(d.get('project_data'), str):
            import json as _json
            d['project_data'] = _json.loads(d['project_data'])
        return jsonify(d)

    except Exception as e:
        print(f"❌ Error getting project {project_id}: {e}")
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/api/projects/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    try:
        data         = request.json
        project_data = data.get('project_data', {})
        if isinstance(project_data, str):
            project_data = json.loads(project_data)

        is_valid, error = validate_project_structure(project_data)
        if not is_valid:
            return jsonify({"error": f"Invalid project structure: {error}"}), 400

        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE projects SET
                name = %s, description = %s, grid_width = %s, grid_height = %s,
                cell_size = %s, project_data = %s, building_count = %s,
                total_floors = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (
            data.get('name', 'Untitled Project'),
            data.get('description', ''),
            data.get('grid_width', 80),
            data.get('grid_height', 60),
            data.get('cell_size', 10),
            json.dumps(project_data),
            data.get('building_count', 0),
            data.get('total_floors', 0),
            project_id,
        ))
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ Updated project #{project_id}")
        return jsonify({"id": project_id, "success": True})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/api/projects/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM projects WHERE id = %s', (project_id,))
        conn.commit()
        rows = cursor.rowcount
        cursor.close(); conn.close()

        if rows == 0:
            return jsonify({"error": "Project not found"}), 404

        print(f"✅ Deleted project #{project_id}")
        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/api/projects/<int:project_id>/validate", methods=["GET"])
def validate_project(project_id):
    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT project_data FROM projects WHERE id = %s', (project_id,))
        row = cursor.fetchone()
        cursor.close(); conn.close()

        if not row:
            return jsonify({"error": "Project not found"}), 404

        project_data = row['project_data']
        if isinstance(project_data, str):
            project_data = json.loads(project_data)

        is_valid, error = validate_project_structure(project_data)
        if not is_valid:
            return jsonify({"valid": False, "error": error})

        buildings = reconstruct_objects_from_project(project_data)
        counts = {"walls": 0, "exits": 0, "stairs": 0, "npcs": 0, "lines": 0}
        for building in buildings:
            for layer in building:
                for obj in layer:
                    if obj.type == "wall":   counts["walls"]  += 1
                    elif obj.type == "exit": counts["exits"]  += 1
                    elif obj.type in ("stairs", "concrete_stairs"): counts["stairs"] += 1
                    elif obj.type == "npc":  counts["npcs"]   += 1
                    elif obj.type == "line": counts["lines"]  += 1

        return jsonify({
            "valid": True,
            "building_count": len(buildings),
            "object_counts": counts,
            "message": "Project is valid and ready for simulation"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500