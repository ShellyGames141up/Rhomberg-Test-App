import fs from 'node:fs/promises';
import path from 'node:path';

const rosterPath = path.resolve('private', 'internal-staff.local.json');
const allowedBranches = new Set(['cape-town', 'port-elizabeth', 'johannesburg', 'durban']);

let source;
try {
  source = await fs.readFile(rosterPath, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Private staff roster is not present. Public build remains unaffected.');
    process.exit(0);
  }
  throw error;
}

const roster = JSON.parse(source);
if (!Array.isArray(roster.staff) || !roster.staff.length) throw new Error('Private roster must contain a non-empty staff array.');
const identifiers = new Set();
for (const [index, account] of roster.staff.entries()) {
  const label = `staff[${index}]`;
  for (const field of ['displayName', 'branchId', 'department']) {
    if (!String(account[field] || '').trim()) throw new Error(`${label}.${field} is required.`);
  }
  if (!allowedBranches.has(account.branchId)) throw new Error(`${label}.branchId is not approved.`);
  if (!Array.isArray(account.roles) || !account.roles.length) throw new Error(`${label}.roles must contain at least one role.`);
  const identifier = String(account.email || account.username || '').trim().toLowerCase();
  if (!identifier) throw new Error(`${label} requires an email or username login identifier.`);
  if (identifiers.has(identifier)) throw new Error(`${label} duplicates another login identifier.`);
  identifiers.add(identifier);
  for (const forbidden of ['password', 'passwordHash', 'temporaryPassword', 'secret', 'credential']) {
    if (Object.hasOwn(account, forbidden)) throw new Error(`${label} must not contain ${forbidden}.`);
  }
}

console.log(`Private staff roster validated: ${roster.staff.length} accounts, no credentials stored.`);
