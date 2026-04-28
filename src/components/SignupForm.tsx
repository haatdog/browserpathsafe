// SignupForm.tsx
import { useState } from 'react';
import { authAPI } from '../lib/api';
import { T } from '../design/DesignTokens';
import { CheckCircle, Clock, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', password: '', confirm: '',
  });
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    if (!form.first_name.trim())        { setError('First name is required.'); return; }
    if (!form.last_name.trim())         { setError('Last name is required.'); return; }
    setLoading(true);
    try {
      const res = await authAPI.register(form.email, form.password, 'member', {
        first_name:  form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name:   form.last_name.trim(),
      });
      if (res.status === 'pending') {
        setSubmitted(true);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pending success screen ─────────────────────────────────────────────────
  if (submitted) return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-4 px-4">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
        <Clock className="w-10 h-10 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Application Submitted!</h2>
      <p className="text-gray-600 text-sm max-w-xs leading-relaxed">
        Your account is <strong>pending approval</strong> by the administrator.
        You will be able to log in once your account has been verified.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 max-w-xs">
        📧 Please wait for the administrator to review your application.
      </div>
    </div>
  );

  // ── Signup form ────────────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input type="text" required value={form.first_name}
            onChange={e => set('first_name', e.target.value)}
            className={inputCls} placeholder="Juan" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input type="text" required value={form.last_name}
            onChange={e => set('last_name', e.target.value)}
            className={inputCls} placeholder="dela Cruz" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Middle Name <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <input type="text" value={form.middle_name}
          onChange={e => set('middle_name', e.target.value)}
          className={inputCls} placeholder="Santos" />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="email" required value={form.email}
            onChange={e => set('email', e.target.value)}
            className={`${inputCls} pl-10`} placeholder="juan@example.com" />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type={showPw ? 'text' : 'password'} required value={form.password}
            onChange={e => set('password', e.target.value)}
            className={`${inputCls} pl-10 pr-10`} placeholder="Min. 8 characters" />
          <button type="button" onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
        <input type={showPw ? 'text' : 'password'} required value={form.confirm}
          onChange={e => set('confirm', e.target.value)}
          className={inputCls} placeholder="Re-enter password" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
        ℹ️ Your account will require administrator approval before you can log in.
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</> : 'Submit Application'}
      </button>
    </form>
  );
}