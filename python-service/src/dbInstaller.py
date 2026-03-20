import psycopg2
import bcrypt

# Connect to database
conn = psycopg2.connect(
    dbname='postgres',
    user='postgres', 
    password='pathsafe2026',
    host='db.uyqnmbexdhtrcfjivpmq.supabase.co'
)
cursor = conn.cursor()

# Create admin user
user_id = 'admin-001'
email = 'admin@yourcompany.com'
password = 'password'
password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

cursor.execute('''
    INSERT INTO auth_users (id, email, password_hash)
    VALUES (%s, %s, %s)
    ON CONFLICT (email) DO NOTHING
''', (user_id, email, password_hash))

cursor.execute('''
    INSERT INTO user_profiles (id, email, role)
    VALUES (%s, %s, 'admin')
    ON CONFLICT (id) DO NOTHING
''', (user_id, email))

conn.commit()
cursor.close()
conn.close()

print(f"✅ Admin user created: {email}")
print(f"Password: {password}")