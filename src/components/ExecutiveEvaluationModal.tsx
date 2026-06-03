// ExecutiveEvaluationModal.tsx
import { useState, useEffect } from 'react';
import { T, C } from '../design/DesignTokens';
import {
  X, Users, MapPin, MessageSquare, GraduationCap, User,
  Download, FileText, PlusCircle, CheckCircle, AlertCircle,
  Upload, ChevronLeft, ChevronRight, Images, Printer
} from 'lucide-react';
import { evaluationAPI } from '../lib/api';

const API = import.meta.env.VITE_PYTHON_API_URL || 'https://browserpathsafe.onrender.com';
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
}

interface ExecutiveEvaluationModalProps { event: AppEvent; onClose: () => void; }

const EMPTY_FORM = {
  instructor_name: '', program_class: '', classroom_office: '',
  male_count: 0, female_count: 0, comments: '',
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

  useEffect(() => { loadAll(); }, [event.id]);

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
        image_urls: images,
      } as any);
      setSubmitSuccess(true); setForm(EMPTY_FORM); setImages([]);
      loadAll();
    } catch (err: any) { setSubmitError(err.message || 'Failed to submit.'); }
    finally { setSubmitting(false); }
  };

  // ── Coordinator's own evaluation PDF ──────────────────────────────────────
  const handlePrintMyEval = () => {
    if (!myEval) return;
    const imgs = getImages(myEval);
    const date = new Date(event.start_time);
    const submitted = new Date(myEval.submitted_at);
    const total = myEval.male_count + myEval.female_count;

    const photosHtml = imgs.length > 0 ? `
      <div class="section">
        <div class="section-title">Photo Evidence</div>
        <div class="photos-grid">
          ${imgs.map((src, i) => `
            <div class="photo-wrap">
              <img src="${src}" alt="Photo ${i + 1}" />
              ${i === 0 ? '<div class="photo-label">Cover Photo</div>' : ''}
            </div>`).join('')}
        </div>
      </div>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Coordinator Evaluation — ${event.title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color:#111; padding:32px; }
    .header { text-align:center; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:20px; }
    .header h1 { font-size:14pt; text-transform:uppercase; letter-spacing:1px; }
    .header h2 { font-size:12pt; font-weight:normal; margin-top:4px; }
    .section { margin-bottom:18px; }
    .section-title { font-size:10pt; text-transform:uppercase; letter-spacing:.5px; color:#555; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:10px; }
    .field-row { display:flex; margin-bottom:8px; }
    .field-label { font-weight:bold; width:180px; flex-shrink:0; }
    .field-value { flex:1; border-bottom:1px solid #999; padding-bottom:2px; min-height:18px; }
    .counts { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-top:8px; }
    .count-box { border:1px solid #ccc; padding:10px; text-align:center; border-radius:4px; }
    .count-box .num { font-size:20pt; font-weight:bold; }
    .count-box .lbl { font-size:9pt; color:#555; margin-top:4px; }
    .comments-box { border:1px solid #ccc; padding:10px; min-height:60px; border-radius:4px; font-size:10pt; white-space:pre-wrap; }
    .photos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:8px; }
    .photo-wrap { position:relative; border:1px solid #ccc; border-radius:4px; overflow:hidden; }
    .photo-wrap img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
    .photo-label { position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,.5); color:#fff; font-size:8pt; text-align:center; padding:2px; }
    .footer { margin-top:40px; display:flex; justify-content:space-between; font-size:9pt; color:#777; border-top:1px solid #ccc; padding-top:8px; }
    @media print { body { padding:16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cavite State University — Carmona Campus</h1>
    <h2>Evacuation Drill — Coordinator Evaluation Report</h2>
  </div>

  <div class="section">
    <div class="section-title">Event Information</div>
    <div class="field-row"><span class="field-label">Event Title:</span><span class="field-value">${event.title}</span></div>
    <div class="field-row"><span class="field-label">Drill Type:</span><span class="field-value">${event.event_type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></div>
    <div class="field-row"><span class="field-label">Date Conducted:</span><span class="field-value">${date.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div>
    <div class="field-row"><span class="field-label">Time:</span><span class="field-value">${date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Coordinator Information</div>
    <div class="field-row"><span class="field-label">Name / Representative:</span><span class="field-value">${myEval.instructor_name}</span></div>
    <div class="field-row"><span class="field-label">Program / Class:</span><span class="field-value">${myEval.program_class}</span></div>
    <div class="field-row"><span class="field-label">Classroom / Office:</span><span class="field-value">${myEval.classroom_office}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Headcount</div>
    <div class="counts">
      <div class="count-box"><div class="num">${myEval.male_count}</div><div class="lbl">Male</div></div>
      <div class="count-box"><div class="num">${myEval.female_count}</div><div class="lbl">Female</div></div>
      <div class="count-box"><div class="num">${total}</div><div class="lbl">Total</div></div>
    </div>
  </div>

  ${myEval.comments ? `
  <div class="section">
    <div class="section-title">Comments &amp; Observations</div>
    <div class="comments-box">${myEval.comments}</div>
  </div>` : ''}

  ${photosHtml}

  <div class="footer">
    <span>PathSafe — DRRM System</span>
    <span>Submitted: ${submitted.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} at ${submitted.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=850,height=950');
    if (w) {
      w.document.write(html);
      w.document.close();
      // Wait for all images (base64) to fully render before printing
      const waitAndPrint = () => {
        const allImgs = Array.from(w.document.images);
        if (allImgs.length === 0) { setTimeout(() => { w.focus(); w.print(); }, 300); return; }
        let loaded = 0;
        const check = () => { loaded++; if (loaded >= allImgs.length) { w.focus(); w.print(); } };
        allImgs.forEach(img => {
          if (img.complete) { check(); }
          else { img.onload = check; img.onerror = check; }
        });
        // Fallback in case onload never fires
        setTimeout(() => { w.focus(); w.print(); }, 2000);
      };
      setTimeout(waitAndPrint, 300);
    }
  };

  // ── Aggregate member report PDF ───────────────────────────────────────────
  const handleDownloadMemberReport = () => {
    const eventDate   = new Date(event.start_time).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    const totalMale   = memberEvalList.reduce((s, e) => s + e.male_count, 0);
    const totalFemale = memberEvalList.reduce((s, e) => s + e.female_count, 0);
    const rows = memberEvalList.map((ev, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${ev.instructor_name}</td>
        <td>${ev.program_class||'N/A'}</td>
        <td>${ev.classroom_office}</td>
        <td style="text-align:center">${ev.male_count}</td>
        <td style="text-align:center">${ev.female_count}</td>
        <td style="text-align:center;font-weight:bold">${ev.male_count+ev.female_count}</td>
        <td>${ev.comments||'—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Member Evaluations — ${event.title}</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:Arial,sans-serif; font-size:10pt; padding:32px 44px; }
      .header { text-align:center; margin-bottom:16px; }
      .header h1 { font-size:14pt; font-weight:bold; text-transform:uppercase; }
      .header h2 { font-size:11pt; font-weight:normal; margin-top:4px; }
      hr { border:none; border-top:2px solid #000; margin:8px 0; }
      .summary { display:flex; border:1px solid #ccc; margin-bottom:16px; }
      .summary div { flex:1; padding:8px 12px; border-right:1px solid #ccc; }
      .summary div:last-child { border-right:none; }
      .summary .val { font-size:18pt; font-weight:bold; }
      .summary .lbl { font-size:8pt; color:#555; text-transform:uppercase; }
      table { width:100%; border-collapse:collapse; font-size:9.5pt; }
      th { background:#1e1b4b; color:#fff; padding:7px 8px; text-align:left; font-size:9pt; }
      td { padding:6px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
      tr:nth-child(even) td { background:#f5f3ff; }
      .footer { margin-top:20px; display:flex; justify-content:space-between; font-size:8.5pt; color:#666; border-top:1px solid #ddd; padding-top:8px; }
    </style></head><body>
    <div class="header"><h1>Evacuation Drill — Member Evaluation Summary</h1><h2>${event.title}</h2></div>
    <hr/><hr style="border-top:1px solid #000;margin-top:2px"/>
    <div class="summary">
      <div><div class="lbl">Date</div><div style="font-size:11pt;font-weight:bold;margin-top:4px">${eventDate}</div></div>
      <div><div class="lbl">Submissions</div><div class="val">${memberEvalList.length}</div></div>
      <div><div class="lbl">Total</div><div class="val" style="color:#5b21b6">${totalMale+totalFemale}</div></div>
      <div><div class="lbl">Male</div><div class="val" style="color:#1d4ed8">${totalMale}</div></div>
      <div><div class="lbl">Female</div><div class="val" style="color:#be185d">${totalFemale}</div></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:28px">#</th><th>Instructor / Representative</th><th>Program / Class</th>
        <th>Classroom / Office</th><th style="width:44px;text-align:center">Male</th>
        <th style="width:50px;text-align:center">Female</th><th style="width:44px;text-align:center">Total</th>
        <th>Comments</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer"><span>PathSafe — DRRM System</span><span>Generated: ${new Date().toLocaleString()}</span></div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=700');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400); }
  };

  const memberEvalList = evaluations.filter(ev => !myEval || ev.submitted_by !== myEval.submitted_by);
  const stats = {
    totalMale:   memberEvalList.reduce((s, e) => s + e.male_count, 0),
    totalFemale: memberEvalList.reduce((s, e) => s + e.female_count, 0),
    get total()  { return this.totalMale + this.totalFemale; },
  };

  const myEvalImages = getImages(myEval);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white" style={T.pageTitle}>Evacuation Evaluations</h2>
            <p className="text-purple-100 mt-0.5" style={T.body}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-purple-800 rounded-lg p-2 transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Stats bar */}
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-3 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Event Date</p><p className="font-semibold">{new Date(event.start_time).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-gray-500">Submissions</p><p className="font-semibold">{memberEvalList.length}</p></div>
            <div><p className="text-xs text-gray-500">Total Participants</p><p className="font-bold text-slate-700">{stats.total}</p></div>
            <div><p className="text-xs text-gray-500">Total Males</p><p className="font-bold text-slate-700">{stats.totalMale}</p></div>
            <div><p className="text-xs text-gray-500">Total Females</p><p className="font-bold text-slate-700">{stats.totalFemale}</p></div>
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
                  <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
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
                          className={`w-full text-left p-3 rounded-lg border transition ${selectedEval?.id === ev.id ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
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
                        { icon: <User className="w-4 h-4 text-purple-600" />,         label: 'Instructor / Representative', val: selectedEval.instructor_name },
                        { icon: <GraduationCap className="w-4 h-4 text-purple-600" />, label: 'Program / Class',             val: selectedEval.program_class   },
                        { icon: <MapPin className="w-4 h-4 text-purple-600" />,        label: 'Classroom / Office',          val: selectedEval.classroom_office },
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