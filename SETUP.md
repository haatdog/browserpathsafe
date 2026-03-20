# Setup and Configuration

## What Was Set Up

This project now includes a complete web-based multi-user interface for your disaster simulation system with:

### Frontend
- React + TypeScript application
- Tailwind CSS styling
- Supabase authentication
- Multi-page dashboard with role-based access

### Database
- PostgreSQL via Supabase
- User profiles with role management
- Simulation tracking and results storage
- Row-level security for data protection

### Demo Users
- Admin account: admin@example.com / password
- Executive account: executive@example.com / password
- Member account: member@example.com / password

## Running the Application

### Option 1: Development Mode (Recommended for Development)

```bash
# From the project root directory
npm run dev
```

Then open your browser to: **http://localhost:5173**

The development server will automatically reload when you make changes.

### Option 2: Production Build

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

## Environment Variables

The application uses these environment variables (already configured):

```
VITE_SUPABASE_URL=https://pmazvsimefvtvzqhgffd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are stored in `.env` and automatically loaded by Vite.

## Database Access

### View Your Data
Visit the Supabase Dashboard:
- URL: https://app.supabase.com
- Navigate to your project
- View `user_profiles` and `simulations` tables

### Create More Users
As an admin, you can create users through:
1. The web interface (User Management page)
2. Or directly via Supabase dashboard

### Reset Demo Data
If you want to reset the demo users, you can delete records from:
- `auth.users` - Supabase Auth table
- `user_profiles` - Your profiles table

## Frontend Structure

### Pages
- **AuthPage** - Login/Signup interface
- **DashboardPage** - Main application with sidebar navigation

### Components
- **LoginForm** - Email/password login
- **SignupForm** - New account creation
- **Sidebar** - Navigation and user info
- **SimulationCreator** - Form to create simulations
- **SimulationList** - View all simulations with real-time updates
- **UserManagement** - Admin panel for user management

### Styling
- Built with Tailwind CSS
- Responsive design (mobile, tablet, desktop)
- Light theme with blue accent color
- Icons from lucide-react

## Customization

### Change Application Title
Edit `src/pages/AuthPage.tsx`:
```tsx
<h1 className="text-3xl font-bold text-gray-900">DisasterSim</h1>
```

### Add Simulation Parameters
Edit `src/components/SimulationCreator.tsx` to add more form fields:
```tsx
<input
  type="number"
  value={config.your_parameter}
  onChange={(e) => setConfig({...config, your_parameter: e.target.value})}
/>
```

### Modify Colors
Tailwind CSS classes are used throughout. Change color scheme by updating className values:
- Blue: `bg-blue-600` → Change to `bg-emerald-600` etc.
- All components use standard Tailwind colors

### Change Auto-Refresh Rate
In `src/components/SimulationList.tsx`:
```tsx
const interval = setInterval(loadSimulations, 5000); // 5000ms = 5 seconds
```

Change to different interval as needed.

## Deployment

### Frontend (Vercel - Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo directly to Vercel for automatic deployments.

### Frontend (Other Platforms)

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist/` folder to:
   - Netlify
   - AWS Amplify
   - GitHub Pages
   - Any static hosting service

### Backend (Future Integration)

When you set up the FastAPI backend, deploy to:
- Railway.app
- Fly.io
- AWS Lambda
- Google Cloud Functions
- Your own server

## Monitoring & Debugging

### Browser Console Errors
Press F12 to open developer tools and check the Console tab for any errors.

### Network Requests
Open Network tab to see:
- Authentication requests to Supabase
- Database queries
- Response times

### Check Authentication
In browser console:
```javascript
// Check current session
supabase.auth.getSession()
```

### View Database
Visit: https://app.supabase.com
- Select your project
- Browse tables in left sidebar
- View/edit data directly

## Common Issues & Solutions

### "VITE_SUPABASE_URL is not defined"
The `.env` file might be missing environment variables. Run:
```bash
# Check if .env exists
cat .env
```

If missing, you'll need to add:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

### "Port 5173 already in use"
The development server is already running. Either:
1. Kill the process: `killall node`
2. Or run on different port: `npm run dev -- --port 3000`

### "Cannot connect to database"
1. Check internet connection
2. Verify Supabase credentials in `.env`
3. Visit https://supabase.com to check service status
4. Try logging in to Supabase dashboard directly

### "Demo login not working"
Try creating a new account instead:
1. Click "Sign up" on the login page
2. Create with new email and password
3. You'll be assigned as "member" role
4. Admin can assign higher roles if needed

## Development Workflow

### Making Changes
1. Edit files in `src/`
2. Changes auto-save and browser auto-reloads
3. Check browser console for any errors

### Type Safety
Run type checking:
```bash
npm run typecheck
```

### Linting
Check code style:
```bash
npm run lint
```

### Testing Locally
1. Open dev tools (F12)
2. Test different user roles
3. Check Network tab for API calls
4. Use Application tab to view stored data

## Integrating Your Python Code

See `INTEGRATION_GUIDE.md` and `backend-example/` for detailed instructions on:
1. Setting up FastAPI backend
2. Wrapping your Python simulation code
3. Creating API endpoints
4. Connecting frontend to backend

## Useful Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linting
npm run lint

# TypeScript type checking
npm run typecheck
```

## File Structure

```
project/
├── src/
│   ├── pages/              # Page components
│   ├── components/         # Reusable components
│   ├── lib/                # Utilities (Supabase client)
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css            # Global styles
├── backend-example/        # FastAPI backend examples
├── .env                    # Environment variables
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies
└── README_INTEGRATION.md   # Integration guide
```

## Next Steps

1. **Run the dev server**: `npm run dev`
2. **Test with demo accounts** to explore features
3. **Create your own users** as admin
4. **Customize colors and branding** to match your needs
5. **Set up FastAPI backend** when ready to integrate Python code
6. **Deploy to production** using platforms like Vercel

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **TypeScript**: https://www.typescriptlang.org
- **Vite**: https://vitejs.dev

---

**All set!** Your application is ready to use. Run `npm run dev` to start.
