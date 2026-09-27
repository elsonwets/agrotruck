import { jsonStore, type BlobStore } from "./accounts";

// Limite les tentatives (connexion, inscription) : indispensable avec des PIN de 4 à 6 chiffres.
export interface AttemptLimit { max: number; windowMinutes: number; lockMinutes: number }
interface AttemptRecord { count: number; since: number; lockedUntil?: number }

const MINUTE = 60_000;

function defaultStore(): BlobStore {
  return jsonStore("agrotruck-rate-limits");
}

export async function isLocked(key: string, store: BlobStore = defaultStore(), now = Date.now()): Promise<boolean> {
  const record = (await store.get(key)) as AttemptRecord | null;
  return Boolean(record?.lockedUntil && record.lockedUntil > now);
}

export async function recordAttempt(key: string, limit: AttemptLimit, store: BlobStore = defaultStore(), now = Date.now()): Promise<void> {
  const previous = (await store.get(key)) as AttemptRecord | null;
  const fresh = !previous || now - previous.since > limit.windowMinutes * MINUTE;
  const count = (fresh ? 0 : previous.count) + 1;
  const record: AttemptRecord = count >= limit.max
    ? { count: 0, since: now, lockedUntil: now + limit.lockMinutes * MINUTE }
    : { count, since: fresh ? now : previous.since };
  await store.setJSON(key, record);
}

export async function clearAttempts(key: string, store: BlobStore = defaultStore()): Promise<void> {
  await store.setJSON(key, { count: 0, since: 0 });
}
