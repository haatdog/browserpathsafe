// ExecutiveEvaluationModal.tsx
import { useState, useEffect } from 'react';
import { T, C } from '../design/DesignTokens';
import {
  X, Users, MapPin, MessageSquare, GraduationCap, User,
  Download, FileText, PlusCircle, CheckCircle, AlertCircle,
  Upload, ChevronLeft, ChevronRight, Images
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Event {
  id: number;
  title: string;
  event_type: string;
  start_time: string;
}

interface Evaluation {
  id: number;
  event_id: number;
  instructor_name: string;
  program_class: string;
  classroom_office: string;
  male_count: number;
  female_count: number;
  comments: string;
  submitted_by: string;
  submitted_by_email: string;
  submitted_at: string;
  image_url?: string;
  image_urls?: string[];
}

interface ExecutiveEvaluationModalProps {
  event: Event;
  onClose: () => void;
}

const EMPTY_FORM = {
  instructor_name: '',
  program_class: '',
  classroom_office: '',
  male_count: 0,
  female_count: 0,
  comments: '',
};

// ── Multi-image uploader ─────────────────────────────────────────────────────
function MultiImageUploader({ images, onChange, max = 5, accentColor = 'purple' }: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  accentColor?: 'blue' | 'purple';
}) {
  const [dragOver, setDragOver] = useState(false);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    const toProcess = Array.from(files)
      .filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
      .slice(0, max - images.length);
    if (!toProcess.length) return;
    Promise.all(toProcess.map(compressImage))
      .then(compressed => onChange([...images, ...compressed]))
      .catch(err => console.error('Image compression failed:', err));
  };

  const dropBg = dragOver
    ? 'border-purple-500 bg-purple-50'
    : accentColor === 'purple'
    ? 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
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
              {idx === 0 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-sm" style={T.bodyMedium}>Cover</span>}
            </div>
          ))}
        </div>
      )}
      {images.length < max && (
        <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition ${dropBg}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}>
          <div className="flex flex-col items-center gap-1 text-gray-500 pointer-events-none">
            <Upload className="w-5 h-5" />
            <span style={T.body}>{images.length === 0 ? 'Upload photos' : 'Add more'}</span>
            <span style={T.meta}>{images.length}/{max} • up to 5MB each</span>
          </div>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => { processFiles(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {images.length >= max && <p className="text-center" style={T.meta}>Maximum {max} photos reached</p>}
    </div>
  );
}

// ── Mini slideshow ───────────────────────────────────────────────────────────
function MiniSlideshow({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5" style={T.bodyMedium}>
          <Images className="w-4 h-4 text-purple-500" />Photo Evidence
        </p>
        {images.length > 1 && <span style={T.meta}>{current + 1}/{images.length}</span>}
      </div>
      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: '16/9' }}>
        <img src={images[current]} alt="" className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent(c => (c - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrent(c => (c + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {images.map((src, idx) => (
            <button key={idx} onClick={() => setCurrent(idx)}
              className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${idx === current ? 'border-purple-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-75'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getEvalImages(ev: Evaluation): string[] {
  if (Array.isArray(ev.image_urls) && ev.image_urls.length > 0) return ev.image_urls;
  if (ev.image_url) return [ev.image_url];
  return [];
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function ExecutiveEvaluationModal({ event, onClose }: ExecutiveEvaluationModalProps) {
  const [evaluations,        setEvaluations]        = useState<Evaluation[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [fetchError,         setFetchError]         = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [activeTab,          setActiveTab]          = useState<'view' | 'submit'>('view');
  const [form,               setForm]               = useState(EMPTY_FORM);
  const [images,             setImages]             = useState<string[]>([]);
  const [submitting,         setSubmitting]         = useState(false);
  const [submitError,        setSubmitError]        = useState('');
  const [submitSuccess,      setSubmitSuccess]      = useState(false);

  useEffect(() => { loadEvaluations(); }, [event.id]);

  const loadEvaluations = async () => {
    setLoading(true); setFetchError('');
    try {
      const res = await fetch(`http://localhost:5000/api/evaluations/event/${event.id}`, { credentials: 'include' });
      if (!res.ok) { const d = await res.json(); setFetchError(d.error || 'Failed to load'); return; }
      const data = await res.json();
      setEvaluations(Array.isArray(data.evaluations) ? data.evaluations : []);
    } catch { setFetchError('Network error loading evaluations.'); }
    finally { setLoading(false); }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setSubmitError('');
    if (!form.instructor_name.trim()) { setSubmitError('Instructor name is required.'); setSubmitting(false); return; }
    if (!form.classroom_office.trim()) { setSubmitError('Classroom / Office is required.'); setSubmitting(false); return; }
    if (form.male_count + form.female_count === 0) { setSubmitError('Total participants must be at least 1.'); setSubmitting(false); return; }
    try {
      const res = await fetch('http://localhost:5000/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event_id: event.id, ...form, program_class: form.program_class || 'N/A', image_url: images[0] || '', image_urls: images })
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Failed to submit.'); return; }
      setSubmitSuccess(true); setForm(EMPTY_FORM); setImages([]);
      loadEvaluations();
    } catch { setSubmitError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  // ── Download Report as CSV ────────────────────────────────────────────────
  const handleDownloadReport = () => {
    const eventDate = new Date(event.start_time).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    const rows = evaluations.map((ev, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${ev.instructor_name}</td>
        <td>${ev.program_class || 'N/A'}</td>
        <td>${ev.classroom_office}</td>
        <td style="text-align:center">${ev.male_count}</td>
        <td style="text-align:center">${ev.female_count}</td>
        <td style="text-align:center;font-weight:bold">${ev.male_count + ev.female_count}</td>
        <td>${ev.comments || '—'}</td>
        <td style="font-size:9pt;color:#555">${new Date(ev.submitted_at).toLocaleString()}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Evacuation Evaluation Report</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 36px 44px; }

      /* Header */
      .header { text-align: center; margin-bottom: 6px; }
      .header h1 { font-size: 15pt; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
      .header h2 { font-size: 11pt; font-weight: normal; margin-top: 2px; }
      .divider { border: none; border-top: 2.5px solid #000; margin: 8px 0 4px; }
      .divider-thin { border: none; border-top: 1px solid #000; margin: 4px 0 14px; }

      /* Summary bar */
      .summary { display: flex; gap: 0; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .summary-item { flex: 1; padding: 8px 12px; border-right: 1px solid #ccc; }
      .summary-item:last-child { border-right: none; }
      .summary-item .val { font-size: 18pt; font-weight: bold; line-height: 1; }
      .summary-item .lbl { font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
      .total .val { color: #5b21b6; }
      .male  .val { color: #1d4ed8; }
      .female .val { color: #be185d; }

      /* Table */
      table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
      th { background: #1e1b4b; color: #fff; padding: 7px 8px; text-align: left; font-size: 9pt; font-weight: bold; }
      th.center { text-align: center; }
      td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      tr:nth-child(even) td { background: #f5f3ff; }
      tr:last-child td { border-bottom: 2px solid #1e1b4b; }

      /* Footer */
      .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 8.5pt; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }

      @media print { body { padding: 16px 24px; } }
    </style></head><body>

    <div class="header">
      <h1>Evacuation Drill Evaluation Report</h1>
      <h2>${event.title}</h2>
    </div>
    <hr class="divider"/>
    <hr class="divider-thin"/>

    <div class="summary">
      <div class="summary-item">
        <div class="lbl">Event Date</div>
        <div style="font-size:11pt;font-weight:bold;margin-top:4px">${eventDate}</div>
      </div>
      <div class="summary-item">
        <div class="lbl">Submissions</div>
        <div class="val">${stats.totalSubmissions}</div>
      </div>
      <div class="summary-item total">
        <div class="lbl">Total Participants</div>
        <div class="val">${stats.totalParticipants}</div>
      </div>
      <div class="summary-item male">
        <div class="lbl">Total Male</div>
        <div class="val">${stats.totalMale}</div>
      </div>
      <div class="summary-item female">
        <div class="lbl">Total Female</div>
        <div class="val">${stats.totalFemale}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th>Instructor / Representative</th>
          <th>Program / Class</th>
          <th>Classroom / Office</th>
          <th class="center" style="width:44px">Male</th>
          <th class="center" style="width:50px">Female</th>
          <th class="center" style="width:44px">Total</th>
          <th>Comments</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      <span>PathSafe — Evacuation Evaluation Report</span>
      <span>Generated: ${new Date().toLocaleString()}</span>
    </div>

    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Please allow popups to download the PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  const stats = {
    totalMale:         evaluations.reduce((s, e) => s + e.male_count, 0),
    totalFemale:       evaluations.reduce((s, e) => s + e.female_count, 0),
    get totalParticipants() { return this.totalMale + this.totalFemale; },
    totalSubmissions:  evaluations.length,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white" style={T.pageTitle}>Evacuation Evaluations — Executive View</h2>
            <p className="text-purple-100 mt-1" style={T.body}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-purple-800 rounded-lg p-2 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-4 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div><p className="mb-1" style={T.meta}>Event Date</p><p style={T.cardTitle}>{new Date(event.start_time).toLocaleDateString()}</p></div>
            <div><p className="mb-1" style={T.meta}>Submissions</p><p style={T.cardTitle}>{stats.totalSubmissions}</p></div>
            <div><p className="mb-1" style={T.meta}>Total Participants</p><p className="text-purple-700" style={T.sectionHeader}>{stats.totalParticipants}</p></div>
            <div><p className="mb-1" style={T.meta}>Total Males</p><p className="text-blue-600" style={T.sectionHeader}>{stats.totalMale}</p></div>
            <div><p className="mb-1" style={T.meta}>Total Females</p><p className="text-pink-600" style={T.sectionHeader}>{stats.totalFemale}</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setActiveTab('view')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 ${activeTab === 'view' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
            <FileText className="w-4 h-4" />
            Member Evaluations
            {evaluations.length > 0 && <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full" style={T.meta}>{evaluations.length}</span>}
          </button>
          <button onClick={() => { setActiveTab('submit'); setSubmitSuccess(false); }}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition border-b-2 ${activeTab === 'submit' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
            <PlusCircle className="w-4 h-4" />
            Submit My Evaluation
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* VIEW tab */}
          {activeTab === 'view' && (
            <div className="flex h-full">
              {/* List pane */}
              <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                <div className="p-4">
                  <h3 className="mb-3 flex items-center gap-2" style={T.sectionHeader}>
                    <FileText className="w-4 h-4" />Submitted Evaluations ({evaluations.length})
                  </h3>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                    </div>
                  ) : fetchError ? (
                    <div className="text-center py-8 text-red-600 text-sm flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8" /><p>{fetchError}</p>
                    </div>
                  ) : evaluations.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p style={{...T.body, color: C.inkMuted}}>No evaluations submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {evaluations.map(ev => {
                        const imgCount = getEvalImages(ev).length;
                        return (
                          <button key={ev.id} onClick={() => setSelectedEvaluation(ev)}
                            className={`w-full text-left p-3 rounded-lg border transition ${selectedEvaluation?.id === ev.id ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className="font-medium text-gray-900 text-sm">{ev.instructor_name}</div>
                            <div className="text-xs text-gray-600 mt-1">{ev.program_class} • {ev.classroom_office}</div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-xs text-gray-500"><Users className="w-3 h-3" />{ev.male_count + ev.female_count} participants</div>
                              <span className="text-blue-600" style={T.meta}>{ev.male_count}M / {ev.female_count}F</span>
                            </div>
                            {imgCount > 0 && <div className="flex items-center gap-1 mt-1.5 text-xs text-purple-600"><Images className="w-3 h-3" />{imgCount} photo{imgCount !== 1 ? 's' : ''}</div>}
                            <div className="text-xs text-gray-400 mt-1 truncate">by {ev.submitted_by_email}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail pane */}
              <div className="flex-1 overflow-y-auto">
                {selectedEvaluation ? (
                  <div className="p-6 space-y-4">
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                      <h3 className="mb-4" style={T.cardTitle}>Evaluation Details</h3>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><User className="w-4 h-4 text-purple-600" />Instructor / Representative</div>
                        <div className="text-gray-900 text-sm">{selectedEvaluation.instructor_name}</div>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><GraduationCap className="w-4 h-4 text-purple-600" />Program / Class</div>
                        <div className="text-gray-900 text-sm">{selectedEvaluation.program_class}</div>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><MapPin className="w-4 h-4 text-purple-600" />Classroom / Office</div>
                        <div className="text-gray-900 text-sm">{selectedEvaluation.classroom_office}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center"><div className="text-xs text-gray-600 mb-1">Male</div><div className="text-2xl font-bold text-blue-600">{selectedEvaluation.male_count}</div></div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center"><div className="text-xs text-gray-600 mb-1">Female</div><div className="text-2xl font-bold text-pink-600">{selectedEvaluation.female_count}</div></div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-center"><div className="text-xs text-gray-600 mb-1">Total</div><div className="text-2xl font-bold text-purple-600">{selectedEvaluation.male_count + selectedEvaluation.female_count}</div></div>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><MessageSquare className="w-4 h-4 text-purple-600" />Comments and Suggestions</div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          {selectedEvaluation.comments
                            ? <p className="whitespace-pre-wrap" style={T.body}>{selectedEvaluation.comments}</p>
                            : <p className="italic" style={T.body}>No comments provided</p>}
                        </div>
                      </div>
                      <MiniSlideshow images={getEvalImages(selectedEvaluation)} />
                      <div className="border-t border-purple-200 pt-4 mt-4 text-xs text-gray-500 space-y-1">
                        <p>Submitted by: {selectedEvaluation.submitted_by_email}</p>
                        <p>Submitted on: {new Date(selectedEvaluation.submitted_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p style={{...T.body, color: C.inkMuted}}>Select an evaluation to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBMIT tab */}
          {activeTab === 'submit' && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-2xl mx-auto p-6">
                {submitSuccess ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                    <h3 style={T.pageTitle}>Evaluation Submitted!</h3>
                    <p className="text-center" style={{...T.body, color: C.inkMuted}}>Your evaluation for <strong>{event.title}</strong> has been recorded.</p>
                    <button onClick={() => { setSubmitSuccess(false); setActiveTab('view'); }}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      View All Evaluations
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h3 style={T.pageTitle}>Submit Your Evaluation</h3>
                      <p className="mt-1" style={{...T.body, color: C.inkMuted}}>Record your own headcount and observations for <strong>{event.title}</strong>.</p>
                    </div>
                    <form onSubmit={handleSubmitEvaluation} className="space-y-5">
                      {submitError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />{submitError}
                        </div>
                      )}
                      <div>
                        <label className="block mb-1" style={T.bodyMedium}>Your Name / Representative *</label>
                        <input type="text" required value={form.instructor_name}
                          onChange={e => setForm(p => ({ ...p, instructor_name: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g. Dr. Juan Dela Cruz" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Program / Class</label>
                          <input type="text" value={form.program_class}
                            onChange={e => setForm(p => ({ ...p, program_class: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g. BSIT-2A" />
                        </div>
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Classroom / Office *</label>
                          <input type="text" required value={form.classroom_office}
                            onChange={e => setForm(p => ({ ...p, classroom_office: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g. Room 301" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Male Count *</label>
                          <input type="number" min={0} required value={form.male_count}
                            onChange={e => setForm(p => ({ ...p, male_count: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block mb-1" style={T.bodyMedium}>Female Count *</label>
                          <input type="number" min={0} required value={form.female_count}
                            onChange={e => setForm(p => ({ ...p, female_count: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                        </div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                        <span style={T.body}>Total Participants</span>
                        <span className="text-purple-700" style={T.pageTitle}>{form.male_count + form.female_count}</span>
                      </div>
                      <div>
                        <label className="block mb-1" style={T.bodyMedium}>Comments & Observations</label>
                        <textarea rows={4} value={form.comments}
                          onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          placeholder="Any notable observations, issues, or suggestions..." />
                      </div>
                      <div>
                        <label className="block mb-2" style={T.bodyMedium}>Photo Evidence (Optional, up to 5)</label>
                        <MultiImageUploader images={images} onChange={setImages} max={5} accentColor="purple" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setActiveTab('view')}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                        <button type="submit" disabled={submitting}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
                          {submitting ? 'Submitting...' : 'Submit Evaluation'}
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
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          <div style={{...T.body, color: C.inkMuted}}>
            {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''} •{' '}
            {stats.totalParticipants} total ({stats.totalMale}M / {stats.totalFemale}F)
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              disabled={evaluations.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-medium"
            >
              <Download className="w-4 h-4" />Download Report
            </button>
            <button onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}