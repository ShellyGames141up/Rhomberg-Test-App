import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateProductionArtifact } from './check-production-artifact.mjs';

const root = process.cwd();
const output = path.resolve(root, 'dist-production');
const metadataNames = new Set(['CHECKSUMS.sha256', 'VALIDATION.txt', 'release-manifest.json']);

const collectFiles = async directory => {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(target));
    else files.push(target);
  }
  return files;
};

const normalise = value => value.replaceAll('\\', '/');
const sha256 = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const commandOutput = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();
const pnpmVersion = () => process.platform === 'win32'
  ? commandOutput(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm --version'])
  : commandOutput('pnpm', ['--version']);
const buildTimestamp = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

for (const name of metadataNames) await fs.rm(path.join(output, name), { force: true });
const validation = await validateProductionArtifact(output);
const packageMetadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const payloadFiles = (await collectFiles(output))
  .filter(file => !metadataNames.has(path.basename(file)))
  .map(file => ({ file, path: normalise(path.relative(output, file)) }))
  .sort((left, right) => left.path.localeCompare(right.path));

const artifacts = [];
for (const entry of payloadFiles) artifacts.push({ path: entry.path, sha256: await sha256(entry.file) });

const releaseManifest = {
  schemaVersion: 1,
  application: 'Rhomberg Connect',
  applicationVersion: packageMetadata.version,
  sourceCommitSha: commandOutput('git', ['rev-parse', 'HEAD']),
  buildTimestampUtc: buildTimestamp,
  nodeVersion: process.version,
  pnpmVersion: pnpmVersion(),
  buildCommand: 'pnpm run build:production',
  publicRuntimeConfigurationNames: [
    'apiBaseUrl',
    'requestTimeoutMs',
    'environmentName',
    'notificationTransport',
  ],
  previousCompatibleRelease: process.env.RHOMBERG_PREVIOUS_COMPATIBLE_RELEASE || null,
  backendCompatibility: {
    apiBasePath: '/api/v1',
    status: 'not-included',
    note: 'This release contains the static frontend only. A compatible server API must be supplied separately.',
  },
  artifactCount: artifacts.length,
  artifacts,
};

await fs.writeFile(
  path.join(output, 'release-manifest.json'),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  'utf8',
);
await fs.writeFile(
  path.join(output, 'CHECKSUMS.sha256'),
  `${artifacts.map(entry => `${entry.sha256}  ${entry.path}`).join('\n')}\n`,
  'utf8',
);
await fs.writeFile(
  path.join(output, 'VALIDATION.txt'),
  [
    'Rhomberg Connect static staging artifact validation',
    `Generated (UTC): ${buildTimestamp}`,
    `Source commit: ${releaseManifest.sourceCommitSha}`,
    `Application version: ${releaseManifest.applicationVersion}`,
    `Node: ${releaseManifest.nodeVersion}`,
    `pnpm: ${releaseManifest.pnpmVersion}`,
    `Files scanned: ${validation.filesScanned}`,
    `Approved assets: ${validation.assetsApproved}`,
    `Service-worker precache targets: ${validation.precacheTargets}`,
    ...validation.validations.map(item => `PASS: ${item}`),
    'PASS: SHA-256 checksums generated for every release payload file',
    'NOTICE: The backend/API is not included in this static frontend artifact.',
    '',
  ].join('\n'),
  'utf8',
);

await validateProductionArtifact(output);
console.log(`Generated release metadata for ${artifacts.length} static payload files. No deployment ZIP was created.`);
