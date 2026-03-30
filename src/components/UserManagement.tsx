// UserManagement.tsx
import { useState, useEffect } from 'react';
import { T } from '../design/DesignTokens';
import { Users, UserPlus, UserMinus, Trash2, Shield, User, Crown, Loader, Tag, Star, Plus, X, Pencil, Check } from 'lucide-react';

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

// Authenticated fetch — sends JWT token on every request
const authFetch = (url: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('pathsafe_token');
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
};

interface Group { id: number; name: string; is_custom: boolean; }
interface UserProfile {
  id: string; email: string; first_name?: string | null; last_name?: string | null;
  role: 'admin' | 'coordinator' | 'member'; group_id: number | null;
  group_name: string | null; is_head: boolean; created_at: string; updated_at: string;
}

const getRoleIcon = (role: string) => {
  if (role === 'admin')     return <Crown  className="w-4 h-4 text-yellow-600" />;
  if (role === 'coordinator') return <Shield className="w-4 h-4 text-green-600"  />;
  return <User className="w-4 h-4 text-gray-500" />;
};
const getRoleBadge = (role: string) => {
  if (role === 'admin')     return 'bg-yellow-100 text-yellow-800';
  if (role === 'coordinator') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-700';
};
const getDisplayName = (user: UserProfile) => {
  if (user.first_name || user.last_name) return [user.first_name, user.last_name].filter(Boolean).join(' ');
  return user.email.split('@')[0];
};

