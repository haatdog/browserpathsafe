// MemberEvaluationModal.tsx
import { useState } from 'react';
import { X, Save, User, Users, MapPin, MessageSquare, GraduationCap } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  event_type: string;
  start_time: string;
}

interface MemberEvaluationModalProps {
  event: Event;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function MemberEvaluationModal({ event, userId, onClose, onSubmitted }: MemberEvaluationModalProps) {
  const [formData, setFormData] = useState({
    instructor_name: '',
    program_class: '',
    classroom_office: '',
    male_count: '',
    female_count: '',
    comments: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.instructor_name.trim()) {
      newErrors.instructor_name = 'Instructor/Representative name is required';
    }

    if (!formData.classroom_office.trim()) {
      newErrors.classroom_office = 'Classroom/Office location is required';
    }

    const maleCount = parseInt(formData.male_count);
    const femaleCount = parseInt(formData.female_count);

    if (isNaN(maleCount) || maleCount < 0) {
      newErrors.male_count = 'Please enter a valid number';
    }

    if (isNaN(femaleCount) || femaleCount < 0) {
      newErrors.female_count = 'Please enter a valid number';
    }

    if (maleCount === 0 && femaleCount === 0) {
      newErrors.male_count = 'Total count must be at least 1';
      newErrors.female_count = 'Total count must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        event_id: event.id,
        instructor_name: formData.instructor_name.trim(),
        program_class: formData.program_class.trim() || 'N/A',
        classroom_office: formData.classroom_office.trim(),
        male_count: parseInt(formData.male_count),
        female_count: parseInt(formData.female_count),
        comments: formData.comments.trim()
      };

      console.log('Submitting evaluation:', payload);

      // ✅ REAL API CALL
      const response = await fetch('http://localhost:5000/api/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit evaluation');
      }

      const result = await response.json();
      console.log('✅ Evaluation submitted:', result);

      alert('Evaluation submitted successfully!');
      onSubmitted();
    } catch (error) {
      console.error('❌ Error submitting evaluation:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit evaluation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCount = (parseInt(formData.male_count) || 0) + (parseInt(formData.female_count) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Evacuation Drill Evaluation</h2>
            <p className="text-blue-100 text-sm mt-1">{event.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Event Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Event Date:</strong> {new Date(event.start_time).toLocaleDateString()} at {new Date(event.start_time).toLocaleTimeString()}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <strong>Type:</strong> {event.event_type}
            </p>
          </div>

          {/* 1. Instructor/Representative Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-blue-600" />
              Name of Instructor/Representative *
            </label>
            <input
              type="text"
              value={formData.instructor_name}
              onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.instructor_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your full name"
            />
            {errors.instructor_name && (
              <p className="text-red-600 text-sm mt-1">{errors.instructor_name}</p>
            )}
          </div>

          {/* 2. Program/Class */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              Program / Class Handled
            </label>
            <input
              type="text"
              value={formData.program_class}
              onChange={(e) => setFormData({ ...formData, program_class: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., BSHM-1A, N/A if not applicable"
            />
            <p className="text-xs text-gray-500 mt-1">Leave as "N/A" if not applicable</p>
          </div>

          {/* 3. Classroom/Office */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Classroom Number / Office *
            </label>
            <input
              type="text"
              value={formData.classroom_office}
              onChange={(e) => setFormData({ ...formData, classroom_office: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.classroom_office ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., 302, S-102, Kitchen 1, OSAS, Library"
            />
            {errors.classroom_office && (
              <p className="text-red-600 text-sm mt-1">{errors.classroom_office}</p>
            )}
          </div>

          {/* 4 & 5. Participant Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                Number of Males *
              </label>
              <input
                type="number"
                min="0"
                value={formData.male_count}
                onChange={(e) => setFormData({ ...formData, male_count: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.male_count ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
              />
              {errors.male_count && (
                <p className="text-red-600 text-sm mt-1">{errors.male_count}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 text-pink-600" />
                Number of Females *
              </label>
              <input
                type="number"
                min="0"
                value={formData.female_count}
                onChange={(e) => setFormData({ ...formData, female_count: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.female_count ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
              />
              {errors.female_count && (
                <p className="text-red-600 text-sm mt-1">{errors.female_count}</p>
              )}
            </div>
          </div>

          {/* Total Count Display */}
          {totalCount > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Total Participants:</strong> {totalCount} ({parseInt(formData.male_count) || 0} male, {parseInt(formData.female_count) || 0} female)
              </p>
            </div>
          )}

          {/* 6. Comments and Suggestions */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Comments and Suggestions
            </label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Share your observations, suggestions, or any issues encountered during the drill..."
            />
            <p className="text-xs text-gray-500 mt-1">Optional: Provide feedback to improve future drills</p>
          </div>

          {/* Required Fields Note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Fields marked with * are required
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Submit Evaluation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}