export const BREAKPOINTS = Object.freeze({
  smallMobile: 360,
  largeMobile: 600,
  tabletPortrait: 768,
  tabletLandscape: 1024,
  smallLaptop: 1280,
  desktop: 1440,
  largeDesktop: 1920,
  ultrawide: 2560,
});

export const RESPONSIVE_AUDIT_WIDTHS = Object.freeze([
  320, 360, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920,
]);

export const TYPOGRAPHY_SCALE = Object.freeze({
  display: 'clamp(2.75rem, 5vw, 5.75rem)',
  pageHeading: 'clamp(2.125rem, 3.6vw, 4.25rem)',
  sectionHeading: 'clamp(1.375rem, 1.2vw + 1rem, 2rem)',
  cardHeading: '1rem',
  body: '1rem',
  secondary: '0.9375rem',
  label: '0.875rem',
  button: '0.9375rem',
  input: '1rem',
  helper: '0.8125rem',
  status: '0.875rem',
  table: '0.875rem',
  navigation: '0.875rem',
});

export const SEMANTIC_COLOURS = Object.freeze({
  light: Object.freeze({
    page: '#eaf1f3',
    surface: '#ffffff',
    elevated: '#ffffff',
    textPrimary: '#10252f',
    textSecondary: '#314d59',
    textMuted: '#526b75',
    textDisabled: '#687f88',
    border: '#cddde1',
    borderStrong: '#91aab1',
    link: '#075e7b',
    focus: '#006f86',
  }),
  dark: Object.freeze({
    page: '#061922',
    surface: '#102a35',
    elevated: '#173641',
    textPrimary: '#f5fbfc',
    textSecondary: '#d4e5e8',
    textMuted: '#abc2c9',
    textDisabled: '#8da5ad',
    border: '#365965',
    borderStrong: '#5f7f88',
    link: '#78dce5',
    focus: '#86edf3',
  }),
});

export const STATUS_COLOURS = Object.freeze({
  neutral: Object.freeze({ background: '#e7eef0', foreground: '#2f4b56' }),
  information: Object.freeze({ background: '#dceff7', foreground: '#07546f' }),
  progress: Object.freeze({ background: '#d9f1f3', foreground: '#075d6e' }),
  warning: Object.freeze({ background: '#fff0c7', foreground: '#684800' }),
  success: Object.freeze({ background: '#dcefe3', foreground: '#145a36' }),
  error: Object.freeze({ background: '#f9dfdf', foreground: '#842d2d' }),
  accent: Object.freeze({ background: '#e7e1f6', foreground: '#4f3481' }),
});

const STATUS_TONES = Object.freeze({
  success: new Set([
    'accepted', 'completed', 'collected', 'delivered', 'qa_passed', 'released',
    'certificate_uploaded', 'ready_for_collection',
  ]),
  error: new Set([
    'cancelled', 'expired', 'qa_failed', 'failed', 'quality_correction_required',
    'delivery_problem',
  ]),
  warning: new Set([
    'on_hold', 'calibration_on_hold', 'awaiting_materials', 'pending_certificate',
    'awaiting_customer_acceptance', 'awaiting_dispatch', 'awaiting_planning',
  ]),
  accent: new Set(['out_for_delivery', 'dispatched', 'converted_to_order']),
  progress: new Set([
    'under_rep_review', 'in_progress', 'planning_in_progress', 'expediting_in_progress',
    'calibration_in_progress', 'qa_in_progress', 'assembly_in_progress',
  ]),
});

export const statusToneFor = status => {
  const value = String(status || '').trim().toLowerCase();
  for (const [tone, values] of Object.entries(STATUS_TONES)) {
    if (values.has(value)) return tone;
  }
  return value ? 'information' : 'neutral';
};
