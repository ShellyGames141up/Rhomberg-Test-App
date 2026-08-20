import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { products } from '../src/data/catalogue.js';
import { classifyCatalogueAssetPath } from '../scripts/catalogue-assets.mjs';
import { PRODUCTION_ASSETS } from '../scripts/production-assets.mjs';

const compiledComponent = await build({
  entryPoints: ['src/components/ProductDetail.jsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  platform: 'node',
  write: false,
});
const componentModule = await import(`data:text/javascript;base64,${Buffer.from(compiledComponent.outputFiles[0].text).toString('base64')}`);
const { ProductDocuments } = componentModule;

const withDocuments = products.filter(product => product.documents.length);
const withFamilyDocument = products.filter(product => product.documents.some(document => document.scope === 'family'));
const missing = products.filter(product => !product.documents.length);

assert.equal(products.length, 84);
assert.equal(withDocuments.length, 34);
assert.equal(withFamilyDocument.length, 33);
assert.equal(missing.length, 50);

for (const product of products) {
  assert.equal(product.documentSourceStatus, product.documents.length ? 'approved_documents_available' : 'missing_approved_datasheet_source');
  assert.equal(new Set(product.documents.map(document => document.assetPath)).size, product.documents.length, `duplicate document mapping for ${product.id}`);
  for (const document of product.documents) {
    assert.equal(classifyCatalogueAssetPath(document.assetPath), 'product-document');
    assert.ok(PRODUCTION_ASSETS.includes(document.assetPath), `document is not production-allowlisted: ${document.assetPath}`);
    assert.ok(fs.existsSync(document.assetPath), `document source is missing: ${document.assetPath}`);
    assert.equal(document.customerVisible, true);
    assert.equal(document.approvalStatus, 'approved_repository_source');
    assert.ok(['product', 'family'].includes(document.scope));
    assert.ok(document.title && document.applicability);
  }
}

assert.throws(() => classifyCatalogueAssetPath('private/test-product.pdf'), /outside the approved public asset policy/);
assert.throws(() => classifyCatalogueAssetPath('assets/datasheets/preview-only.txt'), /outside the approved public asset policy/);

const pbb = products.find(product => product.code === 'PBB');
const pbbMarkup = renderToStaticMarkup(React.createElement(ProductDocuments, { product: pbb }));
assert.equal((pbbMarkup.match(/<a /g) || []).length, 2, 'PBB renders its product sheet and approved family ordering guide');
assert.match(pbbMarkup, /href="assets\/datasheets\/PBB-product-sheet\.pdf"/);
assert.match(pbbMarkup, /Download Datasheet for PBB: PBB Product Sheet/);
assert.match(pbbMarkup, /Download Ordering Guide for PBB: Pressure Gauge Ordering Guide/);
assert.match(pbbMarkup, /download=""/);

const pbg = products.find(product => product.code === 'PBG');
const pbgMarkup = renderToStaticMarkup(React.createElement(ProductDocuments, { product: pbg }));
assert.equal((pbgMarkup.match(/<a /g) || []).length, 2, 'multiple legitimate family documents render without duplicate links');
assert.match(pbgMarkup, /Utility-gauge-overview\.pdf/);
assert.match(pbgMarkup, /Pressure-gauge-ordering-guide\.pdf/);

const missingProduct = missing[0];
const missingMarkup = renderToStaticMarkup(React.createElement(ProductDocuments, { product: missingProduct }));
assert.doesNotMatch(missingMarkup, /<a /, 'missing products do not expose fake or broken document actions');
assert.match(missingMarkup, /Approved datasheet source not yet available/);

const componentSource = fs.readFileSync('src/components/ProductDetail.jsx', 'utf8');
assert.doesNotMatch(componentSource, /preview|demo/i);
assert.match(componentSource, /aria-label=.*documentAction/);
assert.match(componentSource, /download target="_blank"/);

console.log('Product document model, allowlist, download UI, missing-source and shared-document tests passed.');
