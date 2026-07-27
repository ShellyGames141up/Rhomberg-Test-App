import { buildPublicBundle, previewIds, stagePreviewVariant } from './build-tools.mjs';

const previewId = process.argv[2];
if (!previewIds.includes(previewId)) {
  throw new Error(`Choose one preview: ${previewIds.join(', ')}`);
}
await buildPublicBundle();
const output = await stagePreviewVariant(previewId);
console.log(`Built ${previewId} in ${output}`);
