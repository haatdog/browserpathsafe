import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, X, ChevronLeft, ChevronRight, Video, FileText } from 'lucide-react';

// const API_URL = 'http://localhost:5000';  // ✅ Add this

interface Event {
  id: number;
  title: string;
  description: string;
  event_type: 'training' | 'meeting' | 'drill' | 'other';
  start_time: string;
  end_time: string;
  location?: string;
  is_virtual: boolean;
  meeting_link?: string;
  max_participants?: number;
  created_by: string;
  created_at: string;
}

interface CalendarSidebarProps {
  userRole: 'admin' | 'executive' | 'member';
}

export default function CalendarSidebar({ userRole }: CalendarSidebarProps) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"
  const [events, setEvents] = useState<Event[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'meeting' as Event['event_type'],
    start_time: '',
    end_time: '',
    location: '',
    is_virtual: false,
    meeting_link: '',
    max_participants: undefined as number | undefined
  });

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const loadEvents = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await fetch(`${API_URL}/api/events?year=${year}&month=${month}`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const createEvent = async () => {
    if (userRole !== 'executive') {
      alert('Only executives can create events');
      return;
    }
    
    if (!newEvent.title || !newEvent.start_time || !newEvent.end_time) {
      alert('Please fill in title, start time, and end time');
      return;
    }
  
    try {
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newEvent)
      });
  
      if (response.ok) {
        setNewEvent({
          title: '',
          description: '',
          event_type: 'meeting',
          start_time: '',
          end_time: '',
          location: '',
          is_virtual: false,
          meeting_link: '',
          max_participants: undefined
        });
        setShowCreateModal(false);
        loadEvents();
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
  };

  const getTodayEvents = () => {
    const today = new Date();
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.getDate() === today.getDate() &&
             eventDate.getMonth() === today.getMonth() &&
             eventDate.getFullYear() === today.getFullYear();
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(event => new Date(event.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayEvents = getTodayEvents();
  const upcomingEvents = getUpcomingEvents();

  const eventTypeColors = {
    training: 'bg-blue-100 text-blue-700 border-blue-300',
    meeting: 'bg-purple-100 text-purple-700 border-purple-300',
    drill: 'bg-red-100 text-red-700 border-red-300',
    other: 'bg-gray-100 text-gray-700 border-gray-300'
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Calendar & Events</h2>
          {/* ✅ Only show "Create Event" button for EXECUTIVE role */}
          {userRole === 'executive' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              title="Create Event"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">{monthName}</span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Mini Calendar */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="font-semibold text-gray-600 py-1">{day}</div>
          ))}
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="py-1"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(date)}
                className={`
                  py-1 rounded relative
                  ${isToday ? 'bg-blue-600 text-white font-bold' : ''}
                  ${isSelected && !isToday ? 'bg-blue-100 text-blue-700 font-semibold' : ''}
                  ${!isToday && !isSelected ? 'hover:bg-gray-100 text-gray-700' : ''}
                `}
              >
                {day}
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Today's Events */}
        {todayEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Today
            </h3>
            <div className="space-y-2">
              {todayEvents.map(event => (
                <EventCard key={event.id} event={event} formatTime={formatTime} eventTypeColors={eventTypeColors} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Upcoming</h3>
            <div className="space-y-2">
              {upcomingEvents.map(event => (
                <EventCard key={event.id} event={event} formatTime={formatTime} formatDate={formatDate} eventTypeColors={eventTypeColors} />
              ))}
            </div>
          </div>
        )}

        {todayEvents.length === 0 && upcomingEvents.length === 0 && (
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No upcoming events</p>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Schedule Event</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value as Event['event_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="meeting">Meeting</option>
                  <option value="training">Training</option>
                  <option value="drill">Emergency Drill</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Fire drill, Safety training..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Event details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_virtual"
                  checked={newEvent.is_virtual}
                  onChange={(e) => setNewEvent({ ...newEvent, is_virtual: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_virtual" className="text-sm font-medium text-gray-700">Virtual Event</label>
              </div>

              {newEvent.is_virtual ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={newEvent.meeting_link}
                    onChange={(e) => setNewEvent({ ...newEvent, meeting_link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://zoom.us/..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Conference Room A, Building 2..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants (optional)</label>
                <input
                  type="number"
                  value={newEvent.max_participants || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, max_participants: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={createEvent}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  event: Event;
  formatTime: (time: string) => string;
  formatDate?: (time: string) => string;
  eventTypeColors: Record<Event['event_type'], string>;
}

function EventCard({ event, formatTime, formatDate, eventTypeColors }: EventCardProps) {
  const eventTypeIcons: Record<Event['event_type'], typeof CalendarIcon> = {
    training: FileText,
    meeting: Users,
    drill: CalendarIcon,
    other: CalendarIcon
  };

  const Icon = eventTypeIcons[event.event_type];

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition">
      <div className="flex items-start gap-2 mb-2">
        <div className={`p-1.5 rounded ${eventTypeColors[event.event_type]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 truncate">{event.title}</h4>
          {formatDate && (
            <p className="text-xs text-gray-500">{formatDate(event.start_time)}</p>
          )}
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
        </div>

        {event.is_virtual ? (
          <div className="flex items-center gap-1.5">
            <Video className="w-3 h-3" />
            <span className="text-blue-600">Virtual Event</span>
          </div>
        ) : event.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {event.max_participants && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            <span>Max {event.max_participants} participants</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{event.description}</p>
      )}
    </div>
  );
}