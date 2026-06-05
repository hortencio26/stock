// Memory fallback cache in case localStorage is blocked in cross-origin iframes (e.g. Chrome 3rd party cookie options)
const memoryStore: Record<string, string> = {};

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Fallback to memory. Error reading key "${key}":`, e);
      return memoryStore[key] !== undefined ? memoryStore[key] : null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[safeStorage] Fallback to memory. Error writing key "${key}":`, e);
      memoryStore[key] = String(value);
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Fallback to memory. Error removing key "${key}":`, e);
      delete memoryStore[key];
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("[safeStorage] Fallback to memory. Error clearing storage:", e);
      for (const key in memoryStore) {
        delete memoryStore[key];
      }
    }
  }
};
