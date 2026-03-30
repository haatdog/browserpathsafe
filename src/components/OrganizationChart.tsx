// OrganizationChart.tsx
import { useState, useEffect } from 'react';
import { Loader, Users, Star, Shield, Crown, User, ChevronDown, ChevronUp } from 'lucide-react';
import { T, C } from '../design/DesignTokens';
import { organizationAPI, UserProfile } from '../lib/api';

interface Group {
  id: number;
  name: string;
  is_custom: boolean;
}


// ── Group colour palette ───────────────────────────────────────────────────────
const GROUP_COLORS = [
  { bg: 'bg-red-50',     border: 'border-red-200',    accent: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700'    },
  { bg: 'bg-blue-50',    border: 'border-blue-200',   accent: 'bg-blue-500',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'   },
  { bg: 'bg-green-50',   border: 'border-green-200',  accent: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700'  },
  { bg: 'bg-amber-50',   border: 'border-amber-200',  accent: 'bg-amber-500',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
  { bg: 'bg-purple-50',  border: 'border-purple-200', accent: 'bg-purple-500', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-cyan-50',    border: 'border-cyan-200',   accent: 'bg-cyan-500',   text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700'   },
  { bg: 'bg-rose-50',    border: 'border-rose-200',   accent: 'bg-rose-500',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700'   },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200', accent: 'bg-indigo-500', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
];

// ── Display name helper ───────────────────────────────────────────────────────
function getDisplayName(user: UserProfile) {
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return user.email.split('@')[0];
}

// Initials avatar
function Avatar({ email, firstName, lastName, size = 'md', highlight = false }: { email: string; firstName?: string | null; lastName?: string | null; size?: 'sm' | 'md' | 'lg'; highlight?: boolean }) {
  const initials = firstName && lastName
    ? (firstName[0] + lastName[0]).toUpperCase()
    : firstName
    ? firstName.slice(0, 2).toUpperCase()
    : email.split('@')[0].slice(0, 2).toUpperCase();
  const sz = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0
      ${highlight
        ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-white ring-2 ring-amber-400 ring-offset-1'
        : 'bg-slate-200 text-slate-600'}`}>
      {initials}
    </div>
  );
}

// Role icon
function RoleIcon({ role }: { role: string }) {
  if (role === 'admin')     return <Crown  className="w-3.5 h-3.5 text-amber-500" />;
  if (role === 'coordinator') return <Shield className="w-3.5 h-3.5 text-blue-500"  />;
  return <User className="w-3.5 h-3.5 text-gray-400" />;
}

// ── Member card ────────────────────────────────────────────────────────────────
function MemberCard({ user, isHead, colorIdx }: { user: UserProfile; isHead: boolean; colorIdx: number }) {
  const c = GROUP_COLORS[((colorIdx % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length];
  const username = getDisplayName(user);

  return (
    <div className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border
      ${isHead
        ? `${c.bg} ${c.border} shadow-md`
        : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}
      transition-shadow duration-200 group`}>

      {isHead && (
        <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.badge} border ${c.border}`}>
          Unit Head
        </span>
      )}

      <Avatar email={user.email} firstName={user.first_name} lastName={user.last_name} size={isHead ? 'md' : 'sm'} highlight={isHead} />

      <div className="text-center min-w-0 w-full">
        <div className="font-semibold text-gray-900 text-sm truncate" title={user.email}>
          {username}
        </div>
        <div className="text-[11px] text-gray-400 truncate">{user.email.split('@')[1]}</div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <RoleIcon role={user.role} />
        <span className="capitalize">{user.role}</span>
      </div>
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────
function GroupCard({ group, members, colorIdx }: { group: Group | null; members: UserProfile[]; colorIdx: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const c = GROUP_COLORS[((colorIdx % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length];

  const head    = members.find(m => m.is_head);
  const regular = members.filter(m => !m.is_head);
  const label   = group?.name ?? 'Unassigned';
  const isUnassigned = !group;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200
      ${isUnassigned ? 'border-dashed border-gray-300 bg-gray-50' : `${c.border} bg-white`}`}>

      {/* Header */}
      <div
        className={`flex items-center justify-between px-5 py-4 cursor-pointer
          ${isUnassigned ? 'bg-gray-100' : `${c.bg}`}`}
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isUnassigned ? 'bg-gray-400' : c.accent}`} />
          <span className={`font-bold text-base ${isUnassigned ? 'text-gray-500' : 'text-gray-900'}`}>
            {label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${isUnassigned ? 'bg-gray-200 text-gray-600' : `${c.badge}`}`}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          {group?.is_custom && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded" style={T.bodyMedium}>
              Custom
            </span>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-600 transition">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Connector line to head */}
      {!collapsed && head && (
        <div className="flex flex-col items-center pt-4 pb-0">
          <div className={`w-0.5 h-4 ${isUnassigned ? 'bg-gray-300' : c.accent} opacity-40`} />
        </div>
      )}

      {/* Members grid */}
      {!collapsed && (
        <div className="px-5 pb-5 pt-2 space-y-4">
          {/* Head */}
          {head && (
            <div className="flex justify-center">
              <div className="w-36">
                <MemberCard user={head} isHead colorIdx={colorIdx} />
              </div>
            </div>
          )}

          {/* Connector line from head to members */}
          {head && regular.length > 0 && (
            <div className="flex flex-col items-center">
              <div className={`w-0.5 h-3 ${isUnassigned ? 'bg-gray-300' : c.accent} opacity-40`} />
              <div className={`w-3/4 h-0.5 ${isUnassigned ? 'bg-gray-300' : c.accent} opacity-20`} />
            </div>
          )}

          {/* Regular members */}
          {regular.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {regular.map(m => (
                <MemberCard key={m.id} user={m} isHead={false} colorIdx={colorIdx} />
              ))}
            </div>
          )}

          {members.length === 0 && (
            <p className="text-center py-4" style={T.body}>No members assigned</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leadership row ────────────────────────────────────────────────────────────
function LeadershipRow({ users }: { users: UserProfile[] }) {
  const admins     = users.filter(u => u.role === 'admin');
  const coordinators = users.filter(u => u.role === 'coordinator');
  const all        = [...admins, ...coordinators];
  if (all.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-xl mb-8">
      <div className="flex items-center gap-2 mb-5">
        <Crown className="w-5 h-5 text-amber-400" />
        <h3 className="text-white" style={T.pageTitle}>Leadership</h3>
        <span className="px-2 py-0.5 bg-white/10 text-white/70 rounded-full ml-1" style={T.meta}>{all.length} people</span>
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        {all.map(u => {
          const username = getDisplayName(u);
          const isAdmin  = u.role === 'admin';
          return (
            <div key={u.id} className="flex flex-col items-center gap-2.5 w-32 text-center">
              <Avatar email={u.email} firstName={u.first_name} lastName={u.last_name} size="lg" highlight />
              <div>
                <div className="text-white font-semibold text-sm truncate w-full">{username}</div>
                <div className="text-white/40 text-[11px] truncate">{u.email.split('@')[1]}</div>
              </div>
              <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                ${isAdmin
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-400/20 text-blue-300 border border-blue-500/30'}`}>
                {isAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {isAdmin ? 'Admin' : 'Coordinator'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ users, groups }: { users: UserProfile[]; groups: Group[] }) {
  const members    = users.filter(u => u.role === 'member');
  const assigned   = members.filter(u => u.group_id !== null);
  const heads      = members.filter(u => u.is_head);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {[
        { label: 'Total Members',  value: users.length,    sub: 'all roles',           color: 'text-slate-700' },
        { label: 'Groups',         value: groups.length,   sub: 'active groups',       color: 'text-blue-600'  },
        { label: 'Assigned',       value: assigned.length, sub: 'in a group',          color: 'text-green-600' },
        { label: 'Group Heads',    value: heads.length,    sub: 'team leads',          color: 'text-amber-600' },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
          <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
          <div className="mt-0.5" style={T.sectionHeader}>{s.label}</div>
          <div className="text-xs text-gray-400">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrganizationChart() {
  const [users,   setUsers]   = useState<UserProfile[]>([]);
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await organizationAPI.get();
        setUsers(Array.isArray(data.users)  ? data.users  : []);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
      {error}
    </div>
  );

  const members = users.filter(u => u.role === 'member');

  // Build group → members map
  const groupMap: Map<number | null, UserProfile[]> = new Map();
  groupMap.set(null, []);
  groups.forEach(g => groupMap.set(g.id, []));
  members.forEach(u => {
    const key = u.group_id ?? null;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(u);
  });

  // Groups that actually have members (or all groups to show empty ones)
  const activeGroups = groups.filter(g => (groupMap.get(g.id)?.length ?? 0) > 0);
  const unassigned   = groupMap.get(null) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 style={T.pageTitle}>Organization Chart</h1>
        <p className="mt-1" style={{...T.body, color: C.inkMuted}}>Members organized by group and role</p>
      </div>

      <StatsBar users={users} groups={groups} />

      <LeadershipRow users={users} />

      {/* Groups */}
      {activeGroups.length > 0 ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-gray-500" />
            <h2 style={T.sectionHeader}>Groups</h2>
          </div>
          {activeGroups.map((g, i) => (
            <GroupCard
              key={g.id}
              group={g}
              members={groupMap.get(g.id) ?? []}
              colorIdx={i}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p style={T.bodyMedium}>No groups have members yet</p>
          <p className="mt-1" style={T.body}>Assign members to groups in User Management</p>
        </div>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="mt-5">
          <GroupCard group={null} members={unassigned} colorIdx={-1} />
        </div>
      )}
    </div>
  );
}