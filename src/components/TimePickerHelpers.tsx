// ── Shared time picker helpers — paste these into EventManagement.tsx and CreateIncidentModal.tsx ──

// TimeInput — for time-only fields (e.g. incident time)
// value: "14:30" (24h), onChange: same format
export function TimeInput({ value, onChange, placeholder = 'Select time' }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
  }) {
    const parse = (v: string) => {
      if (!v) return { hour: '', minute: '00', ampm: 'AM' };
      const [h, m] = v.split(':');
      const h24 = parseInt(h);
      return { hour: String(h24 % 12 || 12), minute: m || '00', ampm: h24 >= 12 ? 'PM' : 'AM' };
    };
    const { hour, minute, ampm } = parse(value);
  
    const emit = (h: string, m: string, ap: string) => {
      if (!h) { onChange(''); return; }
      let h24 = parseInt(h);
      if (ap === 'PM' && h24 !== 12) h24 += 12;
      if (ap === 'AM' && h24 === 12) h24 = 0;
      onChange(`${String(h24).padStart(2, '0')}:${m}`);
    };
  
    const selectClass = "px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";
  
    return (
      <div className="flex gap-2 items-center">
        <select value={hour} onChange={e => emit(e.target.value, minute, ampm)} className={`w-16 ${selectClass}`}>
          <option value="">--</option>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400 font-bold">:</span>
        <select value={minute} onChange={e => emit(hour, e.target.value, ampm)} className={`w-16 ${selectClass}`}>
          {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ampm} onChange={e => emit(hour, minute, e.target.value)} className={`w-16 ${selectClass}`}>
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
    );
  }
  
  // DateTimeInput — for datetime fields (e.g. event start/end)
  // value: "2026-03-30T14:30", onChange: same format
  export function DateTimeInput({ value, onChange, label, required }: {
    value: string; onChange: (v: string) => void; label: string; required?: boolean;
  }) {
    const datePart = value.split('T')[0] || '';
    const timePart = value.split('T')[1] || '';
  
    const parse = (t: string) => {
      if (!t) return { hour: '12', minute: '00', ampm: 'AM' };
      const [h, m] = t.split(':');
      const h24 = parseInt(h) || 0;
      return { hour: String(h24 % 12 || 12), minute: m || '00', ampm: h24 >= 12 ? 'PM' : 'AM' };
    };
    const { hour, minute, ampm } = parse(timePart);
  
    const combine = (d: string, h: string, m: string, ap: string) => {
      let h24 = parseInt(h) || 12;
      if (ap === 'PM' && h24 !== 12) h24 += 12;
      if (ap === 'AM' && h24 === 12) h24 = 0;
      return `${d}T${String(h24).padStart(2, '0')}:${m}`;
    };
  
    const selectClass = "px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";
  
    return (
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" value={datePart} required={required}
            onChange={e => onChange(combine(e.target.value, hour, minute, ampm))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
          <select value={hour} onChange={e => onChange(combine(datePart, e.target.value, minute, ampm))} className={`w-16 ${selectClass}`}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="text-gray-400 font-bold">:</span>
          <select value={minute} onChange={e => onChange(combine(datePart, hour, e.target.value, ampm))} className={`w-16 ${selectClass}`}>
            {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={ampm} onChange={e => onChange(combine(datePart, hour, minute, e.target.value))} className={`w-16 ${selectClass}`}>
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>
    );
  }