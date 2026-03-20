# DisasterSim - Backend Integration Guide

## Overview

Your project has been migrated from Supabase to a local Node.js backend with PostgreSQL. This guide walks you through setup and integration.

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher installed and running locally

## Quick Start

### Step 1: Create PostgreSQL Database

```bash
createdb simulation_db
```

### Step 2: Initialize Database Schema

```bash
psql simulation_db < server/schema.sql
```

This creates all necessary tables:
- `auth_users` - User credentials
- `user_profiles` - User roles and metadata
- `simulations` - Simulation records

### Step 3: Configure Environment

Edit `server/.env`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/simulation_db
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
PORT=3001
```

For local development, if you have no PostgreSQL password, use:
```env
DATABASE_URL=postgresql://postgres@localhost:5432/simulation_db
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Start the Application

**Terminal 1 - Backend:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

## Project Structure

```
project/
├── src/                    # React frontend
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── lib/
│   │   └── api.ts        # API client for backend
│   └── App.tsx
├── server/               # Node.js backend
│   ├── src/
│   │   ├── index.ts      # Express server entry
│   │   ├── db.ts         # PostgreSQL connection
│   │   ├── types.ts      # TypeScript types
│   │   ├── middleware/
│   │   │   └── auth.ts   # JWT authentication
│   │   └── routes/
│   │       ├── auth.ts   # Auth endpoints
│   │       ├── profiles.ts # User endpoints
│   │       └── simulations.ts # Simulation endpoints
│   ├── schema.sql        # Database schema
│   ├── package.json
│   └── tsconfig.json
└── package.json          # Root workspace config
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |

### Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles/me` | Get current user profile |
| GET | `/api/profiles` | List all users (admin only) |
| POST | `/api/profiles/:id/role` | Update user role (admin only) |
| DELETE | `/api/profiles/:id` | Delete user (admin only) |

### Simulations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/simulations` | List user's simulations |
| POST | `/api/simulations` | Create simulation (executive only) |
| GET | `/api/simulations/:id` | Get simulation details |
| PATCH | `/api/simulations/:id` | Update simulation |
| DELETE | `/api/simulations/:id` | Delete simulation |

## User Roles

- **Admin**: Full system access, user management
- **Executive**: Can create and manage simulations
- **Member**: Can view simulations

## Demo Accounts

After setup, you can create demo accounts. Add these to your database:

```sql
-- For PostgreSQL password-less setup
psql simulation_db

-- Then in psql:
INSERT INTO auth_users (id, email, password_hash, created_at, updated_at)
VALUES ('user_admin', 'admin@example.com', '$2b$10$YIj1KrGaLX7l7XqOpYH0duB9TqqqHW86pTcQ8Xw1tL0HtCWHJNBei', NOW(), NOW());

INSERT INTO user_profiles (id, email, role, created_at, updated_at)
VALUES ('user_admin', 'admin@example.com', 'admin', NOW(), NOW());
```

Or use the signup form in the application to create accounts.

## Frontend API Integration

The frontend API client is in `src/lib/api.ts`. It handles:
- Base URL from `VITE_API_URL` environment variable
- JWT token storage and retrieval
- Request/response handling
- Error management

Example usage:
```typescript
import { authService, simulationAPI } from '@/lib/api';

// Login
const user = await authService.login('email@example.com', 'password');

// Get simulations
const simulations = await simulationAPI.getAll();

// Create simulation
const sim = await simulationAPI.create(configObject);
```

## Building for Production

### Frontend
```bash
npm run build
```

Outputs to `dist/` directory.

### Server
```bash
npm run build --workspace=server
```

Outputs to `server/dist/` directory.

### Run Production Build
```bash
node server/dist/index.js
```

## Environment Variables

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
```

For production:
```env
VITE_API_URL=https://your-backend.com/api
```

### Backend (server/.env)
```env
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=use-a-strong-random-string-here
NODE_ENV=production
PORT=3001
```

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
- Verify database exists: `psql -l`
- Check DATABASE_URL format in `server/.env`

### Port Already in Use
Change PORT in `server/.env` (default: 3001) or kill existing process:
```bash
lsof -i :3001
kill -9 <PID>
```

### TypeScript Errors
```bash
npm run typecheck
```

## Next Steps

1. Customize user roles and permissions in `server/src/routes/profiles.ts`
2. Add simulation logic to `server/src/routes/simulations.ts`
3. Deploy backend to cloud service (Heroku, AWS, DigitalOcean, etc.)
4. Deploy frontend to static host (Vercel, Netlify, etc.)
5. Update `VITE_API_URL` to point to deployed backend

## Support

For issues:
1. Check logs in both frontend and backend terminals
2. Verify database schema: `psql simulation_db -c "\dt"`
3. Test backend directly: `curl http://localhost:3001/health`
4. Check network tab in browser DevTools for API errors
