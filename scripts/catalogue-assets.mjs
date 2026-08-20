import fs from 'node:fs';
import path from 'node:path';
import { categories, products } from '../src/data/catalogue.js';

const CUSTOMER_VISIBLE_SUPPORT_IMAGES = new Set([
  'assets/images/calibration.png',
  'assets/images/switches.png',
  'assets/images/transmitters.png',
]);

const normalise = value => String(value || '').replaceAll('\\', '/');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const classify = assetPath => {
  if (/^assets\/images\/products\/[a-z0-9-]+\.webp$/.test(assetPath)) return 'product-image';
  if (CUSTOMER_VISIBLE_SUPPORT_IMAGES.has(assetPath)) return 'catalogue-support-image';
  if (/^assets\/datasheets\/[A-Za-z0-9-]+\.pdf$/.test(assetPath)) return 'product-document';
  throw new Error(`Catalogue reference is outside the approved public asset policy: ${assetPath}`);
};

const references = new Map();
const addReference = (assetPath, reference) => {
  const approvedPath = normalise(assetPath);
  assert(approvedPath && !approvedPath.includes('..') && !approvedPath.startsWith('/'), `Unsafe catalogue asset path: ${approvedPath}`);
  const entries = references.get(approvedPath) || [];
  entries.push(Object.freeze(reference));
  references.set(approvedPath, entries);
};

for (const category of categories) {
  addReference(category.image, { surface: 'category', id: category.id, label: category.name });
}

for (const product of products) {
  addReference(product.image, { surface: 'product', id: product.id, label: `${product.code} ${product.name}` });
  for (const document of product.datasheets || []) {
    addReference(document.url, { surface: 'datasheet', id: product.id, label: `${product.code}: ${document.label}` });
  }
}

export const CATALOGUE_ASSET_MANIFEST = Object.freeze([...references]
  .map(([assetPath, referencedBy]) => Object.freeze({
    path: assetPath,
    type: classify(assetPath),
    customerVisible: true,
    safePublic: true,
    referencedBy: Object.freeze([...referencedBy].sort((left, right) => `${left.surface}:${left.id}:${left.label}`.localeCompare(`${right.surface}:${right.id}:${right.label}`))),
  }))
  .sort((left, right) => left.path.localeCompare(right.path)));

export const PUBLIC_CATALOGUE_PDFS = Object.freeze(CATALOGUE_ASSET_MANIFEST
  .filter(asset => asset.type === 'product-document')
  .map(asset => Object.freeze({
    path: asset.path,
    purpose: [...new Set(asset.referencedBy.map(reference => reference.label))].join('; '),
    customerVisible: asset.customerVisible,
    safePublic: asset.safePublic,
  })));

export const STALE_CATALOGUE_ASSETS = Object.freeze([
  ['assets/images/diaphragm-gauge.png', 'Legacy category image; no current catalogue category or product references it.'],
  ['assets/images/gas-analysis.png', 'Legacy category image; the current Gas Analysis category uses analysis-family.webp.'],
  ['assets/images/process-gauge.png', 'Legacy category image; no current catalogue category or product references it.'],
  ['assets/images/products/electrical-contacts.webp', 'No current product or product-detail record references this image.'],
  ['assets/images/products/rpt103.webp', 'The combined RPT102 / 103 record uses rpt102.webp.'],
  ['assets/images/products/seal-triclamp.webp', 'The current Dairy / Tri-Clamp record uses seal-dairy.webp.'],
  ['assets/images/products/snubber.webp', 'The current Snubber record intentionally uses the calibration support image.'],
  ['assets/images/products/v-line.webp', 'No current product or product-detail record references this image.'],
  ['assets/images/temperature-sensors.png', 'Legacy category image; current temperature products use model-specific imagery.'],
  ['assets/images/temperature.png', 'Legacy category image; the current Temperature category uses tps.webp.'],
  ['assets/images/utility-gauge.png', 'Legacy category image; utility products use model-specific imagery.'],
].map(([assetPath, reason]) => Object.freeze({ path: assetPath, reason })));

export function validateCatalogueAssetFiles(root = process.cwd(), fileSystem = fs) {
  const seen = new Set();
  for (const asset of CATALOGUE_ASSET_MANIFEST) {
    assert(!seen.has(asset.path), `Duplicate catalogue manifest path: ${asset.path}`);
    seen.add(asset.path);
    assert(asset.customerVisible && asset.safePublic, `Catalogue asset is not approved public content: ${asset.path}`);
    const resolved = path.resolve(root, asset.path);
    assert(resolved.startsWith(`${path.resolve(root)}${path.sep}`), `Catalogue asset escapes the repository: ${asset.path}`);
    assert(fileSystem.existsSync(resolved), `Catalogue reference is missing its source file: ${asset.path}`);
    const details = fileSystem.statSync(resolved);
    assert(details.isFile() && details.size > 0, `Catalogue source is empty or not a file: ${asset.path}`);
  }
  return Object.freeze({ assets: seen.size, references: [...references.values()].reduce((total, entries) => total + entries.length, 0) });
}
