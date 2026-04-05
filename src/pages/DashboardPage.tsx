// DashboardPage.tsx
import { useState, useEffect } from 'react';
import { profileAPI, authService } from '../lib/api';
import type { UserProfile } from '../lib/api';
import { LogOut, Menu, X, User, Check, Loader, Calendar } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import type { Page } from '../types/navigation';
import SimulationCreator from '../components/SimulationCreator';
import SimulationList from '../components/SimulationList';
import ProjectList from '../components/ProjectList';
import UserManagement from '../components/UserManagement';
import AnnouncementsFeed from '../components/AnnouncementsFeed';
import CalendarSidebar from '../components/CalendarSidebar';
import EventManagement from '../components/EventManagement';
import IncidentReportsList from '../components/IncidentReportList';
import OrganizationChart from '../components/OrganizationChart';
import { T, C } from '../design/DesignTokens';

interface DashboardPageProps { onLogout: () => void; }

const PAGE_TITLES: Record<Page, string> = {
  home:         'Home',
  organization: 'Organization',
  simulations:  'Simulations',
  create:       'Create Simulation',
  projects:     'Projects',
  users:        'User Management',
  events:       'Events & Drills',
  incidents:    'Incident Reports',
};

const PUBLIC_PAGES: Page[] = ['home', 'organization', 'incidents'];
const ROLE_PAGES: Record<string, Page[]> = {
  admin:       ['users', 'events', 'simulations', 'create', 'projects'],
  coordinator: ['events', 'simulations', 'create', 'projects'],
  member:      ['events'],
};

function getDisplayName(profile: UserProfile | null) {
  if (!profile) return '';
  if (profile.first_name || profile.last_name)
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  return profile.email.split('@')[0];
}

