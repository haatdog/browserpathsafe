# pyright: reportMissingImports=false, reportMissingModuleSource=false
import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# ── App setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024   # 50 MB
app.secret_key = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_PATH']     = '/api'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
CORS(app, origins=[
    "http://localhost:5173",
    "https://browserpathsafe.vercel.app",
])

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin']  = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>',             methods=['OPTIONS'])
def handle_options(path):
    return '', 200


# ── Blueprints ─────────────────────────────────────────────────────────────────
from src.routes.auth          import auth_bp
from src.routes.users         import users_bp
from src.routes.projects      import projects_bp
from src.routes.simulations   import simulations_bp
from src.routes.announcements import announcements_bp
from src.routes.events        import events_bp
from src.routes.incidents     import incidents_bp
from src.routes.evaluations   import evaluations_bp
from src.routes.organization  import organization_bp

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(simulations_bp)
app.register_blueprint(announcements_bp)
app.register_blueprint(events_bp)
app.register_blueprint(incidents_bp)
app.register_blueprint(evaluations_bp)
app.register_blueprint(organization_bp)


# ── Health check ───────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    from src.utils import get_db
    try:
        conn = get_db(); cursor = conn.cursor()
        cursor.execute('SELECT 1'); cursor.close(); conn.close()
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "database": "disconnected", "error": str(e)}), 500


