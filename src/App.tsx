import { useEffect, useState } from 'react';
import { authService } from './lib/api';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'coordinator' | 'member';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // ✅ ASYNC function to check session
  const checkAuth = async () => {
    try {
      const currentUser = await authService.getMe();
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.log('Not authenticated');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Called after successful login
  const handleLogin = async () => {
    await checkAuth(); // Re-check to get user info
  };

  // ✅ Called on logout
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ✅ Show dashboard if user exists (authenticated)
  // ✅ Show auth page if no user (not authenticated)
  return user ? (
    <DashboardPage onLogout={handleLogout} />
  ) : (
    <AuthPage onLogin={handleLogin} />
  );
}

export default App;