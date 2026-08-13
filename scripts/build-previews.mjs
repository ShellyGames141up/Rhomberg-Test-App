import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildPublicBundle,
  previewIds,
  root,
  stageGitHubPagesPreview,
  stagePreviewVariant,
} from './build-tools.mjs';
import { assertPublicArtifactSafe } from './assert-public-artifact-safe.mjs';

const variantsRoot = path.join(root, 'dist-previews');
if (path.dirname(variantsRoot) !== root || path.basename(variantsRoot) !== 'dist-previews') {
  throw new Error('Refusing to prepare an unexpected preview output path.');
}
await fs.rm(variantsRoot, { recursive: true, force: true });
await fs.mkdir(variantsRoot, { recursive: true });
await buildPublicBundle();
for (const previewId of previewIds) await stagePreviewVariant(previewId);
const githubPagesOutput = await stageGitHubPagesPreview();
await assertPublicArtifactSafe(githubPagesOutput, { root, allowDemoAccounts: true });
for (const previewId of previewIds) await assertPublicArtifactSafe(path.join(variantsRoot, previewId), { root, allowDemoAccounts: true });
console.log(`Built ${previewIds.length} standalone previews and the GitHub Pages artifact.`);
