import fs from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('private', 'internal-staff.local.json');
const outputDirectory = path.resolve('docs', 'private');
const outputPath = path.join(outputDirectory, 'INTERNAL_USER_ACCOUNT_MATRIX.md');
const protectedKeys = ['password', 'passwordHash', 'temporaryPassword', 'secret', 'credential'];

const escapeCell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ').trim();
const readable = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
if (!Array.isArray(source.staff) || !source.staff.length) throw new Error('Validate a non-empty private staff roster before generating the matrix.');

const rows = source.staff.map((account, index) => {
  for (const key of protectedKeys) {
    if (Object.hasOwn(account, key)) throw new Error(`staff[${index}] contains prohibited credential data.`);
  }
  const identifier = account.email || account.username;
  if (!account.displayName || !identifier || !account.branchId || !Array.isArray(account.roles) || !account.roles.length) {
    throw new Error(`staff[${index}] is missing a required matrix field.`);
  }
  return [
    account.displayName,
    identifier,
    readable(account.branchId),
    account.roles.map(readable).join(', '),
    account.roles.map(readable).join(', '),
    account.activationStatus || 'Pending IT activation review',
  ].map(escapeCell);
});

const document = [
  '# Internal User Account Matrix',
  '',
  '> PRIVATE — RHOMBERG AND AUTHORISED IT REVIEW ONLY. Never commit or deploy this file.',
  '',
  '| User name | Login email / username | Branch | Role(s) | Workspace | Account activation status |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.join(' | ')} |`),
  '',
  'Passwords, password hashes, recovery codes and temporary credentials are prohibited from this matrix.',
  '',
].join('\n');

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(outputPath, document, { encoding: 'utf8', mode: 0o600 });
console.log(`Generated private account matrix for ${rows.length} accounts. No credentials were included.`);
