// SafetyMarkers.ts
// ─────────────────────────────────────────────────────────────────────────────
// All safety marker definitions in one place.
// To replace a placeholder SVG with a real downloaded icon:
//   1. Open your SVG file in a text editor
//   2. Copy everything INSIDE the <svg> tag (not the tag itself)
//   3. Paste it as the `svg` field below
//   4. Adjust `viewBox` if needed (usually "0 0 24 24" or "0 0 48 48")
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyMarkerDef {
    type: string;       // matches ObjectType
    label: string;      // display name in toolbar + canvas
    color: string;      // background color of the marker box
    borderColor: string;
    textColor: string;
    viewBox: string;
    svg: string;        // inner SVG content — replace with real icon
  }
  
  export const SAFETY_MARKERS: SafetyMarkerDef[] = [
    {
      type: 'marker_fire_extinguisher',
      label: 'Fire Extinguisher',
      color: '#fee2e2',
      borderColor: '#dc2626',
      textColor: '#dc2626',
      viewBox: '0 0 24 24',
      // Placeholder: simple cylinder shape — replace with real ISO 7010 F001
      svg: `<rect x="9" y="8" width="6" height="12" rx="3" fill="#dc2626"/>
            <rect x="10" y="4" width="4" height="4" rx="1" fill="#dc2626"/>
            <line x1="14" y1="5" x2="18" y2="3" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M18 3 Q21 3 21 6" stroke="#dc2626" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    },
    {
      type: 'marker_fire_exit',
      label: 'Fire Exit',
      color: '#dcfce7',
      borderColor: '#16a34a',
      textColor: '#15803d',
      viewBox: '0 0 24 24',
      // Placeholder: person running through door — replace with ISO 7010 E001
      svg: `<rect x="2" y="2" width="20" height="20" rx="2" fill="#16a34a"/>
            <circle cx="15" cy="7" r="1.5" fill="white"/>
            <path d="M15 9 L13 14 L10 17" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M13 14 L16 17" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M13 11 L10 12" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <rect x="6" y="4" width="2" height="16" rx="0.5" fill="white"/>
            <path d="M8 12 L11 10" stroke="white" stroke-width="1" fill="none" stroke-linecap="round"/>`,
    },
    {
      type: 'marker_assembly_point',
      label: 'Assembly Point',
      color: '#dbeafe',
      borderColor: '#2563eb',
      textColor: '#1d4ed8',
      viewBox: '0 0 24 24',
      // Placeholder: group of people with arrow — replace with ISO 7010 E007
      svg: `<rect x="2" y="2" width="20" height="20" rx="2" fill="#2563eb"/>
            <circle cx="8"  cy="8"  r="1.5" fill="white"/>
            <circle cx="12" cy="8"  r="1.5" fill="white"/>
            <circle cx="16" cy="8"  r="1.5" fill="white"/>
            <path d="M6 11 Q8 10 8 13 L8 17" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M10 11 Q12 10 12 13 L12 17" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M14 11 Q16 10 16 13 L16 17" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    },
    {
      type: 'marker_first_aid',
      label: 'First Aid',
      color: '#dcfce7',
      borderColor: '#16a34a',
      textColor: '#15803d',
      viewBox: '0 0 24 24',
      // Placeholder: white cross on green — replace with ISO 7010 E003
      svg: `<rect x="2" y="2" width="20" height="20" rx="3" fill="#16a34a"/>
            <rect x="10" y="6" width="4" height="12" rx="1" fill="white"/>
            <rect x="6" y="10" width="12" height="4" rx="1" fill="white"/>`,
    },
    {
      type: 'marker_fire_alarm',
      label: 'Fire Alarm',
      color: '#fee2e2',
      borderColor: '#dc2626',
      textColor: '#dc2626',
      viewBox: '0 0 24 24',
      // Placeholder: bell with flame — replace with ISO 7010 F005
      svg: `<path d="M12 3 C8 3 6 6 6 9 L6 15 L4 17 L20 17 L18 15 L18 9 C18 6 16 3 12 3 Z" fill="#dc2626"/>
            <rect x="10" y="17" width="4" height="2" rx="1" fill="#dc2626"/>
            <circle cx="12" cy="19.5" r="1.5" fill="#dc2626"/>`,
    },
    {
      type: 'marker_emergency_phone',
      label: 'Emergency Phone',
      color: '#dbeafe',
      borderColor: '#2563eb',
      textColor: '#1d4ed8',
      viewBox: '0 0 24 24',
      // Placeholder: phone icon — replace with ISO 7010 E004
      svg: `<rect x="2" y="2" width="20" height="20" rx="2" fill="#2563eb"/>
            <path d="M8 6 C7 6 6 7 6 8 L6 9 C6 15 9 18 15 18 L16 18 C17 18 18 17 18 16 L18 14 C18 13.5 17.5 13 17 13 L15 13 C14.5 13 14 13.5 14 14 L14 14.5 C12.5 14 10 11.5 9.5 10 L10 10 C10.5 10 11 9.5 11 9 L11 7 C11 6.5 10.5 6 10 6 Z" fill="white"/>`,
    },
    {
      type: 'marker_no_entry',
      label: 'No Entry',
      color: '#fee2e2',
      borderColor: '#dc2626',
      textColor: '#dc2626',
      viewBox: '0 0 24 24',
      // Placeholder: circle with horizontal bar — ISO 7010 P017
      svg: `<circle cx="12" cy="12" r="10" fill="#dc2626"/>
            <rect x="6" y="10.5" width="12" height="3" rx="1.5" fill="white"/>`,
    },
    {
      type: 'marker_you_are_here',
      label: 'You Are Here',
      color: '#fef9c3',
      borderColor: '#ca8a04',
      textColor: '#92400e',
      viewBox: '0 0 24 24',
      // Placeholder: pin with dot — replace with real "You Are Here" marker
      svg: `<path d="M12 2 C8.5 2 6 4.5 6 8 C6 13 12 22 12 22 C12 22 18 13 18 8 C18 4.5 15.5 2 12 2 Z" fill="#ca8a04"/>
            <circle cx="12" cy="8" r="3" fill="white"/>
            <circle cx="12" cy="8" r="1.5" fill="#ca8a04"/>`,
    },
    {
      type: 'marker_fire_hose',
      label: 'Fire Hose',
      color: '#fee2e2',
      borderColor: '#dc2626',
      textColor: '#dc2626',
      viewBox: '0 0 24 24',
      // Placeholder: coiled hose shape — replace with ISO 7010 F002
      svg: `<rect x="2" y="2" width="20" height="20" rx="2" fill="#dc2626"/>
            <circle cx="12" cy="12" r="7" stroke="white" stroke-width="2.5" fill="none"/>
            <circle cx="12" cy="12" r="3.5" stroke="white" stroke-width="2" fill="none"/>
            <line x1="12" y1="5" x2="12" y2="2" stroke="white" stroke-width="2" stroke-linecap="round"/>`,
    },
    {
      type: 'marker_aed',
      label: 'AED Defibrillator',
      color: '#fef3c7',
      borderColor: '#d97706',
      textColor: '#92400e',
      viewBox: '0 0 24 24',
      // Placeholder: heart with lightning bolt — replace with ISO 7010 E010
      svg: `<rect x="2" y="2" width="20" height="20" rx="3" fill="#d97706"/>
            <path d="M12 18 C12 18 5 13 5 8.5 C5 6.5 6.5 5 8.5 5 C9.8 5 11 5.8 12 7 C13 5.8 14.2 5 15.5 5 C17.5 5 19 6.5 19 8.5 C19 13 12 18 12 18 Z" fill="white"/>
            <path d="M11 9 L10 13 L12.5 11 L12 15 L14 10 L11.5 12 Z" fill="#d97706"/>`,
    },
  ];
  
  // Helper: get marker def by type
  export const getMarkerDef = (type: string): SafetyMarkerDef | undefined =>
    SAFETY_MARKERS.find(m => m.type === type);
  
  // All safety marker ObjectTypes
  export const SAFETY_MARKER_TYPES = SAFETY_MARKERS.map(m => m.type);
  
  // Check if a type is a safety marker
  export const isSafetyMarker = (type: string): boolean =>
    SAFETY_MARKER_TYPES.includes(type);