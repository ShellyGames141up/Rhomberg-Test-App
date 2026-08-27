// Public workflow vocabulary; no identities or operational seed data.
export const TECHNICAL_CATEGORY_OPTIONS = Object.freeze([
  ['product_selection', 'Product selection'],
  ['product_compatibility', 'Product compatibility'],
  ['product_configuration', 'Product configuration'],
  ['application_suitability', 'Application suitability'],
  ['material_suitability', 'Material suitability'],
  ['pressure_range', 'Pressure range'],
  ['temperature_range', 'Temperature range'],
  ['connection_requirement', 'Connection requirement'],
  ['electrical_requirement', 'Electrical requirement'],
  ['calibration_requirement', 'Calibration requirement'],
  ['sanas_or_traceable_requirement', 'SANAS or Traceable requirement'],
  ['special_manufacturing_request', 'Special manufacturing request'],
  ['installation_question', 'Installation question'],
  ['missing_technical_information', 'Missing technical information'],
  ['other', 'Other'],
].map(([id, label]) => Object.freeze({ id, label })));
