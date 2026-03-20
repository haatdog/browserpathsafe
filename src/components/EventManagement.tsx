// EventManagement.tsx - WITH EVACUATION EVALUATION INTEGRATION

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Edit, Trash2, CheckCircle, Play, Flag, FileText, X, Save } from 'lucide-react';
import MemberEvaluationModal from './MemberEvaluationModal';
import ExecutiveEvaluationModal from './ExecutiveEvaluationModal';
import { profileAPI } from '../lib/api';

interface Event {
  id: number;
  title: string;
  description: string;
  event_type: 'meeting' | 'drill' | 'training' | 'inspection' | 'other' | 'fire_drill' | 'earthquake_drill' | 'bomb_threat_drill';
  start_time: string;
  end_time: string;
  location: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface EventWithStatus extends Event {
  status: 'upcoming' | 'ongoing' | 'done';
}

export default function EventManagement() {
  const [events, setEvents] = useState<EventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'ongoing' | 'done'>('all');
  const [filterType, setFilterType] = useState<'all' | 'meeting' | 'drill' | 'training' | 'inspection' | 'other'>('all');
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  // ✅ NEW: Evaluation modal states
  const [showMemberEvalModal, setShowMemberEvalModal] = useState(false);
  const [showExecutiveEvalModal, setShowExecutiveEvalModal] = useState(false);
  const [selectedEventForEval, setSelectedEventForEval] = useState<Event | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'executive' | 'member'>('member');
  const [userId, setUserId] = useState<string>('');
  const [userEvaluations, setUserEvaluations] = useState<{[eventId: number]: boolean}>({});

  useEffect(() => {
    loadUserProfile();
    fetchEvents();
    fetchUserEvaluations();
    // Refresh every minute to update status
    const interval = setInterval(() => {
      fetchEvents();
      fetchUserEvaluations();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ✅ NEW: Load user profile to get role
  const loadUserProfile = async () => {
    try {
      const profile = await profileAPI.getMe();
      setUserRole(profile.role);
      setUserId(profile.id);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // ✅ NEW: Fetch user's evaluations to check which events they've evaluated
  const fetchUserEvaluations = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/evaluations/my', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Create a map of event_id -> true for evaluated events
        const evalMap: {[eventId: number]: boolean} = {};
        data.forEach((evaluation: any) => {
          evalMap[evaluation.event_id] = true;
        });
        setUserEvaluations(evalMap);
        console.log('📋 User evaluations loaded:', evalMap);
      }
    } catch (error) {
      console.error('Error fetching user evaluations:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/events', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📅 Fetched events:', data);
        console.log('📅 Total events:', data.length);
        
        const eventsWithStatus = data.map((event: Event) => {
          const status = calculateEventStatus(event.start_time, event.end_time);
          console.log(`Event "${event.title}":`, {
            start: event.start_time,
            end: event.end_time,
            status
          });
          return {
            ...event,
            status
          };
        });
        
        console.log('📅 Events with status:', eventsWithStatus);
        setEvents(eventsWithStatus);
      } else {
        console.error('Failed to fetch events:', response.status);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEventStatus = (startTime: string, endTime: string): 'upcoming' | 'ongoing' | 'done' => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    console.log('Status calculation:', {
      now: now.toISOString(),
      start: start.toISOString(),
      end: end.toISOString(),
      isUpcoming: now < start,
      isOngoing: now >= start && now <= end,
      isDone: now > end
    });

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    return 'done';
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleDelete = async (eventId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setEvents(events.filter(e => e.id !== eventId));
        setShowDeleteConfirm(null);
      } else {
        alert('Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  // ✅ UPDATED: Handle evaluate - shows appropriate modal based on role
  const handleEvaluate = (event: Event) => {
    setSelectedEventForEval(event);
    
    if (userRole === 'executive') {
      // Executive sees all evaluations for this drill
      setShowExecutiveEvalModal(true);
    } else {
      // Member submits their own evaluation
      setShowMemberEvalModal(true);
    }
  };

  // ✅ NEW: Check if user has already evaluated this event
  const hasEvaluated = (eventId: number) => {
    return userEvaluations[eventId] === true;
  };

  // ✅ NEW: Check if event is a drill that can be evaluated
  const isDrillEvent = (eventType: string) => {
    return ['drill', 'fire_drill', 'earthquake_drill', 'bomb_threat_drill'].includes(eventType);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'drill':
      case 'fire_drill':
      case 'earthquake_drill':
      case 'bomb_threat_drill':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'meeting':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'training':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'inspection':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            Upcoming
          </span>
        );
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200 animate-pulse">
            <Play className="w-3.5 h-3.5" />
            Ongoing
          </span>
        );
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Done
          </span>
        );
      default:
        return null;
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const filteredEvents = events.filter(event => {
    if (filterStatus !== 'all' && event.status !== filterStatus) return false;
    if (filterType !== 'all' && event.event_type !== filterType) return false;
    return true;
  });

  const statusCounts = {
    all: events.length,
    upcoming: events.filter(e => e.status === 'upcoming').length,
    ongoing: events.filter(e => e.status === 'ongoing').length,
    done: events.filter(e => e.status === 'done').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage and track all scheduled events</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{filteredEvents.length}</span> event{filteredEvents.length !== 1 ? 's' : ''} shown
            </div>
            <div className="text-xs text-gray-500">
              ({events.length} total)
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filterStatus === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({statusCounts.all})
              </button>
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filterStatus === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Upcoming ({statusCounts.upcoming})
              </button>
              <button
                onClick={() => setFilterStatus('ongoing')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filterStatus === 'ongoing'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Ongoing ({statusCounts.ongoing})
              </button>
              <button
                onClick={() => setFilterStatus('done')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filterStatus === 'done'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Done ({statusCounts.done})
              </button>
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">
              {filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first event from the calendar'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEvents.map((event) => {
                  const startDateTime = formatDateTime(event.start_time);
                  const endDateTime = formatDateTime(event.end_time);

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 transition">
                      {/* Event */}
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{event.title}</span>
                            {/* ✅ NEW: Show "Evaluated" badge if member has submitted evaluation */}
                            {userRole === 'member' && hasEvaluated(event.id) && isDrillEvent(event.event_type) && event.status === 'done' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                ✓ Evaluated
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{startDateTime.date}</div>
                          <div className="text-gray-600">
                            {startDateTime.time} - {endDateTime.time}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getEventTypeColor(event.event_type)}`}>
                          {event.event_type.replace('_', ' ').charAt(0).toUpperCase() + event.event_type.replace('_', ' ').slice(1)}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {event.location || 'Not specified'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {getStatusBadge(event.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* ✅ UPDATED: Evaluate button - for drills and done status */}
                          {isDrillEvent(event.event_type) && event.status === 'done' && (
                            <button
                              onClick={() => handleEvaluate(event)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg transition ${
                                userRole === 'executive' 
                                  ? 'bg-purple-600 hover:bg-purple-700'
                                  : hasEvaluated(event.id)
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-purple-600 hover:bg-purple-700'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              {userRole === 'executive' 
                                ? 'View Evaluations' 
                                : hasEvaluated(event.id)
                                  ? 'Edit Evaluation'
                                  : 'Evaluate'}
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit event"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setShowDeleteConfirm(event.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete event"
                          >
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

      {/* Edit Modal */}
      {showEditModal && editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => {
            setShowEditModal(false);
            setEditingEvent(null);
          }}
          onSave={(updatedEvent) => {
            setEvents(events.map(e => 
              e.id === updatedEvent.id 
                ? { ...updatedEvent, status: calculateEventStatus(updatedEvent.start_time, updatedEvent.end_time) }
                : e
            ));
            setShowEditModal(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event</h3>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Member Evaluation Modal */}
      {showMemberEvalModal && selectedEventForEval && (
        <MemberEvaluationModal
          event={selectedEventForEval}
          userId={userId}
          onClose={() => {
            setShowMemberEvalModal(false);
            setSelectedEventForEval(null);
          }}
          onSubmitted={() => {
            setShowMemberEvalModal(false);
            setSelectedEventForEval(null);
            // ✅ Refresh evaluations to update button state
            fetchUserEvaluations();
          }}
        />
      )}

      {/* ✅ NEW: Executive Evaluation Modal */}
      {showExecutiveEvalModal && selectedEventForEval && (
        <ExecutiveEvaluationModal
          event={selectedEventForEval}
          onClose={() => {
            setShowExecutiveEvalModal(false);
            setSelectedEventForEval(null);
          }}
        />
      )}
    </div>
  );
}

// ==================== EDIT MODAL COMPONENT (unchanged) ====================

interface EditEventModalProps {
  event: Event;
  onClose: () => void;
  onSave: (event: Event) => void;
}

function EditEventModal({ event, onClose, onSave }: EditEventModalProps) {
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    start_time: new Date(event.start_time).toISOString().slice(0, 16),
    end_time: new Date(event.end_time).toISOString().slice(0, 16),
    location: event.location
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (new Date(formData.start_time) >= new Date(formData.end_time)) {
      setError('End time must be after start time');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`http://localhost:5000/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedEvent = await response.json();
        onSave(updatedEvent);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Edit Event</h2>
              <p className="text-blue-100 text-sm">Update event details and reschedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type *
            </label>
            <select
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
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

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Building, room number, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}