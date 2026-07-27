import { buildPublicBundle, root } from './build-tools.mjs';

await buildPublicBundle();
console.log(`Built the shared mock-preview bundle in ${root}`);
