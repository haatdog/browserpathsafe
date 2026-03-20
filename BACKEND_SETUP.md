# Backend Setup Guide

Your application has been converted to use a Node.js backend with local PostgreSQL instead of Supabase. Here's how to get it running:

## Prerequisites

1. PostgreSQL installed and running locally
2. Node.js 18+ installed

## Setup Steps

### 1. Create Database

Create a PostgreSQL database for your project:

```bash
createdb simulation_db
```

### 2. Initialize Database Schema

Run the SQL schema to create tables:

```bash
psql simulation_db < server/schema.sql
```

### 3. Configure Environment

The server configuration is already set up in `server/.env`. Update it with your database credentials if needed:

```
DATABASE_URL=postgresql://user:password@localhost:5432/simulation_db
JWT_SECRET=your-secret-key-change-this
NODE_ENV=development
PORT=3001
```

### 4. Run the Application

In the project root, start the server:

```bash
npm run dev:server
```

In another terminal, start the frontend:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3001`.

## Demo Credentials

After running the schema, use these demo accounts:

- **Admin**: admin@example.com / password
- **Executive**: executive@example.com / password
- **Member**: member@example.com / password

To add these accounts to the database, run:

```sql
INSERT INTO auth_users (id, email, password_hash, created_at, updated_at) VALUES
  ('user_admin', 'admin@example.com', '$2b$10$...', NOW(), NOW()),
  ('user_exec', 'executive@example.com', '$2b$10$...', NOW(), NOW()),
  ('user_member', 'member@example.com', '$2b$10$...', NOW(), NOW());

INSERT INTO user_profiles (id, email, role, created_at, updated_at) VALUES
  ('user_admin', 'admin@example.com', 'admin', NOW(), NOW()),
  ('user_exec', 'executive@example.com', 'executive', NOW(), NOW()),
  ('user_member', 'member@example.com', 'member', NOW(), NOW());
```

## Project Structure

- `/src` - React frontend
- `/server/src` - Node.js backend
  - `db.ts` - Database connection
  - `index.ts` - Express server setup
  - `types.ts` - TypeScript types
  - `middleware/auth.ts` - JWT authentication
  - `routes/auth.ts` - Authentication endpoints
  - `routes/profiles.ts` - User profile endpoints
  - `routes/simulations.ts` - Simulation endpoints

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout

### Profiles
- `GET /api/profiles/me` - Get current user profile
- `GET /api/profiles` - List all users (admin only)
- `POST /api/profiles/:id/role` - Update user role (admin only)
- `DELETE /api/profiles/:id` - Delete user (admin only)

### Simulations
- `GET /api/simulations` - List user's simulations
- `POST /api/simulations` - Create new simulation (executive only)
- `GET /api/simulations/:id` - Get simulation details
- `PATCH /api/simulations/:id` - Update simulation
- `DELETE /api/simulations/:id` - Delete simulation

## Next Steps

You can now:
1. Run the application with PostgreSQL
2. Access it from other IDEs by pointing to your local database and backend
3. Deploy the backend to a server or cloud platform

For production, remember to:
- Update `JWT_SECRET` to a strong random value
- Use environment-specific database URLs
- Enable HTTPS
- Set up proper database backups
