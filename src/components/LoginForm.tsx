// LoginForm.tsx
import { useState } from 'react';
import { authService } from '../lib/api';
import { Mail, Lock, Loader, KeyRound, X, CheckCircle } from 'lucide-react';
import { T } from '../design/DesignTokens';

interface LoginFormProps {
  onError: (error: string | null) => void;
  onSuccess: () => void;
}

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

// ── Forgot Password Modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('pathsafe_token');
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Reset Password</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!sent ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Enter your email address and we'll send you a temporary password to log in with.
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-gray-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading
                      ? <><Loader className="w-4 h-4 animate-spin" /> Sending…</>
                      : 'Send Reset Email'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Success — email sent */
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-gray-900">Check your email</p>
                <p className="text-sm text-gray-500">
                  We sent a temporary password to{' '}
                  <span className="font-medium text-gray-700">{email}</span>.
                </p>
                <p className="text-xs text-gray-400">
                  Check your inbox and spam folder. Use the temporary password to log in, then change it from your profile.
                </p>
              </div>
              <button onClick={onClose}
                className="w-full px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Login Form ───────────────────────────────────────────────────────────
export default function LoginForm({ onError, onSuccess }: LoginFormProps) {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onError(null);
    try {
      await authService.login(email, password);
      onSuccess();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block mb-1.5" style={T.bodyMedium}>
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required placeholder="you@example.com"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" style={T.bodyMedium}>Password</label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs text-green-600 hover:text-green-700 font-medium transition"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader className="w-4 h-4 animate-spin" /> Signing in…</>
            : 'Sign In'}
        </button>
      </form>

      {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />}
    </>
  );
}