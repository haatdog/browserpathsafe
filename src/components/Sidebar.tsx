// Sidebar.tsx - UPDATED

import { Home, BarChart3, Plus, Users, FolderOpen, X, Calendar, AlertTriangle, GitBranch } from 'lucide-react';
import type { Page } from '../types/navigation';

interface SidebarProps {
  profile: {
    id: string;
    email: string;
    role: 'admin' | 'executive' | 'member';
  } | null;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ profile, currentPage, onNavigate, isOpen, onClose }: SidebarProps) {
  const isExecutive = profile?.role === 'executive';
  const isAdmin     = profile?.role === 'admin';
  const isMember    = profile?.role === 'member';

  const NavBtn = ({
    page, icon: Icon, label,
  }: { page: Page; icon: any; label: string }) => (
    <button
      onClick={() => onNavigate(page)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
        ${currentPage === page
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-gray-700 hover:bg-gray-100'}`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">PathSafe</h2>
          <button onClick={onClose} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {/* Home — EVERYONE */}
            <NavBtn page="home"         icon={Home}          label="Home"              />

            {/* Organization — EVERYONE */}
            <NavBtn page="organization" icon={GitBranch}     label="Organization"      />

            {/* Events & Drills — EXECUTIVES & MEMBERS */}
            {(isExecutive || isMember) && (
              <NavBtn page="events"     icon={Calendar}      label="Events & Drills"   />
            )}

            {/* Incident Reports — EVERYONE */}
            <NavBtn page="incidents"    icon={AlertTriangle} label="Incident Reports"  />

            {/* Simulations — EXECUTIVE ONLY */}
            {isExecutive && (
              <NavBtn page="simulations" icon={BarChart3}    label="Simulations"       />
            )}

            {/* Projects — EXECUTIVE ONLY */}
            {isExecutive && (
              <NavBtn page="projects"   icon={FolderOpen}    label="Projects"          />
            )}

            {/* Create Simulation — EXECUTIVE ONLY */}
            {isExecutive && (
              <NavBtn page="create"     icon={Plus}          label="Create Simulation" />
            )}

            {/* User Management — ADMIN ONLY */}
            {isAdmin && (
              <NavBtn page="users"      icon={Users}         label="User Management"   />
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded text-xs font-medium capitalize
              ${profile?.role === 'admin'     ? 'bg-red-100 text-red-700'   : ''}
              ${profile?.role === 'executive' ? 'bg-blue-100 text-blue-700' : ''}
              ${profile?.role === 'member'    ? 'bg-green-100 text-green-700' : ''}`}>
              {profile?.role}
            </div>
            <span className="text-xs text-gray-500">Access Level</span>
          </div>
        </div>
      </aside>
    </>
  );
}