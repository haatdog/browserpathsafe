# src/routes/auth.py
from flask import Blueprint, request, jsonify, session
import jwt as pyjwt
import os
from datetime import datetime, timedelta, timezone
from psycopg2.extras import RealDictCursor
from src.utils import get_db, hash_password, check_password, generate_user_id

def generate_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email':   email,
        'role':    role,
        'exp':     datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, os.getenv('SECRET_KEY', 'dev-secret'), algorithm='HS256')

def decode_token(token: str) -> dict | None:
    try:
        return pyjwt.decode(token, os.getenv('SECRET_KEY', 'dev-secret'), algorithms=['HS256'])
    except Exception:
        return None

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/api/auth/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return '', 200
    try:
        data     = request.json
        email    = data.get('email')
        password = data.get('password')
        role     = data.get('role', 'member')

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute('SELECT id FROM auth_users WHERE email = %s', (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "Email already registered"}), 400

        user_id       = generate_user_id()
        password_hash = hash_password(password)

        cursor.execute(
            'INSERT INTO auth_users (id, email, password_hash) VALUES (%s, %s, %s)',
            (user_id, email, password_hash)
        )
        first_name = data.get('first_name', '').strip() or None
        last_name  = data.get('last_name', '').strip() or None
        group_id   = data.get('group_id') or None
        is_head    = bool(data.get('is_head', False))

        cursor.execute(
            '''INSERT INTO user_profiles (id, email, role, first_name, last_name, group_id, is_head)
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (user_id, email, role, first_name, last_name, group_id, is_head)
        )
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ User registered: {email} ({role})")
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "user": {"id": user_id, "email": email, "role": role}
        }), 201

    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return '', 200
    try:
        data     = request.json
        email    = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT au.id, au.email, au.password_hash, up.role
            FROM auth_users au
            JOIN user_profiles up ON au.id = up.id
            WHERE au.email = %s
        ''', (email,))
        user = cursor.fetchone()
        cursor.close(); conn.close()

        if not user or not check_password(password, user['password_hash']):
            return jsonify({"error": "Invalid email or password"}), 401

        session['user_id'] = user['id']
        session['email']   = user['email']
        session['role']    = user['role']
        token = generate_token(user['id'], user['email'], user['role'])

        print(f"✅ User logged in: {email}")
        return jsonify({
            "success": True,
            "token":   token,
            "user": {"id": user['id'], "email": user['email'], "role": user['role']}
        })

    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"error": str(e)}), 500


def send_reset_email(to_email: str, temp_password: str) -> bool:
    """Send password reset email via SMTP. Works with Gmail, Yahoo, Outlook, etc."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    sender_email    = os.getenv('EMAIL_ADDRESS')
    sender_password = os.getenv('EMAIL_APP_PASSWORD')

    if not sender_email or not sender_password:
        print("⚠️  EMAIL_ADDRESS or EMAIL_APP_PASSWORD not set — skipping email")
        return False

    # Auto-detect SMTP settings from email domain
    # You can also override with EMAIL_SMTP_HOST and EMAIL_SMTP_PORT env vars
    domain = sender_email.split('@')[-1].lower()
    SMTP_SETTINGS = {
        'gmail.com':        ('smtp.gmail.com',        465, True),
        'yahoo.com':        ('smtp.mail.yahoo.com',   465, True),
        'yahoo.com.ph':     ('smtp.mail.yahoo.com',   465, True),
        'ymail.com':        ('smtp.mail.yahoo.com',   465, True),
        'outlook.com':      ('smtp.office365.com',    587, False),
        'hotmail.com':      ('smtp.office365.com',    587, False),
        'live.com':         ('smtp.office365.com',    587, False),
        'icloud.com':       ('smtp.mail.me.com',      587, False),
        'me.com':           ('smtp.mail.me.com',      587, False),
        'protonmail.com':   ('smtp.protonmail.com',   587, False),
        'zoho.com':         ('smtp.zoho.com',         465, True),
    }

    # Allow manual override via environment variables
    smtp_host = os.getenv('EMAIL_SMTP_HOST')
    smtp_port = int(os.getenv('EMAIL_SMTP_PORT', '0'))
    use_ssl   = os.getenv('EMAIL_SMTP_SSL', '').lower() not in ('false', '0', 'no')

    if not smtp_host:
        host, port, ssl = SMTP_SETTINGS.get(domain, ('smtp.gmail.com', 465, True))
        smtp_host = host
        if smtp_port == 0:
            smtp_port = port
        use_ssl = ssl

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
      <div style="background:#16a34a;padding:20px;border-radius:8px;text-align:center;margin-bottom:24px;">
        <h1 style="color:white;margin:0;font-size:24px;">🛡️ PathSafe</h1>
      </div>
      <h2 style="color:#111827;margin-bottom:8px;">Password Reset Request</h2>
      <p style="color:#6b7280;margin-bottom:24px;">
        A temporary password has been generated for your PathSafe account.
        Use it to log in, then change your password immediately from your profile settings.
      </p>
      <div style="background:white;border:2px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="color:#6b7280;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
        <p style="font-family:monospace;font-size:28px;font-weight:bold;color:#111827;letter-spacing:4px;margin:0;">{temp_password}</p>
      </div>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;">
        <p style="color:#92400e;font-size:13px;margin:0;">
          ⚠️ This is a temporary password. Please change it after logging in.
          If you did not request this reset, contact your administrator immediately.
        </p>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center;">
        PathSafe — Disaster Risk Reduction and Management System
      </p>
    </div>
    """

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '🔑 PathSafe — Your Temporary Password'
        msg['From']    = f'PathSafe <{sender_email}>'
        msg['To']      = to_email
        msg.attach(MIMEText(html, 'html'))

        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, to_email, msg.as_string())
        print(f"✅ Reset email sent to: {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email send failed: {e}")
        return False