# ── Database init ──────────────────────────────────────────────────────────────
def init_db():
    from src.utils import get_db
    conn   = get_db()
    cursor = conn.cursor()

    statements = [
        # ── Core tables ────────────────────────────────────────────────────────
        '''CREATE TABLE IF NOT EXISTS auth_users (
            id VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        '''CREATE TABLE IF NOT EXISTS user_profiles (
            id VARCHAR(255) PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
            email VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'member',
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            group_id INTEGER,
            is_head BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        '''CREATE TABLE IF NOT EXISTS groups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            is_custom BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        '''CREATE TABLE IF NOT EXISTS projects (
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
        )''',
        'CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC)',
        '''CREATE TABLE IF NOT EXISTS simulations (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            disaster_type VARCHAR(20) DEFAULT 'fire',
            status VARCHAR(50) DEFAULT 'completed',
            config JSON,
            results JSON NOT NULL,
            project_data JSON,
            steps INTEGER,
            elapsed_s DECIMAL(10,3),
            evacuation_time DECIMAL(10,2),
            agents_spawned INTEGER,
            agents_evacuated INTEGER,
            agents_trapped INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_disaster_type CHECK (disaster_type IN ('fire','earthquake','bomb'))
        )''',
        'CREATE INDEX IF NOT EXISTS idx_simulations_created  ON simulations(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_simulations_project  ON simulations(project_id)',
        'CREATE INDEX IF NOT EXISTS idx_simulations_user     ON simulations(user_id)',
        '''CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            image_urls JSONB DEFAULT '[]',
            target_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
            target_heads_only BOOLEAN DEFAULT FALSE,
            is_pinned BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned DESC, created_at DESC)',
        '''CREATE TABLE IF NOT EXISTS announcement_likes (
            id SERIAL PRIMARY KEY,
            announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(announcement_id, user_id)
        )''',
        '''CREATE TABLE IF NOT EXISTS announcement_comments (
            id SERIAL PRIMARY KEY,
            announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
            user_id VARCHAR(255) REFERENCES user_profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'CREATE INDEX IF NOT EXISTS idx_comments_announcement ON announcement_comments(announcement_id)',
        '''CREATE TABLE IF NOT EXISTS events (
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
        )''',
        'CREATE INDEX IF NOT EXISTS idx_events_time    ON events(start_time)',
        'CREATE INDEX IF NOT EXISTS idx_events_creator ON events(created_by)',
        '''CREATE TABLE IF NOT EXISTS incidents (
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
            image_urls JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter_id)',
        'CREATE INDEX IF NOT EXISTS idx_incidents_status   ON incidents(status)',
        'CREATE INDEX IF NOT EXISTS idx_incidents_date     ON incidents(incident_date DESC)',
        '''CREATE TABLE IF NOT EXISTS incident_remarks (
            id SERIAL PRIMARY KEY,
            incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL REFERENCES user_profiles(id),
            remark TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''',
        'CREATE INDEX IF NOT EXISTS idx_remarks_incident ON incident_remarks(incident_id)',
        '''CREATE TABLE IF NOT EXISTS evacuation_evaluations (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            instructor_name VARCHAR(255) NOT NULL,
            program_class VARCHAR(100) NOT NULL DEFAULT 'N/A',
            classroom_office VARCHAR(100) NOT NULL,
            male_count INTEGER NOT NULL CHECK (male_count >= 0),
            female_count INTEGER NOT NULL CHECK (female_count >= 0),
            comments TEXT,
            image_url TEXT,
            image_urls JSONB DEFAULT '[]',
            submitted_by VARCHAR(255) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
            submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT total_count_check CHECK (male_count + female_count > 0),
            UNIQUE(event_id, submitted_by)
        )''',
        'CREATE INDEX IF NOT EXISTS idx_evals_event     ON evacuation_evaluations(event_id)',
        'CREATE INDEX IF NOT EXISTS idx_evals_user      ON evacuation_evaluations(submitted_by)',
        'CREATE INDEX IF NOT EXISTS idx_evals_submitted ON evacuation_evaluations(submitted_at)',

        # ── Safe migrations (ADD COLUMN IF NOT EXISTS never fails) ─────────────
        # user_profiles: name fields used by OrganizationChart, profile editor,
        #                display names across the app
        'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)',
        'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)',
        # simulations: project_data needed for playback and path visualization
        'ALTER TABLE simulations ADD COLUMN IF NOT EXISTS project_data JSON',

        # ── Seed data ──────────────────────────────────────────────────────────
        '''INSERT INTO groups (name, is_custom) VALUES
            ('First Aid Group', FALSE),
            ('Site Security Group', FALSE),
            ('Communication Group', FALSE),
            ('Fire Safety Group', FALSE),
            ('Evacuation Group', FALSE),
            ('Building Safety Inspection Group', FALSE)
            ON CONFLICT (name) DO NOTHING''',

        # Default admin — password: Admin@123  (change after first login!)
        '''DO $$
        DECLARE
            admin_id VARCHAR(255) := 'admin-default-001';
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM auth_users WHERE email = 'admin@pathsafe.com') THEN
                INSERT INTO auth_users (id, email, password_hash)
                VALUES (admin_id, 'admin@pathsafe.com',
                        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGc8L4pNgq7Bxv3j5W2tZ8K9Lem');

                INSERT INTO user_profiles (id, email, role, first_name, last_name)
                VALUES (admin_id, 'admin@pathsafe.com', 'executive', 'Admin', 'PathSafe');
            END IF;
        END $$;''',
    ]

    for sql in statements:
        try:
            cursor.execute(sql)
        except Exception as e:
            print(f"⚠️  Migration warning: {e}")

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Database initialized successfully!")


try:
    init_db()
except Exception as e:
    print(f"⚠️ Database initialization warning: {e}")


# ── Startup banner ─────────────────────────────────────────────────────────────
API_PORT = int(os.getenv('PYTHON_PORT', 5000))

if __name__ == "__main__":
    print("=" * 60)
    print("🚨 Disaster Simulation API Server")
    print("=" * 60)
    print(f"🌐 Port: {API_PORT}")
    print()
    print("Routes registered:")
    print("  /api/auth/*         → src/routes/auth.py")
    print("  /api/users/*        → src/routes/users.py")
    print("  /api/projects/*     → src/routes/projects.py")
    print("  /api/simulations/*  → src/routes/simulations.py")
    print("  /api/announcements/*→ src/routes/announcements.py")
    print("  /api/events/*       → src/routes/events.py")
    print("  /api/incidents/*    → src/routes/incidents.py")
    print("  /api/evaluations/*  → src/routes/evaluations.py")
    print("  /api/groups/*       → src/routes/organization.py")
    print("  /api/organization   → src/routes/organization.py")
    print("=" * 60)

    app.run(host="0.0.0.0", port=API_PORT, debug=True)