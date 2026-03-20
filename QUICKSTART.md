# DisasterSim - Quick Start Guide

## Overview

Your disaster simulation system now has a fully functional web interface with:
- ✅ Login/Signup page
- ✅ Role-based authentication (Admin, Executive, Member)
- ✅ Multi-user dashboard
- ✅ Simulation management
- ✅ User administration panel

## Demo Credentials

The system comes with pre-configured demo users for testing:

### Admin Account
- **Email:** admin@example.com
- **Password:** password
- **Permissions:** Create/delete users, view all simulations

### Executive Account
- **Email:** executive@example.com
- **Password:** password
- **Permissions:** Create and run simulations, view own simulations

### Member Account
- **Email:** member@example.com
- **Password:** password
- **Permissions:** View simulations only

## Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:5173**

### 2. Login

1. Open http://localhost:5173 in your browser
2. You'll see the login/signup page
3. Use any of the demo credentials above to login
4. Or create a new account

### 3. Explore Features

**As Admin (admin@example.com):**
- Navigate to "User Management"
- Create new users with different roles
- Manage existing users
- View all simulations

**As Executive (executive@example.com):**
- Navigate to "Create Simulation"
- Fill in simulation parameters (grid size, number of evacuees/responders, disaster type)
- Click "Start Simulation"
- View simulation status and results in the "Simulations" tab

**As Member (member@example.com):**
- View all available simulations
- See simulation details and results
- Cannot create or manage users

## Architecture

```
Browser (React)
    ↓
Supabase (Auth + Database)
    ↓
Your Python Backend (Future Integration)
    ↓
Your Simulation Code (main.py, model.py, agent.py)
```

## Project Structure

```
src/
├── pages/
│   ├── AuthPage.tsx           # Login/Signup page
│   └── DashboardPage.tsx       # Main dashboard after login
├── components/
│   ├── LoginForm.tsx           # Login form component
│   ├── SignupForm.tsx          # Signup form component
│   ├── Sidebar.tsx             # Navigation sidebar
│   ├── SimulationCreator.tsx   # Create simulation form
│   ├── SimulationList.tsx      # View simulations
│   └── UserManagement.tsx      # Admin panel
├── lib/
│   └── supabase.ts             # Database client
└── App.tsx                     # Main app component
```

## Features

### Authentication
- Secure email/password authentication via Supabase
- Automatic session management
- Protected routes based on user role

### Simulation Management
- Create simulations with custom parameters
- Track simulation status (running, completed, failed)
- View detailed results and metrics
- Delete old simulations

### User Management (Admin)
- Create new users with different roles
- Assign roles (admin, executive, member)
- Delete users
- View all user accounts

### Real-Time Updates
- Simulations list updates every 5 seconds
- Status changes reflected instantly
- Results available immediately upon completion

## Integrating Your Python Simulation Code

When you're ready to integrate your existing Python simulation code:

1. **Set up FastAPI backend** (see `/backend-example/main_api.py`)
2. **Create API endpoints** that wrap your simulation logic
3. **Update frontend** to call the API instead of using mock data

The database already stores all simulation configurations and results. Your Python code will:
- Receive parameters from the database
- Run your existing simulation (main.py, model.py, agent.py)
- Return results to be stored in the database

See `INTEGRATION_GUIDE.md` for detailed backend setup instructions.

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### Environment Variables

The following environment variables are already configured:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

These are used to connect to your database and authentication system.

## Troubleshooting

### "Can't reach the browser"
1. Make sure the dev server is running: `npm run dev`
2. Open http://localhost:5173 (not localhost:3000)
3. Check for any console errors in the browser developer tools

### "Login not working"
1. Check your Supabase connection (look at console errors)
2. Try creating a new account if demo account isn't working
3. Verify email and password format

### "Can't create simulations"
1. Make sure you're logged in as Executive role
2. Check browser console for any error messages
3. Verify database is accessible

### "Simulations show old data"
1. The list auto-updates every 5 seconds
2. Try refreshing the page (Ctrl+R)
3. Check browser console for any network errors

## Next Steps

1. **Test the current interface** with demo accounts
2. **Customize simulation parameters** in SimulationCreator
3. **Set up FastAPI backend** when ready to integrate Python code
4. **Connect your simulation** to the API endpoints
5. **Deploy** to production (Vercel for frontend, Railway/Fly for backend)

## Support

- Frontend Issues: Check browser console (F12)
- Database Issues: Visit Supabase dashboard
- General Questions: See INTEGRATION_GUIDE.md

---

**Ready to start?** Run `npm run dev` and visit http://localhost:5173
