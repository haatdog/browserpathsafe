// CreateIncidentModal.tsx
import { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, Upload, User, Phone, Briefcase } from 'lucide-react';

const API_BASE =
  (import.meta.env.VITE_API_URL as string) ??
  (import.meta.env.VITE_PYTHON_API_URL as string) ??
  `${location.protocol}//${location.hostname}:5000`;

interface Person {
  name: string;
  role: string;
  contact: string;
}

const emptyPerson = (): Person => ({ name: '', role: '', contact: '' });

// ── Multi-image uploader ──────────────────────────────────────────────────────
export function MultiImageUploader({
  images, onChange, max = 5, accentColor = 'blue',
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  max?: number;
  accentColor?: 'blue' | 'purple';
}) {
  const [dragOver, setDragOver] = useState(false);

  const compress = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 800;
          let { width: w, height: h } = img;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
            else { w = Math.round((w * MAX) / h); h = MAX; }
          }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.55));
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

  const process = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, max - images.length);
    if (!list.length) return;
    Promise.all(list.map(compress)).then(r => onChange([...images, ...r]));
  };

  const border = dragOver ? 'border-blue-500 bg-blue-50'
    : accentColor === 'purple' ? 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50';

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <X className="w-3 h-3" />
              </button>
              {idx === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm font-medium">Cover</span>}
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition ${border}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); process(e.dataTransfer.files); }}>
          <div className="flex flex-col items-center gap-1.5 text-gray-500 pointer-events-none">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">{images.length === 0 ? 'Upload photos' : 'Add more photos'}</span>
            <span className="text-xs text-gray-400">{images.length}/{max} • PNG, JPG, WEBP up to 10MB</span>
          </div>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => { process(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {images.length >= max && <p className="text-xs text-center text-gray-400">Maximum {max} photos reached</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b-2 border-blue-600 pb-2 mb-5">
      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-widest">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Person row ────────────────────────────────────────────────────────────────
function PersonRow({ person, onChange, onRemove, canRemove }: {
  person: Person; onChange: (p: Person) => void; onRemove: () => void; canRemove: boolean;
}) {
  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-xl p-4">
      {canRemove && (
        <button type="button" onClick={onRemove}
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <User className="w-3 h-3" /> Full Name *
          </label>
          <input type="text" required value={person.name}
            onChange={e => onChange({ ...person, name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Juan dela Cruz" />
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <Briefcase className="w-3 h-3" /> Role / Position *
          </label>
          <input type="text" required value={person.role}
            onChange={e => onChange({ ...person, role: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Student, Faculty" />
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <Phone className="w-3 h-3" /> Contact *
          </label>
          <input type="text" required value={person.contact}
            onChange={e => onChange({ ...person, contact: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Phone or email" />
        </div>
      </div>
    </div>
  );
}

// ── Person list ───────────────────────────────────────────────────────────────
function PersonList({ people, onChange, addLabel }: {
  people: Person[]; onChange: (p: Person[]) => void; addLabel: string;
}) {
  return (
    <div className="space-y-3">
      {people.map((p, i) => (
        <PersonRow key={i} person={p}
          onChange={np => onChange(people.map((x, j) => j === i ? np : x))}
          onRemove={() => onChange(people.filter((_, j) => j !== i))}
          canRemove={people.length > 1} />
      ))}
      <button type="button" onClick={() => onChange([...people, emptyPerson()])}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition">
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

// ── Yes / No toggle ───────────────────────────────────────────────────────────
function YesNo({ label, value, onChange }: {
  label: string; value: boolean | null; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-2">
        {([true, false] as const).map(opt => (
          <button key={String(opt)} type="button" onClick={() => onChange(opt)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition
              ${value === opt
                ? opt ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {opt ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CreateIncidentModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: () => void;
}) {
  const [reportDate,         setReportDate]         = useState(new Date().toISOString().slice(0, 10));
  const [personsInvolved,    setPersonsInvolved]    = useState<Person[]>([emptyPerson()]);
  const [incidentDate,       setIncidentDate]       = useState(new Date().toISOString().slice(0, 10));
  const [incidentTime,       setIncidentTime]       = useState('');
  const [location,           setLocation]           = useState('');
  const [description,        setDescription]        = useState('');
  const [hasInjuries,        setHasInjuries]        = useState<boolean | null>(null);
  const [injuryDescription,  setInjuryDescription]  = useState('');
  const [hasPropertyDamage,  setHasPropertyDamage]  = useState<boolean | null>(null);
  const [damageDescription,  setDamageDescription]  = useState('');
  const [hasWitnesses,       setHasWitnesses]       = useState<boolean | null>(null);
  const [witnesses,          setWitnesses]          = useState<Person[]>([emptyPerson()]);
  const [actionsTaken,       setActionsTaken]       = useState('');
  const [images,             setImages]             = useState<string[]>([]);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInjuries === null || hasPropertyDamage === null || hasWitnesses === null) {
      setError('Please answer all Yes/No questions before submitting.');
      return;
    }
    setLoading(true);
    setError('');

    const richData = {
      report_date: reportDate,
      persons_involved: personsInvolved,
      incident_date: incidentDate,
      incident_time: incidentTime,
      location,
      description,
      has_injuries: hasInjuries,
      injury_description: hasInjuries ? injuryDescription : '',
      has_property_damage: hasPropertyDamage,
      damage_description: hasPropertyDamage ? damageDescription : '',
      has_witnesses: hasWitnesses,
      witnesses: hasWitnesses ? witnesses : [],
      actions_taken: actionsTaken,
    };

    try {
      const res = await fetch(`${API_BASE}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `Incident at ${location || 'Unknown Location'} — ${incidentDate}`,
          description: JSON.stringify(richData),
          incident_type: 'safety',
          severity: (hasInjuries || hasPropertyDamage) ? 'high' : 'medium',
          location,
          incident_date: incidentTime ? `${incidentDate}T${incidentTime}` : `${incidentDate}T00:00`,
          image_url:  images[0] || '',
          image_urls: images,
        }),
      });

      if (res.ok) { onSuccess(); onClose(); }
      else {
        const d = await res.json();
        setError(d.error || 'Failed to submit report');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Report Incident</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* Date of Report */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Report *</label>
            <input type="date" required value={reportDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setReportDate(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {/* Persons Involved */}
          <div>
            <SectionHeader title="Persons Involved" subtitle="List all individuals directly involved in the incident" />
            <PersonList people={personsInvolved} onChange={setPersonsInvolved} addLabel="Add another person involved" />
          </div>

          {/* Incident Details */}
          <div>
            <SectionHeader title="Incident Details" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Incident *</label>
                  <input type="date" required value={incidentDate}
                    onChange={e => setIncidentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Time of Incident</label>
                  <input type="time" value={incidentTime}
                    onChange={e => setIncidentTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location *</label>
                <input type="text" required value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Building A, Room 203" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description of Incident *</label>
                <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe what happened in detail..." />
              </div>
            </div>
          </div>

          {/* Damage and Injuries */}
          <div>
            <SectionHeader title="Damage and Injuries" />
            <div className="space-y-4">
              <YesNo label="Were there any injuries?" value={hasInjuries} onChange={setHasInjuries} />
              {hasInjuries && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description of Injuries *</label>
                  <textarea required value={injuryDescription} onChange={e => setInjuryDescription(e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Describe the injuries sustained..." />
                </div>
              )}
              <YesNo label="Was there any property damage?" value={hasPropertyDamage} onChange={setHasPropertyDamage} />
              {hasPropertyDamage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description of Property Damage *</label>
                  <textarea required value={damageDescription} onChange={e => setDamageDescription(e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Describe the property damage..." />
                </div>
              )}
            </div>
          </div>

          {/* Witnesses */}
          <div>
            <SectionHeader title="Witnesses" />
            <div className="space-y-4">
              <YesNo label="Were there any witnesses?" value={hasWitnesses} onChange={setHasWitnesses} />
              {hasWitnesses && (
                <PersonList people={witnesses} onChange={setWitnesses} addLabel="Add another witness" />
              )}
            </div>
          </div>

          {/* Actions Taken */}
          <div>
            <SectionHeader title="Actions Taken" subtitle="Describe any immediate actions or responses" />
            <textarea value={actionsTaken} onChange={e => setActionsTaken(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g. Notified security, called emergency services, evacuated area..." />
          </div>

          {/* Photo Evidence */}
          <div>
            <SectionHeader title="Photo Evidence" subtitle="Optional — up to 5 photos" />
            <MultiImageUploader images={images} onChange={setImages} max={5} />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium">
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}