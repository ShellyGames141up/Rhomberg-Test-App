import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltEncoded, hashEncoded] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltEncoded || !hashEncoded) return false;
  const expected = Buffer.from(hashEncoded, 'base64url');
  const actual = await scrypt(String(password), Buffer.from(saltEncoded, 'base64url'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const hashSessionToken = (token, pepper) => sha256(`${pepper}:${token}`);
export function secureHashEquals(value, expectedHex) {
  const actual = Buffer.from(sha256(value), 'hex');
  const expected = Buffer.from(String(expectedHex || ''), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
