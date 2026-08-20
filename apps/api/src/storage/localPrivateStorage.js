import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../security/crypto.js';

export function createLocalPrivateStorage({ root, maxBytes }) {
  return {
    async put({ buffer, originalName, mediaType }) {
      if (!Buffer.isBuffer(buffer) || buffer.length < 1 || buffer.length > maxBytes) {
        const error = new Error(`Documents must contain data and be no larger than ${maxBytes} bytes.`);
        error.code = 'INVALID_DOCUMENT'; error.statusCode = 422; throw error;
      }
      const id = randomUUID();
      const storageKey = `${new Date().getUTCFullYear()}/${id}`;
      const destination = path.resolve(root, storageKey);
      if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Unsafe storage key.');
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, buffer, { flag: 'wx', mode: 0o600 });
      return { id, storageKey, originalName, mediaType, sizeBytes: buffer.length, sha256Hex: sha256(buffer) };
    },
    async remove(storageKey) {
      const destination = path.resolve(root, storageKey);
      if (destination.startsWith(`${path.resolve(root)}${path.sep}`)) await fs.rm(destination, { force: true });
    },
  };
}

export function createMemoryPrivateStorage({ maxBytes = 4 * 1024 * 1024 } = {}) {
  const objects = new Map();
  return {
    _objects: objects,
    async put(input) {
      if (!Buffer.isBuffer(input.buffer) || input.buffer.length < 1 || input.buffer.length > maxBytes) {
        const error = new Error('The document is empty or too large.'); error.code = 'INVALID_DOCUMENT'; error.statusCode = 422; throw error;
      }
      const id = randomUUID(); const storageKey = `memory/${id}`;
      objects.set(storageKey, Buffer.from(input.buffer));
      return { id, storageKey, originalName: input.originalName, mediaType: input.mediaType, sizeBytes: input.buffer.length, sha256Hex: sha256(input.buffer) };
    },
    async remove(key) { objects.delete(key); },
  };
}
