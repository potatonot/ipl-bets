// Simple in-memory cache — persists for the lifetime of the browser tab.
// Data is shown instantly on repeat visits, then silently refreshed in the background.

const cache = {};

export const setCache = (key, data) => {
  cache[key] = { data, ts: Date.now() };
};

export const getCache = (key, maxAgeMs = 60000) => {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data;
};

export const clearCache = (key) => {
  if (key) delete cache[key];
  else Object.keys(cache).forEach((k) => delete cache[k]);
};
