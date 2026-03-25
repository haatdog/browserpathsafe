// DashboardPage.tsx
import { useState, useEffect } from 'react';
import { profileAPI, authService } from '../lib/api';
import { LogOut, Menu, X } from 'lucide-react';
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

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'executive' | 'member';
  created_at: string;
  updated_at: string;
}

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
  admin:     ['users'],
  executive: ['events', 'simulations', 'create', 'projects'],
  member:    ['events'],
};

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [currentPage,      setCurrentPage]      = useState<Page>('home');
  const [profile,          setProfile]          = useState<UserProfile | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await profileAPI.getMe();
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => { await authService.logout(); onLogout(); };

  useEffect(() => {
    if (!profile) return;
    const allowed = [...PUBLIC_PAGES, ...(ROLE_PAGES[profile.role] ?? [])];
    if (!allowed.includes(currentPage)) setCurrentPage('home');
  }, [currentPage, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-page)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const navigate = (page: Page) => { setCurrentPage(page); setSidebarOpen(false); };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface-page)', fontFamily: 'var(--font-base)' }}>
      <Sidebar
        profile={profile}
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Header ─────────────────────────────────────────── */}
        <header style={{
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg transition hover:bg-gray-100"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              {/* Page title */}
              <h1 style={T.pageTitle}>
                {PAGE_TITLES[currentPage] ?? currentPage}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p style={T.bodyMedium}>
                  {profile?.email}
                </p>
                <p style={{...T.meta, textTransform: 'capitalize'}}>
                  {profile?.role ?? 'Loading…'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-lg transition hover:bg-gray-100"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-auto p-6 ${currentPage === 'home' ? 'max-w-4xl' : 'max-w-7xl'} mx-auto w-full`}>
            {currentPage === 'home'         && profile && <AnnouncementsFeed userRole={profile.role} userId={profile.id} />}
            {currentPage === 'organization' && <OrganizationChart />}
            {currentPage === 'incidents'    && <IncidentReportsList />}
            {currentPage === 'events'       && (
              profile?.role === 'executive' || profile?.role === 'member'
                ? <EventManagement /> : <AccessDenied />
            )}
            {currentPage === 'simulations'  && (profile?.role === 'executive' ? <SimulationList />     : <AccessDenied />)}
            {currentPage === 'create'       && (profile?.role === 'executive' ? <SimulationCreator />  : <AccessDenied />)}
            {currentPage === 'projects'     && (profile?.role === 'executive' ? <ProjectList />        : <AccessDenied />)}
            {currentPage === 'users'        && (profile?.role === 'admin'     ? <UserManagement />     : <AccessDenied />)}
          </main>

          {currentPage === 'home' && profile && <CalendarSidebar userRole={profile.role} />}
        </div>
      </div>
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