const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export const ACCESSIBLE_LIGHT_TEXT = '#ffffff';
export const ACCESSIBLE_DARK_TEXT = '#10252f';
export const LIGHT_SURFACE = '#ffffff';
export const DARK_SURFACE = '#0d2530';

export const isValidHexColour = value => HEX_PATTERN.test(String(value || '').trim());

export const normaliseHexColour = value => {
  const colour = String(value || '').trim().toLowerCase();
  return isValidHexColour(colour) ? colour : '';
};

export const hexToRgb = colour => {
  const value = normaliseHexColour(colour);
  if (!value) return null;
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
};

const linearChannel = channel => {
  const normalised = channel / 255;
  return normalised <= 0.04045
    ? normalised / 12.92
    : ((normalised + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = colour => {
  const rgb = hexToRgb(colour);
  if (!rgb) return 0;
  return (
    0.2126 * linearChannel(rgb.red)
    + 0.7152 * linearChannel(rgb.green)
    + 0.0722 * linearChannel(rgb.blue)
  );
};

export const contrastRatio = (first, second) => {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

export const meetsContrast = (foreground, background, minimum = 4.5) => (
  isValidHexColour(foreground)
  && isValidHexColour(background)
  && contrastRatio(foreground, background) >= minimum
);

export const foregroundForColour = (
  background,
  {
    light = ACCESSIBLE_LIGHT_TEXT,
    dark = ACCESSIBLE_DARK_TEXT,
    minimum = 4.5,
  } = {},
) => {
  if (!isValidHexColour(background)) return dark;
  const lightRatio = contrastRatio(background, light);
  const darkRatio = contrastRatio(background, dark);
  if (lightRatio >= minimum || lightRatio >= darkRatio) return light;
  return dark;
};

export const contrastReport = (
  background,
  foreground = foregroundForColour(background),
  minimum = 4.5,
) => {
  const ratio = contrastRatio(background, foreground);
  return Object.freeze({
    background: normaliseHexColour(background),
    foreground: normaliseHexColour(foreground),
    ratio,
    minimum,
    passes: ratio >= minimum,
  });
};

export const validateThemeColour = (
  name,
  colour,
  {
    surface = LIGHT_SURFACE,
    textMinimum = 4.5,
    controlMinimum = 3,
  } = {},
) => {
  if (!isValidHexColour(colour)) return `Choose a valid six-digit ${name} colour.`;
  const foreground = foregroundForColour(colour, { minimum: textMinimum });
  if (!meetsContrast(foreground, colour, textMinimum)) {
    return `${name} cannot provide ${textMinimum}:1 readable text contrast.`;
  }
  if (['primary', 'secondary', 'accent'].includes(name) && contrastRatio(colour, surface) < controlMinimum) {
    return `${name} needs at least ${controlMinimum}:1 contrast against light cards and controls.`;
  }
  return '';
};

export const validateContrastPairs = pairs => (
  (pairs || []).map(pair => ({
    ...pair,
    ...contrastReport(pair.background, pair.foreground, pair.minimum),
  }))
);

export const unsafeContrastPairs = pairs => validateContrastPairs(pairs).filter(pair => !pair.passes);
