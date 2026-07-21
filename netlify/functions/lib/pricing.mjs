import { gunzipSync } from 'node:zlib';

const clean = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const array = value => Array.isArray(value) ? value : value ? [value] : [];
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const GAUGE_CODES = new Set(['PBB', 'PBZ', 'PBX', 'PCB / PCK', 'PBR', 'CBC', 'BBR', 'DBB', 'HGZ', 'PBS', 'PBT', 'PDBH', 'PBG', 'PBJ', 'PBK', 'PBU', 'PBN']);

export function loadPrivatePriceBook(environment = process.env) {
  const encoded = [
    environment.RHOMBERG_PRICEBOOK_GZIP_BASE64,
    environment.RHOMBERG_PRICEBOOK_GZIP_BASE64_1,
    environment.RHOMBERG_PRICEBOOK_GZIP_BASE64_2,
    environment.RHOMBERG_PRICEBOOK_GZIP_BASE64_3,
  ].filter(Boolean).join('');
  if (!encoded) throw new Error('The private Rhomberg price book has not been configured.');
  return JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
}

const desiredVariant = line => {
  const material = clean(line.configuration?.material);
  if (material.includes('monel')) return 'MM';
  if (material.includes('brass')) return 'BB';
  if (material.includes('stainless')) return 'SS';
  if (['PBR', 'CBC', 'BBR', 'PBJ', 'PBK'].includes(line.code)) return 'BB';
  if (['DBB', 'HGZ', 'PBS', 'PBT', 'PDBH'].includes(line.code)) return 'SS';
  return '';
};

const dialNumber = line => String(line.configuration?.dialSize || '').match(/\d+/)?.[0] || '';

const maximumInBaseUnits = value => {
  const text = String(value || '').replace(/(\d)\s+(?=\d{3}(?:\D|$))/g, '$1').replace(/\s+/g, ' ');
  const matches = [...text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(kpa|mpa|bar|psi|°?c)?/gi)];
  if (!matches.length) return null;
  const match = matches[matches.length - 1];
  const number = Number(match[1].replace(',', '.'));
  const unit = String(match[2] || 'bar').toLowerCase();
  if (unit === 'kpa') return number / 100;
  if (unit === 'mpa') return number * 10;
  if (unit === 'psi') return number / 14.5038;
  return number;
};

const scoreRule = (rule, line) => {
  const configuration = line.configuration || {};
  const description = clean(rule.description);
  let score = 0;

  const variant = desiredVariant(line);
  if (variant && rule.variant) score += variant === rule.variant ? 50 : -150;

  const dial = dialNumber(line);
  const ruleDial = rule.description.match(/(\d+)\s*mm\s*dial/i)?.[1] || '';
  if (dial && ruleDial) score += dial === ruleDial ? 70 : -160;

  const sourceCode = clean(rule.variant || rule.code);
  const lineCode = clean(line.code);
  if (description.startsWith(lineCode)) score += 30;
  if (sourceCode === lineCode) score += 20;

  const selectedConnection = clean(configuration.processConnection || configuration.threadSize);
  if (selectedConnection) {
    const fractions = ['1 2', '3 4', '1 inch', '1 4'];
    for (const fraction of fractions) {
      if (selectedConnection.includes(fraction)) score += description.includes(fraction) ? 18 : 0;
    }
  }

  const mounting = clean(configuration.mounting);
  if (line.code === 'TPS' && mounting) {
    if (mounting.includes('rigid')) score += description.includes('rigid stem') ? 55 : -40;
    if (mounting.includes('bottom')) score += description.includes('bottom entry') ? 55 : -40;
    if (mounting.includes('every')) score += description.includes('every angle') ? 55 : -40;
  }
  if (line.code === 'TPB' && mounting) {
    const isRemote = mounting.includes('remote');
    score += isRemote === /bc|cc|ec|fc/i.test(rule.description) ? 55 : -40;
  }

  const selectedMaximum = maximumInBaseUnits(configuration.range || configuration.fullScaleRange);
  if (selectedMaximum !== null && /kpa|mpa/i.test(rule.description)) {
    if (selectedMaximum <= 60) score += /6000\s*kpa/i.test(rule.description) ? 45 : 0;
    else if (selectedMaximum <= 1000) score += /10\s*mpa[^}]*100\s*mpa|10\s*mpa[^}]*60\s*mpa/i.test(rule.description) ? 45 : 0;
    else if (selectedMaximum <= 1800) score += /120\s*mpa[^}]*1[68]0\s*mpa/i.test(rule.description) ? 45 : 0;
    else score += /200\s*mpa[^}]*250\s*mpa/i.test(rule.description) ? 45 : 0;
  }

  return score;
};

