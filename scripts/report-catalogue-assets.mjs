import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE_ASSET_MANIFEST, STALE_CATALOGUE_ASSETS } from './catalogue-assets.mjs';
import { EXCLUDED_NON_CATALOGUE_ASSETS, PRODUCTION_ASSETS } from './production-assets.mjs';
import { categories, products } from '../src/data/catalogue.js';

const root = process.cwd();
const output = path.join(root, 'docs', 'PRODUCTION_CATALOGUE_ASSET_INVENTORY.md');
const productDocumentOutput = path.join(root, 'docs', 'PRODUCT_DOCUMENT_MATRIX.md');
const normalise = value => value.replaceAll('\\', '/');

const collect = async directory => {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target));
    else files.push(target);
  }
  return files;
};

const brandReferences = new Map([
  ['assets/images/favicon.ico', 'IIS production index favicon'],
  ['assets/images/rhomberg-connect-icon-192.png', 'Web manifest and service-worker application icon'],
  ['assets/images/rhomberg-connect-icon-512.png', 'Web manifest and service-worker application icon'],
  ['assets/images/rhomberg-connect-logo-compact.png', 'Onboarding, intro and service-worker application shell'],
  ['assets/images/rhomberg-connect-logo-full-dark.png', 'Authentication, layout, settings and application shell'],
  ['assets/images/rhomberg-connect-logo-loading.png', 'Application loading state and service-worker application shell'],
  ['assets/images/rhomberg-connect-logo-splash.png', 'Intro and service-worker application shell'],
  ['assets/images/rhomberg-connect-symbol.png', 'Onboarding, intro and service-worker application shell'],
  ['assets/images/rhomberg-gauge-mark.svg', 'Service-worker application shell branding'],
  ['assets/images/rhomberg-wordmark-transparent.png', 'Service-worker application shell branding'],
]);

const stale = new Map(STALE_CATALOGUE_ASSETS.map(asset => [asset.path, asset.reason]));
const unrelated = new Map(EXCLUDED_NON_CATALOGUE_ASSETS.map(asset => [asset.path, asset.reason]));
const catalogue = new Map(CATALOGUE_ASSET_MANIFEST.map(asset => [asset.path, asset]));
const production = new Set(PRODUCTION_ASSETS);

const typeOf = assetPath => {
  const extension = path.extname(assetPath).slice(1).toUpperCase();
  if (assetPath.startsWith('assets/datasheets/')) return `Product document (${extension})`;
  if (assetPath.startsWith('assets/images/products/')) return `Product image (${extension})`;
  return `Image / branding (${extension || 'file'})`;
};

const referenceOf = assetPath => {
  const entry = catalogue.get(assetPath);
  if (entry) {
    const grouped = new Map();
    for (const reference of entry.referencedBy) grouped.set(reference.surface, [...(grouped.get(reference.surface) || []), reference.label]);
    return [...grouped].map(([surface, labels]) => `${surface}: ${[...new Set(labels)].join(', ')}`).join('; ');
  }
  if (brandReferences.has(assetPath)) return brandReferences.get(assetPath);
  return `Not referenced — ${stale.get(assetPath) || unrelated.get(assetPath) || 'unclassified'}`;
};

const escapeCell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export async function renderCatalogueAssetInventory() {
  const files = (await collect(path.join(root, 'assets')))
    .map(file => ({ file, relative: normalise(path.relative(root, file)) }))
    .sort((left, right) => left.relative.localeCompare(right.relative));
  const rows = [];
  for (const entry of files) {
    const details = await fs.stat(entry.file);
    const isCatalogue = catalogue.has(entry.relative);
    const isProduction = production.has(entry.relative);
    rows.push(`| ${escapeCell(path.basename(entry.relative))} | \`${entry.relative}\` | ${typeOf(entry.relative)} | ${(details.size / 1024).toFixed(1)} KiB | ${escapeCell(referenceOf(entry.relative))} | ${isProduction ? 'Yes' : 'No'} | ${isCatalogue || brandReferences.has(entry.relative) ? 'Yes' : 'No — unused/unapproved'} | ${isCatalogue ? 'Yes' : isProduction ? 'Branding only' : 'No'} |`);
  }

  return `# Production catalogue asset inventory

This inventory is generated from the current catalogue/product records and the explicit production asset policy. It does not approve whole directories.

- Repository assets discovered: **${files.length}**
- Customer-visible catalogue/product assets approved: **${CATALOGUE_ASSET_MANIFEST.length}**
- Additional production branding assets: **${brandReferences.size}**
- Stale catalogue-related assets excluded: **${STALE_CATALOGUE_ASSETS.length}**
- Unused branding variants excluded: **${EXCLUDED_NON_CATALOGUE_ASSETS.length}**

| Filename | Repository path | Type | Approx. size | Application reference | Production | Appears safe/public | Customer-visible catalogue |
|---|---|---:|---:|---|:---:|---|:---:|
${rows.join('\n')}

## Policy

Only paths in the structured catalogue manifest or the small explicit application-branding list enter \`dist-production\`. Missing, empty, unsafe, duplicated catalogue or unclassified repository assets fail automated validation. Files marked unused/unapproved remain in source for review but do not enter staging.
`;
}

