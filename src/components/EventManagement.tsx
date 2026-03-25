// EventManagement.tsx - WITH EVACUATION EVALUATION INTEGRATION
import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Edit, Trash2, CheckCircle, Play, FileText, X, Save } from 'lucide-react';
import MemberEvaluationModal from './MemberEvaluationModal';
import ExecutiveEvaluationModal from './ExecutiveEvaluationModal';
import { profileAPI } from '../lib/api';
import { T, C } from '../design/DesignTokens';

interface Event {
  id: number; title: string; description: string;
  event_type: 'meeting'|'drill'|'training'|'inspection'|'other'|'fire_drill'|'earthquake_drill'|'bomb_threat_drill';
  start_time: string; end_time: string; location: string;
  created_by: number; created_at: string; updated_at: string;
}
interface EventWithStatus extends Event { status: 'upcoming'|'ongoing'|'done'; }

export default function EventManagement() {
  const [events, setEvents] = useState<EventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all'|'upcoming'|'ongoing'|'done'>('all');
  const [filterType,   setFilterType]   = useState<string>('all');
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number|null>(null);
  const [showMemberEvalModal,    setShowMemberEvalModal]    = useState(false);
  const [showExecutiveEvalModal, setShowExecutiveEvalModal] = useState(false);
  const [selectedEventForEval,   setSelectedEventForEval]   = useState<Event|null>(null);
  const [userRole,    setUserRole]    = useState<'admin'|'executive'|'member'>('member');
  const [userId,      setUserId]      = useState<string>('');
  const [userEvaluations, setUserEvaluations] = useState<{[id:number]:boolean}>({});

  useEffect(() => {
    loadUserProfile(); fetchEvents(); fetchUserEvaluations();
    const t = setInterval(() => { fetchEvents(); fetchUserEvaluations(); }, 60000);
    return () => clearInterval(t);
  }, []);

  const loadUserProfile = async () => {
    try { const p = await profileAPI.getMe(); setUserRole(p.role); setUserId(p.id); } catch {}
  };

  const fetchUserEvaluations = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/evaluations/my', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const m: {[id:number]:boolean} = {};
        data.forEach((e:any) => { m[e.event_id] = true; });
        setUserEvaluations(m);
      }
    } catch {}
  };

  const calculateStatus = (start: string, end: string): 'upcoming'|'ongoing'|'done' => {
    const now = new Date(), s = new Date(start), e = new Date(end);
    if (now < s) return 'upcoming';
    if (now >= s && now <= e) return 'ongoing';
    return 'done';
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/events', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.map((e:Event) => ({ ...e, status: calculateStatus(e.start_time, e.end_time) })));
      }
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/events/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { setEvents(events.filter(e => e.id !== id)); setShowDeleteConfirm(null); }
      else alert('Failed to delete event');
    } catch { alert('Failed to delete event'); }
  };

  const handleEvaluate = (event: Event) => {
    setSelectedEventForEval(event);
    userRole === 'executive' ? setShowExecutiveEvalModal(true) : setShowMemberEvalModal(true);
  };

  const isDrillEvent = (t: string) => ['drill','fire_drill','earthquake_drill','bomb_threat_drill'].includes(t);

  const getTypeColor = (t: string) => {
    if (isDrillEvent(t)) return 'bg-red-50 text-red-700 border-red-200';
    if (t === 'meeting')    return 'bg-blue-50 text-blue-700 border-blue-200';
    if (t === 'training')   return 'bg-purple-50 text-purple-700 border-purple-200';
    if (t === 'inspection') return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'upcoming') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200" style={T.bodyMedium}>
        <Clock className="w-3 h-3" /> Upcoming
      </span>
    );
    if (status === 'ongoing') return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 animate-pulse" style={T.bodyMedium}>
        <Play className="w-3 h-3" /> Ongoing
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200" style={T.bodyMedium}>
        <CheckCircle className="w-3 h-3" /> Done
      </span>
    );
  };

  const fmtDateTime = (s: string) => {
    const d = new Date(s);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const filtered = events.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    return true;
  });

  const counts = {
    all: events.length,
    upcoming: events.filter(e => e.status === 'upcoming').length,
    ongoing:  events.filter(e => e.status === 'ongoing').length,
    done:     events.filter(e => e.status === 'done').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-3" style={{...T.body, color: C.inkMuted}}>Loading events…</p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={T.pageTitle}>Event Management</h1>
            <p className="mt-0.5" style={{...T.body, color: C.inkMuted}}>Manage and track all scheduled events</p>
          </div>
          <p style={{...T.body, color: C.inkMuted}}>
            <span style={T.cardTitle}>{filtered.length}</span> of {events.length} events
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span style={T.bodyMedium}>Status:</span>
            <div className="flex gap-1.5">
              {[
                { key: 'all',      label: `All (${counts.all})`,           active: 'bg-gray-900 text-white',  inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                { key: 'upcoming', label: `Upcoming (${counts.upcoming})`, active: 'bg-blue-600 text-white',  inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                { key: 'ongoing',  label: `Ongoing (${counts.ongoing})`,   active: 'bg-green-600 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
                { key: 'done',     label: `Done (${counts.done})`,         active: 'bg-gray-600 text-white',  inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
              ].map(btn => (
                <button key={btn.key} onClick={() => setFilterStatus(btn.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === btn.key ? btn.active : btn.inactive}`}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span style={T.bodyMedium}>Type:</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="all">All Types</option>
              <option value="meeting">Meeting</option>
              <option value="drill">Drill</option>
              <option value="training">Training</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="mb-1" style={T.cardTitle}>No events found</h3>
            <p style={{...T.body, color: C.inkMuted}}>
              {filterStatus !== 'all' || filterType !== 'all' ? 'Try adjusting your filters' : 'Create your first event from the calendar'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Event','Date & Time','Type','Location','Status','Actions'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(event => {
                  const s = fmtDateTime(event.start_time), e = fmtDateTime(event.end_time);
                  return (
                    <tr key={event.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span style={{...T.bodyMedium, color: C.inkPrimary}}>{event.title}</span>
                          {userRole === 'member' && userEvaluations[event.id] && isDrillEvent(event.event_type) && event.status === 'done' && (
                            <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200" style={T.bodyMedium}>✓ Evaluated</span>
                          )}
                        </div>
                        {event.description && <p className="mt-0.5 line-clamp-1" style={T.meta}>{event.description}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-gray-900">{s.date}</div>
                        <div className="text-xs text-gray-500">{s.time} – {e.time}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(event.event_type)}`}>
                          {event.event_type.replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5" style={{...T.body, color: C.inkMuted}}>
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {event.location || 'Not specified'}
                        </div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(event.status)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDrillEvent(event.event_type) && event.status === 'done' && (
                            <button onClick={() => handleEvaluate(event)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition ${
                                userRole === 'executive' ? 'bg-purple-600 hover:bg-purple-700' :
                                userEvaluations[event.id] ? 'bg-green-600 hover:bg-green-700' :
                                'bg-purple-600 hover:bg-purple-700'}`}>
                              <FileText className="w-3.5 h-3.5" />
                              {userRole === 'executive' ? 'View' : userEvaluations[event.id] ? 'Edit' : 'Evaluate'}
                            </button>
                          )}
                          <button onClick={() => { setEditingEvent(event); setShowEditModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(event.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && editingEvent && (
        <EditEventModal event={editingEvent}
          onClose={() => { setShowEditModal(false); setEditingEvent(null); }}
          onSave={(updated) => {
            setEvents(events.map(e => e.id === updated.id ? { ...updated, status: calculateStatus(updated.start_time, updated.end_time) } : e));
            setShowEditModal(false); setEditingEvent(null);
          }} />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="mb-1" style={T.cardTitle}>Delete Event</h3>
                <p style={{...T.body, color: C.inkMuted}}>Are you sure? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-sm text-white rounded-lg hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showMemberEvalModal && selectedEventForEval && (
        <MemberEvaluationModal event={selectedEventForEval} userId={userId}
          onClose={() => { setShowMemberEvalModal(false); setSelectedEventForEval(null); }}
          onSubmitted={() => { setShowMemberEvalModal(false); setSelectedEventForEval(null); fetchUserEvaluations(); }} />
      )}
      {showExecutiveEvalModal && selectedEventForEval && (
        <ExecutiveEvaluationModal event={selectedEventForEval}
          onClose={() => { setShowExecutiveEvalModal(false); setSelectedEventForEval(null); }} />
      )}
    </div>
  );
}

interface EditEventModalProps { event: Event; onClose: () => void; onSave: (e: Event) => void; }

function EditEventModal({ event, onClose, onSave }: EditEventModalProps) {
  const [form, setForm] = useState({
    title: event.title, description: event.description, event_type: event.event_type,
    start_time: new Date(event.start_time).toISOString().slice(0,16),
    end_time:   new Date(event.end_time).toISOString().slice(0,16),
    location: event.location,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (new Date(form.start_time) >= new Date(form.end_time)) { setError('End time must be after start time'); return; }
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/events/${event.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) onSave(await res.json());
      else { const d = await res.json(); setError(d.error || 'Failed to update event'); }
    } catch { setError('Failed to update event'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={T.pageTitle}>Edit Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {[
            { key: 'title',       label: 'Event Title', type: 'text', required: true },
          ].map(() => null)}
          <div>
            <label className="block mb-1.5" style={T.bodyMedium}>Event Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block mb-1.5" style={T.bodyMedium}>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>
          <div>
            <label className="block mb-1.5" style={T.bodyMedium}>Event Type *</label>
            <select value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value as any})} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="meeting">Meeting</option>
              <option value="drill">Drill</option>
              <option value="fire_drill">Fire Drill</option>
              <option value="earthquake_drill">Earthquake Drill</option>
              <option value="bomb_threat_drill">Bomb Threat Drill</option>
              <option value="training">Training</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5" style={T.bodyMedium}>Start Date & Time *</label>
              <input type="datetime-local" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block mb-1.5" style={T.bodyMedium}>End Date & Time *</label>
              <input type="datetime-local" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5" style={T.bodyMedium}>Location</label>
            <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Building, room number, etc." />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-sm text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}