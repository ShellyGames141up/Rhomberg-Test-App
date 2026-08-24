// The API owns the approved catalogue source. The browser imports this same
// public dataset at build time so preview and server-backed modes cannot drift.
export * from '../../apps/api/src/data/catalogue.js';
