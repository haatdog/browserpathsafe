// ExecutiveEvaluationModal.tsx
import { useState, useEffect } from 'react';
import { T, C } from '../design/DesignTokens';
import {
  X, Users, MapPin, MessageSquare, GraduationCap, User,
  Download, FileText, PlusCircle, CheckCircle, AlertCircle,
  Upload, ChevronLeft, ChevronRight, Images, Printer
} from 'lucide-react';
import { evaluationAPI, profileAPI, type UserProfile } from '../lib/api';

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';

function getDisplayName(profile: UserProfile): string {
  if (profile.first_name || profile.last_name)
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  return profile.email.split('@')[0];
}

function getPreparedByFromProfile(profile: UserProfile | null) {
  if (!profile) return { prepName: 'PATHSAFE SYSTEM', prepRole: 'System' };
  return {
    prepName: getDisplayName(profile).toUpperCase(),
    prepRole: profile.role.charAt(0).toUpperCase() + profile.role.slice(1),
  };
}
const authHeaders = () => {
  const token = localStorage.getItem('pathsafe_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppEvent { id: number; title: string; event_type: string; start_time: string; }

interface Evaluation {
  id: number; event_id: number;
  instructor_name: string; program_class: string; classroom_office: string;
  male_count: number; female_count: number; comments: string;
  submitted_by: string; submitted_by_email: string; submitted_at: string;
  image_url?: string; image_urls?: string[] | string;
  infrastructure_type?: string | null;
  infrastructure_name?: string | null;
  infrastructure_others?: string | null;
  region?: string | null;
  quarter?: string | null;
}

interface ExecutiveEvaluationModalProps { event: AppEvent; onClose: () => void; }

const EMPTY_FORM = {
  instructor_name: '', program_class: '', classroom_office: '',
  male_count: 0, female_count: 0, comments: '',
  infrastructure_type: '' as string,
  infrastructure_name: '',
  infrastructure_others: '',
  region: '',
  quarter: '',
};

function getImages(ev: Evaluation | null): string[] {
  if (!ev) return [];
  let urls = ev.image_urls;
  if (typeof urls === 'string') { try { urls = JSON.parse(urls); } catch { urls = []; } }
  if (Array.isArray(urls) && urls.length > 0) return urls;
  if (ev.image_url) return [ev.image_url];
  return [];
}

// ── Multi-image uploader ──────────────────────────────────────────────────────
function MultiImageUploader({ images, onChange, max = 5 }: { images: string[]; onChange: (imgs: string[]) => void; max?: number; }) {
  const [dragOver, setDragOver] = useState(false);

  const compress = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 800; let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', 0.55));
      };
      img.src = ev.target!.result as string;
    };
    r.readAsDataURL(file);
  });

  const process = (files: FileList | null) => {
    if (!files) return;
    const todo = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024).slice(0, max - images.length);
    if (!todo.length) return;
    Promise.all(todo.map(compress)).then(c => onChange([...images, ...c])).catch(console.error);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
              {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm">Cover</span>}
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition ${dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); process(e.dataTransfer.files); }}>
          <div className="flex flex-col items-center gap-1 text-gray-500 pointer-events-none">
            <Upload className="w-5 h-5" />
            <span style={T.body}>{images.length === 0 ? 'Upload photos' : 'Add more'}</span>
            <span style={T.meta}>{images.length}/{max} • up to 10MB each</span>
          </div>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { process(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {images.length >= max && <p className="text-center" style={T.meta}>Maximum {max} photos reached</p>}
    </div>
  );
}

