// MemberEvaluationModal.tsx
import { useState } from 'react';
import { X, Save, User, Users, MapPin, MessageSquare, GraduationCap } from 'lucide-react';
import { T, C } from '../design/DesignTokens';

interface Event {
  id: number; title: string; event_type: string; start_time: string;
}
interface MemberEvaluationModalProps {
  event: Event; userId: string; onClose: () => void; onSubmitted: () => void;
}

export default function MemberEvaluationModal({ event, userId, onClose, onSubmitted }: MemberEvaluationModalProps) {
  const [formData, setFormData] = useState({
    instructor_name: '', program_class: '', classroom_office: '',
    male_count: '', female_count: '', comments: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!formData.instructor_name.trim()) e.instructor_name = 'Instructor/Representative name is required';
    if (!formData.classroom_office.trim()) e.classroom_office = 'Classroom/Office location is required';
    const m = parseInt(formData.male_count), f = parseInt(formData.female_count);
    if (isNaN(m) || m < 0) e.male_count = 'Please enter a valid number';
    if (isNaN(f) || f < 0) e.female_count = 'Please enter a valid number';
    if (m === 0 && f === 0) {
      e.male_count = 'Total count must be at least 1';
      e.female_count = 'Total count must be at least 1';
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
        event_id: event.id,
        instructor_name: formData.instructor_name.trim(),
        program_class: formData.program_class.trim() || 'N/A',
        classroom_office: formData.classroom_office.trim(),
        male_count: parseInt(formData.male_count),
        female_count: parseInt(formData.female_count),
        comments: formData.comments.trim(),
      };
      const res = await fetch('http://localhost:5000/api/evaluations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to submit'); }
      alert('Evaluation submitted successfully!');
      onSubmitted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit evaluation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = (parseInt(formData.male_count) || 0) + (parseInt(formData.female_count) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={T.pageTitle}>Drill Evaluation</h2>
            <p className="mt-0.5" style={{...T.body, color: C.inkMuted}}>{event.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Event info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-600">
            <span style={T.bodyMedium}>Date: </span>
            {new Date(event.start_time).toLocaleDateString()} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            <span className="ml-4" style={T.bodyMedium}>Type: </span>{event.event_type}
          </div>

          <div>
            <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
              <User className="w-3.5 h-3.5 text-blue-500" /> Instructor / Representative *
            </label>
            <input type="text" value={formData.instructor_name}
              onChange={e => setFormData({...formData, instructor_name: e.target.value})}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.instructor_name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Enter your full name" />
            {errors.instructor_name && <p className="text-red-600 mt-1" style={T.meta}>{errors.instructor_name}</p>}
          </div>

          <div>
            <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
              <GraduationCap className="w-3.5 h-3.5 text-blue-500" /> Program / Class
            </label>
            <input type="text" value={formData.program_class}
              onChange={e => setFormData({...formData, program_class: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. BSHM-1A, N/A if not applicable" />
            <p className="mt-1" style={T.meta}>Leave as "N/A" if not applicable</p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
              <MapPin className="w-3.5 h-3.5 text-blue-500" /> Classroom / Office *
            </label>
            <input type="text" value={formData.classroom_office}
              onChange={e => setFormData({...formData, classroom_office: e.target.value})}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.classroom_office ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. 302, S-102, OSAS, Library" />
            {errors.classroom_office && <p className="text-red-600 mt-1" style={T.meta}>{errors.classroom_office}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
                <Users className="w-3.5 h-3.5 text-blue-500" /> Males *
              </label>
              <input type="number" min="0" value={formData.male_count}
                onChange={e => setFormData({...formData, male_count: e.target.value})}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.male_count ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="0" />
              {errors.male_count && <p className="text-red-600 mt-1" style={T.meta}>{errors.male_count}</p>}
            </div>
            <div>
              <label className="flex items-center gap-1.5 mb-1.5" style={T.bodyMedium}>
                <Users className="w-3.5 h-3.5 text-pink-500" /> Females *
              </label>
              <input type="number" min="0" value={formData.female_count}
                onChange={e => setFormData({...formData, female_count: e.target.value})}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.female_count ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="0" />
              {errors.female_count && <p className="text-red-600 mt-1" style={T.meta}>{errors.female_count}</p>}
            </div>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <button type="button" onClick={onClose} disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-sm text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting
              ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Submitting…</>
              : <><Save className="w-4 h-4" /> Submit Evaluation</>}
          </button>
        </div>
      </div>
    </div>
  );
}