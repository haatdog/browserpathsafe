// MemberEvaluationModal.tsx
import { useState, useEffect } from 'react';
import { X, Save, User, Users, MapPin, MessageSquare, GraduationCap, Printer, CheckCircle } from 'lucide-react';
import { T, C } from '../design/DesignTokens';
import { evaluationAPI } from '../lib/api';

interface AppEvent { id: number; title: string; event_type: string; start_time: string; }
interface MemberEvaluationModalProps {
  event: AppEvent; userId: string;
  onClose: () => void; onSubmitted: () => void;
}

interface Submission {
  instructor_name: string; program_class: string; classroom_office: string;
  male_count: number; female_count: number; comments: string; submitted_at: string;
}

interface MemberEvaluationModalProps {
  event: AppEvent; userId: string;
  alreadySubmitted?: boolean;
  onClose: () => void; onSubmitted: () => void;
}

export default function MemberEvaluationModal({ event, userId, alreadySubmitted = false, onClose, onSubmitted }: MemberEvaluationModalProps) {
  // Always start in loading and check backend — never trust client-side state alone
  const [mode,          setMode]          = useState<'loading'|'form'|'view'>('loading');
  const [submission,    setSubmission]    = useState<Submission | null>(null);
  const [formData,      setFormData]      = useState({
    instructor_name: '', program_class: '', classroom_office: '',
    male_count: '', female_count: '', comments: '',
  });
  const [isSubmitting, setIsSubmitting]  = useState(false);
  const [errors,       setErrors]        = useState<Record<string, string>>({});

  // Always check backend on open — if a submission exists go to view, else show form
  useEffect(() => {
    const load = async () => {
      try {
        const data = await evaluationAPI.mine();
        // Match by event_id — use == to handle string/number mismatch
        const mine = Array.isArray(data)
          // eslint-disable-next-line eqeqeq
          ? data.find((e: any) => e.event_id == event.id)
          : null;
        if (mine) {
          setSubmission(mine);
          setMode('view');
          return;
        }
      } catch {}
      setMode('form');
    };
    load();
  }, [event.id]);

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!formData.instructor_name.trim()) e.instructor_name = 'Required';
    if (!formData.classroom_office.trim()) e.classroom_office = 'Required';
    const m = parseInt(formData.male_count), f = parseInt(formData.female_count);
    if (isNaN(m) || m < 0) e.male_count = 'Enter a valid number';
    if (isNaN(f) || f < 0) e.female_count = 'Enter a valid number';
    if (!isNaN(m) && !isNaN(f) && m === 0 && f === 0) {
      e.male_count = 'Total must be at least 1';
      e.female_count = 'Total must be at least 1';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        event_id:         event.id,
        instructor_name:  formData.instructor_name.trim(),
        program_class:    formData.program_class.trim() || 'N/A',
        classroom_office: formData.classroom_office.trim(),
        male_count:       parseInt(formData.male_count),
        female_count:     parseInt(formData.female_count),
        comments:         formData.comments.trim(),
      };
      await evaluationAPI.submit({
        event_id:         payload.event_id,
        instructor_name:  payload.instructor_name,
        program_class:    payload.program_class,
        classroom_office: payload.classroom_office,
        male_count:       payload.male_count,
        female_count:     payload.female_count,
        comments:         payload.comments,
      });
      onSubmitted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!submission) return;
    const date = new Date(event.start_time);
    const submitted = new Date(submission.submitted_at);
    const total = submission.male_count + submission.female_count;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Evacuation Drill Evaluation — ${event.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 32px; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 14pt; text-transform: uppercase; letter-spacing: 1px; }
    .header h2 { font-size: 12pt; font-weight: normal; margin-top: 4px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
    .field-row { display: flex; margin-bottom: 8px; }
    .field-label { font-weight: bold; width: 180px; flex-shrink: 0; }
    .field-value { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; min-height: 18px; }
    .counts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 8px; }
    .count-box { border: 1px solid #ccc; padding: 10px; text-align: center; border-radius: 4px; }
    .count-box .num { font-size: 20pt; font-weight: bold; }
    .count-box .lbl { font-size: 9pt; color: #555; margin-top: 4px; }
    .comments-box { border: 1px solid #ccc; padding: 10px; min-height: 60px; border-radius: 4px; font-size: 10pt; white-space: pre-wrap; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 9pt; color: #777; border-top: 1px solid #ccc; padding-top: 8px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cavite State University — Carmona Campus</h1>
    <h2>Evacuation Drill Evaluation Form</h2>
  </div>

  <div class="section">
    <div class="section-title">Event Information</div>
    <div class="field-row"><span class="field-label">Event Title:</span><span class="field-value">${event.title}</span></div>
    <div class="field-row"><span class="field-label">Drill Type:</span><span class="field-value">${event.event_type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></div>
    <div class="field-row"><span class="field-label">Date Conducted:</span><span class="field-value">${date.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div>
    <div class="field-row"><span class="field-label">Time:</span><span class="field-value">${date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Respondent Information</div>
    <div class="field-row"><span class="field-label">Instructor / Representative:</span><span class="field-value">${submission.instructor_name}</span></div>
    <div class="field-row"><span class="field-label">Program / Class:</span><span class="field-value">${submission.program_class}</span></div>
    <div class="field-row"><span class="field-label">Classroom / Office:</span><span class="field-value">${submission.classroom_office}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Evacuation Headcount</div>
    <div class="counts">
      <div class="count-box"><div class="num">${submission.male_count}</div><div class="lbl">Male</div></div>
      <div class="count-box"><div class="num">${submission.female_count}</div><div class="lbl">Female</div></div>
      <div class="count-box"><div class="num">${total}</div><div class="lbl">Total</div></div>
    </div>
  </div>

  ${submission.comments ? `
  <div class="section">
    <div class="section-title">Comments &amp; Observations</div>
    <div class="comments-box">${submission.comments}</div>
  </div>` : ''}

  <div class="footer">
    <span>PathSafe — DRRM System</span>
    <span>Submitted: ${submitted.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} at ${submitted.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const total = (parseInt(formData.male_count) || 0) + (parseInt(formData.female_count) || 0);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (mode === 'loading') return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading evaluation…</span>
      </div>
    </div>
  );

  // ── View submitted evaluation ─────────────────────────────────────────────
  if (mode === 'view' && submission) return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={T.pageTitle}>Evaluation Submission</h2>
            <p className="mt-0.5" style={{...T.body, color: C.inkMuted}}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Submitted badge */}
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Evaluation Submitted</p>
              <p className="text-xs text-green-600">
                {new Date(submission.submitted_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })} at {new Date(submission.submitted_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
              </p>
            </div>
          </div>

          {/* Fields — read only */}
          {[
            { label: 'Instructor / Representative', value: submission.instructor_name },
            { label: 'Program / Class',             value: submission.program_class   },
            { label: 'Classroom / Office',          value: submission.classroom_office },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs font-medium text-gray-500 mb-1">{f.label}</p>
              <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{f.value}</p>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Male',   value: submission.male_count,                              color: 'text-blue-600'  },
              { label: 'Female', value: submission.female_count,                            color: 'text-pink-600'  },
              { label: 'Total',  value: submission.male_count + submission.female_count,    color: 'text-gray-900'  },
            ].map(c => (
              <div key={c.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {submission.comments && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Comments & Observations</p>
              <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 whitespace-pre-wrap">{submission.comments}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
            ⚠ Evaluations cannot be resubmitted once filed.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition">
            Close
          </button>
          <button onClick={handlePrint}
            className="flex-1 px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );

  // ── Submission form ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={T.pageTitle}>Drill Evaluation</h2>
            <p className="mt-0.5" style={{...T.body, color: C.inkMuted}}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-600">
            <span style={T.bodyMedium}>Date: </span>
            {new Date(event.start_time).toLocaleDateString()} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            <span className="ml-4" style={T.bodyMedium}>Type: </span>{event.event_type.replace(/_/g,' ')}
          </div>

          {[
            { key: 'instructor_name',  label: 'Instructor / Representative *', placeholder: 'Enter your full name',            icon: <User className="w-3.5 h-3.5 text-blue-500" /> },
            { key: 'program_class',    label: 'Program / Class',               placeholder: 'e.g. BSHM-1A, N/A if not applicable', icon: <GraduationCap className="w-3.5 h-3.5 text-blue-500" /> },
            { key: 'classroom_office', label: 'Classroom / Office *',          placeholder: 'e.g. 302, S-102, OSAS, Library', icon: <MapPin className="w-3.5 h-3.5 text-blue-500" /> },
          ].map(f => (
            <div key={f.key}>
              <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>{f.icon} {f.label}</label>
              <input type="text" value={(formData as any)[f.key]}
                onChange={e => setFormData({...formData, [f.key]: e.target.value})}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[f.key] ? 'border-red-400' : 'border-gray-300'}`}
                placeholder={f.placeholder} />
              {errors[f.key] && <p className="text-red-600 mt-1" style={T.meta}>{errors[f.key]}</p>}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'male_count',   label: 'Males *',   iconCls: 'text-blue-500'  },
              { key: 'female_count', label: 'Females *', iconCls: 'text-pink-500'  },
            ].map(f => (
              <div key={f.key}>
                <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
                  <Users className={`w-3.5 h-3.5 ${f.iconCls}`} /> {f.label}
                </label>
                <input type="number" min="0" value={(formData as any)[f.key]}
                  onChange={e => setFormData({...formData, [f.key]: e.target.value})}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[f.key] ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="0" />
                {errors[f.key] && <p className="text-red-600 mt-1" style={T.meta}>{errors[f.key]}</p>}
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <p style={{...T.body, color: C.inkMuted}}>
                <span style={{...T.bodyMedium, color: C.inkPrimary}}>Total: {total}</span>
                {' '}({parseInt(formData.male_count)||0}M · {parseInt(formData.female_count)||0}F)
              </p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> Comments & Suggestions
            </label>
            <textarea value={formData.comments} onChange={e => setFormData({...formData, comments: e.target.value})} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Share observations or feedback about the drill…" />
            <p className="mt-1" style={T.meta}>Optional</p>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50">
          <button type="button" onClick={onClose} disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-sm text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
            {isSubmitting
              ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Submitting…</>
              : <><Save className="w-4 h-4" /> Submit Evaluation</>}
          </button>
        </div>
      </div>
    </div>
  );
}