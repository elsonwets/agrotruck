import type { BlobStore } from "./accounts";

// Store Blobs en mémoire pour les tests, avec des ETag comme Netlify Blobs.
export function fakeStore(): BlobStore {
  const data = new Map<string, { json: string; etag: string }>();
  let version = 0;
  const write = (key: string, value: unknown) => { data.set(key, { json: JSON.stringify(value), etag: String(++version) }); };
  return {
    async setJSON(key, value) { write(key, value); },
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)!.json) : null; },
    async list({ prefix }) { return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
    async getWithEtag(key) {
      const entry = data.get(key);
      return entry ? { data: JSON.parse(entry.json), etag: entry.etag } : null;
    },
    async setJSONIfMatch(key, value, etag) {
      if (data.get(key)?.etag !== etag) return false;
      write(key, value);
      return true;
    },
  };
}
