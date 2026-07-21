export const shouldShowField = (field, values) => {
  if (field.key === 'customRange' && values.range !== 'Custom range - sales review') return false;
  if (!field.showWhen) return true;
  const actual = values[field.showWhen.key];
  if (field.showWhen.values) return field.showWhen.values.includes(actual);
  if (Object.prototype.hasOwnProperty.call(field.showWhen, 'notValue')) return actual !== field.showWhen.notValue;
  return actual === field.showWhen.value;
};

export const optionsForField = (field, values = {}) => {
  if (!field.optionsBy) return field.options || [];
  const dependency = values[field.optionsBy.key];
  return field.optionsBy.map?.[dependency] || field.optionsBy.fallback || field.options || [];
};
