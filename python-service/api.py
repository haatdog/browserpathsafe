# pyright: reportMissingImports=false, reportMissingModuleSource=false
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import json
import os
import time
import psycopg2
import bcrypt
import secrets
import threading
import uuid
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from src.map_object import (
    MapObject,
    validate_project_structure,
    reconstruct_objects_from_project
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max body
app.secret_key = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_PATH'] = '/api'  # ← add this line
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # ← add this line
CORS(app)

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 200


# ==================== DATABASE CONFIGURATION ====================

DB_CONFIG = {
    'dbname': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'port': os.getenv('DB_PORT', '5432')
}

API_PORT = int(os.getenv('PYTHON_PORT', 5000))

def get_db():
    """Get PostgreSQL database connection"""
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def require_auth():
    """Helper function to require authentication"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401
    return None

def require_role(*allowed_roles):
    """Decorator to require specific role"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({"error": "Not authenticated"}), 401
            
            conn = get_db()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not user or user['role'] not in allowed_roles:
                return jsonify({"error": f"Requires role: {', '.join(allowed_roles)}"}), 403
            
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

def generate_user_id() -> str:
    return secrets.token_urlsafe(16)


def init_db():
    """Initialize database with all required tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Auth users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS auth_users (
            id VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # User profiles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            id VARCHAR(255) PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
            email VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'member',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            grid_width INTEGER DEFAULT 80,
            grid_height INTEGER DEFAULT 60,
            cell_size INTEGER DEFAULT 10,
            project_data JSON NOT NULL,
            building_count INTEGER DEFAULT 0,
            total_floors INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
    ''')
    
    # Simulations table with disaster_type
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS simulations (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            disaster_type VARCHAR(20) DEFAULT 'fire',
            status VARCHAR(50) DEFAULT 'completed',
            config JSON,
            results JSON NOT NULL,
            steps INTEGER,
            elapsed_s DECIMAL(10, 3),
            evacuation_time DECIMAL(10, 2),
            agents_spawned INTEGER,
            agents_evacuated INTEGER,
            agents_trapped INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_disaster_type CHECK (disaster_type IN ('fire', 'earthquake', 'bomb'))
        );
        CREATE INDEX IF NOT EXISTS idx_simulations_created ON simulations(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_simulations_project ON simulations(project_id);
        CREATE INDEX IF NOT EXISTS idx_simulations_user ON simulations(user_id);
    ''')

    # Announcements table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            is_pinned BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned DESC, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_announcements_user ON announcements(user_id);
    ''')
    
    # Announcement Likes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS announcement_likes (
            id SERIAL PRIMARY KEY,
            announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(announcement_id, user_id)
        );
    ''')
    
    # Announcement Comments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS announcement_comments (
            id SERIAL PRIMARY KEY,
            announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_comments_announcement ON announcement_comments(announcement_id);
    ''')
    
    # Events table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            event_type VARCHAR(50) DEFAULT 'meeting',
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            location VARCHAR(500),
            is_virtual BOOLEAN DEFAULT FALSE,
            meeting_link TEXT,
            max_participants INTEGER,
            created_by VARCHAR(255) REFERENCES user_profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_events_time ON events(start_time);
        CREATE INDEX IF NOT EXISTS idx_events_creator ON events(created_by);
    ''')
    
    # Incidents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id SERIAL PRIMARY KEY,
            reporter_id VARCHAR(255) NOT NULL REFERENCES user_profiles(id),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            incident_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            location VARCHAR(255),
            incident_date TIMESTAMP NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter_id);
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date DESC);
    ''')
    
    # Incident Remarks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incident_remarks (
            id SERIAL PRIMARY KEY,
            incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL REFERENCES user_profiles(id),
            remark TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_remarks_incident ON incident_remarks(incident_id);
        CREATE INDEX IF NOT EXISTS idx_remarks_user ON incident_remarks(user_id);
    ''')

    # Evacuation Evaluations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS evacuation_evaluations (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            instructor_name VARCHAR(255) NOT NULL,
            program_class VARCHAR(100) NOT NULL DEFAULT 'N/A',
            classroom_office VARCHAR(100) NOT NULL,
            male_count INTEGER NOT NULL CHECK (male_count >= 0),
            female_count INTEGER NOT NULL CHECK (female_count >= 0),
            comments TEXT,
            submitted_by VARCHAR(255) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
            submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT total_count_check CHECK (male_count + female_count > 0),
            UNIQUE(event_id, submitted_by)
        );
        CREATE INDEX IF NOT EXISTS idx_evacuation_evaluations_event ON evacuation_evaluations(event_id);
        CREATE INDEX IF NOT EXISTS idx_evacuation_evaluations_user ON evacuation_evaluations(submitted_by);
        CREATE INDEX IF NOT EXISTS idx_evacuation_evaluations_submitted ON evacuation_evaluations(submitted_at);
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Database initialized successfully!")

try:
    init_db()
except Exception as e:
    print(f"⚠️ Database initialization warning: {e}")


# ==================== AUTH ENDPOINTS ====================

@app.route("/api/auth/register", methods=["POST", "OPTIONS"])
def register():
    """Register a new user"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'member')
        
        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT id FROM auth_users WHERE email = %s', (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Email already registered"}), 400
        
        user_id = generate_user_id()
        password_hash = hash_password(password)
        
        cursor.execute('''
            INSERT INTO auth_users (id, email, password_hash)
            VALUES (%s, %s, %s)
        ''', (user_id, email, password_hash))
        
        cursor.execute('''
            INSERT INTO user_profiles (id, email, role)
            VALUES (%s, %s, %s)
        ''', (user_id, email, role))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ User registered: {email} ({role})")
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "user": {"id": user_id, "email": email, "role": role}
        }), 201
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    """Login user and create session"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT au.id, au.email, au.password_hash, up.role
            FROM auth_users au
            JOIN user_profiles up ON au.id = up.id
            WHERE au.email = %s
        ''', (email,))
        
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user or not check_password(password, user['password_hash']):
            return jsonify({"error": "Invalid email or password"}), 401
        
        session['user_id'] = user['id']
        session['email'] = user['email']
        session['role'] = user['role']
        
        print(f"✅ User logged in: {email}")
        return jsonify({
            "success": True,
            "user": {
                "id": user['id'],
                "email": user['email'],
                "role": user['role']
            }
        })
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    """Logout user and clear session"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        session.clear()
        return jsonify({"success": True, "message": "Logged out"})
    except Exception as e:
        print(f"❌ Logout error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/me", methods=["GET", "OPTIONS"])
