// SignupForm.tsx
import { useState } from 'react';
import { authService } from '../lib/api';
import { Mail, Lock, User, Loader } from 'lucide-react';
import { T } from '../design/DesignTokens';

interface SignupFormProps {
  onError: (error: string | null) => void;
  onSuccess: () => void;
}

export default function SignupForm({ onError, onSuccess }: SignupFormProps) {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onError(null);
    try {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      await authService.signup(email, password);
      onSuccess();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label htmlFor="email" className="block mb-1.5" style={T.bodyMedium}>
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="you@example.com"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block mb-1.5" style={T.bodyMedium}>
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="••••••••"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
        </div>
        <p className="mt-1" style={T.meta}>Minimum 6 characters</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block mb-1.5" style={T.bodyMedium}>
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            required placeholder="••••••••"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loading
          ? <><Loader className="w-4 h-4 animate-spin" /> Creating account…</>
          : <><User className="w-4 h-4" /> Sign Up</>}
      </button>
    </form>
  );
}