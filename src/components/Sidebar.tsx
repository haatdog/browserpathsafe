// Sidebar.tsx
import { Home, BarChart3, Plus, Users, FolderOpen, X, Calendar, AlertTriangle, GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Page } from '../types/navigation';
import { T } from '../design/DesignTokens';

interface SidebarProps {
  profile: {
    id: string; email: string;
    role: 'admin' | 'executive' | 'member';
    group_id?: number | null; is_head?: boolean;
  } | null;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ profile, currentPage, onNavigate, isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const isExecutive = profile?.role === 'executive';
  const isAdmin     = profile?.role === 'admin';
  const isMember    = profile?.role === 'member';
  const isUnitHead  = !!(profile?.is_head && profile?.group_id);

  const NavBtn = ({ page, icon: Icon, label }: { page: Page; icon: any; label: string }) => (
    <button
      onClick={() => onNavigate(page)}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
        ${currentPage === page
          ? 'bg-green-600 text-white shadow-md'
          : 'text-gray-700 hover:bg-green-50 hover:text-green-700'}
        ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        bg-white border-r border-gray-200 flex flex-col
        transition-all duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${collapsed ? 'w-16' : 'w-64'}
      `}>
        {/* Header */}
        <div className={`p-4 border-b border-gray-200 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">PS</span>
              </div>
              <h2 style={T.pageTitle}>PathSafe</h2>
            </div>
          )}
          <button onClick={onClose} className="md:hidden p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center p-1 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600 transition"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <NavBtn page="home"         icon={Home}          label="Home"              />
          <NavBtn page="organization" icon={GitBranch}     label="Organization"      />
          {(isExecutive || isMember) && (
            <NavBtn page="events"     icon={Calendar}      label="Events & Drills"   />
          )}
          <NavBtn page="incidents"    icon={AlertTriangle} label="Incident Reports"  />
          {isExecutive && <NavBtn page="simulations" icon={BarChart3}  label="Simulations"       />}
          {isExecutive && <NavBtn page="projects"    icon={FolderOpen} label="Projects"          />}
          {isExecutive && <NavBtn page="create"      icon={Plus}       label="Create Simulation" />}
          {isAdmin     && <NavBtn page="users"       icon={Users}      label="User Management"   />}
          {isUnitHead && !isAdmin && <NavBtn page="users" icon={Users} label="My Group" />}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 flex justify-center">
          {collapsed ? (
            <div
              title={profile?.role}
              className={`w-2.5 h-2.5 rounded-full
                ${profile?.role === 'admin'     ? 'bg-red-500'    : ''}
                ${profile?.role === 'executive' ? 'bg-green-500'  : ''}
                ${profile?.role === 'member'    ? 'bg-emerald-400' : ''}`}
            />
          ) : (
            <div className="flex items-center gap-2 w-full">
              <div className={`px-2 py-1 rounded text-xs font-medium capitalize
                ${profile?.role === 'admin'     ? 'bg-red-100    text-red-700'     : ''}
                ${profile?.role === 'executive' ? 'bg-green-100  text-green-700'   : ''}
                ${profile?.role === 'member'    ? 'bg-emerald-100 text-emerald-700' : ''}`}>
                {profile?.role}
              </div>
              <span style={T.meta}>Access Level</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}