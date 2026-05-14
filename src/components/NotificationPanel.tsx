// NotificationPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Megaphone, Calendar, UserCheck, Info } from 'lucide-react';
import { T } from '../design/DesignTokens';
import type { Page } from '../types/navigation';

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

const authFetch = (url: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('pathsafe_token');
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers as Record<string, string> || {}),
    },
  });
};

interface Notification {
  id: number;
  type: 'announcement' | 'event' | 'drill_reminder' | 'account_approved' | string;
  title: string;
  body?: string;
  link_type?: string;
  ref_id?: number;
  is_read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  onNavigate?: (page: Page) => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'announcement')    return <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><Megaphone className="w-4 h-4 text-green-600" /></div>;
  if (type === 'event')           return <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><Calendar className="w-4 h-4 text-blue-600" /></div>;
  if (type === 'account_approved') return <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><UserCheck className="w-4 h-4 text-emerald-600" /></div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-gray-500" /></div>;
}

export default function NotificationPanel({ onNavigate }: NotificationPanelProps) {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => clearInterval(t);
  }, []);

  const fetchCount = async () => {
    try {
      const res = await authFetch(`${API}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {}
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open) fetchAll();
  };

  const markRead = async (id: number) => {
    try {
      await authFetch(`${API}/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await authFetch(`${API}/api/notifications/read-all`, { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const deleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await authFetch(`${API}/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.is_read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch {}
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.link_type && onNavigate) {
      onNavigate(notif.link_type as Page);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[80] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-600" />
              <span style={T.cardTitle}>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} title="Mark all as read"
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition">
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p style={T.bodyMedium} className="text-gray-400">No notifications yet</p>
                <p className="text-xs text-gray-300 mt-1">We'll let you know when something happens</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition group relative
                      ${!n.is_read ? 'bg-green-50/40' : ''}`}
                  >
                    <NotifIcon type={n.type} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1" />
                      )}
                      <button
                        onClick={e => deleteNotif(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 rounded transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center bg-gray-50">
              <p className="text-xs text-gray-400">{notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Click to mark as read</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}