import { ServiceError } from './contracts.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

export function createBrowserStore(storage) {
  let availableStorage = storage;
  if (!availableStorage) {
    try {
      availableStorage = globalThis.localStorage;
    } catch {
      availableStorage = null;
    }
  }
  const engine = availableStorage || new MemoryStorage();

  return {
    get(key, fallback) {
      try {
        const value = engine.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      try {
        engine.setItem(key, JSON.stringify(value));
        return value;
      } catch (cause) {
        throw new ServiceError('This browser could not save the change. Check private-browsing or storage settings and try again.', {
          code: 'BROWSER_STORAGE_UNAVAILABLE',
          status: 503,
          cause,
        });
      }
    },

    remove(key) {
      try {
        engine.removeItem(key);
      } catch (cause) {
        throw new ServiceError('This browser could not complete sign-out. Please close the browser after leaving the preview.', {
          code: 'BROWSER_STORAGE_UNAVAILABLE',
          status: 503,
          cause,
        });
      }
    },

    has(key) {
      try {
        return engine.getItem(key) !== null;
      } catch {
        return false;
      }
    },
  };
}
