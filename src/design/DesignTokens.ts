/**
 * DESIGN TOKENS
 * Import this file anywhere and use the constants for consistent styling.
 * These match the CSS variables defined in design-system.css.
 *
 * Usage:
 *   import { T, C } from '../design/DesignTokens';
 *   <h1 style={T.pageTitle}>Hello</h1>
 *   <p  style={T.body}>Content</p>
 */

// ── Typography styles (use as style={} props) ─────────────────────────────

export const T = {
    /** One per page — the main screen title in the header bar */
    pageTitle: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-page-title-size)',    // 22px
      fontWeight: 'var(--text-page-title-weight)',  // 700
      lineHeight: 'var(--text-page-title-lh)',
      color:      'var(--color-ink-primary)',
    },
  
    /** Section heading — groups related content inside a page */
    sectionHeader: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-section-size)',       // 16px
      fontWeight: 'var(--text-section-weight)',     // 600
      lineHeight: 'var(--text-section-lh)',
      color:      'var(--color-ink-primary)',
    },
  
    /** Card / item title — inside cards, list rows, modal headers */
    cardTitle: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-card-title-size)',    // 15px
      fontWeight: 'var(--text-card-title-weight)',  // 600
      lineHeight: 'var(--text-card-title-lh)',
      color:      'var(--color-ink-primary)',
    },
  
    /** Default paragraph and list text */
    body: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-body-size)',          // 14px
      fontWeight: 'var(--text-body-weight)',        // 400
      lineHeight: 'var(--text-body-lh)',
      color:      'var(--color-ink-secondary)',
    },
  
    /** Body text with medium weight — labels, emphasized content */
    bodyMedium: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-body-size)',          // 14px
      fontWeight: 500,
      lineHeight: 'var(--text-body-lh)',
      color:      'var(--color-ink-secondary)',
    },
  
    /** Timestamps, badge labels, small captions */
    meta: {
      fontFamily: 'var(--font-base)',
      fontSize:   'var(--text-meta-size)',          // 12px
      fontWeight: 'var(--text-meta-weight)',        // 400
      lineHeight: 'var(--text-meta-lh)',
      color:      'var(--color-ink-muted)',
    },
  } as const;
  
  // ── Colour shortcuts ──────────────────────────────────────────────────────
  
  export const C = {
    // Text
    inkPrimary:   'var(--color-ink-primary)',    // #111827
    inkSecondary: 'var(--color-ink-secondary)',  // #374151
    inkMuted:     'var(--color-ink-muted)',      // #6b7280
    inkDisabled:  'var(--color-ink-disabled)',   // #9ca3af
  
    // Surface
    surfacePage:  'var(--color-surface-page)',   // #f3f4f6
    surfaceCard:  'var(--color-surface-card)',   // #ffffff
    surfaceInput: 'var(--color-surface-input)',  // #f9fafb
  
    // Border
    border:       'var(--color-border)',         // #e5e7eb
  
    // Brand
    brand:        'var(--color-brand)',          // #1d4ed8
    brandHover:   'var(--color-brand-hover)',    // #1e40af
    brandLight:   'var(--color-brand-light)',    // #eff6ff
  
    // Semantic
    danger:       'var(--color-danger)',
    dangerLight:  'var(--color-danger-light)',
    warning:      'var(--color-warning)',
    warningLight: 'var(--color-warning-light)',
    success:      'var(--color-success)',
    successLight: 'var(--color-success-light)',
  } as const;
  
  // ── Shadow shortcuts ──────────────────────────────────────────────────────
  
  export const S = {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  } as const;
  
  // ── Border radius shortcuts ───────────────────────────────────────────────
  
  export const R = {
    sm: 'var(--radius-sm)',   // 6px  badges
    md: 'var(--radius-md)',   // 10px buttons, inputs
    lg: 'var(--radius-lg)',   // 14px cards
    xl: 'var(--radius-xl)',   // 18px modals
  } as const;