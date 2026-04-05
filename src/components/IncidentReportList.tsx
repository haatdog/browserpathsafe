// IncidentReportList.tsx
import { useState, useEffect } from 'react';
import {
  AlertTriangle, Calendar, MapPin, MessageSquare, Plus, Filter,
  Users, Eye, ChevronRight, Loader, X
} from 'lucide-react';
import CreateIncidentModal from './CreateIncidentModal';
import { T, C } from '../design/DesignTokens';

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
  description: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDescription(raw: string): RichData | null {
  try { return JSON.parse(raw); } catch { return null; }
}

function capitalize(s: string) {
  return s.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function fmt(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return dateStr; }
}

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

// ── Boolean badge ─────────────────────────────────────────────────────────────
function BoolBadge({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${value ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

// ── PDF generator ─────────────────────────────────────────────────────────────
function downloadIncidentPDF(incident: Incident) {
  let rich: RichData | null = null;
  try { rich = JSON.parse(incident.description); } catch { /* plain text */ }

  const fmtLong = (s?: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return s; }
  };

  const chk = (v?: boolean | null) => v === true ? '&#9746;' : '&#9744;';
  const esc = (s?: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const persons = rich?.persons_involved?.length
    ? rich.persons_involved
    : [{ name: '', role: '', contact: '' }, { name: '', role: '', contact: '' }, { name: '', role: '', contact: '' }];

  const witnesses = rich?.witnesses?.length
    ? rich.witnesses
    : [{ name: '', role: '', contact: '' }, { name: '', role: '', contact: '' }];

  const personRows = persons.map((p) => `
    <div class="field-row">
      <span class="label">Name:</span><span class="uline" style="width:200px">${esc(p.name)}</span>
      <span class="label" style="margin-left:24px">Role:</span><span class="uline" style="flex:1">${esc(p.role)}</span>
    </div>
    <div class="field-row">
      <span class="label">Contact Information:</span><span class="uline" style="flex:1">${esc(p.contact)}</span>
    </div>`).join('');

  const witnessRows = witnesses.map((w) => `
    <div class="field-row">
      <span class="label">Witness Name:</span><span class="uline" style="width:260px">${esc(w.name)}</span>
    </div>
    <div class="field-row">
      <span class="label">Contact Information:</span><span class="uline" style="flex:1">${esc(w.contact)}</span>
    </div>`).join('');

  let timeDisp = rich?.incident_time || '';
  let isAM = false;
  let isPM = false;
  if (timeDisp) {
    const h = parseInt(timeDisp.split(':')[0]);
    isAM = h < 12;
    isPM = h >= 12;
    timeDisp = `${h % 12 || 12}:${timeDisp.split(':')[1]}`;
  }

  const descText = esc(rich?.description || incident.description);
  const injDesc  = esc(rich?.injury_description);
  const dmgDesc  = esc(rich?.damage_description);
  const actDesc  = esc(rich?.actions_taken);

  const blankLines = (n: number) => Array(n).fill('<div class="desc-line"></div>').join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Incident Report #${incident.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:10.5pt;color:#000;padding:36px 48px;max-width:780px;margin:0 auto}
    h1{text-align:center;font-size:17pt;font-weight:bold;letter-spacing:1.5px;margin-bottom:3px}
    .thick{border:none;border-top:3px solid #000;margin-bottom:2px}
    .thin{border:none;border-top:1px solid #000;margin-bottom:18px}
    .sec{font-weight:bold;font-size:10.5pt;margin:16px 0 8px}
    .field-row{display:flex;align-items:baseline;margin-bottom:9px;gap:4px}
    .label{white-space:nowrap;font-size:10pt}
    .uline{border-bottom:1px solid #000;display:inline-block;min-width:40px;padding-bottom:1px}
    .desc-line{border-bottom:1px solid #000;width:100%;min-height:18px;margin-bottom:7px;padding-bottom:2px}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:4px}
    .cb{font-size:11pt}
    .row{display:flex;gap:10px;align-items:baseline;margin-bottom:8px;flex-wrap:wrap}
    .sig-row{display:grid;grid-template-columns:2fr 1fr;gap:48px;margin-top:36px}
    .sig-line{border-bottom:1px solid #000;margin-top:22px}
    .sig-label{font-size:9pt;margin-top:4px;color:#333}
    .footer{margin-top:20px;font-size:8pt;color:#777;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:8px}
    @media print{body{padding:18px 28px}}
  </style></head><body>

  <h1>INCIDENT REPORT</h1>
  <hr class="thick"/><hr class="thin"/>

  <div class="field-row">
    <span class="label">Date of Report:</span>
    <span class="uline" style="width:280px">${fmtLong(rich?.report_date || incident.incident_date)}</span>
  </div>

  <div class="sec">Person(s) Involved</div>
  ${personRows}

  <div class="sec">Incident Details</div>
  <div class="field-row">
    <span class="label">Date of Incident:</span>
    <span class="uline" style="width:200px">${fmtLong(rich?.incident_date || incident.incident_date)}</span>
    <span class="label" style="margin-left:20px">Time:</span>
    <span class="uline" style="width:72px">${timeDisp}</span>
    <span style="margin-left:8px">
      <span class="cb">${chk(isAM)}</span> AM &nbsp;
      <span class="cb">${chk(isPM)}</span> PM
    </span>
  </div>
  <div class="field-row">
    <span class="label">Location:</span>
    <span class="uline" style="flex:1">${esc(rich?.location || incident.location)}</span>
  </div>
  <div class="field-row">
    <span class="label">Description of Incident:</span>
    <span class="uline" style="flex:1">${descText}</span>
  </div>
  ${blankLines(2)}

  <div class="sec">Damages and Injuries</div>
  <div class="row">
    <span>Were there any injuries?</span>
    <span class="cb">${chk(rich?.has_injuries)}</span> Yes &nbsp;
    <span class="cb">${chk(rich?.has_injuries === false)}</span> No
    <span style="margin-left:32px">Were there any property damages?</span>
    <span class="cb">${chk(rich?.has_property_damage)}</span> Yes &nbsp;
    <span class="cb">${chk(rich?.has_property_damage === false)}</span> No
  </div>
  <div class="two-col">
    <div>
      <div style="margin-bottom:4px">Describe the injuries:</div>
      <div class="desc-line">${injDesc}</div>
      ${blankLines(2)}
    </div>
    <div>
      <div style="margin-bottom:4px">Describe the property damage:</div>
      <div class="desc-line">${dmgDesc}</div>
      ${blankLines(2)}
    </div>
  </div>

  <div class="sec">Witness(es)</div>
  <div class="row">
    <span>Were there any witnesses to the incident?</span>
    <span class="cb">${chk(rich?.has_witnesses)}</span> Yes &nbsp;
    <span class="cb">${chk(rich?.has_witnesses === false)}</span> No
  </div>
  ${witnessRows}

  <div class="sec">Actions Taken</div>
  <div class="desc-line">${actDesc}</div>
  ${blankLines(2)}

  <div class="sig-row">
    <div><div class="sig-line"></div><div class="sig-label">Signature of Reporter</div></div>
    <div><div class="sig-line"></div><div class="sig-label">Date</div></div>
  </div>

  <div class="footer">
    <span>Incident #${incident.id} &middot; ${esc(incident.reporter_email)} &middot; ${capitalize(incident.status)}</span>
    <span>Generated: ${new Date().toLocaleString()}</span>
  </div>

  <script>window.onload = () => { window.focus(); window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=860,height=960');
  if (!w) { alert('Allow popups to download the PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

// ── Incident card ─────────────────────────────────────────────────────────────
function IncidentCard({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const rich = parseDescription(incident.description);

  const personsCount = rich?.persons_involved?.length ?? 0;
  const witnessCount = rich?.has_witnesses ? (rich.witnesses?.length ?? 0) : 0;
  const hasInjuries  = rich?.has_injuries ?? false;
  const hasDamage    = rich?.has_property_damage ?? false;
  const location     = rich?.location || incident.location;
  const incidentDate = rich?.incident_date ? fmt(rich.incident_date) : fmt(incident.incident_date);
  const summary      = rich?.description || incident.description;

  return (
    <div onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group">
      <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.medium}`}>
          {incident.severity.toUpperCase()}
        </span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[incident.status] ?? STATUS_STYLES.pending}`}>
          {capitalize(incident.status)}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <h3 className="group-hover:text-blue-600 transition line-clamp-1" style={T.pageTitle}>
          {incident.title}
        </h3>
        <p className="line-clamp-2" style={{...T.body, color: C.inkMuted}}>{summary}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {incidentDate}</span>
          {location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {location}</span>}
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> {incident.remarks_count} remark{incident.remarks_count !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {personsCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full" style={T.meta}>
              <Users className="w-3 h-3" /> {personsCount} involved
            </span>
          )}
          {witnessCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full" style={T.meta}>
              <Eye className="w-3 h-3" /> {witnessCount} witness{witnessCount !== 1 ? 'es' : ''}
            </span>
          )}
          <BoolBadge value={hasInjuries} trueLabel="Injuries reported" falseLabel="No injuries" />
          <BoolBadge value={hasDamage}   trueLabel="Property damage"   falseLabel="No damage" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span style={T.meta}>
            Reported by <span style={T.bodyMedium}>{incident.reporter_email}</span>
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 style={T.pageTitle}>Incident Reports</h1>
          <p className="mt-1" style={{...T.body, color: C.inkMuted}}>{incidents.length} total report{incidents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition text-sm font-medium shadow-sm w-full sm:w-auto justify-center sm:justify-start">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending',         val: incidents.filter(i => i.status === 'pending').length,                                  color: 'text-yellow-600' },
          { label: 'Under Review',    val: incidents.filter(i => i.status === 'under_review').length,                             color: 'text-blue-600'   },
          { label: 'Resolved',        val: incidents.filter(i => i.status === 'resolved').length,                                 color: 'text-green-600'  },
          { label: 'High / Critical', val: incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length,      color: 'text-red-600'    },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="mr-1" style={T.bodyMedium}>Status:</span>
        {['all', 'pending', 'under_review', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? 'All' : capitalize(s)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="mb-1" style={T.sectionHeader}>No incidents found</h3>
          <p style={{...T.body, color: C.inkMuted}}>
            {filter === 'all' ? 'No incidents reported yet.' : `No ${capitalize(filter)} incidents.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map(i => (
            <IncidentCard key={i.id} incident={i} onClick={() => setSelectedIncident(i)} />
          ))}
        </div>
      )}

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onRefresh={fetchIncidents}
        />
      )}

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
        <h4 className="text-blue-700 uppercase tracking-widest" style={T.pageTitle}>{title}</h4>
      </div>
      {children}
    </div>
  );

  const PersonBlock = ({ people }: { people: { name: string; role: string; contact: string }[] }) => (
    <div className="space-y-2">
      {people.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm grid grid-cols-3 gap-2">
          <div><span className="block" style={T.meta}>Name</span><span style={T.bodyMedium}>{p.name}</span></div>
          <div><span className="block" style={T.meta}>Role</span><span>{p.role}</span></div>
          <div><span className="block" style={T.meta}>Contact</span><span>{p.contact}</span></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="line-clamp-1" style={T.pageTitle}>{incident.title}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${SEVERITY_STYLES[incident.severity]}`}>
              {incident.severity.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={() => downloadIncidentPDF(incident)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs font-medium"
            >
              ⬇ Download PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`px-3 py-1 rounded-full font-medium ${STATUS_STYLES[incident.status]}`}>
              {capitalize(incident.status)}
            </span>
            {rich?.report_date && (
              <span className="flex items-center gap-1.5" style={T.meta}>
                <Calendar className="w-3.5 h-3.5" /> Report date: {fmt(rich.report_date)}
              </span>
            )}
            <span style={T.meta}>Reported by {incident.reporter_email}</span>
          </div>

          {rich ? (
            <>
              {(rich.persons_involved?.length ?? 0) > 0 && (
                <Section title="Persons Involved">
                  <PersonBlock people={rich.persons_involved!} />
                </Section>
              )}

              <Section title="Incident Details">
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block mb-0.5" style={T.meta}>Date</span>
                      <span style={T.bodyMedium}>{rich.incident_date ? fmt(rich.incident_date) : '—'}</span>
                    </div>
                    <div>
                      <span className="block mb-0.5" style={T.meta}>Time</span>
                      <span style={T.bodyMedium}>{rich.incident_time || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="block mb-0.5" style={T.meta}>Location</span>
                    <span style={T.bodyMedium}>{rich.location || incident.location || '—'}</span>
                  </div>
                  <div>
                    <span className="block mb-0.5" style={T.meta}>Description</span>
                    <p className="leading-relaxed" style={T.body}>{rich.description}</p>
                  </div>
                </div>
              </Section>

              <Section title="Damage and Injuries">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-36 flex-shrink-0" style={{...T.body, color: C.inkMuted}}>Injuries:</span>
                    <BoolBadge value={!!rich.has_injuries} trueLabel="Yes" falseLabel="None" />
                  </div>
                  {rich.has_injuries && rich.injury_description && (
                    <p className="bg-red-50 rounded-lg px-3 py-2" style={T.body}>{rich.injury_description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-36 flex-shrink-0" style={{...T.body, color: C.inkMuted}}>Property damage:</span>
                    <BoolBadge value={!!rich.has_property_damage} trueLabel="Yes" falseLabel="None" />
                  </div>
                  {rich.has_property_damage && rich.damage_description && (
                    <p className="bg-orange-50 rounded-lg px-3 py-2" style={T.body}>{rich.damage_description}</p>
                  )}
                </div>
              </Section>

              <Section title="Witnesses">
                {rich.has_witnesses && (rich.witnesses?.length ?? 0) > 0 ? (
                  <PersonBlock people={rich.witnesses!} />
                ) : (
                  <p style={{...T.body, color: C.inkMuted}}>No witnesses.</p>
                )}
              </Section>

              {rich.actions_taken && (
                <Section title="Actions Taken">
                  <p className="leading-relaxed" style={T.body}>{rich.actions_taken}</p>
                </Section>
              )}
            </>
          ) : (
            <div>
              <p className="whitespace-pre-wrap" style={T.body}>{incident.description}</p>
            </div>
          )}

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