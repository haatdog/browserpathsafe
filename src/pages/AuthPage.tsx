import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignupForm';
import { Zap } from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Zap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">PathSafe</h1>
          </div>

          <p className="text-center text-gray-600 mb-8">
          WEB-BASED DISASTER RISK REDUCTION AND MANAGEMENT SYSTEM
                    </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {isLogin ? (
            <LoginForm onError={setError} onSuccess={onLogin} />
          ) : (
            <SignupForm onError={setError} onSuccess={onLogin} />
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={handleToggleMode}
                className="text-blue-600 hover:text-blue-700 font-medium transition"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Demo Credentials</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div>
                <p className="font-medium text-gray-700">Admin:</p>
                <p>admin@example.com / password</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Coordinator:</p>
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
