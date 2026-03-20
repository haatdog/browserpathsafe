// DashboardPage.tsx - FINAL VERSION

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

interface DashboardPageProps {
  onLogout: () => void;
}

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

// Pages every role can visit
const PUBLIC_PAGES: Page[] = ['home', 'organization', 'incidents'];

// Pages per role (on top of public)
const ROLE_PAGES: Record<string, Page[]> = {
  admin:     ['users'],
  executive: ['events', 'simulations', 'create', 'projects'],
  member:    ['events'],
};

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await profileAPI.getMe();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onLogout();
  };

  // Guard: redirect if role can't access current page
  useEffect(() => {
    if (!profile) return;
    const allowed = [...PUBLIC_PAGES, ...(ROLE_PAGES[profile.role] ?? [])];
    if (!allowed.includes(currentPage)) setCurrentPage('home');
  }, [currentPage, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const navigate = (page: Page) => { setCurrentPage(page); setSidebarOpen(false); };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar
        profile={profile}
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {PAGE_TITLES[currentPage] ?? currentPage}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.role ?? 'Loading...'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 hover:text-gray-900"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-8 ${
            currentPage === 'home' ? 'max-w-4xl' : 'max-w-7xl'
          } mx-auto w-full`}>

            {/* Home — EVERYONE */}
            {currentPage === 'home' && profile && (
              <AnnouncementsFeed userRole={profile.role} userId={profile.id} />
            )}

            {/* Organization — EVERYONE (read-only; edit via User Management) */}
            {currentPage === 'organization' && (
              <OrganizationChart />
            )}

            {/* Incident Reports — EVERYONE */}
            {currentPage === 'incidents' && <IncidentReportsList />}

            {/* Events & Drills — EXECUTIVES & MEMBERS */}
            {currentPage === 'events' && (
              profile?.role === 'executive' || profile?.role === 'member'
                ? <EventManagement />
                : <AccessDenied />
            )}

            {/* Simulations — EXECUTIVE ONLY */}
            {currentPage === 'simulations' && (
              profile?.role === 'executive' ? <SimulationList /> : <AccessDenied />
            )}

            {/* Create Simulation — EXECUTIVE ONLY */}
            {currentPage === 'create' && (
              profile?.role === 'executive' ? <SimulationCreator /> : <AccessDenied />
            )}

            {/* Projects — EXECUTIVE ONLY */}
            {currentPage === 'projects' && (
              profile?.role === 'executive' ? <ProjectList /> : <AccessDenied />
            )}

            {/* User Management — ADMIN ONLY */}
            {currentPage === 'users' && (
              profile?.role === 'admin' ? <UserManagement /> : <AccessDenied />
            )}
          </main>

          {/* Right Calendar Sidebar — home only */}
          {currentPage === 'home' && profile && (
            <CalendarSidebar userRole={profile.role} />
          )}
        </div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="text-center py-12">
      <p className="text-gray-600">Access denied. You don't have permission to view this page.</p>
    </div>
  );
}