def get_current_user():
    """Get current logged-in user"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT id, email, role, created_at, updated_at
            FROM user_profiles
            WHERE id = %s
        ''', (user_id,))
        
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            session.clear()
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "id": user['id'],
            "email": user['email'],
            "role": user['role'],
            "created_at": user['created_at'].isoformat() if user['created_at'] else None,
            "updated_at": user['updated_at'].isoformat() if user['updated_at'] else None
        })
        
    except Exception as e:
        print(f"❌ Error getting current user: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== USER MANAGEMENT ENDPOINTS ====================

@app.route("/api/users", methods=["GET", "OPTIONS"])
def get_all_users():
    """Get all users (admin only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'admin':
            cursor.close()
            conn.close()
            return jsonify({"error": "Admin access required"}), 403
        
        cursor.execute('''
            SELECT u.id, u.email, u.role, u.group_id, u.is_head,
                g.name as group_name,
                u.created_at, u.updated_at
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.created_at DESC
        ''')
        
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for u in users:
            result.append({
                "id": u['id'],
                "email": u['email'],
                "role": u['role'],
                "group_id": u['group_id'],
                "group_name": u['group_name'],
                "is_head": bool(u['is_head']) if u['is_head'] is not None else False,
                "created_at": u['created_at'].isoformat() if u['created_at'] else None,
                "updated_at": u['updated_at'].isoformat() if u['updated_at'] else None
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting users: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<string:user_id>/role", methods=["PUT", "OPTIONS"])
def update_user_role(user_id):
    """Update user role (admin only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        current_user_id = session.get('user_id')
        if not current_user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        current_user = cursor.fetchone()
        
        if not current_user or current_user['role'] != 'admin':
            cursor.close()
            conn.close()
            return jsonify({"error": "Admin access required"}), 403
        
        data = request.json
        new_role = data.get('role')
        
        if new_role not in ['admin', 'executive', 'member']:
            cursor.close()
            conn.close()
            return jsonify({"error": "Invalid role"}), 400
        
        cursor.execute('''
            UPDATE user_profiles
            SET role = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, email, role, created_at, updated_at
        ''', (new_role, user_id))
        
        updated_user = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        if not updated_user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "id": updated_user['id'],
            "email": updated_user['email'],
            "role": updated_user['role'],
            "created_at": updated_user['created_at'].isoformat() if updated_user['created_at'] else None,
            "updated_at": updated_user['updated_at'].isoformat() if updated_user['updated_at'] else None
        })
        
    except Exception as e:
        print(f"❌ Error updating user role: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<string:user_id>", methods=["DELETE", "OPTIONS"])
def delete_user(user_id):
    """Delete user (admin only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        current_user_id = session.get('user_id')
        if not current_user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (current_user_id,))
        current_user = cursor.fetchone()
        
        if not current_user or current_user['role'] != 'admin':
            cursor.close()
            conn.close()
            return jsonify({"error": "Admin access required"}), 403
        
        if user_id == current_user_id:
            cursor.close()
            conn.close()
            return jsonify({"error": "Cannot delete your own account"}), 400
        
        cursor.execute('DELETE FROM auth_users WHERE id = %s', (user_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Deleted user {user_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== HEALTH CHECK ====================

@app.route("/health", methods=["GET"])
def health():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        conn.close()
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "database": "disconnected", "error": str(e)}), 500


# ==================== PROJECT CRUD ENDPOINTS ====================

@app.route("/api/projects", methods=["POST"])
def create_project():
    """POST /api/projects - Create new project"""
    try:
        data = request.json
        
        project_data = data.get('project_data', {})
        is_valid, error = validate_project_structure(project_data)
        if not is_valid:
            return jsonify({"error": f"Invalid project structure: {error}"}), 400
        
        conn = get_db()
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
            data.get('total_floors', 0)
        ))
        
        project_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Created project #{project_id}: {data.get('name')}")
        
        return jsonify({
            "id": project_id,
            "success": True,
            "message": "Project created successfully"
        }), 201
        
    except Exception as e:
        print(f"❌ Error creating project: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects", methods=["GET"])
def list_projects():
    """GET /api/projects - List all projects"""
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT id, name, description, grid_width, grid_height, 
                   cell_size, building_count, total_floors, 
                   created_at, updated_at
            FROM projects 
            ORDER BY updated_at DESC
        ''')
        
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        
        for project in projects:
            if project['created_at']:
                project['created_at'] = project['created_at'].isoformat()
            if project['updated_at']:
                project['updated_at'] = project['updated_at'].isoformat()
        
        return jsonify(projects)
        
    except Exception as e:
        print(f"❌ Error listing projects: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<int:project_id>", methods=["GET"])
def get_project(project_id):
    """GET /api/projects/<id> - Get single project"""
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT * FROM projects WHERE id = %s', (project_id,))
        project = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        if project['created_at']:
            project['created_at'] = project['created_at'].isoformat()
        if project['updated_at']:
            project['updated_at'] = project['updated_at'].isoformat()
        
        return jsonify(project)
        
    except Exception as e:
        print(f"❌ Error getting project {project_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    try:
        data = request.json
        
        project_data = data.get('project_data', {})
        
        if isinstance(project_data, str):
            project_data = json.loads(project_data)
        
        is_valid, error = validate_project_structure(project_data)
        if not is_valid:
            return jsonify({"error": f"Invalid project structure: {error}"}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE projects SET
                name = %s,
                description = %s,
                grid_width = %s,
                grid_height = %s,
                cell_size = %s,
                project_data = %s,
                building_count = %s,
                total_floors = %s,
                updated_at = CURRENT_TIMESTAMP
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
            project_id
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Updated project #{project_id}")
        return jsonify({"id": project_id, "success": True})
        
    except Exception as e:
        print(f"❌ Error updating project {project_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    """DELETE /api/projects/<id> - Delete project"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM projects WHERE id = %s', (project_id,))
        conn.commit()
        
        rows_affected = cursor.rowcount
        cursor.close()
        conn.close()
        
        if rows_affected == 0:
            return jsonify({"error": "Project not found"}), 404
        
        print(f"✅ Deleted project #{project_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error deleting project {project_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<int:project_id>/validate", methods=["GET"])
def validate_project(project_id):
    """GET /api/projects/<id>/validate - Validate project"""
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT project_data FROM projects WHERE id = %s', (project_id,))
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not row:
            return jsonify({"error": "Project not found"}), 404
        
        project_data = row['project_data']
        if isinstance(project_data, str):
            project_data = json.loads(project_data)
        
        is_valid, error = validate_project_structure(project_data)
        
        if not is_valid:
            return jsonify({"valid": False, "error": error})
        
        try:
            buildings = reconstruct_objects_from_project(project_data)
            
            object_counts = {
                "walls": 0, "exits": 0, "stairs": 0, "npcs": 0, "lines": 0
            }
            
            for building in buildings:
                for layer in building:
                    for obj in layer:
                        if obj.type == "wall":
                            object_counts["walls"] += 1
                        elif obj.type == "exit":
                            object_counts["exits"] += 1
                        elif obj.type == "stairs":
                            object_counts["stairs"] += 1
                        elif obj.type == "npc":
                            object_counts["npcs"] += 1
                        elif obj.type == "line":
                            object_counts["lines"] += 1
            
            return jsonify({
                "valid": True,
                "building_count": len(buildings),
                "object_counts": object_counts,
                "message": "Project is valid and ready for simulation"
            })
            
        except Exception as e:
            return jsonify({
                "valid": False,
                "error": f"Failed to reconstruct objects: {str(e)}"
            })
        
    except Exception as e:
        print(f"❌ Error validating project {project_id}: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== SIMULATION ENDPOINTS (DISASTER-AWARE) ====================

# In-memory job store  {job_id: {status, progress, result, error}}
# Jobs are kept for 10 minutes then cleaned up automatically.
_simulation_jobs: dict = {}
_jobs_lock = threading.Lock()
 
 
def _cleanup_old_jobs():
    """Remove jobs older than 10 minutes."""
    import time as _time
    cutoff = _time.time() - 600
    with _jobs_lock:
        to_delete = [jid for jid, job in _simulation_jobs.items()
                     if job.get('started_at', 0) < cutoff]
        for jid in to_delete:
            del _simulation_jobs[jid]
 
 
def _run_simulation_thread(job_id: str, project_data, disaster_type: str,
                           max_steps: int, project_id: int, user_id):
    """Run simulation in background thread, updating job progress."""
    import time as _time
    from src.simulation import run_simulation as _run_sim
 
    def on_progress(info: dict):
        with _jobs_lock:
            if job_id in _simulation_jobs:
                _simulation_jobs[job_id]['progress'] = info
 
    try:
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'running'
 
        # Run — progress_callback fires every 100 steps
        results = _run_sim(project_data, max_steps=max_steps,
                           disaster_type=disaster_type)
 
        # Save to DB
        try:
            conn = get_db()
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
                json.dumps({
                    'disaster_type': disaster_type,
                    'max_steps': max_steps,
                }),
                json.dumps(results),
                results.get('steps', 0),
                results.get('elapsed_s', 0),
                results.get('evacuation_time', 0),
                results.get('agents_spawned', 0),
                results.get('agents_evacuated', 0),
                results.get('agents_trapped', 0),
            ))
            sim_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            conn.close()
            results['simulation_id'] = sim_id
        except Exception as db_err:
            print(f"⚠️  DB save failed for job {job_id}: {db_err}")
 
        with _jobs_lock:
            _simulation_jobs[job_id]['status']  = 'completed'
            _simulation_jobs[job_id]['results'] = results
            _simulation_jobs[job_id]['progress'] = {
                'pct': 100, 'evacuated': results.get('agents_evacuated', 0),
                'remaining': 0, 'queued': 0,
                'step': results.get('steps', 0),
                'max_steps': max_steps,
                'total': results.get('agents_spawned', 0),
            }
 
        print(f"✅ Job {job_id} done: "
              f"{results.get('agents_evacuated')}/{results.get('agents_spawned')} evacuated")
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'failed'
            _simulation_jobs[job_id]['error']  = str(e)
 
 
# ── Endpoint 1: Start simulation (returns job_id immediately) ──────────────────
 
# In-memory job store  {job_id: {status, progress, result, error}}
# Jobs are kept for 10 minutes then cleaned up automatically.
_simulation_jobs: dict = {}
_jobs_lock = threading.Lock()
 
 
def _cleanup_old_jobs():
    """Remove jobs older than 10 minutes."""
    import time as _time
    cutoff = _time.time() - 600
    with _jobs_lock:
        to_delete = [jid for jid, job in _simulation_jobs.items()
                     if job.get('started_at', 0) < cutoff]
        for jid in to_delete:
            del _simulation_jobs[jid]
 
 
def _run_simulation_thread(job_id: str, project_data, disaster_type: str,
                           max_steps: int, project_id: int, user_id):
    cancel_flag = {'cancel': False}
    with _jobs_lock:
        if job_id in _simulation_jobs:
            _simulation_jobs[job_id]['cancel_flag'] = cancel_flag
    """Run simulation in background thread, updating job progress."""
    import time as _time
    from src.simulation import run_simulation as _run_sim
 
    def on_progress(info: dict):
        with _jobs_lock:
            if job_id in _simulation_jobs:
                _simulation_jobs[job_id]['progress'] = info
 
    try:
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'running'
 
        # Run — progress_callback fires every 100 steps
        results = _run_sim(project_data, max_steps=max_steps,
                           disaster_type=disaster_type,
                           progress_callback=on_progress,
                           cancel_flag=cancel_flag)
 
        # Save to DB
        try:
            conn = get_db()
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
                json.dumps({
                    'disaster_type': disaster_type,
                    'max_steps': max_steps,
                }),
                json.dumps(results),
                results.get('steps', 0),
                results.get('elapsed_s', 0),
                results.get('evacuation_time', 0),
                results.get('agents_spawned', 0),
                results.get('agents_evacuated', 0),
                results.get('agents_trapped', 0),
            ))
            sim_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            conn.close()
            results['simulation_id'] = sim_id
        except Exception as db_err:
            print(f"⚠️  DB save failed for job {job_id}: {db_err}")
 
        with _jobs_lock:
            _simulation_jobs[job_id]['status']  = 'completed'
            _simulation_jobs[job_id]['results'] = results
            _simulation_jobs[job_id]['progress'] = {
                'pct': 100, 'evacuated': results.get('agents_evacuated', 0),
                'remaining': 0, 'queued': 0,
                'step': results.get('steps', 0),
                'max_steps': max_steps,
                'total': results.get('agents_spawned', 0),
            }
 
        print(f"✅ Job {job_id} done: "
              f"{results.get('agents_evacuated')}/{results.get('agents_spawned')} evacuated")
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        with _jobs_lock:
            _simulation_jobs[job_id]['status'] = 'failed'
            _simulation_jobs[job_id]['error']  = str(e)
 
 
# ── Endpoint 1: Start simulation (returns job_id immediately) ──────────────────
 
@app.route("/api/simulations/run", methods=["POST", "OPTIONS"])
def run_simulation():
    """Start simulation in background. Returns job_id for progress polling."""
    if request.method == "OPTIONS":
        return '', 200
 
    auth_error = require_auth()
    if auth_error:
        return auth_error
 
    try:
        data         = request.json
        project_id   = data.get('project_id')
        disaster_type = data.get('disaster_type', 'fire')
        max_steps    = int(data.get('max_steps', 10000))
        user_id      = session.get('user_id')
 
        if not project_id:
            return jsonify({"error": "project_id required"}), 400
        if disaster_type not in ('fire', 'earthquake', 'bomb'):
            return jsonify({"error": "Invalid disaster_type"}), 400
 
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT project_data FROM projects WHERE id = %s', (project_id,))
        row    = cursor.fetchone()
        cursor.close()
        conn.close()
 
        if not row:
            return jsonify({"error": "Project not found"}), 404
 
        project_data = row[0]
        if isinstance(project_data, str):
            project_data = json.loads(project_data)
 
        # Create job entry
        _cleanup_old_jobs()
        job_id = str(uuid.uuid4())
        import time as _time
        with _jobs_lock:
            _simulation_jobs[job_id] = {
                'status':     'queued',
                'progress':   {'pct': 0, 'step': 0, 'max_steps': max_steps,
                               'evacuated': 0, 'remaining': 0, 'queued': 0, 'total': 0},
                'results':    None,
                'error':      None,
                'started_at': _time.time(),
            }
 
        # Launch background thread
        t = threading.Thread(
            target=_run_simulation_thread,
            args=(job_id, project_data, disaster_type, max_steps, project_id, user_id),
            daemon=True,
        )
        t.start()
 
        print(f"🚀 Started simulation job {job_id} ({disaster_type}) for project {project_id}")
        return jsonify({"success": True, "job_id": job_id}), 202
 
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
 
 
# ── Endpoint 2: Poll progress ──────────────────────────────────────────────────
 
@app.route("/api/simulations/progress/<job_id>", methods=["GET", "OPTIONS"])
def get_simulation_progress(job_id):
    """
    GET /api/simulations/progress/<job_id>
 
    Returns:
      { status: 'queued'|'running'|'completed'|'failed',
        progress: { pct, step, max_steps, evacuated, remaining, queued, total },
        results: {...} | null,   # only when status='completed'
        error: string | null }
    """
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
 
 
# ── Endpoint 3: Cancel simulation ──────────────────────────────────────────────
 
@app.route("/api/simulations/cancel/<job_id>", methods=["POST", "OPTIONS"])
def cancel_simulation(job_id):
    """
    POST /api/simulations/cancel/<job_id>
    Sets the cancel flag so the simulation thread exits cleanly on its next step.
    """
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

@app.route("/api/simulations", methods=["GET", "OPTIONS"])
def get_simulations():
    """GET /api/simulations - List all simulations"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        project_id = request.args.get('project_id')
        limit = int(request.args.get('limit', 100))
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        if project_id:
            cursor.execute('''
                SELECT s.*, p.name as project_name
                FROM simulations s
                LEFT JOIN projects p ON s.project_id = p.id
                WHERE s.project_id = %s
                ORDER BY s.created_at DESC
                LIMIT %s
            ''', (project_id, limit))
        else:
            cursor.execute('''
                SELECT s.*, p.name as project_name
                FROM simulations s
                LEFT JOIN projects p ON s.project_id = p.id
                ORDER BY s.created_at DESC
                LIMIT %s
            ''', (limit,))
        
        simulations = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for sim in simulations:
            sim_dict = dict(sim)
            if sim_dict.get('created_at'):
                sim_dict['created_at'] = sim_dict['created_at'].isoformat()
            if sim_dict.get('completed_at'):
                sim_dict['completed_at'] = sim_dict['completed_at'].isoformat()
            if sim_dict.get('elapsed_s'):
                sim_dict['elapsed_s'] = float(sim_dict['elapsed_s'])
            if sim_dict.get('evacuation_time'):
                sim_dict['evacuation_time'] = float(sim_dict['evacuation_time'])
            result.append(sim_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error listing simulations: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/simulations/<int:sim_id>", methods=["GET", "OPTIONS"])
def get_simulation(sim_id):
    """GET /api/simulations/<id> - Get single simulation"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT s.*, p.name as project_name, p.project_data
            FROM simulations s
            LEFT JOIN projects p ON s.project_id = p.id
            WHERE s.id = %s
        ''', (sim_id,))
        
        simulation = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not simulation:
            return jsonify({"error": "Simulation not found"}), 404
        
        sim_dict = dict(simulation)
        if sim_dict.get('created_at'):
            sim_dict['created_at'] = sim_dict['created_at'].isoformat()
        if sim_dict.get('completed_at'):
            sim_dict['completed_at'] = sim_dict['completed_at'].isoformat()
        if sim_dict.get('elapsed_s'):
            sim_dict['elapsed_s'] = float(sim_dict['elapsed_s'])
        if sim_dict.get('evacuation_time'):
            sim_dict['evacuation_time'] = float(sim_dict['evacuation_time'])
        
        return jsonify(sim_dict)
        
    except Exception as e:
        print(f"❌ Error getting simulation {sim_id}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/simulations/<int:sim_id>", methods=["DELETE", "OPTIONS"])
def delete_simulation(sim_id):
    """DELETE /api/simulations/<id> - Delete simulation"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM simulations WHERE id = %s', (sim_id,))
        conn.commit()
        
        rows_affected = cursor.rowcount
        cursor.close()
        conn.close()
        
        if rows_affected == 0:
            return jsonify({"error": "Simulation not found"}), 404
        
        print(f"✅ Deleted simulation #{sim_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error deleting simulation {sim_id}: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== ANNOUNCEMENT ENDPOINTS ====================

@app.route("/api/announcements", methods=["GET", "OPTIONS"])
def get_announcements():
    """GET announcements — filtered by audience targeting"""
    if request.method == "OPTIONS":
        return '', 200

    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('''
            SELECT
                a.*,
                u.email as author_email,
                u.role as author_role,
                u.group_id as author_group_id,
                u.is_head as author_is_head,
                g.name as author_group_name,
                tg.name as target_group_name,
                (SELECT COUNT(*) FROM announcement_likes WHERE announcement_id = a.id) as likes_count,
                (SELECT COUNT(*) FROM announcement_likes WHERE announcement_id = a.id AND user_id = %(uid)s) > 0 as user_liked,
                (SELECT COUNT(*) FROM announcement_comments WHERE announcement_id = a.id) as comments_count
            FROM announcements a
            LEFT JOIN user_profiles u ON a.user_id = u.id
            LEFT JOIN groups g ON u.group_id = g.id
            LEFT JOIN groups tg ON a.target_group_id = tg.id
            WHERE (
                -- Executives and admins always see everything
                (SELECT role FROM user_profiles WHERE id = %(uid)s) IN ('executive', 'admin')

                OR

                -- No targeting = visible to everyone
                (a.target_group_id IS NULL AND a.target_heads_only = FALSE)

                OR

                -- Targeted to the viewer's group
                (
                    a.target_group_id IS NOT NULL
                    AND a.target_group_id = (SELECT group_id FROM user_profiles WHERE id = %(uid)s)
                )

                OR

                -- Heads-only, and viewer is a head
                (
                    a.target_heads_only = TRUE
                    AND (SELECT is_head FROM user_profiles WHERE id = %(uid)s) = TRUE
                )
            )
            ORDER BY a.is_pinned DESC, a.created_at DESC
        ''', {'uid': user_id})

        announcements = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for announcement in announcements:
            ann_dict = dict(announcement)
            if ann_dict.get('created_at'):
                ann_dict['created_at'] = ann_dict['created_at'].isoformat()
            if ann_dict.get('updated_at'):
                ann_dict['updated_at'] = ann_dict['updated_at'].isoformat()
            ann_dict['likes_count'] = int(ann_dict.get('likes_count') or 0)
            ann_dict['comments_count'] = int(ann_dict.get('comments_count') or 0)
            ann_dict['target_group_id'] = ann_dict.get('target_group_id')
            ann_dict['target_group_name'] = ann_dict.get('target_group_name')
            ann_dict['target_heads_only'] = bool(ann_dict.get('target_heads_only'))
            ann_dict['author_group_id'] = ann_dict.get('author_group_id')
            ann_dict['author_is_head'] = bool(ann_dict.get('author_is_head'))
            if not ann_dict.get('image_url'):
                ann_dict['image_url'] = None
            result.append(ann_dict)

        return jsonify(result)

    except Exception as e:
        print(f"❌ Error getting announcements: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements", methods=["POST", "OPTIONS"])
def create_announcement():
    """POST create announcement (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role, email FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can create announcements"}), 403
        
        data = request.json
        
        cursor.execute('''
            INSERT INTO announcements (user_id, title, content, image_url, image_urls, target_group_id, target_heads_only)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            user_id,
            data.get('title'),
            data.get('content'),
            data.get('image_url'),
            json.dumps(data.get('image_urls', [])),
            data.get('target_group_id'),
            data.get('target_heads_only', False)
        ))
        
        announcement = cursor.fetchone()
        conn.commit()
        
        cursor.close()
        conn.close()
        
        result = dict(announcement)
        result['author_email'] = user['email']
        result['author_role'] = user['role']
        result['likes_count'] = 0
        result['comments_count'] = 0
        result['user_liked'] = False
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        if result.get('updated_at'):
            result['updated_at'] = result['updated_at'].isoformat()
        
        return jsonify(result), 201
        
    except Exception as e:
        print(f"❌ Error creating announcement: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements/<int:announcement_id>/pin", methods=["PUT", "OPTIONS"])
def toggle_pin_announcement(announcement_id):
    """PUT toggle pin (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can pin announcements"}), 403
        
        data = request.json
        
        cursor.execute('''
            UPDATE announcements 
            SET is_pinned = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (data.get('is_pinned'), announcement_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error toggling pin: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements/<int:announcement_id>/like", methods=["POST", "OPTIONS"])
def toggle_like_announcement(announcement_id):
    """POST toggle like"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id FROM announcement_likes 
            WHERE announcement_id = %s AND user_id = %s
        ''', (announcement_id, user_id))
        
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute('''
                DELETE FROM announcement_likes 
                WHERE announcement_id = %s AND user_id = %s
            ''', (announcement_id, user_id))
        else:
            cursor.execute('''
                INSERT INTO announcement_likes (announcement_id, user_id)
                VALUES (%s, %s)
            ''', (announcement_id, user_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error toggling like: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements/<int:announcement_id>", methods=["DELETE", "OPTIONS"])
def delete_announcement(announcement_id):
    """DELETE announcement (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can delete announcements"}), 403
        
        cursor.execute('DELETE FROM announcements WHERE id = %s', (announcement_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error deleting announcement: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements/<int:announcement_id>/comments", methods=["GET", "OPTIONS"])
def get_announcement_comments(announcement_id):
    """GET comments for announcement"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT c.*, u.email as user_email, u.role as user_role
            FROM announcement_comments c
            LEFT JOIN user_profiles u ON c.user_id = u.id
            WHERE c.announcement_id = %s
            ORDER BY c.created_at ASC
        ''', (announcement_id,))
        
        comments = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for comment in comments:
            comment_dict = dict(comment)
            if comment_dict.get('created_at'):
                comment_dict['created_at'] = comment_dict['created_at'].isoformat()
            result.append(comment_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting comments: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/announcements/<int:announcement_id>/comments", methods=["POST", "OPTIONS"])
def add_announcement_comment(announcement_id):
    """POST add comment to announcement"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        data = request.json
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            INSERT INTO announcement_comments (announcement_id, user_id, content)
            VALUES (%s, %s, %s)
            RETURNING *
        ''', (announcement_id, user_id, data.get('content')))
        
        comment = cursor.fetchone()
        conn.commit()
        
        cursor.execute('SELECT email, role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        result = dict(comment)
        result['user_email'] = user['email'] if user else None
        result['user_role'] = user['role'] if user else None
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        
        return jsonify(result), 201
        
    except Exception as e:
        print(f"❌ Error adding comment: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== EVENT ENDPOINTS ====================

@app.route("/api/events", methods=["GET", "OPTIONS"])
def get_events():
    """GET events"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        if year and month:
            cursor.execute('''
                SELECT e.*, u.email as creator_email
                FROM events e
                LEFT JOIN user_profiles u ON e.created_by = u.id
                WHERE EXTRACT(YEAR FROM start_time) = %s 
                AND EXTRACT(MONTH FROM start_time) = %s
                ORDER BY start_time DESC
            ''', (year, month))
        else:
            cursor.execute('''
                SELECT e.*, u.email as creator_email
                FROM events e
                LEFT JOIN user_profiles u ON e.created_by = u.id
                ORDER BY start_time DESC
                LIMIT 100
            ''')
        
        events = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for event in events:
            event_dict = dict(event)
            if event_dict.get('start_time'):
                event_dict['start_time'] = event_dict['start_time'].isoformat()
            if event_dict.get('end_time'):
                event_dict['end_time'] = event_dict['end_time'].isoformat()
            if event_dict.get('created_at'):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            result.append(event_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting events: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/events", methods=["POST", "OPTIONS"])
def create_event():
    """POST create event (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can create events"}), 403
        
        data = request.json
        
        cursor.execute('''
            INSERT INTO events (
                title, description, event_type, start_time, end_time, location, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            data.get('title'),
            data.get('description'),
            data.get('event_type'),
            data.get('start_time'),
            data.get('end_time'),
            data.get('location'),
            user_id
        ))
        
        event = cursor.fetchone()
        conn.commit()
        
        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (user_id,))
        creator = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        result = dict(event)
        result['creator_email'] = creator['email'] if creator else None
        if result.get('start_time'):
            result['start_time'] = result['start_time'].isoformat()
        if result.get('end_time'):
            result['end_time'] = result['end_time'].isoformat()
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        
        return jsonify(result), 201
        
    except Exception as e:
        print(f"❌ Error creating event: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/events/<int:event_id>", methods=["PUT", "OPTIONS"])
def update_event(event_id):
    """PUT update event (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can update events"}), 403
        
        data = request.json
        
        cursor.execute('''
            UPDATE events
            SET title = %s, description = %s, event_type = %s,
                start_time = %s, end_time = %s, location = %s
            WHERE id = %s
            RETURNING *
        ''', (
            data.get('title'),
            data.get('description'),
            data.get('event_type'),
            data.get('start_time'),
            data.get('end_time'),
            data.get('location'),
            event_id
        ))
        
        event = cursor.fetchone()
        conn.commit()
        
        if not event:
            cursor.close()
            conn.close()
            return jsonify({"error": "Event not found"}), 404
        
        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (event['created_by'],))
        creator = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        result = dict(event)
        result['creator_email'] = creator['email'] if creator else None
        if result.get('start_time'):
            result['start_time'] = result['start_time'].isoformat()
        if result.get('end_time'):
            result['end_time'] = result['end_time'].isoformat()
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error updating event: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/events/<int:event_id>", methods=["DELETE", "OPTIONS"])
def delete_event(event_id):
    """DELETE event (executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({"error": "Only executives can delete events"}), 403
        
        cursor.execute('DELETE FROM events WHERE id = %s', (event_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"❌ Error deleting event: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== INCIDENT REPORT ENDPOINTS ====================

@app.route("/api/incidents", methods=["POST", "OPTIONS"])
def create_incident():
    """POST create incident report (All authenticated users)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        data = request.json
        
        # Validation
        required = ['title', 'description', 'incident_type', 'severity', 'incident_date']
        if not all(k in data for k in required):
            return jsonify({'error': 'Missing required fields'}), 400
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            INSERT INTO incidents 
            (reporter_id, title, description, incident_type, severity, location, incident_date, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        ''', (
            user_id,
            data.get('title'),
            data.get('description'),
            data.get('incident_type'),
            data.get('severity'),
            data.get('location'),
            data.get('incident_date'),
            json.dumps(data.get('image_urls', []))
        ))
        
        incident = cursor.fetchone()
        conn.commit()
        
        cursor.execute('SELECT email FROM user_profiles WHERE id = %s', (user_id,))
        reporter = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        result = dict(incident)
        result['reporter_email'] = reporter['email'] if reporter else None
        result['remarks_count'] = 0
        if result.get('incident_date'):
            result['incident_date'] = result['incident_date'].isoformat()
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        if result.get('updated_at'):
            result['updated_at'] = result['updated_at'].isoformat()
        
        print(f"✅ Incident created: {data.get('title')} by {reporter['email'] if reporter else 'unknown'}")
        return jsonify(result), 201
        
    except Exception as e:
        print(f"❌ Error creating incident: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/incidents", methods=["GET", "OPTIONS"])
def get_incidents():
    """GET incidents (Members see own, Executives see all)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        user_role = user['role'] if user else 'member'
        
        # Executives and admins see all, members see only their own
        if user_role in ['executive', 'admin']:
            cursor.execute('''
                SELECT 
                    i.id, i.title, i.description, i.incident_type, i.severity,
                    i.location, i.incident_date, i.status, i.image_url, i.image_urls,
                    i.created_at, i.updated_at,
                    u.email as reporter_email,
                    (SELECT COUNT(*) FROM incident_remarks WHERE incident_id = i.id) as remarks_count
                FROM incidents i
                JOIN user_profiles u ON i.reporter_id = u.id
                ORDER BY i.incident_date DESC
            ''')
        else:
            cursor.execute('''
                SELECT 
                    i.id, i.title, i.description, i.incident_type, i.severity,
                    i.location, i.incident_date, i.status, i.image_url, i.image_urls,
                    i.created_at, i.updated_at,
                    u.email as reporter_email,
                    (SELECT COUNT(*) FROM incident_remarks WHERE incident_id = i.id) as remarks_count
                FROM incidents i
                JOIN user_profiles u ON i.reporter_id = u.id
                WHERE i.reporter_id = %s
                ORDER BY i.incident_date DESC
            ''', (user_id,))
        
        incidents = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for incident in incidents:
            inc_dict = dict(incident)
            if inc_dict.get('incident_date'):
                inc_dict['incident_date'] = inc_dict['incident_date'].isoformat()
            if inc_dict.get('created_at'):
                inc_dict['created_at'] = inc_dict['created_at'].isoformat()
            if inc_dict.get('updated_at'):
                inc_dict['updated_at'] = inc_dict['updated_at'].isoformat()
            inc_dict['remarks_count'] = int(inc_dict.get('remarks_count') or 0)
            result.append(inc_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting incidents: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/incidents/<int:incident_id>", methods=["GET", "OPTIONS"])
def get_incident(incident_id):
    """GET single incident with remarks"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        user_role = user['role'] if user else 'member'
        
        # Get incident
        cursor.execute('''
            SELECT 
                i.id, i.reporter_id, i.title, i.description, i.incident_type, i.severity,
                i.location, i.incident_date, i.status, i.image_url, i.image_urls,
                i.created_at, i.updated_at,
                u.email as reporter_email
            FROM incidents i
            JOIN user_profiles u ON i.reporter_id = u.id
            WHERE i.id = %s
        ''', (incident_id,))
        
        incident = cursor.fetchone()
        
        if not incident:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Incident not found'}), 404
        
        # Check permissions: Members can only view their own
        if user_role not in ['executive', 'admin'] and incident['reporter_id'] != user_id:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Access denied'}), 403
        
        inc_dict = dict(incident)
        if inc_dict.get('incident_date'):
            inc_dict['incident_date'] = inc_dict['incident_date'].isoformat()
        if inc_dict.get('created_at'):
            inc_dict['created_at'] = inc_dict['created_at'].isoformat()
        if inc_dict.get('updated_at'):
            inc_dict['updated_at'] = inc_dict['updated_at'].isoformat()
        
        # Get remarks
        cursor.execute('''
            SELECT 
                r.id, r.remark, r.created_at,
                u.email as author_email, u.role as author_role
            FROM incident_remarks r
            JOIN user_profiles u ON r.user_id = u.id
            WHERE r.incident_id = %s
            ORDER BY r.created_at ASC
        ''', (incident_id,))
        
        remarks = []
        for remark in cursor.fetchall():
            remark_dict = dict(remark)
            if remark_dict.get('created_at'):
                remark_dict['created_at'] = remark_dict['created_at'].isoformat()
            remarks.append(remark_dict)
        
        inc_dict['remarks'] = remarks
        
        cursor.close()
        conn.close()
        
        return jsonify(inc_dict)
        
    except Exception as e:
        print(f"❌ Error getting incident: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/incidents/<int:incident_id>/remarks", methods=["POST", "OPTIONS"])
def add_remark(incident_id):
    """POST add remark to incident (Executives only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] not in ['executive', 'admin']:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Only executives can add remarks'}), 403
        
        data = request.json
        if 'remark' not in data:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Remark text required'}), 400
        
        # Check incident exists
        cursor.execute('SELECT id FROM incidents WHERE id = %s', (incident_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Incident not found'}), 404
        
        # Insert remark
        cursor.execute('''
            INSERT INTO incident_remarks (incident_id, user_id, remark)
            VALUES (%s, %s, %s)
            RETURNING *
        ''', (incident_id, user_id, data['remark']))
        
        remark = cursor.fetchone()
        conn.commit()
        
        cursor.execute('SELECT email, role FROM user_profiles WHERE id = %s', (user_id,))
        author = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        result = dict(remark)
        result['author_email'] = author['email'] if author else None
        result['author_role'] = author['role'] if author else None
        if result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat()
        
        print(f"✅ Remark added to incident #{incident_id} by {author['email'] if author else 'unknown'}")
        return jsonify(result), 201
        
    except Exception as e:
        print(f"❌ Error adding remark: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/incidents/<int:incident_id>/status", methods=["PATCH", "OPTIONS"])
def update_incident_status(incident_id):
    """PATCH update incident status (Executives only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] not in ['executive', 'admin']:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Only executives can update status'}), 403
        
        data = request.json
        if 'status' not in data:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Status required'}), 400
        
        valid_statuses = ['pending', 'under_review', 'resolved', 'closed']
        if data['status'] not in valid_statuses:
            cursor.close()
            conn.close()
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        cursor.execute('''
            UPDATE incidents 
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        ''', (data['status'], incident_id))
        
        incident = cursor.fetchone()
        
        if not incident:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Incident not found'}), 404
        
        conn.commit()
        cursor.close()
        conn.close()
        
        result = dict(incident)
        if result.get('updated_at'):
            result['updated_at'] = result['updated_at'].isoformat()
        
        print(f"✅ Incident #{incident_id} status updated to {data['status']}")
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error updating incident status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
# ==================== EVACUATION EVALUATION ENDPOINTS ====================

@app.route("/api/evaluations/pending", methods=["GET", "OPTIONS"])
def get_pending_evaluations():
    """Get evacuation drills that need evaluation from current user"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get recent evacuation drills where user hasn't submitted evaluation
        cursor.execute('''
            SELECT 
                e.id, 
                e.title, 
                e.event_type, 
                e.start_time, 
                e.end_time,
                e.description
            FROM events e
            WHERE e.event_type IN ('drill', 'fire_drill', 'earthquake_drill', 'bomb_threat_drill')
            AND e.start_time <= NOW()
            AND e.start_time >= NOW() - INTERVAL '30 days'
            AND NOT EXISTS (
                SELECT 1 FROM evacuation_evaluations ee
                WHERE ee.event_id = e.id AND ee.submitted_by = %s
            )
            ORDER BY e.start_time DESC
        ''', (user_id,))
        
        events = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for event in events:
            event_dict = dict(event)
            if event_dict.get('start_time'):
                event_dict['start_time'] = event_dict['start_time'].isoformat()
            if event_dict.get('end_time'):
                event_dict['end_time'] = event_dict['end_time'].isoformat()
            result.append(event_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting pending evaluations: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluations/my", methods=["GET", "OPTIONS"])
def get_my_evaluations():
    """Get current user's submitted evaluations"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT 
                e.id,
                e.event_id,
                e.instructor_name,
                e.program_class,
                e.classroom_office,
                e.male_count,
                e.female_count,
                e.comments,
                e.submitted_by,
                e.submitted_at,
                ev.title as event_title,
                ev.start_time as event_date,
                ev.event_type
            FROM evacuation_evaluations e
            JOIN events ev ON e.event_id = ev.id
            WHERE e.submitted_by = %s
            ORDER BY e.submitted_at DESC
        ''', (user_id,))
        
        evaluations = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for evaluation in evaluations:
            eval_dict = dict(evaluation)
            if eval_dict.get('submitted_at'):
                eval_dict['submitted_at'] = eval_dict['submitted_at'].isoformat()
            if eval_dict.get('event_date'):
                eval_dict['event_date'] = eval_dict['event_date'].isoformat()
            result.append(eval_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting my evaluations: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluations", methods=["POST", "OPTIONS"])
def submit_evaluation():
    """Submit a new evacuation evaluation"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        data = request.json
        
        # Validate required fields
        required = ['event_id', 'instructor_name', 'classroom_office', 'male_count', 'female_count']
        missing = [field for field in required if field not in data]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400
        
        # Validate counts
        try:
            male_count = int(data['male_count'])
            female_count = int(data['female_count'])
        except (ValueError, TypeError):
            return jsonify({'error': 'Male and female counts must be valid numbers'}), 400
        
        if male_count < 0 or female_count < 0:
            return jsonify({'error': 'Participant counts cannot be negative'}), 400
        
        if male_count + female_count == 0:
            return jsonify({'error': 'Total participants must be at least 1'}), 400
        
        # Validate instructor name
        if not data['instructor_name'].strip():
            return jsonify({'error': 'Instructor/Representative name is required'}), 400
        
        # Validate classroom/office
        if not data['classroom_office'].strip():
            return jsonify({'error': 'Classroom/Office location is required'}), 400
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if event exists
        cursor.execute('SELECT id FROM events WHERE id = %s', (data['event_id'],))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
        # Check if already submitted
        cursor.execute('''
            SELECT id FROM evacuation_evaluations 
            WHERE event_id = %s AND submitted_by = %s
        ''', (data['event_id'], user_id))
        
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'You have already submitted an evaluation for this event'}), 400
        
        # Insert evaluation
        cursor.execute('''
            INSERT INTO evacuation_evaluations (
                event_id, 
                instructor_name, 
                program_class, 
                classroom_office,
                male_count, 
                female_count, 
                comments, 
                image_url,
                image_urls,
                submitted_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, submitted_at
        ''', (
            data['event_id'],
            data['instructor_name'].strip(),
            data.get('program_class', '').strip() or 'N/A',
            data['classroom_office'].strip(),
            male_count,
            female_count,
            data.get('comments', '').strip(),
            data.get('image_url'),
            json.dumps(data.get('image_urls', [])),
            user_id
        ))
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Evaluation submitted for event #{data['event_id']} by user {user_id}")
        
        return jsonify({
            'id': result['id'],
            'submitted_at': result['submitted_at'].isoformat(),
            'message': 'Evaluation submitted successfully'
        }), 201
        
    except Exception as e:
        print(f"❌ Error submitting evaluation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluations/recent-drills", methods=["GET", "OPTIONS"])
def get_recent_drills():
    """Get recent drills with evaluation counts (Executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Unauthorized. Executive role required.'}), 403
        
        cursor.execute('''
            SELECT 
                e.id, 
                e.title, 
                e.event_type, 
                e.start_time, 
                e.end_time,
                e.description,
                COUNT(ee.id) as evaluation_count,
                COALESCE(SUM(ee.male_count), 0) as total_male,
                COALESCE(SUM(ee.female_count), 0) as total_female
            FROM events e
            LEFT JOIN evacuation_evaluations ee ON e.id = ee.event_id
            WHERE e.event_type IN ('drill', 'fire_drill', 'earthquake_drill', 'bomb_threat_drill')
            AND e.start_time <= NOW()
            AND e.start_time >= NOW() - INTERVAL '30 days'
            GROUP BY e.id, e.title, e.event_type, e.start_time, e.end_time, e.description
            HAVING COUNT(ee.id) > 0
            ORDER BY e.start_time DESC
        ''')
        
        drills = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for drill in drills:
            drill_dict = dict(drill)
            if drill_dict.get('start_time'):
                drill_dict['start_time'] = drill_dict['start_time'].isoformat()
            if drill_dict.get('end_time'):
                drill_dict['end_time'] = drill_dict['end_time'].isoformat()
            drill_dict['evaluation_count'] = int(drill_dict['evaluation_count'])
            drill_dict['total_male'] = int(drill_dict['total_male'])
            drill_dict['total_female'] = int(drill_dict['total_female'])
            result.append(drill_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error getting recent drills: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluations/event/<int:event_id>", methods=["GET", "OPTIONS"])
def get_event_evaluations(event_id):
    """Get all evaluations for a specific event (Executive only)"""
    if request.method == "OPTIONS":
        return '', 200
    
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401
        
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check user role
        cursor.execute('SELECT role FROM user_profiles WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user or user['role'] != 'executive':
            cursor.close()
            conn.close()
            return jsonify({'error': 'Unauthorized. Executive role required.'}), 403
        
        # Verify event exists
        cursor.execute('SELECT id, title FROM events WHERE id = %s', (event_id,))
        event = cursor.fetchone()
        if not event:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Event not found'}), 404
        
        # Get all evaluations for this event
        cursor.execute('''
            SELECT 
                e.id,
                e.event_id,
                e.instructor_name,
                e.program_class,
                e.classroom_office,
                e.male_count,
                e.female_count,
                e.comments,
                e.image_url,
                e.image_urls,
                e.submitted_by,
                e.submitted_at,
                u.email as submitted_by_email
            FROM evacuation_evaluations e
            JOIN user_profiles u ON e.submitted_by = u.id
            WHERE e.event_id = %s
            ORDER BY e.submitted_at DESC
        ''', (event_id,))
        
        evaluations = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result_evals = []
        for evaluation in evaluations:
            eval_dict = dict(evaluation)
            if eval_dict.get('submitted_at'):
                eval_dict['submitted_at'] = eval_dict['submitted_at'].isoformat()
            result_evals.append(eval_dict)
        
        return jsonify({
            'event': dict(event),
            'evaluations': result_evals
        })
        
    except Exception as e:
        print(f"❌ Error getting event evaluations: {e}")
        return jsonify({"error": str(e)}), 500


# ==================== GROUP ENDPOINTS ====================

@app.route("/api/groups", methods=["GET", "OPTIONS"])
def get_groups():
    if request.method == "OPTIONS": return '', 200
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM groups ORDER BY is_custom ASC, name ASC')
        groups = [dict(g) for g in cursor.fetchall()]
        cursor.close(); conn.close()
        return jsonify(groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/groups", methods=["POST", "OPTIONS"])
def create_group():
    if request.method == "OPTIONS": return '', 200
    user_id = session.get('user_id')
    if not user_id: return jsonify({"error": "Not authenticated"}), 401
    try:
        data = request.json
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'INSERT INTO groups (name, is_custom) VALUES (%s, TRUE) RETURNING *',
            (data.get('name'),)
        )
        group = dict(cursor.fetchone())
        conn.commit(); cursor.close(); conn.close()
        return jsonify(group), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/groups/<int:group_id>", methods=["DELETE", "OPTIONS"])
def delete_group(group_id):
    if request.method == "OPTIONS": return '', 200
    user_id = session.get('user_id')
    if not user_id: return jsonify({"error": "Not authenticated"}), 401
    try:
        conn = get_db()
        cursor = conn.cursor()
        # Only allow deleting custom groups
        cursor.execute('DELETE FROM groups WHERE id = %s', (group_id,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<string:user_id>/group", methods=["PUT", "OPTIONS"])
def update_user_group(user_id):
    if request.method == "OPTIONS": return '', 200
    current_user_id = session.get('user_id')
    if not current_user_id: return jsonify({"error": "Not authenticated"}), 401
    try:
        data = request.json
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            'UPDATE user_profiles SET group_id = %s, is_head = %s WHERE id = %s',
            (data.get('group_id'), data.get('is_head', False), user_id)
        )
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== STARTUP ====================

if __name__ == "__main__":
    print("=" * 60)
    print("🚨 Disaster Simulation API Server (DISASTER-AWARE)")
    print("=" * 60)
    print(f"📊 Database: {DB_CONFIG['dbname']}")
    print(f"🌐 Port: {API_PORT}")
    print()
    print("🗺️  Project Endpoints:")
    print("   - POST/GET/PUT/DELETE /api/projects")
    print()
    print("🚨 Simulation Endpoints (WITH DISASTER TYPE):")
    print("   - POST /api/simulations/run (fire/earthquake/bomb)")
    print("   - GET/DELETE /api/simulations")
    print()
    print("📢 Announcement Endpoints:")
    print("   - GET/POST /api/announcements")
    print()
    print("📅 Event Endpoints:")
    print("   - GET/POST/PUT/DELETE /api/events")
    print()
    print("🚨 Incident Report Endpoints:")
    print("   - GET/POST /api/incidents")
    print("   - GET /api/incidents/<id>")
    print("   - POST /api/incidents/<id>/remarks (executives only)")
    print("   - PATCH /api/incidents/<id>/status (executives only)")
    print("📋 Evacuation Evaluation Endpoints:")
    print("   - GET /api/evaluations/pending")
    print("   - GET /api/evaluations/my")
    print("   - POST /api/evaluations")
    print("   - GET /api/evaluations/recent-drills (executives)")
    print("   - GET /api/evaluations/event/<id> (executives)")
    print("=" * 60)
    
    app.run(host="0.0.0.0", port=API_PORT, debug=True)