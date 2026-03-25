//CalendarSidebar
import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, X, ChevronLeft, ChevronRight, Video, FileText } from 'lucide-react';
import { T, C } from '../design/DesignTokens';

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
    title: '', description: '', event_type: 'meeting' as Event['event_type'],
    start_time: '', end_time: '', location: '', is_virtual: false,
    meeting_link: '', max_participants: undefined as number | undefined
  });

  useEffect(() => { loadEvents(); }, [currentDate]);

  const loadEvents = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await fetch(`${API_URL}/api/events?year=${year}&month=${month}`);
      setEvents(await response.json());
    } catch (e) { console.error(e); }
  };

  const createEvent = async () => {
    if (userRole !== 'executive') { alert('Only executives can create events'); return; }
    if (!newEvent.title || !newEvent.start_time || !newEvent.end_time) {
      alert('Please fill in title, start time, and end time'); return;
    }
    try {
      const res = await fetch(`${API_URL}/api/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(newEvent)
      });
      if (res.ok) {
        setNewEvent({ title: '', description: '', event_type: 'meeting', start_time: '', end_time: '',
                      location: '', is_virtual: false, meeting_link: '', max_participants: undefined });
        setShowCreateModal(false); loadEvents();
      }
    } catch (e) { alert('Failed to create event'); }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear(), month = date.getMonth();
    return {
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      startingDayOfWeek: new Date(year, month, 1).getDay(),
    };
  };

  const getEventsForDate = (date: Date) =>
    events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });

  const getTodayEvents = () => {
    const t = new Date();
    return events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(e => new Date(e.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  };

  const formatTime = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayEvents = getTodayEvents();
  const upcomingEvents = getUpcomingEvents();

  const eventTypeColors = {
    training: 'bg-blue-100 text-blue-700',
    meeting:  'bg-purple-100 text-purple-700',
    drill:    'bg-red-100 text-red-700',
    other:    'bg-gray-100 text-gray-700',
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 style={T.sectionHeader}>Calendar & Events</h2>
          {userRole === 'executive' && (
            <button onClick={() => setShowCreateModal(true)}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition" title="Create Event">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4" /></button>
          <span style={{...T.bodyMedium, color: C.inkPrimary}}>{monthName}</span>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-xs font-medium text-gray-500 py-1">{d}</div>
          ))}
          {Array.from({ length: startingDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const hasEvents = getEventsForDate(date).length > 0;
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            return (
              <button key={day} onClick={() => setSelectedDate(date)}
                className={`py-1 text-xs rounded relative ${
                  isToday ? 'bg-blue-600 text-white font-semibold' :
                  isSelected ? 'bg-blue-50 text-blue-700 font-medium' :
                  'hover:bg-gray-100 text-gray-700'}`}>
                {day}
                {hasEvents && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {todayEvents.length > 0 && (
          <div>
            <h3 className="uppercase tracking-wider mb-2 flex items-center gap-1.5" style={T.sectionHeader}>
              <CalendarIcon className="w-3.5 h-3.5" /> Today
            </h3>
            <div className="space-y-2">
              {todayEvents.map(e => <EventCard key={e.id} event={e} formatTime={formatTime} eventTypeColors={eventTypeColors} />)}
            </div>
          </div>
        )}
        {upcomingEvents.length > 0 && (
          <div>
            <h3 className="uppercase tracking-wider mb-2" style={T.sectionHeader}>Upcoming</h3>
            <div className="space-y-2">
              {upcomingEvents.map(e => <EventCard key={e.id} event={e} formatTime={formatTime} formatDate={formatDate} eventTypeColors={eventTypeColors} />)}
            </div>
          </div>
        )}
        {todayEvents.length === 0 && upcomingEvents.length === 0 && (
          <div className="text-center py-8">
            <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p style={T.meta}>No upcoming events</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 style={T.pageTitle}>Schedule Event</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Event Type', type: 'select' },
              ].map(() => null)}
              <div>
                <label className="block mb-1" style={T.bodyMedium}>Event Type</label>
                <select value={newEvent.event_type} onChange={e => setNewEvent({...newEvent, event_type: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="meeting">Meeting</option>
                  <option value="training">Training</option>
                  <option value="drill">Emergency Drill</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block mb-1" style={T.bodyMedium}>Title</label>
                <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Fire drill, Safety training..." />
              </div>
              <div>
                <label className="block mb-1" style={T.bodyMedium}>Description</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Event details..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1" style={T.bodyMedium}>Start Time</label>
                  <input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent({...newEvent, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block mb-1" style={T.bodyMedium}>End Time</label>
                  <input type="datetime-local" value={newEvent.end_time} onChange={e => setNewEvent({...newEvent, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_virtual" checked={newEvent.is_virtual}
                  onChange={e => setNewEvent({...newEvent, is_virtual: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="is_virtual" style={T.bodyMedium}>Virtual Event</label>
              </div>
              {newEvent.is_virtual ? (
                <div>
                  <label className="block mb-1" style={T.bodyMedium}>Meeting Link</label>
                  <input type="url" value={newEvent.meeting_link} onChange={e => setNewEvent({...newEvent, meeting_link: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://zoom.us/..." />
                </div>
              ) : (
                <div>
                  <label className="block mb-1" style={T.bodyMedium}>Location</label>
                  <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Conference Room A..." />
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={createEvent}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Create Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  event: Event;
  formatTime: (t: string) => string;
  formatDate?: (t: string) => string;
  eventTypeColors: Record<Event['event_type'], string>;
}

function EventCard({ event, formatTime, formatDate, eventTypeColors }: EventCardProps) {
  const icons: Record<Event['event_type'], any> = { training: FileText, meeting: Users, drill: CalendarIcon, other: CalendarIcon };
  const Icon = icons[event.event_type];
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-sm transition">
      <div className="flex items-start gap-2 mb-1.5">
        <div className={`p-1.5 rounded text-xs ${eventTypeColors[event.event_type]}`}><Icon className="w-3 h-3" /></div>
        <div className="flex-1 min-w-0">
          <h4 className="truncate" style={T.cardTitle}>{event.title}</h4>
          {formatDate && <p style={T.meta}>{formatDate(event.start_time)}</p>}
        </div>
      </div>
      <div className="space-y-1 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{formatTime(event.start_time)} – {formatTime(event.end_time)}</div>
        {event.is_virtual
          ? <div className="flex items-center gap-1.5 text-blue-600"><Video className="w-3 h-3" />Virtual</div>
          : event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /><span className="truncate">{event.location}</span></div>
        }
      </div>
    </div>
  );
}