function ProfileModal({ profile, onClose, onSaved }: {
  profile: UserProfile; onClose: () => void; onSaved: (updated: UserProfile) => void;
}) {
  const [tab,             setTab]             = useState<'profile' | 'password'>('profile');
  const [firstName,       setFirstName]       = useState(profile.first_name ?? '');
  const [lastName,        setLastName]        = useState(profile.last_name  ?? '');
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [success,         setSuccess]         = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass,      setSavingPass]      = useState(false);

  const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';
  const token = localStorage.getItem('pathsafe_token');
  const authHeaders = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`${API}/api/auth/profile`, { method: 'PATCH', headers: authHeaders, credentials: 'include', body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onSaved({ ...profile, first_name: data.first_name, last_name: data.last_name });
      setSuccess('Profile updated!'); setTimeout(() => onClose(), 1000);
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    if (newPassword.length < 6) { setError('Minimum 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSavingPass(true);
    try {
      const res = await fetch(`${API}/api/auth/change-password`, { method: 'POST', headers: authHeaders, credentials: 'include', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuccess('Password changed!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) { setError(err.message); } finally { setSavingPass(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

        <div className="flex items-center justify-between px-5 pt-3 pb-3 sm:pt-5">
          <h3 style={T.pageTitle}>Edit Profile</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex justify-center pb-3">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-white text-xl font-bold">
            {firstName && lastName ? (firstName[0] + lastName[0]).toUpperCase() : firstName ? firstName.slice(0,2).toUpperCase() : profile.email.slice(0,2).toUpperCase()}
          </div>
        </div>

        <div className="flex border-b border-gray-200 px-5">
          {(['profile','password'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>
              {t === 'profile' ? 'Profile' : 'Password'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {error   && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-lg text-sm flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}

          {tab === 'profile' ? (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus placeholder="Juan"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="dela Cruz"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={profile.email} disabled className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader className="w-4 h-4 animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Save</>}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {[['Current Password', currentPassword, setCurrentPassword], ['New Password', newPassword, setNewPassword], ['Confirm New Password', confirmPassword, setConfirmPassword]].map(([label, val, setter]: any) => (
                <div key={label as string}><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type="password" value={val} onChange={e => setter(e.target.value)} required placeholder="••••••••"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              ))}
              <p className="text-xs text-gray-400">Minimum 6 characters</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={savingPass} className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingPass ? <><Loader className="w-4 h-4 animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Change</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [currentPage,      setCurrentPage]      = useState<Page>('home');
  const [profile,          setProfile]          = useState<UserProfile | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfile,      setShowProfile]      = useState(false);
  const [showCalendar,     setShowCalendar]     = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try { const data = await profileAPI.getMe(); setProfile(data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleLogout = async () => { await authService.logout(); onLogout(); };

  useEffect(() => {
    if (!profile) return;
    const isUnitHead = (profile.is_head ?? false) && (profile.group_id ?? null) !== null;
    const extraPages: Page[] = isUnitHead ? ['users'] : [];
    const allowed = [...PUBLIC_PAGES, ...(ROLE_PAGES[profile.role] ?? []), ...extraPages];
    if (!allowed.includes(currentPage)) setCurrentPage('home');
  }, [currentPage, profile]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-page)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
    </div>
  );

  const navigate = (page: Page) => { setCurrentPage(page); setSidebarOpen(false); };

  const initials = profile?.first_name && profile?.last_name
    ? (profile.first_name[0] + profile.last_name[0]).toUpperCase()
    : profile?.first_name ? profile.first_name.slice(0,2).toUpperCase()
    : profile?.email.slice(0,2).toUpperCase();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface-page)', fontFamily: 'var(--font-base)' }}>
      <Sidebar
        profile={profile} currentPage={currentPage} onNavigate={navigate}
        isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30" style={{ background: 'var(--color-surface-card)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition flex-shrink-0">
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <h1 className="truncate" style={T.pageTitle}>{PAGE_TITLES[currentPage] ?? currentPage}</h1>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Calendar toggle — mobile only, home page */}
              {currentPage === 'home' && (
                <button onClick={() => setShowCalendar(v => !v)}
                  className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition relative">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <button onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition" title="Edit profile">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="text-right hidden sm:block">
                  <p style={T.bodyMedium}>{getDisplayName(profile)}</p>
                  <p style={{...T.meta, textTransform: 'capitalize'}}>{profile?.role}</p>
                </div>
              </button>
              <div className="w-px h-5 bg-gray-200 hidden sm:block" />
              <button onClick={handleLogout} title="Logout" className="p-2 rounded-xl hover:bg-gray-100 transition" style={{ color: 'var(--color-ink-muted)' }}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-auto p-3 sm:p-6 ${currentPage === 'home' ? 'max-w-4xl' : 'max-w-7xl'} mx-auto w-full`}>
            {currentPage === 'home'         && profile && <AnnouncementsFeed userRole={profile.role} userId={profile.id} />}
            {currentPage === 'organization' && <OrganizationChart />}
            {currentPage === 'incidents'    && <IncidentReportsList />}
            {currentPage === 'events'       && (profile?.role === 'coordinator' || profile?.role === 'member' || profile?.role === 'admin' ? <EventManagement /> : <AccessDenied />)}
            {currentPage === 'simulations'  && (profile?.role === 'coordinator' || profile?.role === 'admin' ? <SimulationList />    : <AccessDenied />)}
            {currentPage === 'create'       && (profile?.role === 'coordinator' || profile?.role === 'admin' ? <SimulationCreator /> : <AccessDenied />)}
            {currentPage === 'projects'     && (profile?.role === 'coordinator' || profile?.role === 'admin' ? <ProjectList />       : <AccessDenied />)}
            {currentPage === 'users'        && (
              profile?.role === 'admin' || (profile?.is_head && profile?.group_id !== null)
                ? <UserManagement currentUserRole={profile!.role} currentUserGroupId={profile!.group_id ?? null} currentUserIsHead={profile!.is_head ?? false} currentUserId={profile!.id} />
                : <AccessDenied />
            )}
          </main>

          {/* Desktop calendar sidebar */}
          {currentPage === 'home' && profile && (
            <div className="hidden md:block">
              <CalendarSidebar userRole={profile.role} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile calendar bottom sheet */}
      {showCalendar && currentPage === 'home' && profile && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCalendar(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-auto">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Calendar & Events</h3>
              <button onClick={() => setShowCalendar(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <CalendarSidebar userRole={profile.role} mobileSheet />
          </div>
        </div>
      )}

      {showProfile && profile && (
        <ProfileModal profile={profile} onClose={() => setShowProfile(false)} onSaved={updated => setProfile(updated)} />
      )}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="text-center py-16">
      <p style={{ fontSize: 'var(--text-body-size)', color: 'var(--color-ink-muted)' }}>
        You don't have permission to view this page.
      </p>
    </div>
  );
}