const ambiguousProduct = code => ['RPT102 / 103', 'RPT161 / 162', 'RPT400 / 401'].includes(code);

const pickBaseRule = (line, book) => {
  const candidates = book.baseRules.filter(rule => rule.code === line.code);
  if (!candidates.length) return { rule: null, reason: 'No price-list line is available for this model.' };
  if (ambiguousProduct(line.code)) return { rule: null, reason: 'Select the exact model number before applying a price.' };

  const ranked = candidates.map(rule => ({ rule, score: scoreRule(rule, line) })).sort((a, b) => b.score - a.score || a.rule.unitPrice - b.rule.unitPrice);
  const best = ranked[0];
  if (!best || best.score < 0) return { rule: null, reason: 'The selected configuration does not have a reliable matching price-list line.' };
  const tied = ranked.filter(entry => entry.score === best.score && entry.rule.unitPrice !== best.rule.unitPrice);
  if (tied.length > 1 && !dialNumber(line)) return { rule: null, reason: 'More configuration detail is required to select the correct base price.' };
  return { rule: best.rule, reason: '' };
};

const gaugeExtra = (book, key, dial) => book.extras.gauge.find(extra => extra.key === key && extra.dial === dial);
const pushExtra = (extras, entry, quantity = 1) => {
  if (!entry || !Number.isFinite(Number(entry.unitPrice))) return false;
  extras.push({ ...entry, quantity, total: money(entry.unitPrice * quantity) });
  return true;
};

const priceGaugeExtras = (line, book, manual) => {
  const configuration = line.configuration || {};
  const extras = [];
  const dial = dialNumber(line);
  const position = clean(configuration.connectionPosition);
  const fill = clean(configuration.fill);
  const options = array(configuration.gaugeOptions).map(clean);

  if (/back flange|front flange/.test(position)) pushExtra(extras, gaugeExtra(book, 'bef-configuration', dial));
  else if (/wide front flange|narrow front ring/.test(position)) pushExtra(extras, gaugeExtra(book, 'uv-configuration', dial));

  if (fill.includes('vibration free')) pushExtra(extras, gaugeExtra(book, 'vfm', dial));
  else if ((fill.includes('glycerine') || fill.includes('silicone')) && !['PBG', 'PBJ'].includes(line.code)) pushExtra(extras, gaugeExtra(book, 'filled', dial));

  const optionMap = [
    ['snubber', 'snubber'], ['maximum drag pointer', 'drag-pointer'], ['safety glass', 'safety-glass'],
    ['red set pointer', 'red-green-line'],
  ];
  for (const [needle, key] of optionMap) {
    if (options.some(option => option.includes(needle))) {
      if (!pushExtra(extras, gaugeExtra(book, key, dial))) manual.push(`Price ${needle} for ${dial || 'selected'} mm dial.`);
    }
  }

  if (clean(configuration.logo).includes('customer logo')) pushExtra(extras, gaugeExtra(book, 'new-logo-range', dial));

  if (clean(configuration.sanas).includes('required')) {
    const maxBar = maximumInBaseUnits(configuration.range || configuration.fullScaleRange) || 0;
    const key = maxBar > 1700 ? 'sanas-ultra' : maxBar > 600 ? 'sanas-high' : 'sanas-low';
    if (!pushExtra(extras, gaugeExtra(book, key, dial))) manual.push('Confirm SANAS calibration price for the selected range.');
  }

  if (line.code === 'PBB' && dial === '100') {
    const contacts = clean(configuration.internalContacts);
    if (contacts.includes('single')) pushExtra(extras, book.extras.contacts.find(item => item.key === 'single-internal'));
    if (contacts.includes('dual')) pushExtra(extras, book.extras.contacts.find(item => item.key === 'dual-internal'));
    if (contacts.includes('single') || contacts.includes('dual')) {
      const cable = String(configuration.contactCableLength || '').match(/\d+/)?.[0];
      if (cable === '2' || cable === '5') pushExtra(extras, book.extras.contacts.find(item => item.key === `cable-${cable}`));
      else manual.push('Confirm internal-contact cable/adaptor price for the selected length.');
    }
  }

  if (configuration.chemicalSeal) manual.push('Chemical seal selection and price require representative review.');
  if (configuration.installationOption && !clean(configuration.installationOption).includes('standard')) manual.push(`Confirm price for ${configuration.installationOption}.`);

  const knownOptions = optionMap.map(([needle]) => needle);
  for (const option of options) {
    if (!knownOptions.some(known => option.includes(known))) manual.push(`Confirm price and compatibility for ${option}.`);
  }
  return extras;
};

