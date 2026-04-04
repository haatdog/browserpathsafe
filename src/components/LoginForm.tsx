// LoginForm.tsx
import { useState } from 'react';
import { authService } from '../lib/api';
import { Mail, Lock, Loader, KeyRound, X, CheckCircle, Copy, Check } from 'lucide-react';
import { T } from '../design/DesignTokens';

interface LoginFormProps {
  onError: (error: string | null) => void;
  onSuccess: () => void;
}

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step,     setStep]     = useState<'form' | 'done'>('form');
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [tempPass, setTempPass] = useState('');
  const [copied,   setCopied]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setTempPass(data.temp_password);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(tempPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
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
          {step === 'form' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter your email and we'll generate a temporary password you can use to log in.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      ? <><Loader className="w-4 h-4 animate-spin" /> Generating…</>
                      : 'Get Temp Password'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900">Temporary Password Ready</p>
                <p className="text-xs text-gray-500 text-center">
                  Use this to log in, then change your password from your profile settings.
                </p>
              </div>

              {/* Temp password box */}
              <div className="bg-gray-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 text-center uppercase tracking-wider mb-3">
                  Your Temporary Password
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-center text-2xl font-mono font-bold text-gray-900 tracking-widest">
                    {tempPass}
                  </code>
                  <button onClick={copy}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition
                      ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                    {copied
                      ? <><Check className="w-4 h-4" /> Copied!</>
                      : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                ⚠ This is shown only once — copy it before closing this window.
              </div>

              <button onClick={onClose}
                className="w-full py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginForm({ onError, onSuccess }: LoginFormProps) {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showForgot,      setShowForgot]      = useState(false);

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
            <input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required placeholder="you@example.com"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" style={T.bodyMedium}>Password</label>
            <button type="button" onClick={() => setShowForgot(true)}
              className="text-xs text-green-600 hover:text-green-700 font-medium transition">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading
            ? <><Loader className="w-4 h-4 animate-spin" /> Signing in…</>
            : 'Sign In'}
        </button>
      </form>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  );
}