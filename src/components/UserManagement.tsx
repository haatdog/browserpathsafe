// UserManagement.tsx
import { useState, useEffect } from 'react';
import { profileAPI, authAPI } from '../lib/api';
import {
  Users, UserPlus, Trash2, Shield, User, Crown, Loader,
  ChevronDown, Tag, Star, Plus, X, Pencil, Check
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Group {
  id: number;
  name: string;
  is_custom: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'executive' | 'member';
  group_id: number | null;
  group_name: string | null;
  is_head: boolean;
  created_at: string;
  updated_at: string;
}

// ── Default groups ────────────────────────────────────────────────────────────
const DEFAULT_GROUPS = [
  'First Aid Group',
  'Site Security Group',
  'Communication Group',
  'Fire Safety Group',
  'Evacuation Group',
  'Building Safety Inspection Group',
];

// ── Role helpers ──────────────────────────────────────────────────────────────
const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin':     return <Crown className="w-4 h-4 text-yellow-600" />;
    case 'executive': return <Shield className="w-4 h-4 text-blue-600" />;
    default:          return <User className="w-4 h-4 text-gray-500" />;
  }
};

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'admin':     return 'bg-yellow-100 text-yellow-800';
    case 'executive': return 'bg-blue-100 text-blue-800';
    default:          return 'bg-gray-100 text-gray-700';
  }
};

// ── Main component ────────────────────────────────────────────────────────────
export default function UserManagement() {
  const [users, setUsers]     = useState<UserProfile[]>([]);
  const [groups, setGroups]   = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '', password: '',
    role: 'member' as 'admin' | 'executive' | 'member',
    group_id: '' as number | '',
    is_head: false,
  });

  // Edit group modal (inline on user row)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGroup, setEditGroup]   = useState<number | ''>('');
  const [editIsHead, setEditIsHead] = useState(false);

  // Create custom group
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName]     = useState('');
  const [creatingGroup, setCreatingGroup]   = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersData, groupsData] = await Promise.all([
        fetch('http://localhost:5000/api/users', { credentials: 'include' }).then(r => r.json()),
        fetch('http://localhost:5000/api/groups', { credentials: 'include' }).then(r => r.json()),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Create user ─────────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          group_id: newUser.group_id || null,
          is_head: newUser.is_head,
        }),
      });
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', role: 'member', group_id: '', is_head: false });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Delete user ─────────────────────────────────────────────────────────────
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE', credentials: 'include',
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Save group/head assignment ───────────────────────────────────────────────
  const handleSaveAssignment = async (userId: string) => {
    try {
      await fetch(`http://localhost:5000/api/users/${userId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          group_id: editGroup || null,
          is_head: editIsHead,
        }),
      });
      setEditingUserId(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditing = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditGroup(user.group_id ?? '');
    setEditIsHead(user.is_head);
  };

  // ── Create custom group ─────────────────────────────────────────────────────
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      await fetch('http://localhost:5000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      setNewGroupName('');
      setShowGroupModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  // ── Delete custom group ─────────────────────────────────────────────────────
  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Delete this group? Members in it will be unassigned.')) return;
    try {
      await fetch(`http://localhost:5000/api/groups/${groupId}`, {
        method: 'DELETE', credentials: 'include',
      });
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Groups panel ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Groups
          </h3>
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <div key={g.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                g.is_custom
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
              {g.name}
              <button
                onClick={() => handleDeleteGroup(g.id)}
                className="ml-1 hover:text-red-600 transition"
                title="Delete group">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── User list ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Create User
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">

              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getRoleIcon(user.role)}
                  <div>
                    <div className="font-medium text-gray-900">{user.email}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {user.group_name && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {user.is_head && <Star className="w-3 h-3 fill-indigo-500 text-indigo-500" />}
                          {user.is_head ? `Head — ${user.group_name}` : user.group_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.role === 'member' && (
                    <button onClick={() => startEditing(user)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Assign group">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDeleteUser(user.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete user">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline edit row */}
              {editingUserId === user.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                  <select
                    value={editGroup}
                    onChange={e => setEditGroup(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">— No Group —</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsHead}
                      onChange={e => setEditIsHead(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <Star className="w-4 h-4 text-indigo-500" />
                    Assign as Head
                  </label>

                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => setEditingUserId(null)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                      Cancel
                    </button>
                    <button onClick={() => handleSaveAssignment(user.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {users.length === 0 && (
            <p className="text-gray-500 text-center py-8">No users found.</p>
          )}
        </div>
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Create New User</h3>
              <button onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required minLength={8} value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="member">Member</option>
                  <option value="executive">Executive</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Group assignment — only for members */}
              {newUser.role === 'member' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group (Optional)</label>
                    <select value={newUser.group_id}
                      onChange={e => setNewUser({ ...newUser, group_id: e.target.value ? Number(e.target.value) : '' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">— No Group —</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  {newUser.group_id && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={newUser.is_head}
                        onChange={e => setNewUser({ ...newUser, is_head: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600" />
                      <Star className="w-4 h-4 text-indigo-500" />
                      Assign as Group Head
                    </label>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <><Loader className="w-4 h-4 animate-spin" />Creating...</> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ────────────────────────────────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Custom Group</h3>
              <button onClick={() => setShowGroupModal(false)}
                className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input type="text" required value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Medical Response Team" />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowGroupModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={creatingGroup}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50">
                  {creatingGroup ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}