const findTpsExtra = (book, keyNeedle, length) => book.extras.tps.find(extra => extra.key.includes(keyNeedle) && (!length || extra.length === length));
const priceTpsExtras = (line, book, manual) => {
  const configuration = line.configuration || {};
  const extras = [];
  const length = String(configuration.stemLength || '').match(/\d+/)?.[0] || '100';
  if (length !== '63') pushExtra(extras, findTpsExtra(book, 'stem-lengths', length));
  if (clean(configuration.probeDiameter).includes('3 8 inch')) pushExtra(extras, findTpsExtra(book, '3-8-stem-od', length));
  const connection = clean(configuration.processConnection);
  if (connection.includes('nw40')) pushExtra(extras, findTpsExtra(book, 'nw40', length));
  if (connection.includes('nw50')) pushExtra(extras, findTpsExtra(book, 'nw50', length));
  if (connection.includes('1 2 inch npt adjustable')) pushExtra(extras, findTpsExtra(book, '1-2-npt', length));
  if (connection.includes('1 2 inch bsp adjustable')) pushExtra(extras, findTpsExtra(book, '1-2-bsp', length));
  if (clean(configuration.traceability).includes('required')) pushExtra(extras, findTpsExtra(book, 'calibration-certificate', length));
  if (configuration.specialRequirements) manual.push('Review the special temperature-instrument requirements.');
  return extras;
};

const findTpbExtra = (book, needle) => book.extras.tpb.find(extra => extra.key.includes(needle));
const priceTpbExtras = (line, book, manual) => {
  const configuration = line.configuration || {};
  const extras = [];
  const maxTemperature = maximumInBaseUnits(configuration.range) || 0;
  if (maxTemperature > 400) pushExtra(extras, findTpbExtra(book, 'higher-temperature'));
  const connection = clean(configuration.processConnection);
  if (connection.includes('1 2 inch npt')) pushExtra(extras, findTpbExtra(book, 'npt-stainless'));
  if (connection.includes('1 2 inch bsp')) pushExtra(extras, findTpbExtra(book, 'bsp-stainless'));
  if (clean(configuration.traceability).includes('required')) pushExtra(extras, findTpbExtra(book, maxTemperature > 400 ? 'higher-ranges' : 'up-to-400'));
  if (clean(configuration.mounting).includes('remote')) manual.push('Confirm capillary length pricing and protection.');
  if (String(configuration.probeLength || '') !== '300 mm') manual.push('Confirm non-standard bulb/probe length pricing.');
  if (configuration.specialRequirements) manual.push('Review the special temperature-instrument requirements.');
  return extras;
};

export function priceEnquiry(enquiry, book) {
  const lines = (enquiry.items || []).map(line => {
    const manualReview = [];
    const { rule: base, reason } = pickBaseRule(line, book);
    if (reason) manualReview.push(reason);

    let extras = [];
    if (line.category === 'pressure' && (line.variant === 'gauge' || GAUGE_CODES.has(line.code))) extras = priceGaugeExtras(line, book, manualReview);
    else if (line.code === 'TPS') extras = priceTpsExtras(line, book, manualReview);
    else if (line.code === 'TPB') extras = priceTpbExtras(line, book, manualReview);
    else if (line.configuration?.specialRequirements) manualReview.push('Review the product special requirements.');

    const quantity = Math.max(1, Math.trunc(Number(line.quantity) || 1));
    const extrasTotal = money(extras.reduce((sum, extra) => sum + extra.total, 0));
    const unitEstimate = base ? money(base.unitPrice + extrasTotal) : null;
    const extendedEstimate = unitEstimate === null ? null : money(unitEstimate * quantity);
    return {
      lineId: line.lineId,
      code: line.code,
      quantity,
      base,
      extras,
      extrasTotal,
      unitEstimate,
      extendedEstimate,
      status: !base ? 'manual' : manualReview.length ? 'partial' : 'estimated',
      manualReview,
    };
  });

  const knownSubtotal = money(lines.reduce((sum, line) => sum + (line.extendedEstimate || 0), 0));
  const unpricedLineCount = lines.filter(line => line.extendedEstimate === null).length;
  const manualItems = [];
  if (enquiry.emergency === 'yes') manualItems.push('Emergency feasibility and surcharge - representative to determine.');
  if (enquiry.fulfilment === 'delivery') manualItems.push('Delivery fee - representative to determine.');
  if (lines.some(line => line.manualReview.length)) manualItems.push('Special and unpriced selections are listed beneath each unit.');

  return {
    sourceLabel: book.sourceLabel,
    effectiveDate: book.effectiveDate,
    currency: book.currency,
    priceBasis: book.priceBasis,
    lines,
    knownSubtotal,
    unpricedLineCount,
    manualItems,
    disclaimer: 'Internal pricing aid only. Verify product suitability, prices, VAT treatment, stock, delivery and lead time before issuing a quotation.',
  };
}
