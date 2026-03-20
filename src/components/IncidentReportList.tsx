// IncidentReportList.tsx
import { useState, useEffect } from 'react';
import {
  AlertTriangle, Calendar, MapPin, MessageSquare, Plus, Filter,
  Users, Eye, ChevronRight, Loader, X
} from 'lucide-react';
import CreateIncidentModal from './CreateIncidentModal';

const API_BASE =
  (import.meta.env.VITE_API_URL as string) ??
  (import.meta.env.VITE_PYTHON_API_URL as string) ??
  `${location.protocol}//${location.hostname}:5000`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface RichData {
  report_date?: string;
  persons_involved?: { name: string; role: string; contact: string }[];
  incident_date?: string;
  incident_time?: string;
  location?: string;
  description?: string;
  has_injuries?: boolean;
  injury_description?: string;
  has_property_damage?: boolean;
  damage_description?: string;
  has_witnesses?: boolean;
  witnesses?: { name: string; role: string; contact: string }[];
  actions_taken?: string;
}

interface Incident {
  id: number;
  title: string;
  description: string;          // may be raw text or JSON string
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  incident_date: string;
  status: 'pending' | 'under_review' | 'resolved' | 'closed';
  image_url?: string;
  image_urls?: string[];
  created_at: string;
  reporter_email: string;
  remarks_count: number;
}

// ── Parse rich JSON description ───────────────────────────────────────────────
function parseDescription(raw: string): RichData | null {
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high:     'bg-orange-100 text-orange-800 border-orange-300',
  medium:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  low:      'bg-blue-100 text-blue-800 border-blue-300',
};

const STATUS_STYLES: Record<string, string> = {
  resolved:     'bg-green-100 text-green-700',
  under_review: 'bg-blue-100 text-blue-700',
  pending:      'bg-yellow-100 text-yellow-700',
  closed:       'bg-gray-100 text-gray-600',
};

function fmt(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return dateStr; }
}

