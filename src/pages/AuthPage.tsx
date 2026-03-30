import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignupForm';

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const handleToggleMode = () => { setIsLogin(!isLogin); setError(null); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Logo + Title */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <img
              src="/PathSafe(200x200).png"
              alt="PathSafe logo"
              className="w-20 h-20 object-contain"
            />
            <h1 className="text-3xl font-bold text-gray-900">PathSafe</h1>
            <p className="text-center text-gray-500 text-xs font-medium tracking-wide uppercase">
              Web-Based Disaster Risk Reduction and Management System
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {isLogin
            ? <LoginForm  onError={setError} onSuccess={onLogin} />
            : <SignupForm onError={setError} onSuccess={onLogin} />}

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={handleToggleMode}
                className="text-green-600 hover:text-green-700 font-medium transition">
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Demo Credentials</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div>
                <p className="font-medium text-gray-700">Admin:</p>
                <p>admin@pathsafe.com / Admin@123</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Executive:</p>
                <p>executive@example.com / password</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Member:</p>
                <p>member@example.com / password</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}