export default function UserManagement({
  currentUserRole = 'admin', currentUserGroupId = null,
  currentUserIsHead = false, currentUserId = '',
}: {
  currentUserRole?: 'admin' | 'coordinator' | 'member';
  currentUserGroupId?: number | null;
  currentUserIsHead?: boolean;
  currentUserId?: string;
}) {
  const [users,   setUsers]   = useState<UserProfile[]>([]);
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const isAdmin    = currentUserRole === 'admin';
  const isUnitHead = currentUserIsHead && currentUserGroupId !== null;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating,        setCreating]        = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'member' as 'admin' | 'coordinator' | 'member', group_id: '' as number | '', is_head: false });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGroup,     setEditGroup]     = useState<number | ''>('');
  const [editIsHead,    setEditIsHead]    = useState(false);
  const [showGroupModal,      setShowGroupModal]      = useState(false);
  const [newGroupName,        setNewGroupName]        = useState('');
  const [creatingGroup,       setCreatingGroup]       = useState(false);
  const [renamingGroupId,     setRenamingGroupId]     = useState<number | null>(null);
  const [renameGroupValue,    setRenameGroupValue]    = useState('');
  const [renamingGroupSaving, setRenamingGroupSaving] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSelected,  setPickerSelected]  = useState<string[]>([]);
  const [pickerSaving,    setPickerSaving]    = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ud, gd] = await Promise.all([
        authFetch(`${API}/api/users`).then(r => r.json()),
        authFetch(`${API}/api/groups`).then(r => r.json()),
      ]);
      setUsers( Array.isArray(ud) ? ud : []);
      setGroups(Array.isArray(gd) ? gd : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const unassignedMembers = users.filter(u => u.role === 'member' && !u.group_id);

  const handleAssignMembers = async () => {
    if (!pickerSelected.length) return;
    setPickerSaving(true);
    try {
      await Promise.all(pickerSelected.map(uid =>
        authFetch(`${API}/api/users/${uid}/group`, { method: 'PUT', body: JSON.stringify({ group_id: currentUserGroupId, is_head: false }) })
      ));
      setPickerSelected([]); setShowPickerModal(false);
      await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setPickerSaving(false); }
  };

  const handleKickMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from the group?`)) return;
    try {
      await authFetch(`${API}/api/users/${userId}/group`, { method: 'PUT', body: JSON.stringify({ group_id: null, is_head: false }) });
      await loadAll();
    } catch (err: any) { setError(err.message); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(null);
    try {
      const payload = {
        email: newUser.email, password: newUser.password,
        first_name: newUser.first_name.trim() || null,
        last_name: newUser.last_name.trim() || null,
        role: isUnitHead && !isAdmin ? 'member' : newUser.role,
        group_id: isUnitHead && !isAdmin ? currentUserGroupId : (newUser.group_id || null),
        is_head: isUnitHead && !isAdmin ? false : newUser.is_head,
      };
      const res = await authFetch(`${API}/api/auth/register`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create user'); }
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', first_name: '', last_name: '', role: 'member', group_id: '', is_head: false });
      await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setCreating(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await authFetch(`${API}/api/users/${userId}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) { setError(err.message); }
  };

  const handleSaveAssignment = async (userId: string) => {
    try {
      await authFetch(`${API}/api/users/${userId}/group`, { method: 'PUT', body: JSON.stringify({ group_id: editGroup || null, is_head: editIsHead }) });
      setEditingUserId(null);
      await loadAll();
      if (userId === currentUserId) window.location.reload();
    } catch (err: any) { setError(err.message); }
  };

  const startEditing = (user: UserProfile) => { setEditingUserId(user.id); setEditGroup(user.group_id ?? ''); setEditIsHead(user.is_head); };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newGroupName.trim()) return; setCreatingGroup(true);
    try {
      await authFetch(`${API}/api/groups`, { method: 'POST', body: JSON.stringify({ name: newGroupName.trim() }) });
      setNewGroupName(''); setShowGroupModal(false); await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setCreatingGroup(false); }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Delete this group? Members in it will be unassigned.')) return;
    try {
      await authFetch(`${API}/api/groups/${groupId}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) { setError(err.message); }
  };

  const startRenaming = (group: Group) => { setRenamingGroupId(group.id); setRenameGroupValue(group.name); };

  const handleRenameGroup = async (groupId: number) => {
    if (!renameGroupValue.trim()) return; setRenamingGroupSaving(true);
    try {
      const res = await authFetch(`${API}/api/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ name: renameGroupValue.trim() }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to rename'); }
      setRenamingGroupId(null); await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setRenamingGroupSaving(false); }
  };

  const visibleUsers = isUnitHead && !isAdmin ? users.filter(u => u.group_id === currentUserGroupId) : users;
  const canRenameGroup = (g: Group) => isAdmin || (isUnitHead && g.id === currentUserGroupId);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader className="w-8 h-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Groups panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-600" /> Groups
          </h3>
          {isAdmin && (
            <button onClick={() => setShowGroupModal(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition">
              <Plus className="w-4 h-4" /> New Group
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <div key={g.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${g.is_custom ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {renamingGroupId === g.id ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus value={renameGroupValue} onChange={e => setRenameGroupValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(g.id); if (e.key === 'Escape') setRenamingGroupId(null); }}
                    className="w-44 px-2 py-0.5 text-sm border border-green-400 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500" />
                  <button onClick={() => handleRenameGroup(g.id)} disabled={renamingGroupSaving} className="text-green-600 hover:text-green-700 transition">
                    {renamingGroupSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setRenamingGroupId(null)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <span>{g.name}</span>
                  {canRenameGroup(g) && <button onClick={() => startRenaming(g)} title="Rename" className="ml-1 opacity-60 hover:opacity-100 transition"><Pencil className="w-3 h-3" /></button>}
                  {isAdmin && <button onClick={() => handleDeleteGroup(g.id)} title="Delete" className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-600 transition"><X className="w-3 h-3" /></button>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-green-600" />
            <h2 style={T.pageTitle}>User Management</h2>
          </div>
          {(isAdmin || isUnitHead) && (
            <button onClick={() => isUnitHead && !isAdmin ? setShowPickerModal(true) : setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" /> {isUnitHead && !isAdmin ? 'Add Member' : 'Create User'}
            </button>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <div className="space-y-2">
          {visibleUsers.map(user => (
            <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getRoleIcon(user.role)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{getDisplayName(user)}</p>
                    <p style={T.meta}>{user.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {user.group_name && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          {user.is_head && <Star className="w-3 h-3 fill-green-500 text-green-500" />}
                          {user.is_head ? `Unit Head — ${user.group_name}` : user.group_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && user.role === 'member' && (
                    <button onClick={() => startEditing(user)} title="Assign group"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                  )}
                  {user.group_id !== null && user.role === 'member' && (isAdmin || (isUnitHead && user.group_id === currentUserGroupId)) && (
                    <button onClick={() => handleKickMember(user.id, getDisplayName(user))} title="Remove from group"
                      className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"><UserMinus className="w-4 h-4" /></button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDeleteUser(user.id)} title="Delete user"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              {editingUserId === user.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                  <select value={editGroup} onChange={e => setEditGroup(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="">— No Group —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={editIsHead} onChange={e => setEditIsHead(e.target.checked)} className="w-4 h-4 rounded text-green-600" />
                    <Star className="w-4 h-4 text-green-500" /> Assign as Unit Head
                  </label>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => setEditingUserId(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={() => handleSaveAssignment(user.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1">
                      <Check className="w-4 h-4" /> Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {visibleUsers.length === 0 && <p className="text-gray-500 text-center py-8 text-sm">No users found.</p>}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 style={T.pageTitle}>{isUnitHead && !isAdmin ? 'Add Member to Group' : 'Create New User'}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
            {isUnitHead && !isAdmin && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                <p className="text-sm text-green-700">New member will be added to <span className="font-semibold">{groups.find(g => g.id === currentUserGroupId)?.name ?? 'your group'}</span>.</p>
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="dela Cruz" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="user@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required minLength={8} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="••••••••" />
              </div>
              {isAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                      <option value="member">Member</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {newUser.role === 'member' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group (Optional)</label>
                        <select value={newUser.group_id} onChange={e => setNewUser({ ...newUser, group_id: e.target.value ? Number(e.target.value) : '' })}
                          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                          <option value="">— No Group —</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                      {newUser.group_id && (
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={newUser.is_head} onChange={e => setNewUser({ ...newUser, is_head: e.target.checked })} className="w-4 h-4 rounded text-green-600" />
                          <Star className="w-4 h-4 text-green-500" /> Assign as Unit Head
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 style={T.pageTitle}>Create Custom Group</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input type="text" required value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g. Medical Response Team" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowGroupModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={creatingGroup}
                  className="flex-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50">
                  {creatingGroup ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Picker (Unit Head only) */}
      {showPickerModal && isUnitHead && !isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={T.pageTitle}>Add Member to Group</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select from unassigned members</p>
              </div>
              <button onClick={() => { setShowPickerModal(false); setPickerSelected([]); }} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
            {unassignedMembers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <Users className="w-10 h-10 text-gray-300 mb-3" />
                <p style={T.bodyMedium}>No unassigned members</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {unassignedMembers.map(u => {
                  const selected = pickerSelected.includes(u.id);
                  return (
                    <button key={u.id} onClick={() => setPickerSelected(prev => selected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${selected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{getDisplayName(u)}</p>
                        <p style={T.meta} className="truncate">{u.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowPickerModal(false); setPickerSelected([]); }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAssignMembers} disabled={pickerSaving || pickerSelected.length === 0}
                className="flex-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                {pickerSaving ? <><Loader className="w-4 h-4 animate-spin" /> Adding…</> : `Add ${pickerSelected.length || ''} Member${pickerSelected.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}