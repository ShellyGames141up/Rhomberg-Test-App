import {
  DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES,
  NOTIFICATION_PREFERENCE_CATEGORIES,
} from '../../domain/notifications.js';
import {
  contrastRatio,
  foregroundForColour,
  isValidHexColour,
  validateThemeColour,
} from '../design/contrast.js';

export { contrastRatio, foregroundForColour, isValidHexColour };

export const CUSTOMER_THEME_PRESETS = Object.freeze([
  { id: 'rhomberg-default', label: 'Rhomberg Default', description: 'Trusted Rhomberg navy and cyan.', colours: { primary: '#073b53', secondary: '#075e7b', accent: '#08788d', success: '#217a55', warning: '#98630f' } },
  { id: 'industrial-professional', label: 'Industrial Professional', description: 'Steel, graphite and safety blue.', colours: { primary: '#263943', secondary: '#3c5966', accent: '#147896', success: '#28775a', warning: '#945e0f' } },
  { id: 'modern', label: 'Modern', description: 'Clean indigo with a bright teal accent.', colours: { primary: '#28355f', secondary: '#43558f', accent: '#00767b', success: '#25785a', warning: '#8e590d' } },
  { id: 'funky', label: 'Funky', description: 'Energetic purple and turquoise with safe contrast.', colours: { primary: '#51306f', secondary: '#77479a', accent: '#007f86', success: '#287653', warning: '#a8680f' } },
  { id: 'dark', label: 'Dark', description: 'Deep technical surfaces and cool cyan.', colours: { primary: '#102d3a', secondary: '#164c5d', accent: '#087587', success: '#2c805e', warning: '#946014' } },
  { id: 'high-contrast', label: 'High Contrast', description: 'Strong navy, white and accessible yellow.', colours: { primary: '#001f2d', secondary: '#004a66', accent: '#006d7f', success: '#176b45', warning: '#9b6100' } },
  { id: 'custom', label: 'Custom', description: 'Choose up to five protected brand colours.', colours: null },
]);

export const CUSTOMER_FONT_SIZES = Object.freeze([
  { id: 'small', label: 'Small', scale: 0.95 },
  { id: 'medium', label: 'Medium', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.12 },
  { id: 'extra-large', label: 'Extra Large', scale: 1.25 },
]);

export const CUSTOMER_DENSITIES = Object.freeze([
  { id: 'comfortable', label: 'Comfortable', scale: 1.14 },
  { id: 'standard', label: 'Standard', scale: 1 },
  { id: 'compact', label: 'Compact', scale: 0.9 },
]);

export const APPEARANCE_MODES = Object.freeze([
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System Default' },
]);

export { NOTIFICATION_PREFERENCE_CATEGORIES };

export const DEFAULT_CUSTOM_COLOURS = Object.freeze({
  primary: '#073b53',
  secondary: '#075e7b',
  accent: '#08788d',
  success: '#217a55',
  warning: '#98630f',
});

export const DEFAULT_NOTIFICATION_PREFERENCES = DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES;

export const createDefaultCustomerPersonalisation = () => ({
  schemaVersion: 1,
  setupCompleted: false,
  themePreset: 'rhomberg-default',
  customColours: { ...DEFAULT_CUSTOM_COLOURS },
  fontSize: 'medium',
  density: 'standard',
  appearanceMode: 'system',
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  profileImage: null,
  companyLogo: null,
  updatedAt: '',
});

const validIds = list => new Set(list.map(item => item.id));
const themeIds = validIds(CUSTOMER_THEME_PRESETS);
const fontSizeIds = validIds(CUSTOMER_FONT_SIZES);
const densityIds = validIds(CUSTOMER_DENSITIES);
const appearanceIds = validIds(APPEARANCE_MODES);

export const themeColoursFor = personalisation => {
  const current = personalisation || createDefaultCustomerPersonalisation();
  const preset = CUSTOMER_THEME_PRESETS.find(item => item.id === current.themePreset) || CUSTOMER_THEME_PRESETS[0];
  if (preset.id !== 'custom') return { ...preset.colours };
  const customColours = { ...DEFAULT_CUSTOM_COLOURS, ...(current.customColours || {}) };
  return Object.fromEntries(Object.entries(customColours).map(([name, colour]) => [
    name,
    validateThemeColour(name, colour) ? DEFAULT_CUSTOM_COLOURS[name] : colour,
  ]));
};

