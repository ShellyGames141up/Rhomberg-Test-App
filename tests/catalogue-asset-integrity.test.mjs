import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { categories, products } from '../src/data/catalogue.js';
import {
  CATALOGUE_ASSET_MANIFEST,
  STALE_CATALOGUE_ASSETS,
  validateCatalogueAssetFiles,
} from '../scripts/catalogue-assets.mjs';
import { EXCLUDED_NON_CATALOGUE_ASSETS, PRODUCTION_ASSETS } from '../scripts/production-assets.mjs';
import { renderCatalogueAssetInventory } from '../scripts/report-catalogue-assets.mjs';

const normalise = value => value.replaceAll('\\', '/');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [normalise(target)];
});

const expectedReferences = new Set();
for (const category of categories) expectedReferences.add(category.image);
for (const product of products) {
  expectedReferences.add(product.image);
  for (const document of product.datasheets || []) expectedReferences.add(document.url);
}

const approvedCataloguePaths = CATALOGUE_ASSET_MANIFEST.map(asset => asset.path);
assert.deepEqual(approvedCataloguePaths, [...expectedReferences].sort(), 'every catalogue, product-detail and datasheet reference must be in the structured manifest');
assert.equal(new Set(approvedCataloguePaths).size, approvedCataloguePaths.length, 'catalogue manifest paths must be unique');
assert.equal(validateCatalogueAssetFiles().assets, approvedCataloguePaths.length);

for (const asset of CATALOGUE_ASSET_MANIFEST) {
  assert.equal(asset.customerVisible, true);
  assert.equal(asset.safePublic, true);
  assert.ok(asset.referencedBy.length > 0, `catalogue asset has no recorded application reference: ${asset.path}`);
  assert.ok(PRODUCTION_ASSETS.includes(asset.path), `referenced catalogue asset is absent from production: ${asset.path}`);
  assert.doesNotMatch(asset.path, /(?:^|\/)(?:private|private-config|test|tests|preview|demo|tmp|logs?)(?:\/|$)|\.map$/i);
}

const deliberatelyMissing = CATALOGUE_ASSET_MANIFEST[0].path;
assert.throws(
  () => validateCatalogueAssetFiles(process.cwd(), {
    existsSync: target => normalise(path.relative(process.cwd(), target)) !== deliberatelyMissing && fs.existsSync(target),
    statSync: fs.statSync,
  }),
  new RegExp(`Catalogue reference is missing its source file: ${deliberatelyMissing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  'a broken product-document or image reference must fail validation',
);

const catalogueHashes = new Map();
for (const asset of CATALOGUE_ASSET_MANIFEST) {
  const hash = createHash('sha256').update(fs.readFileSync(asset.path)).digest('hex');
  catalogueHashes.set(hash, [...(catalogueHashes.get(hash) || []), asset.path]);
}
assert.deepEqual([...catalogueHashes.values()].filter(paths => paths.length > 1), [], 'approved catalogue assets must not contain duplicate files');

const sourceAssets = walk('assets').sort();
const classified = new Set([
  ...PRODUCTION_ASSETS,
  ...STALE_CATALOGUE_ASSETS.map(asset => asset.path),
  ...EXCLUDED_NON_CATALOGUE_ASSETS.map(asset => asset.path),
]);
assert.deepEqual(sourceAssets.filter(asset => !classified.has(asset)), [], 'every repository asset must be approved or explicitly excluded with a reason');
assert.equal(classified.size, sourceAssets.length, 'asset classifications must not overlap or contain missing paths');

for (const excluded of [...STALE_CATALOGUE_ASSETS, ...EXCLUDED_NON_CATALOGUE_ASSETS]) {
  assert.ok(excluded.reason, `excluded asset requires a reason: ${excluded.path}`);
  assert.ok(fs.existsSync(excluded.path), `reported stale/excluded asset is missing: ${excluded.path}`);
  assert.ok(!PRODUCTION_ASSETS.includes(excluded.path), `stale or unrelated asset entered production: ${excluded.path}`);
}

assert.equal(
  fs.readFileSync('docs/PRODUCTION_CATALOGUE_ASSET_INVENTORY.md', 'utf8'),
  await renderCatalogueAssetInventory(),
  'the checked-in catalogue inventory must match the current manifest and source assets',
);

console.log(`Catalogue asset integrity passed: ${CATALOGUE_ASSET_MANIFEST.length} approved, ${STALE_CATALOGUE_ASSETS.length} stale catalogue and ${EXCLUDED_NON_CATALOGUE_ASSETS.length} unrelated assets reported.`);
