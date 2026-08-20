import { CATALOGUE_ASSET_MANIFEST, PUBLIC_CATALOGUE_PDFS } from './catalogue-assets.mjs';

export { CATALOGUE_ASSET_MANIFEST, PUBLIC_CATALOGUE_PDFS };

const BRAND_ASSETS = [
  'assets/images/favicon.ico',
  'assets/images/rhomberg-connect-icon-192.png',
  'assets/images/rhomberg-connect-icon-512.png',
  'assets/images/rhomberg-connect-logo-compact.png',
  'assets/images/rhomberg-connect-logo-full-dark.png',
  'assets/images/rhomberg-connect-logo-loading.png',
  'assets/images/rhomberg-connect-logo-splash.png',
  'assets/images/rhomberg-connect-symbol.png',
  'assets/images/rhomberg-gauge-mark.svg',
  'assets/images/rhomberg-wordmark-transparent.png',
];

export const EXCLUDED_NON_CATALOGUE_ASSETS = Object.freeze([
  ['assets/images/rhomberg-connect-icon-64.png', 'Unused legacy icon size.'],
  ['assets/images/rhomberg-connect-logo-email.png', 'Email-only artwork is not referenced by the staging application.'],
  ['assets/images/rhomberg-connect-logo-full-light.png', 'Unused duplicate of the master transparent logo.'],
  ['assets/images/rhomberg-connect-logo-master-transparent.png', 'Unused duplicate of the full-light logo.'],
  ['assets/images/rhomberg-connect-logo-monochrome.png', 'Unused brand variant.'],
].map(([assetPath, reason]) => Object.freeze({ path: assetPath, reason })));

export const PRODUCTION_ASSETS = Object.freeze([
  ...CATALOGUE_ASSET_MANIFEST.map(item => item.path),
  ...BRAND_ASSETS,
].sort());

export const PRODUCTION_ROOT_FILES = Object.freeze([
  'app.js',
  'index.html',
  'manifest.webmanifest',
  'runtime-config.js',
  'styles.css',
  'sw.js',
  'web.config',
]);

export const PRODUCTION_PRECACHE_FILES = Object.freeze([
  './',
  './index.html',
  './styles.css',
  './runtime-config.js',
  './app.js',
  './manifest.webmanifest',
  './assets/images/rhomberg-connect-logo-full-dark.png',
  './assets/images/rhomberg-connect-logo-compact.png',
  './assets/images/rhomberg-connect-logo-splash.png',
  './assets/images/rhomberg-connect-logo-loading.png',
  './assets/images/rhomberg-connect-symbol.png',
  './assets/images/rhomberg-connect-icon-192.png',
  './assets/images/rhomberg-connect-icon-512.png',
  './assets/images/rhomberg-gauge-mark.svg',
  './assets/images/rhomberg-wordmark-transparent.png',
]);
