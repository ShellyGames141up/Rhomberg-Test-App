import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/AdministratorDashboard.jsx', 'utf8');

assert.match(
  source,
  /\{canEdit && user\.id !== account\.id && <button[^>]+onClick=\{\(\) => onReset\(user\)\}>Reset login<\/button>\}/,
  'administrators must be able to reset both customer and employee login credentials',
);
assert.doesNotMatch(
  source,
  /\{internal && canEdit && user\.id !== account\.id && <button[^>]+onClick=\{\(\) => onReset\(user\)\}>Reset login<\/button>\}/,
  'customer credential recovery must not be hidden behind the internal-employee directory gate',
);
assert.match(source, /dialog\.target\?\.category === 'customer' \? 'Edit customer account'/);
assert.match(source, /account holder must change it at first login/);

console.log('Customer and employee secure login-reset UI coverage passed.');
