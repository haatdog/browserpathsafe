// UserManagement.tsx
import { useState, useEffect } from 'react';
import { T } from '../design/DesignTokens';
import { Users, UserPlus, UserMinus, Trash2, Shield, User, Crown, Loader, Tag, Star, Plus, X, Pencil, Check } from 'lucide-react';

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

const authFetch = (url: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('pathsafe_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers as Record<string,string>), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
};

interface Group    { id: number; name: string; is_custom: boolean; }
interface UserGroup { group_id: number; group_name: string; is_head: boolean; }
interface UserProfile {
  id: string; email: string; first_name?: string | null; last_name?: string | null;
  role: 'admin' | 'coordinator' | 'member';
  group_id: number | null; group_name: string | null; is_head: boolean;
  groups: UserGroup[];
  created_at: string; updated_at: string;
}

const getRoleIcon  = (r: string) => r === 'admin' ? <Crown className="w-4 h-4 text-yellow-600" /> : r === 'coordinator' ? <Shield className="w-4 h-4 text-green-600" /> : <User className="w-4 h-4 text-gray-500" />;
const getRoleBadge = (r: string) => r === 'admin' ? 'bg-yellow-100 text-yellow-800' : r === 'coordinator' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
const getDisplayName = (u: UserProfile) => (u.first_name || u.last_name) ? [u.first_name, u.last_name].filter(Boolean).join(' ') : u.email.split('@')[0];

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

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating,        setCreating]        = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'member' as UserProfile['role'] });

  // Group assignment modal (multi-group)
  const [editingUserId,   setEditingUserId]   = useState<string | null>(null);
  const [editGroups,      setEditGroups]      = useState<{ group_id: number; is_head: boolean }[]>([]);
  const [savingAssign,    setSavingAssign]    = useState(false);

  // Group management
  const [showGroupModal,      setShowGroupModal]      = useState(false);
  const [newGroupName,        setNewGroupName]        = useState('');
  const [creatingGroup,       setCreatingGroup]       = useState(false);
  const [renamingGroupId,     setRenamingGroupId]     = useState<number | null>(null);
  const [renameGroupValue,    setRenameGroupValue]    = useState('');
  const [renamingGroupSaving, setRenamingGroupSaving] = useState(false);

  // Member picker (unit head flow)
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
      setUsers( Array.isArray(ud) ? ud.map((u: any) => ({ ...u, groups: u.groups || [] })) : []);
      setGroups(Array.isArray(gd) ? gd : []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Create user ──────────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(null);
    try {
      const payload = {
        email: newUser.email, password: newUser.password,
        first_name: newUser.first_name.trim() || null,
        last_name:  newUser.last_name.trim()  || null,
        role: isUnitHead && !isAdmin ? 'member' : newUser.role,
      };
      const res = await authFetch(`${API}/api/auth/register`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create user'); }
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', first_name: '', last_name: '', role: 'member' });
      await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setCreating(false); }
  };

  // ── Delete user ──────────────────────────────────────────────────────────────
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try { await authFetch(`${API}/api/users/${userId}`, { method: 'DELETE' }); await loadAll(); }
    catch (err: any) { setError(err.message); }
  };

  // ── Multi-group assignment ────────────────────────────────────────────────────
  const startEditing = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditGroups(user.groups.map(g => ({ group_id: g.group_id, is_head: g.is_head })));
  };

  const toggleGroupInEdit = (groupId: number) => {
    setEditGroups(prev => {
      const exists = prev.find(g => g.group_id === groupId);
      if (exists) return prev.filter(g => g.group_id !== groupId);
      return [...prev, { group_id: groupId, is_head: false }];
    });
  };

  const toggleHeadInEdit = (groupId: number) => {
    setEditGroups(prev => prev.map(g => g.group_id === groupId ? { ...g, is_head: !g.is_head } : g));
  };

  const handleSaveAssignment = async (userId: string) => {
    setSavingAssign(true);
    try {
      await authFetch(`${API}/api/users/${userId}/groups`, {
        method: 'PUT',
        body: JSON.stringify({ groups: editGroups }),
      });
      setEditingUserId(null);
      await loadAll();
      if (userId === currentUserId) window.location.reload();
    } catch (err: any) { setError(err.message); }
    finally { setSavingAssign(false); }
  };

  const handleKickFromGroup = async (userId: string, groupId: number, userName: string, groupName: string) => {
    if (!confirm(`Remove ${userName} from ${groupName}?`)) return;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const remaining = user.groups.filter(g => g.group_id !== groupId);
    try {
      await authFetch(`${API}/api/users/${userId}/groups`, {
        method: 'PUT',
        body: JSON.stringify({ groups: remaining.map(g => ({ group_id: g.group_id, is_head: g.is_head })) }),
      });
      await loadAll();
    } catch (err: any) { setError(err.message); }
  };

  // ── Unit Head: assign members to their groups ─────────────────────────────
  const unassignedMembers = users.filter(u => u.role === 'member' && u.groups.length === 0);

  const handleAssignMembers = async () => {
    if (!pickerSelected.length || !currentUserGroupId) return;
    setPickerSaving(true);
    try {
      await Promise.all(pickerSelected.map(uid => {
        const user = users.find(u => u.id === uid);
        const existing = user?.groups.map(g => ({ group_id: g.group_id, is_head: g.is_head })) || [];
        const already = existing.some(g => g.group_id === currentUserGroupId);
        const newGroups = already ? existing : [...existing, { group_id: currentUserGroupId, is_head: false }];
        return authFetch(`${API}/api/users/${uid}/groups`, { method: 'PUT', body: JSON.stringify({ groups: newGroups }) });
      }));
      setPickerSelected([]); setShowPickerModal(false);
      await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setPickerSaving(false); }
  };

  // ── Group management ─────────────────────────────────────────────────────────
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newGroupName.trim()) return; setCreatingGroup(true);
    try {
      await authFetch(`${API}/api/groups`, { method: 'POST', body: JSON.stringify({ name: newGroupName.trim() }) });
      setNewGroupName(''); setShowGroupModal(false); await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setCreatingGroup(false); }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Delete this group? Members will be unassigned from it.')) return;
    try { await authFetch(`${API}/api/groups/${groupId}`, { method: 'DELETE' }); await loadAll(); }
    catch (err: any) { setError(err.message); }
  };

  const handleRenameGroup = async (groupId: number) => {
    if (!renameGroupValue.trim()) return; setRenamingGroupSaving(true);
    try {
      const res = await authFetch(`${API}/api/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ name: renameGroupValue.trim() }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setRenamingGroupId(null); await loadAll();
    } catch (err: any) { setError(err.message); }
    finally { setRenamingGroupSaving(false); }
  };

  const visibleUsers = isUnitHead && !isAdmin
    ? users.filter(u => u.groups.some(g => g.group_id === currentUserGroupId))
    : users;

  const canRenameGroup = (g: Group) => isAdmin || (isUnitHead && g.id === currentUserGroupId);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader className="w-8 h-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Groups panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Tag className="w-4 h-4 text-green-600" />Groups</h3>
          {isAdmin && (
            <button onClick={() => setShowGroupModal(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition">
              <Plus className="w-4 h-4" />New Group
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <div key={g.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${g.is_custom ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {renamingGroupId === g.id ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus value={renameGroupValue} onChange={e => setRenameGroupValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(g.id); if (e.key === 'Escape') setRenamingGroupId(null); }}
                    className="w-44 px-2 py-0.5 text-sm border border-green-400 rounded bg-white text-gray-900 focus:outline-none" />
                  <button onClick={() => handleRenameGroup(g.id)} disabled={renamingGroupSaving}>
                    {renamingGroupSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
                  </button>
                  <button onClick={() => setRenamingGroupId(null)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
              ) : (
                <>
                  <span>{g.name}</span>
                  {canRenameGroup(g) && <button onClick={() => { setRenamingGroupId(g.id); setRenameGroupValue(g.name); }} className="ml-1 opacity-60 hover:opacity-100"><Pencil className="w-3 h-3" /></button>}
                  {isAdmin && <button onClick={() => handleDeleteGroup(g.id)} className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-600"><X className="w-3 h-3" /></button>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><Users className="w-5 h-5 text-green-600" /><h2 style={T.pageTitle}>User Management</h2></div>
          {(isAdmin || isUnitHead) && (
            <button onClick={() => isUnitHead && !isAdmin ? setShowPickerModal(true) : setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" />{isUnitHead && !isAdmin ? 'Add Member' : 'Create User'}
            </button>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <div className="space-y-2">
          {visibleUsers.map(user => (
            <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex-shrink-0 mt-0.5">{getRoleIcon(user.role)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{getDisplayName(user)}</p>
                    <p style={T.meta}>{user.email}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {/* Show all groups as badges */}
                      {user.groups.map(g => (
                        <span key={g.group_id} className="group/badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          {g.is_head && <Star className="w-3 h-3 fill-green-500 text-green-500" />}
                          {g.is_head ? `Head · ${g.group_name}` : g.group_name}
                          {(isAdmin || (isUnitHead && g.group_id === currentUserGroupId)) && (
                            <button onClick={() => handleKickFromGroup(user.id, g.group_id, getDisplayName(user), g.group_name)}
                              className="ml-0.5 opacity-0 group-hover/badge:opacity-100 hover:text-red-500 transition">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {user.groups.length === 0 && <span className="text-xs text-gray-400 italic">No group</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isAdmin && (
                    <button onClick={() => startEditing(user)} title="Edit groups"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDeleteUser(user.id)} title="Delete user"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>

              {/* Multi-group editor inline */}
              {editingUserId === user.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Assign Groups</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groups.map(g => {
                      const inEdit = editGroups.find(eg => eg.group_id === g.id);
                      return (
                        <div key={g.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition cursor-pointer ${inEdit ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => toggleGroupInEdit(g.id)}>
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${inEdit ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                              {inEdit && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm text-gray-700">{g.name}</span>
                          </div>
                          {inEdit && (
                            <button onClick={e => { e.stopPropagation(); toggleHeadInEdit(g.id); }}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition ${inEdit.is_head ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'}`}>
                              <Star className="w-3 h-3" />{inEdit.is_head ? 'Head' : 'Set Head'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingUserId(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={() => handleSaveAssignment(user.id)} disabled={savingAssign}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1">
                      {savingAssign ? <><Loader className="w-4 h-4 animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Save</>}
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl p-6 sm:p-8 w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 style={T.pageTitle}>Create New User</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} placeholder="Juan"
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} placeholder="dela Cruz"
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="user@example.com"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required minLength={8} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="••••••••"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              {isAdmin && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserProfile['role']})}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    <option value="member">Member</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-400">You can assign groups after creating the user.</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <><Loader className="w-4 h-4 animate-spin" />Creating…</> : 'Create'}
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
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input type="text" required value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Medical Response Team"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowGroupModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={creatingGroup} className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-50">
                  {creatingGroup ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Picker (Unit Head) */}
      {showPickerModal && isUnitHead && !isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl p-6 w-full sm:max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div><h3 style={T.pageTitle}>Add Member to Group</h3><p className="text-xs text-gray-500 mt-0.5">Select from unassigned members</p></div>
              <button onClick={() => { setShowPickerModal(false); setPickerSelected([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
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
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${selected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{getDisplayName(u)}</p><p style={T.meta} className="truncate">{u.email}</p></div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowPickerModal(false); setPickerSelected([]); }} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAssignMembers} disabled={pickerSaving || !pickerSelected.length}
                className="flex-1 px-4 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                {pickerSaving ? <><Loader className="w-4 h-4 animate-spin" />Adding…</> : `Add ${pickerSelected.length || ''} Member${pickerSelected.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}