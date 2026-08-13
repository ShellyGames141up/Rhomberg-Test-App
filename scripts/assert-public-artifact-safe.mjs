import fs from 'node:fs/promises';
import path from 'node:path';

const PRIVATE_CREDENTIAL_FILENAME = 'RHOMBERG_CONNECT_INITIAL_USER_CREDENTIALS.pdf';
const PRIVATE_CONFIG_FILENAME = 'internal-staff.local.json';
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.md', '.mjs', '.sql', '.txt', '.webmanifest', '.yaml', '.yml']);

const collectFiles = async directory => {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(target));
    else result.push(target);
  }
  return result;
};

const privateIdentityMarkers = async root => {
  const source = path.join(root, 'private', PRIVATE_CONFIG_FILENAME);
  try {
    const roster = JSON.parse(await fs.readFile(source, 'utf8'));
    return (roster.staff || []).flatMap(account => [account.displayName, account.email, account.username])
      .map(value => String(value || '').trim()).filter(value => value.length >= 4);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

export async function assertPublicArtifactSafe(output, { root = process.cwd(), allowDemoAccounts = false } = {}) {
  const files = await collectFiles(output);
  const forbiddenNames = [PRIVATE_CREDENTIAL_FILENAME.toLowerCase(), PRIVATE_CONFIG_FILENAME.toLowerCase()];
  for (const file of files) {
    const relative = path.relative(output, file).replaceAll('\\', '/');
    if (forbiddenNames.some(name => relative.toLowerCase().includes(name))) throw new Error(`Public artifact contains private file: ${relative}`);
  }

  const markers = [
    'OWNER_TO_SUPPLY_',
    'pending_owner_configuration',
    'PRIVATE CONFIGURATION PLACEHOLDERS',
    ...await privateIdentityMarkers(root),
  ];
  if (!allowDemoAccounts) markers.push('Demo123!', 'Sales123!', 'TechnicalDemo123!');
  for (const file of files.filter(item => textExtensions.has(path.extname(item).toLowerCase()))) {
    const source = await fs.readFile(file, 'utf8');
    const marker = markers.find(value => source.toLowerCase().includes(value.toLowerCase()));
    if (marker) throw new Error(`Public artifact ${path.relative(output, file)} contains protected private marker.`);
  }
  return { filesScanned: files.length };
}