export const validateCustomerPersonalisation = candidate => {
  const value = candidate || {};
  const errors = {};
  if (!themeIds.has(value.themePreset)) errors.themePreset = 'Choose a recognised theme.';
  if (!fontSizeIds.has(value.fontSize)) errors.fontSize = 'Choose a recognised font size.';
  if (!densityIds.has(value.density)) errors.density = 'Choose a recognised display density.';
  if (!appearanceIds.has(value.appearanceMode)) errors.appearanceMode = 'Choose Light, Dark or System Default.';

  if (value.themePreset === 'custom') {
    for (const [name, colour] of Object.entries({ ...DEFAULT_CUSTOM_COLOURS, ...(value.customColours || {}) })) {
      const contrastError = validateThemeColour(name, colour);
      if (contrastError) errors[`customColours.${name}`] = contrastError;
    }
  }

  for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
    if (typeof value.notificationPreferences?.[category.id] !== 'boolean') {
      errors[`notificationPreferences.${category.id}`] = `Choose a preference for ${category.label.toLowerCase()}.`;
    }
    if (category.critical && value.notificationPreferences?.[category.id] === false) {
      errors[`notificationPreferences.${category.id}`] = `${category.label} must remain enabled for this preview.`;
    }
  }
  return errors;
};

export const normaliseCustomerPersonalisation = candidate => {
  const defaults = createDefaultCustomerPersonalisation();
  const value = candidate || {};
  return {
    ...defaults,
    ...value,
    setupCompleted: Boolean(value.setupCompleted),
    themePreset: themeIds.has(value.themePreset) ? value.themePreset : defaults.themePreset,
    customColours: { ...defaults.customColours, ...(value.customColours || {}) },
    fontSize: fontSizeIds.has(value.fontSize) ? value.fontSize : defaults.fontSize,
    density: densityIds.has(value.density) ? value.density : defaults.density,
    appearanceMode: appearanceIds.has(value.appearanceMode) ? value.appearanceMode : defaults.appearanceMode,
    notificationPreferences: { ...defaults.notificationPreferences, ...(value.notificationPreferences || {}) },
    profileImage: value.profileImage || null,
    companyLogo: value.companyLogo || null,
  };
};

export const customerPersonalisationCss = personalisation => {
  const current = normaliseCustomerPersonalisation(personalisation);
  const colours = themeColoursFor(current);
  const fontScale = CUSTOMER_FONT_SIZES.find(item => item.id === current.fontSize)?.scale || 1;
  const densityScale = CUSTOMER_DENSITIES.find(item => item.id === current.density)?.scale || 1;
  return {
    '--customer-primary': colours.primary,
    '--customer-primary-text': foregroundForColour(colours.primary),
    '--customer-secondary': colours.secondary,
    '--customer-secondary-text': foregroundForColour(colours.secondary),
    '--customer-accent': colours.accent,
    '--customer-accent-text': foregroundForColour(colours.accent),
    '--customer-success': colours.success,
    '--customer-success-text': foregroundForColour(colours.success),
    '--customer-warning': colours.warning,
    '--customer-warning-text': foregroundForColour(colours.warning),
    '--customer-font-scale': String(fontScale),
    '--customer-density-scale': String(densityScale),
  };
};

export const CUSTOMER_IMAGE_ACCEPT = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_CUSTOMER_IMAGE_BYTES = 1024 * 1024;

export const validateCustomerImage = file => {
  if (!file) return 'Choose an image.';
  if (!CUSTOMER_IMAGE_ACCEPT.includes(String(file.type || '').toLowerCase())) return 'Choose a JPG, PNG or WebP image.';
  if (Number(file.size || 0) < 1 || Number(file.size || 0) > MAX_CUSTOMER_IMAGE_BYTES) return 'The image must be 1 MB or smaller.';
  return '';
};