const categoryNames = new Map(categories.map(category => [category.id, category.name]));
const missingDocumentType = new Map([
  ['pressure', 'Product datasheet or technical datasheet'],
  ['temperature', 'Product datasheet or technical datasheet'],
  ['flow', 'Product datasheet'],
  ['level', 'Product datasheet'],
  ['switches', 'Product datasheet'],
  ['protection', 'Product datasheet / seal catalogue sheet'],
  ['analysis', 'Technical datasheet'],
  ['calibration', 'Product datasheet or service sheet'],
]);

const possibleFamilyDocument = product => {
  if (product.category === 'pressure' || (product.category === 'calibration' && ['RDPG10', 'DPG-S281'].includes(product.code))) {
    return 'Pressure Gauge Ordering Guide exists, but no approved relationship is recorded for this product; owner confirmation is required before linking.';
  }
  return 'None identified in the current approved repository documents.';
};

export function renderProductDocumentMatrix() {
  const rows = products.map(product => {
    const category = categoryNames.get(product.category) || product.category;
    const documents = product.documents.length
      ? product.documents.map(document => `${document.title} [${document.type}; ${document.scope}] (\`${document.assetPath}\`)`).join('<br>')
      : '**MISSING APPROVED DATASHEET SOURCE**';
    const guides = product.documents.filter(document => document.type === 'ordering_guide').map(document => document.title).join(', ') || 'None';
    const applicability = product.documents.map(document => document.applicability).join(' ') || 'No approved product-to-document association exists.';
    return `| \`${product.id}\` | ${escapeCell(product.name)} | ${escapeCell(category)} | \`${product.image}\` | Customer Catalogue → ${escapeCell(category)} → \`${product.id}\` → Configure | ${documents} | ${escapeCell(guides)} | ${escapeCell(applicability)} | ${product.documents.length ? 'Yes' : 'No'} |`;
  });
  const missing = products.filter(product => !product.documents.length).map(product => {
    const category = categoryNames.get(product.category) || product.category;
    return `| \`${product.id}\` | ${escapeCell(product.name)} | ${escapeCell(category)} | ${missingDocumentType.get(product.category) || 'Product datasheet'} | ${escapeCell(possibleFamilyDocument(product))} |`;
  });
  const withDocuments = products.filter(product => product.documents.length);
  const shared = products.filter(product => product.documents.some(document => document.scope === 'family'));

  return `# Product-to-document matrix

This matrix covers every live customer-catalogue product. Associations come only from the authoritative catalogue source and approved production asset manifest; it does not infer document applicability from filenames.

- Live products: **${products.length}**
- Products with one or more approved documents: **${withDocuments.length}**
- Products using an explicitly approved shared/family document: **${shared.length}**
- Products missing an approved source: **${missing.length}**

## Complete product matrix

| Product ID | Product name | Category/family | Image | Configuration route | Approved documents | Existing ordering guide | Applicability evidence | Existing source reference |
|---|---|---|---|---|---|---|---|:---:|
${rows.join('\n')}

## Missing approved datasheet sources

| Product ID | Product name | Category/family | Likely required document | Existing family document requiring confirmation |
|---|---|---|---|---|
${missing.join('\n')}

No missing document is represented by a download button. An authorised future catalogue administration service may replace this source-owned mapping only after backend permission, audit and asset-approval controls are implemented.
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = await renderCatalogueAssetInventory();
  if (process.argv.includes('--write')) {
    await fs.writeFile(output, content, 'utf8');
    await fs.writeFile(productDocumentOutput, renderProductDocumentMatrix(), 'utf8');
    console.log(`Wrote ${normalise(path.relative(root, output))} and ${normalise(path.relative(root, productDocumentOutput))}`);
  } else {
    process.stdout.write(content);
  }
}