@auth_bp.route("/api/auth/forgot-password", methods=["POST", "OPTIONS"])
def forgot_password():
    if request.method == "OPTIONS":
        return '', 200
    try:
        email = (request.json or {}).get('email', '').strip().lower()
        if not email:
            return jsonify({"error": "Email is required"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Check user exists
        cursor.execute('SELECT id FROM auth_users WHERE email = %s', (email,))
        user = cursor.fetchone()
        if not user:
            cursor.close(); conn.close()
            return jsonify({"error": "No account found with that email address"}), 404

        # Generate secure temp password
        import secrets, string
        alphabet = string.ascii_letters + string.digits
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(10))
        new_hash = hash_password(temp_password)

        # Save the new password
        cursor.execute(
            'UPDATE auth_users SET password_hash = %s WHERE email = %s',
            (new_hash, email)
        )
        conn.commit()
        cursor.close(); conn.close()

        print(f"🔑 Password reset for: {email}")
        return jsonify({"success": True, "temp_password": temp_password})

    except Exception as e:
        print(f"❌ Forgot password error: {e}")
        return jsonify({"error": str(e)}), 500



@auth_bp.route("/api/auth/change-password", methods=["POST", "OPTIONS"])
def change_password():
    if request.method == "OPTIONS":
        return '', 200
    user_id = session.get('user_id')
    if not user_id:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            payload = decode_token(auth_header[7:])
            if payload:
                user_id = payload.get('user_id')
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        data             = request.json or {}
        current_password = data.get('current_password', '')
        new_password     = data.get('new_password', '')

        if not current_password or not new_password:
            return jsonify({"error": "Both current and new password are required"}), 400
        if len(new_password) < 6:
            return jsonify({"error": "New password must be at least 6 characters"}), 400

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT password_hash FROM auth_users WHERE id = %s', (user_id,))
        user = cursor.fetchone()

        if not user or not check_password(current_password, user['password_hash']):
            cursor.close(); conn.close()
            return jsonify({"error": "Current password is incorrect"}), 400

        new_hash = hash_password(new_password)
        cursor.execute('UPDATE auth_users SET password_hash = %s WHERE id = %s', (new_hash, user_id))
        conn.commit(); cursor.close(); conn.close()

        print(f"✅ Password changed for user: {user_id}")
        return jsonify({"success": True, "message": "Password changed successfully"})

    except Exception as e:
        print(f"❌ Change password error: {e}")
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return '', 200
    try:
        session.clear()
        return jsonify({"success": True, "message": "Logged out"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/me", methods=["GET", "OPTIONS"])
def get_current_user():
    if request.method == "OPTIONS":
        return '', 200
    try:
        # Check session first (local dev)
        user_id = session.get('user_id')

        # Check JWT Bearer token (production cross-domain)
        if not user_id:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                payload = decode_token(auth_header[7:])
                if payload:
                    user_id = payload.get('user_id')

        if not user_id:
            return jsonify({"error": "Not authenticated"}), 401

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.group_id, u.is_head,
                   g.name AS group_name, u.created_at, u.updated_at
            FROM user_profiles u
            LEFT JOIN groups g ON u.group_id = g.id
            WHERE u.id = %s
        ''', (user_id,))
        user = cursor.fetchone()
        cursor.close(); conn.close()

        if not user:
            session.clear()
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         user['id'],
            "email":      user['email'],
            "first_name": user['first_name'],
            "last_name":  user['last_name'],
            "role":       user['role'],
            "group_id":   user['group_id'],
            "group_name": user['group_name'],
            "is_head":    bool(user['is_head']) if user['is_head'] is not None else False,
            "created_at": user['created_at'].isoformat() if user['created_at'] else None,
            "updated_at": user['updated_at'].isoformat() if user['updated_at'] else None,
        })

    except Exception as e:
        print(f"❌ Error getting current user: {e}")
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/api/auth/profile", methods=["PATCH", "OPTIONS"])
def update_profile():
    if request.method == "OPTIONS":
        return '', 200
    user_id = session.get('user_id')
    if not user_id:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            payload = decode_token(auth_header[7:])
            if payload:
                user_id = payload.get('user_id')
    if not user_id:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        data       = request.json or {}
        first_name = data.get('first_name', '').strip() or None
        last_name  = data.get('last_name',  '').strip() or None

        conn   = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """UPDATE user_profiles
               SET first_name = %s, last_name = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, email, first_name, last_name, role, group_id, is_head""",
            (first_name, last_name, user_id)
        )
        user = cursor.fetchone()
        conn.commit(); cursor.close(); conn.close()

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id":         user['id'],
            "email":      user['email'],
            "first_name": user['first_name'],
            "last_name":  user['last_name'],
            "role":       user['role'],
            "group_id":   user['group_id'],
            "is_head":    bool(user['is_head']) if user['is_head'] is not None else False,
        })
    except Exception as e:
        print(f"❌ Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500