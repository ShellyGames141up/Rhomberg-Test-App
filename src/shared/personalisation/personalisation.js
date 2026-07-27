export const CUSTOMER_THEME_PRESETS = Object.freeze([
  { id: 'rhomberg-default', label: 'Rhomberg Default', description: 'Trusted Rhomberg navy and cyan.', colours: { primary: '#073b53', secondary: '#075e7b', accent: '#08788d', success: '#217a55', warning: '#b77812' } },
  { id: 'industrial-professional', label: 'Industrial Professional', description: 'Steel, graphite and safety blue.', colours: { primary: '#263943', secondary: '#3c5966', accent: '#147896', success: '#28775a', warning: '#a96d13' } },
  { id: 'modern', label: 'Modern', description: 'Clean indigo with a bright teal accent.', colours: { primary: '#28355f', secondary: '#43558f', accent: '#008b8f', success: '#25785a', warning: '#ad7314' } },
  { id: 'funky', label: 'Funky', description: 'Energetic purple and turquoise with safe contrast.', colours: { primary: '#51306f', secondary: '#77479a', accent: '#007f86', success: '#287653', warning: '#a8680f' } },
  { id: 'dark', label: 'Dark', description: 'Deep technical surfaces and cool cyan.', colours: { primary: '#102d3a', secondary: '#164c5d', accent: '#0b8494', success: '#2c805e', warning: '#b67b20' } },
  { id: 'high-contrast', label: 'High Contrast', description: 'Strong navy, white and accessible yellow.', colours: { primary: '#001f2d', secondary: '#004a66', accent: '#006d7f', success: '#176b45', warning: '#9b6100' } },
  { id: 'custom', label: 'Custom', description: 'Choose up to five protected brand colours.', colours: null },
]);

export const CUSTOMER_FONT_SIZES = Object.freeze([
  { id: 'small', label: 'Small', scale: 0.92 },
  { id: 'medium', label: 'Medium', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.12 },
  { id: 'extra-large', label: 'Extra Large', scale: 1.24 },
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

export const NOTIFICATION_PREFERENCE_CATEGORIES = Object.freeze([
  { id: 'rfqUpdates', label: 'RFQ updates', critical: false },
  { id: 'quotationNotifications', label: 'Quotation notifications', critical: false },
  { id: 'orderProgress', label: 'Order-progress notifications', critical: false },
  { id: 'delayNotifications', label: 'Delay notifications', critical: false },
  { id: 'fulfilmentNotifications', label: 'Collection or delivery notifications', critical: false },
  { id: 'accountSecurity', label: 'Account and security notifications', critical: true },
  { id: 'maintenanceNotices', label: 'Maintenance notices', critical: true },
  { id: 'companyAnnouncements', label: 'General company announcements', critical: false },
]);

export const DEFAULT_CUSTOM_COLOURS = Object.freeze({
  primary: '#073b53',
  secondary: '#075e7b',
  accent: '#08788d',
  success: '#217a55',
  warning: '#b77812',
});

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze(Object.fromEntries(
  NOTIFICATION_PREFERENCE_CATEGORIES.map(item => [item.id, true]),
));

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
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export const isValidHexColour = value => HEX_PATTERN.test(String(value || '').trim());

const rgb = colour => {
  if (!isValidHexColour(colour)) return null;
  const value = colour.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const luminance = colour => {
  const values = rgb(colour);
  if (!values) return 0;
  const linear = values.map(channel => {
    const normalised = channel / 255;
    return normalised <= 0.03928 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

export const contrastRatio = (first, second) => {
  const firstLum = luminance(first);
  const secondLum = luminance(second);
  return (Math.max(firstLum, secondLum) + 0.05) / (Math.min(firstLum, secondLum) + 0.05);
};

export const foregroundForColour = colour => (
  contrastRatio(colour, '#ffffff') >= contrastRatio(colour, '#102f3d') ? '#ffffff' : '#102f3d'
);

export const themeColoursFor = personalisation => {
  const current = personalisation || createDefaultCustomerPersonalisation();
  const preset = CUSTOMER_THEME_PRESETS.find(item => item.id === current.themePreset) || CUSTOMER_THEME_PRESETS[0];
  return preset.id === 'custom'
    ? { ...DEFAULT_CUSTOM_COLOURS, ...(current.customColours || {}) }
    : { ...preset.colours };
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
      if (!isValidHexColour(colour)) {
        errors[`customColours.${name}`] = `Choose a valid six-digit ${name} colour.`;
        continue;
      }
      const bestContrast = Math.max(contrastRatio(colour, '#ffffff'), contrastRatio(colour, '#102f3d'));
      if (bestContrast < 4.5) errors[`customColours.${name}`] = `${name} needs stronger contrast for readable text.`;
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
    '--customer-warning': colours.warning,
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
