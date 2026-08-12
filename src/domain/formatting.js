const southAfricanRand = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatSouthAfricanCurrency = value => southAfricanRand.format(Number(value || 0));