// ── Boolean badge ─────────────────────────────────────────────────────────────
function BoolBadge({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${value ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

// ── Incident card ─────────────────────────────────────────────────────────────
function IncidentCard({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const rich = parseDescription(incident.description);

  const personsCount  = rich?.persons_involved?.length ?? 0;
  const witnessCount  = rich?.has_witnesses ? (rich.witnesses?.length ?? 0) : 0;
  const hasInjuries   = rich?.has_injuries  ?? false;
  const hasDamage     = rich?.has_property_damage ?? false;
  const location      = rich?.location || incident.location;
  const incidentDate  = rich?.incident_date ? fmt(rich.incident_date) : fmt(incident.incident_date);
  const reportDate    = rich?.report_date   ? fmt(rich.report_date)   : fmt(incident.created_at);
  const summary       = rich?.description   || incident.description;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
    >
      {/* Top bar: severity + status */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.medium}`}>
          {incident.severity.toUpperCase()}
        </span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[incident.status] ?? STATUS_STYLES.pending}`}>
          {incident.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition line-clamp-1">
          {incident.title}
        </h3>

        {/* Description excerpt */}
        <p className="text-sm text-gray-600 line-clamp-2">{summary}</p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> {incidentDate}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> {incident.remarks_count} remark{incident.remarks_count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Indicator pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {personsCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
              <Users className="w-3 h-3" /> {personsCount} involved
            </span>
          )}
          {witnessCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
              <Eye className="w-3 h-3" /> {witnessCount} witness{witnessCount !== 1 ? 'es' : ''}
            </span>
          )}
          <BoolBadge value={hasInjuries} trueLabel="Injuries reported" falseLabel="No injuries" />
          <BoolBadge value={hasDamage}   trueLabel="Property damage"   falseLabel="No damage"   />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            Reported by <span className="font-medium text-gray-600">{incident.reporter_email}</span>
            {rich?.report_date && ` · ${fmt(rich.report_date)}`}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IncidentReportsList() {
  const [incidents,        setIncidents]        = useState<Incident[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState('all');
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => { fetchIncidents(); }, []);

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents`, { credentials: 'include' });
      if (res.ok) setIncidents(await res.json());
    } catch (e) { console.error('Failed to fetch incidents:', e); }
    finally { setLoading(false); }
  };

  const filtered = incidents.filter(i => filter === 'all' || i.status === filter);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">{incidents.length} total report{incidents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending',      val: incidents.filter(i => i.status === 'pending').length,      color: 'text-yellow-600' },
          { label: 'Under Review', val: incidents.filter(i => i.status === 'under_review').length, color: 'text-blue-600'   },
          { label: 'Resolved',     val: incidents.filter(i => i.status === 'resolved').length,     color: 'text-green-600'  },
          { label: 'High / Critical', val: incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600 mr-1">Status:</span>
        {['all', 'pending', 'under_review', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No incidents found</h3>
          <p className="text-sm text-gray-500">
            {filter === 'all' ? 'No incidents reported yet.' : `No ${filter.replace('_', ' ')} incidents.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map(i => (
            <IncidentCard key={i.id} incident={i}
              onClick={() => setSelectedIncident(i)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onRefresh={fetchIncidents}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchIncidents}
        />
      )}
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function IncidentDetailModal({ incident, onClose, onRefresh }: {
  incident: Incident; onClose: () => void; onRefresh: () => void;
}) {
  const rich = parseDescription(incident.description);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div className="border-b-2 border-blue-600 pb-1.5 mb-3">
        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest">{title}</h4>
      </div>
      {children}
    </div>
  );

  const PersonBlock = ({ people }: { people: { name: string; role: string; contact: string }[] }) => (
    <div className="space-y-2">
      {people.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm grid grid-cols-3 gap-2">
          <div><span className="text-xs text-gray-400 block">Name</span><span className="font-medium">{p.name}</span></div>
          <div><span className="text-xs text-gray-400 block">Role</span><span>{p.role}</span></div>
          <div><span className="text-xs text-gray-400 block">Contact</span><span>{p.contact}</span></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 line-clamp-1">{incident.title}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${SEVERITY_STYLES[incident.severity]}`}>
              {incident.severity.toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status + meta */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`px-3 py-1 rounded-full font-medium ${STATUS_STYLES[incident.status]}`}>
              {incident.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            {rich?.report_date && (
              <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Calendar className="w-3.5 h-3.5" /> Report date: {fmt(rich.report_date)}
              </span>
            )}
            <span className="text-xs text-gray-400">Reported by {incident.reporter_email}</span>
          </div>

          {rich ? (
            <>
              {/* Persons involved */}
              {(rich.persons_involved?.length ?? 0) > 0 && (
                <Section title="Persons Involved">
                  <PersonBlock people={rich.persons_involved!} />
                </Section>
              )}

              {/* Incident details */}
              <Section title="Incident Details">
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Date</span>
                      <span className="font-medium">{rich.incident_date ? fmt(rich.incident_date) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Time</span>
                      <span className="font-medium">{rich.incident_time || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">Location</span>
                    <span className="font-medium">{rich.location || incident.location || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-0.5">Description</span>
                    <p className="text-gray-700 leading-relaxed">{rich.description}</p>
                  </div>
                </div>
              </Section>

              {/* Damage & injuries */}
              <Section title="Damage and Injuries">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 w-36 flex-shrink-0">Injuries:</span>
                    <BoolBadge value={!!rich.has_injuries} trueLabel="Yes" falseLabel="None" />
                  </div>
                  {rich.has_injuries && rich.injury_description && (
                    <p className="text-gray-700 bg-red-50 rounded-lg px-3 py-2 text-sm">{rich.injury_description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 w-36 flex-shrink-0">Property damage:</span>
                    <BoolBadge value={!!rich.has_property_damage} trueLabel="Yes" falseLabel="None" />
                  </div>
                  {rich.has_property_damage && rich.damage_description && (
                    <p className="text-gray-700 bg-orange-50 rounded-lg px-3 py-2 text-sm">{rich.damage_description}</p>
                  )}
                </div>
              </Section>

              {/* Witnesses */}
              <Section title="Witnesses">
                {rich.has_witnesses && (rich.witnesses?.length ?? 0) > 0 ? (
                  <PersonBlock people={rich.witnesses!} />
                ) : (
                  <p className="text-sm text-gray-500">No witnesses.</p>
                )}
              </Section>

              {/* Actions taken */}
              {rich.actions_taken && (
                <Section title="Actions Taken">
                  <p className="text-sm text-gray-700 leading-relaxed">{rich.actions_taken}</p>
                </Section>
              )}
            </>
          ) : (
            // Legacy plain-text description
            <div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.description}</p>
            </div>
          )}

          {/* Photos */}
          {(incident.image_urls?.length ?? 0) > 0 && (
            <Section title="Photo Evidence">
              <div className="grid grid-cols-4 gap-2">
                {incident.image_urls!.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}