// ── Mini slideshow ────────────────────────────────────────────────────────────
function MiniSlideshow({ images }: { images: string[] }) {
  const [cur, setCur] = useState(0);
  if (!images.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><Images className="w-4 h-4 text-purple-500" />Photo Evidence ({images.length})</p>
      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: '16/9' }}>
        <img src={images[cur]} alt="" className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCur(c => (c - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCur(c => (c + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"><ChevronRight className="w-4 h-4" /></button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5">
          {images.map((src, i) => (
            <button key={i} onClick={() => setCur(i)} className={`w-12 h-12 rounded-md overflow-hidden border-2 transition flex-shrink-0 ${i === cur ? 'border-purple-500' : 'border-transparent opacity-50 hover:opacity-75'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ExecutiveEvaluationModal({ event, onClose }: ExecutiveEvaluationModalProps) {
  // Member evaluations (from all members)
  const [evaluations,   setEvaluations]   = useState<Evaluation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState('');
  const [selectedEval,  setSelectedEval]  = useState<Evaluation | null>(null);

  // Coordinator's own evaluation
  const [myEval,        setMyEval]        = useState<Evaluation | null>(null);
  const [myEvalLoading, setMyEvalLoading] = useState(true);

  // Submit form state
  const [activeTab,     setActiveTab]     = useState<'view' | 'submit'>('view');
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [images,        setImages]        = useState<string[]>([]);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);

  useEffect(() => { loadAll(); }, [event.id]);

  useEffect(() => {
    profileAPI.getMe().then(setUserProfile).catch(() => {});
  }, []);

  const loadAll = async () => {
    setLoading(true); setMyEvalLoading(true); setFetchError('');
    try {
      // Load member evaluations (coordinator-only endpoint)
      const res = await fetch(`${API}/api/evaluations/event/${event.id}`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) { const d = await res.json(); setFetchError(d.error || 'Failed to load'); }
      else { const d = await res.json(); setEvaluations(Array.isArray(d.evaluations) ? d.evaluations : []); }
    } catch { setFetchError('Network error loading evaluations.'); }
    finally { setLoading(false); }

    try {
      // Load coordinator's own submission
      const mine = await evaluationAPI.mine();
      // eslint-disable-next-line eqeqeq
      const found = Array.isArray(mine) ? mine.find((e: any) => e.event_id == event.id) : null;
      setMyEval(found || null);
    } catch {}
    finally { setMyEvalLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setSubmitError('');
    if (!form.instructor_name.trim()) { setSubmitError('Name is required.'); setSubmitting(false); return; }
    if (!form.classroom_office.trim()) { setSubmitError('Classroom / Office is required.'); setSubmitting(false); return; }
    if (form.male_count + form.female_count === 0) { setSubmitError('Total must be at least 1.'); setSubmitting(false); return; }
    try {
      await evaluationAPI.submit({
        event_id: event.id, ...form,
        program_class: form.program_class || 'N/A',
        infrastructure_type: form.infrastructure_type || null,
        infrastructure_name: form.infrastructure_name || null,
        infrastructure_others: form.infrastructure_others || null,
        region: form.region || null,
        quarter: form.quarter || null,
        image_urls: images,
      } as any);
      setSubmitSuccess(true); setForm(EMPTY_FORM); setImages([]);
      loadAll();
    } catch (err: any) { setSubmitError(err.message || 'Failed to submit.'); }
    finally { setSubmitting(false); }
  };

  // ── Coordinator's own evaluation PDF ──────────────────────────────────────
  const handlePrintMyEval = async () => {
    if (!myEval) return;
    let profile = userProfile;
    if (!profile) {
      try { profile = await profileAPI.getMe(); setUserProfile(profile); } catch {}
    }
    const { prepName, prepRole } = getPreparedByFromProfile(profile);
    const logoSrc  = `${window.location.origin}/Pathsafe2.png`;

    const school   = myEval.infrastructure_type === 'school'   ? (myEval.infrastructure_name || '✓') : '';
    const hospital = myEval.infrastructure_type === 'hospital' ? (myEval.infrastructure_name || '✓') : '';
    const others   = myEval.infrastructure_type === 'others'   ? (myEval.infrastructure_name || myEval.infrastructure_others || '✓') : '';

    // Filler rows to pad table to at least 10 rows (1 coordinator row + fillers)
    const fillerRows = Array.from({length: 9}).map(() => `
      <tr style="height:22px;">
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Coordinator Evaluation — ${event.title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#000;background:#fff;}
    .page{padding:60px 72px;}
    .header{display:flex;align-items:center;gap:16px;margin-bottom:36px;padding-bottom:16px;border-bottom:2px solid #000;}
    .header img{width:72px;height:72px;object-fit:contain;flex-shrink:0;}
    .header-title{font-size:10pt;font-weight:bold;line-height:1.5;text-align:center;flex:1;}
    .report-title{text-align:center;font-weight:bold;font-size:11pt;margin-bottom:16px;}
    .meta-table{margin-bottom:14px;font-size:10pt;}
    .meta-table td{padding:2px 0;}
    .meta-underline{border-bottom:1px solid #000;display:inline-block;min-width:200px;padding-bottom:1px;}
    table.main{width:100%;border-collapse:collapse;font-size:9pt;}
    table.main th,table.main td{border:1px solid #000;}
    .prepared{margin-top:32px;font-size:10pt;}
    .prepared p{margin-bottom:4px;}
    .no-print{position:fixed;bottom:20px;right:20px;}
    @media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="${logoSrc}" alt="PathSafe"/>
    <div class="header-title">
      PATHSAFE: WEB-BASED DISASTER RISK REDUCTION AND MANAGEMENT<br/>
      SYSTEM WITH PATHFINDING AND ROUTE OPTIMIZATION USING A-STAR<br/>
      SEARCH ALGORITHM
    </div>
  </div>

  <p class="report-title">NATIONAL SIMULTANEOUS EARTHQUAKE DRILL PARTICIPATION DATA</p>

  <table class="meta-table">
    <tr><td style="padding-right:8px;">Region:</td><td><span class="meta-underline">${myEval.region || '&nbsp;'}</span></td></tr>
    <tr><td style="padding-right:8px;">Quarter:</td><td><span class="meta-underline">${myEval.quarter || '&nbsp;'}</span></td></tr>
  </table>

  <table class="main">
    <thead>
      <tr>
        <th rowspan="2" style="padding:5px;text-align:left;vertical-align:middle;width:34%;">Agency/Office/Organization:</th>
        <th colspan="2" style="padding:5px;text-align:center;">No. Participants</th>
        <th colspan="3" style="padding:5px;text-align:center;">Critical Infrastructure Covered<br/><span style="font-weight:normal;font-style:italic;font-size:8pt;">(Indicate name of establishment)</span></th>
      </tr>
      <tr>
        <th style="padding:4px;text-align:center;">Male</th>
        <th style="padding:4px;text-align:center;">Female</th>
        <th style="padding:4px;text-align:center;">Schools</th>
        <th style="padding:4px;text-align:center;">Hospitals</th>
        <th style="padding:4px;text-align:center;">Others (Pls. specify)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${myEval.classroom_office}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-size:9pt;">${myEval.male_count}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-size:9pt;">${myEval.female_count}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${school}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${hospital}</td>
        <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${others}</td>
      </tr>
      ${fillerRows}
      <tr style="font-weight:bold;">
        <td style="padding:5px;text-align:center;">TOTAL</td>
        <td style="padding:5px;text-align:center;">${myEval.male_count}</td>
        <td style="padding:5px;text-align:center;">${myEval.female_count}</td>
        <td colspan="3"></td>
      </tr>
      <tr style="font-weight:bold;">
        <td style="padding:5px;text-align:center;">GRAND TOTAL</td>
        <td style="padding:5px;text-align:center;" colspan="2">${myEval.male_count + myEval.female_count}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  <div class="prepared">
    <p style="margin-bottom:20px;">Prepared by:</p>
    <p style="font-weight:bold;">${prepName}</p>
    <p>${prepRole}</p>
  </div>
</div>

<div class="no-print">
  <button onclick="window.print()" style="padding:10px 22px;background:#166534;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Print / Save as PDF</button>
</div>

<script>
  window.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){window.focus();window.print();},500);
  });
</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const memberEvalList = evaluations.filter(ev => !myEval || ev.submitted_by !== myEval.submitted_by);
  const stats = {
    totalMale:   memberEvalList.reduce((s, e) => s + e.male_count, 0),
    totalFemale: memberEvalList.reduce((s, e) => s + e.female_count, 0),
    get total()  { return this.totalMale + this.totalFemale; },
  };

  // ── Aggregate member report — NSEDPD format ──────────────────────────────
  const handleDownloadMemberReport = async () => {
    let profile = userProfile;
    if (!profile) {
      try { profile = await profileAPI.getMe(); setUserProfile(profile); } catch {}
    }
    const { prepName, prepRole } = getPreparedByFromProfile(profile);

    const totalMale   = memberEvalList.reduce((s, e) => s + e.male_count, 0);
    const totalFemale = memberEvalList.reduce((s, e) => s + e.female_count, 0);
    const rows = memberEvalList.map(ev => {
      const school   = ev.infrastructure_type === 'school'   ? (ev.infrastructure_name || '✓') : '';
      const hospital = ev.infrastructure_type === 'hospital' ? (ev.infrastructure_name || '✓') : '';
      const others   = ev.infrastructure_type === 'others'   ? (ev.infrastructure_name || ev.infrastructure_others || '✓') : '';
      return `
        <tr>
          <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${ev.classroom_office}</td>
          <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-size:9pt;">${ev.male_count}</td>
          <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-size:9pt;">${ev.female_count}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${school}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${hospital}</td>
          <td style="border:1px solid #000;padding:4px 6px;font-size:9pt;">${others}</td>
        </tr>`;
    }).join('');

    const fillerCount = Math.max(0, 10 - memberEvalList.length);
    const fillerRows = Array.from({length: fillerCount}).map(() => `
      <tr style="height:22px;">
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
        <td style="border:1px solid #000;"></td>
      </tr>`).join('');

    const logoSrc = `${window.location.origin}/Pathsafe2.png`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>NSEDPD — PathSafe</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#000;background:#fff;}
    .page{padding:60px 72px;}
    .header{display:flex;align-items:center;gap:16px;margin-bottom:36px;padding-bottom:16px;border-bottom:2px solid #000;}
    .header img{width:72px;height:72px;object-fit:contain;flex-shrink:0;}
    .header-title{font-size:10pt;font-weight:bold;line-height:1.5;text-align:center;flex:1;}
    .report-title{text-align:center;font-weight:bold;font-size:11pt;margin-bottom:16px;}
    .meta-table{margin-bottom:14px;font-size:10pt;}
    .meta-table td{padding:2px 0;}
    .meta-underline{border-bottom:1px solid #000;display:inline-block;min-width:200px;padding-bottom:1px;}
    table.main{width:100%;border-collapse:collapse;font-size:9pt;}
    table.main th,table.main td{border:1px solid #000;}
    .prepared{margin-top:32px;font-size:10pt;}
    .prepared p{margin-bottom:4px;}
    .no-print{position:fixed;bottom:20px;right:20px;}
    @media print{.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="${logoSrc}" alt="PathSafe" />
    <div class="header-title">
      PATHSAFE: WEB-BASED DISASTER RISK REDUCTION AND MANAGEMENT<br/>
      SYSTEM WITH PATHFINDING AND ROUTE OPTIMIZATION USING A-STAR<br/>
      SEARCH ALGORITHM
    </div>
  </div>

  <p class="report-title">NATIONAL SIMULTANEOUS EARTHQUAKE DRILL PARTICIPATION DATA</p>

  <table class="meta-table">
    <tr><td style="padding-right:8px;">Region:</td><td><span id="rv" class="meta-underline">&nbsp;</span></td></tr>
    <tr><td style="padding-right:8px;">Quarter:</td><td><span id="qv" class="meta-underline">&nbsp;</span></td></tr>
  </table>

  <table class="main">
    <thead>
      <tr>
        <th rowspan="3" style="padding:5px;text-align:left;vertical-align:middle;width:34%;">Agency/Office/Organization:</th>
        <th colspan="2" style="padding:5px;text-align:center;">No. Participants</th>
        <th colspan="3" style="padding:5px;text-align:center;">Critical Infrastructure Covered<br/><span style="font-weight:normal;font-style:italic;font-size:8pt;">(Indicate name of establishment)</span></th>
      </tr>
      <tr>
        <th style="padding:4px;text-align:center;">Male</th>
        <th style="padding:4px;text-align:center;">Female</th>
        <th style="padding:4px;text-align:center;">Schools</th>
        <th style="padding:4px;text-align:center;">Hospitals</th>
        <th style="padding:4px;text-align:center;">Others (Pls. specify)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${fillerRows}
      <tr style="font-weight:bold;">
        <td style="padding:5px;text-align:center;">TOTAL</td>
        <td style="padding:5px;text-align:center;">${totalMale}</td>
        <td style="padding:5px;text-align:center;">${totalFemale}</td>
        <td colspan="3"></td>
      </tr>
      <tr style="font-weight:bold;">
        <td style="padding:5px;text-align:center;">GRAND TOTAL</td>
        <td style="padding:5px;text-align:center;" colspan="2">${totalMale + totalFemale}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  <div class="prepared">
    <p style="margin-bottom:20px;">Prepared by:</p>
    <p style="font-weight:bold;">${prepName}</p>
    <p>${prepRole}</p>
  </div>
</div>

<div class="no-print">
  <button onclick="window.print()" style="padding:10px 22px;background:#166534;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Print / Save as PDF</button>
</div>

</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const myEvalImages = getImages(myEval);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white" style={T.pageTitle}>Evacuation Evaluations</h2>
            <p className="text-green-100 mt-0.5" style={T.body}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-green-800 rounded-lg p-2 transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Stats bar */}
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Event Date</p><p className="font-semibold">{new Date(event.start_time).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-gray-500">Submissions</p><p className="font-semibold">{memberEvalList.length}</p></div>
            <div><p className="text-xs text-gray-500">Total Participants</p><p className="font-bold text-purple-700">{stats.total}</p></div>
            <div><p className="text-xs text-gray-500">Total Males</p><p className="font-bold text-blue-600">{stats.totalMale}</p></div>
            <div><p className="text-xs text-gray-500">Total Females</p><p className="font-bold text-pink-600">{stats.totalFemale}</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {[
            { key: 'view',   icon: <FileText className="w-4 h-4" />,   label: 'Member Evaluations', badge: evaluations.length },
            { key: 'submit', icon: <PlusCircle className="w-4 h-4" />, label: 'My Evaluation',      badge: null },
          ].map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key as any); setSubmitSuccess(false); }}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 ${activeTab === t.key ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
              {t.icon}{t.label}
              {t.badge !== null && t.badge > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{t.badge}</span>}
              {t.key === 'submit' && myEval && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Submitted</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── MEMBER EVALUATIONS TAB ──────────────────────────────────── */}
          {activeTab === 'view' && (
            <div className="flex h-full overflow-hidden">
              {/* List */}
              <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <FileText className="w-4 h-4" />Submissions ({evaluations.length})
                </h3>
                {loading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
                ) : fetchError ? (
                  <div className="text-center py-8 text-red-600 text-sm"><AlertCircle className="w-8 h-8 mx-auto mb-2" />{fetchError}</div>
                ) : evaluations.length === 0 ? (
                  <div className="text-center py-12"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p style={{...T.body, color: C.inkMuted}}>No evaluations yet</p></div>
                ) : (
                  <div className="space-y-2">
                    {evaluations.map(ev => {
                      const imgCount = getImages(ev).length;
                      return (
                        <button key={ev.id} onClick={() => setSelectedEval(ev)}
                          className={`w-full text-left p-3 rounded-lg border transition ${selectedEval?.id === ev.id ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <div className="font-medium text-gray-900 text-sm">{ev.instructor_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{ev.program_class} · {ev.classroom_office}</div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />{ev.male_count + ev.female_count} pax</span>
                            <span className="text-xs text-blue-500">{ev.male_count}M / {ev.female_count}F</span>
                          </div>
                          {imgCount > 0 && <div className="flex items-center gap-1 mt-1 text-xs text-purple-600"><Images className="w-3 h-3" />{imgCount} photo{imgCount !== 1 ? 's' : ''}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detail */}
              <div className="flex-1 overflow-y-auto">
                {selectedEval ? (
                  <div className="p-6 space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
                      <h3 style={T.cardTitle}>Evaluation Details</h3>
                      {[
                        { icon: <User className="w-4 h-4 text-green-600" />,         label: 'Instructor / Representative', val: selectedEval.instructor_name },
                        { icon: <GraduationCap className="w-4 h-4 text-green-600" />, label: 'Program / Class',             val: selectedEval.program_class   },
                        { icon: <MapPin className="w-4 h-4 text-green-600" />,        label: 'Classroom / Office',          val: selectedEval.classroom_office },
                      ].map(f => (
                        <div key={f.label}>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">{f.icon}{f.label}</div>
                          <p className="text-sm text-gray-900">{f.val}</p>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-3">
                        {[['Male', selectedEval.male_count, 'text-blue-600'], ['Female', selectedEval.female_count, 'text-pink-600'], ['Total', selectedEval.male_count + selectedEval.female_count, 'text-purple-600']].map(([l,v,c]) => (
                          <div key={l as string} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-500 mb-1">{l}</div>
                            <div className={`text-2xl font-bold ${c}`}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1"><MessageSquare className="w-4 h-4 text-purple-600" />Comments</div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                          {selectedEval.comments ? <p className="whitespace-pre-wrap">{selectedEval.comments}</p> : <p className="italic text-gray-400">No comments</p>}
                        </div>
                      </div>
                      <MiniSlideshow images={getImages(selectedEval)} />
                      <p className="text-xs text-gray-400">Submitted: {new Date(selectedEval.submitted_at).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p style={{...T.body, color: C.inkMuted}}>Select an evaluation to view</p></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MY EVALUATION TAB ──────────────────────────────────────── */}
          {activeTab === 'submit' && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-2xl mx-auto p-6">

                {myEvalLoading ? (
                  <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>

                ) : myEval ? (
                  /* ── Already submitted — view only ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-800">Evaluation Submitted</p>
                        <p className="text-xs text-green-600">
                          {new Date(myEval.submitted_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} at {new Date(myEval.submitted_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                        </p>
                      </div>
                    </div>

                    {[
                      { label: 'Name / Representative', val: myEval.instructor_name },
                      { label: 'Program / Class',        val: myEval.program_class   },
                      { label: 'Classroom / Office',     val: myEval.classroom_office },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
                        <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">{f.val}</p>
                      </div>
                    ))}

                    <div className="grid grid-cols-3 gap-3">
                      {[['Male', myEval.male_count, 'text-blue-600'], ['Female', myEval.female_count, 'text-pink-600'], ['Total', myEval.male_count + myEval.female_count, 'text-purple-700']].map(([l,v,c]) => (
                        <div key={l as string} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                          <p className={`text-2xl font-bold ${c}`}>{v}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{l}</p>
                        </div>
                      ))}
                    </div>

                    {myEval.comments && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Comments & Observations</p>
                        <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm whitespace-pre-wrap">{myEval.comments}</p>
                      </div>
                    )}

                    {(myEval.region || myEval.quarter) && (
                      <div className="grid grid-cols-2 gap-3">
                        {myEval.region && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Region</p>
                            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{myEval.region}</p>
                          </div>
                        )}
                        {myEval.quarter && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Quarter</p>
                            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{myEval.quarter}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {myEval.infrastructure_type && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Critical Infrastructure Covered</p>
                        <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-0.5">
                          <p className="capitalize font-medium">{myEval.infrastructure_type === 'others' ? `Others — ${myEval.infrastructure_others || ''}` : myEval.infrastructure_type}</p>
                          {myEval.infrastructure_name && <p className="text-gray-600">{myEval.infrastructure_name}</p>}
                        </div>
                      </div>
                    )}

                    {myEvalImages.length > 0 && <MiniSlideshow images={myEvalImages} />}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                      ⚠ Evaluations cannot be resubmitted once filed.
                    </div>

                    <button onClick={handlePrintMyEval}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-medium">
                      <Printer className="w-4 h-4" /> Print / Save PDF
                    </button>
                  </div>

                ) : submitSuccess ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                    <h3 style={T.pageTitle}>Evaluation Submitted!</h3>
                    <p style={{...T.body, color: C.inkMuted}}>Your evaluation for <strong>{event.title}</strong> has been recorded.</p>
                    <button onClick={() => { setSubmitSuccess(false); setActiveTab('view'); }}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm">
                      View Member Evaluations
                    </button>
                  </div>

                ) : (
                  /* ── Form ── */
                  <>
                    <div className="mb-5">
                      <h3 style={T.pageTitle}>Submit Your Evaluation</h3>
                      <p className="mt-1" style={{...T.body, color: C.inkMuted}}>Record your headcount and observations for <strong>{event.title}</strong>.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {submitError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{submitError}</div>}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Region</label>
                          <input type="text" value={form.region}
                            onChange={e => setForm(p => ({...p, region: e.target.value}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            placeholder="e.g. Region IV-A" />
                        </div>
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Quarter</label>
                          <select value={form.quarter}
                            onChange={e => setForm(p => ({...p, quarter: e.target.value}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white">
                            <option value="">Select quarter...</option>
                            <option value="1st Quarter">1st Quarter</option>
                            <option value="2nd Quarter">2nd Quarter</option>
                            <option value="3rd Quarter">3rd Quarter</option>
                            <option value="4th Quarter">4th Quarter</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1" style={T.bodyMedium}>Your Name / Representative *</label>
                        <input type="text" required value={form.instructor_name} onChange={e => setForm(p => ({...p, instructor_name: e.target.value}))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" placeholder="e.g. Dr. Juan Dela Cruz" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Program / Class</label>
                          <input type="text" value={form.program_class} onChange={e => setForm(p => ({...p, program_class: e.target.value}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" placeholder="e.g. BSIT-2A" />
                        </div>
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Classroom / Office *</label>
                          <input type="text" required value={form.classroom_office} onChange={e => setForm(p => ({...p, classroom_office: e.target.value}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" placeholder="e.g. Room 301" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Male Count *</label>
                          <input type="number" min={0} required value={form.male_count} onChange={e => setForm(p => ({...p, male_count: parseInt(e.target.value)||0}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" />
                        </div>
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Female Count *</label>
                          <input type="number" min={0} required value={form.female_count} onChange={e => setForm(p => ({...p, female_count: parseInt(e.target.value)||0}))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" />
                        </div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                        <span style={T.body}>Total Participants</span>
                        <span className="text-purple-700 font-bold text-lg">{form.male_count + form.female_count}</span>
                      </div>
                      <div>
                        <label className="block mb-1" style={T.bodyMedium}>Critical Infrastructure Covered <span className="text-gray-400 font-normal">(Optional)</span></label>
                        <div className="flex gap-4 mb-2">
                          {(['school','hospital','others'] as const).map(type => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input type="radio" name="infra_type"
                                checked={form.infrastructure_type === type}
                                onChange={() => setForm(p => ({ ...p, infrastructure_type: type, infrastructure_name: '', infrastructure_others: '' }))}
                                className="accent-green-600" />
                              {type === 'school' ? 'School' : type === 'hospital' ? 'Hospital' : 'Others (Pls. specify)'}
                            </label>
                          ))}
                          {form.infrastructure_type && (
                            <button type="button" onClick={() => setForm(p => ({ ...p, infrastructure_type: '', infrastructure_name: '', infrastructure_others: '' }))}
                              className="text-xs text-gray-400 hover:text-red-500 underline">Clear</button>
                          )}
                        </div>
                        {form.infrastructure_type && (
                          <div className="space-y-2">
                            <input type="text" value={form.infrastructure_name}
                              onChange={e => setForm(p => ({ ...p, infrastructure_name: e.target.value }))}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder={`Name of ${form.infrastructure_type === 'school' ? 'school' : form.infrastructure_type === 'hospital' ? 'hospital' : 'establishment'}...`} />
                            {form.infrastructure_type === 'others' && (
                              <input type="text" value={form.infrastructure_others}
                                onChange={e => setForm(p => ({ ...p, infrastructure_others: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Please specify the type of establishment..." />
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block mb-1" style={T.bodyMedium}>Comments & Observations</label>
                        <textarea rows={3} value={form.comments} onChange={e => setForm(p => ({...p, comments: e.target.value}))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                          placeholder="Notable observations, issues, or suggestions..." />
                      </div>
                      <div>
                        <label className="block mb-2" style={T.bodyMedium}>Photo Evidence <span className="text-gray-400 font-normal">(Optional, up to 5)</span></label>
                        <MultiImageUploader images={images} onChange={setImages} max={5} />
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => setActiveTab('view')}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
                        <button type="submit" disabled={submitting}
                          className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                          {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting…</> : 'Submit Evaluation'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          <p style={{...T.body, color: C.inkMuted}}>{memberEvalList.length} member submission{memberEvalList.length !== 1 ? 's' : ''} · {stats.total} total ({stats.totalMale}M / {stats.totalFemale}F)</p>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadMemberReport} disabled={evaluations.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-medium">
              <Download className="w-4 h-4" />Member Report
            </button>
            <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}