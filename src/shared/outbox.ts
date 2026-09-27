// File d'attente hors ligne : une action (publier une demande, « chargé », « livré ») part tout de suite si Convex
// est joignable, sinon elle est gardée sur le téléphone (IndexedDB) et rejouée dans l'ordre au retour du réseau.
// « Accepter » et « Annuler » n'y passent jamais : il faut être en ligne pour ne pas promettre une mission déjà prise.

export type OutboxKind = "create" | "loaded" | "delivered";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  label: string;
  args: Record<string, unknown>;
  queuedAt: string;
}

export interface OutboxStorage {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

// Refus du serveur (règle métier) : l'action est retirée de la file et signalée, jamais rejouée.
export class OutboxRejected extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

// Envoie une action ; lève OutboxRejected pour un refus, toute autre erreur = réseau indisponible.
export type Sender = (item: Pick<OutboxItem, "kind" | "args">) => Promise<unknown>;
export type SubmitResult = { status: "sent"; result: unknown } | { status: "queued"; item: OutboxItem } | { status: "rejected"; code: string };
export interface FlushReport { sent: OutboxItem[]; rejected: { item: OutboxItem; code: string }[]; remaining: number }

export function createOutbox(storage: OutboxStorage, send: Sender, isOnline: () => boolean, onChange: () => void = () => undefined) {
  const sorted = async () => (await storage.all()).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  let flushing: Promise<FlushReport> | null = null;

  async function queue(input: Omit<OutboxItem, "id" | "queuedAt">): Promise<SubmitResult> {
    const item: OutboxItem = { ...input, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
    await storage.put(item);
    onChange();
    return { status: "queued", item };
  }

  return {
    list: sorted,

    async submit(input: Omit<OutboxItem, "id" | "queuedAt">): Promise<SubmitResult> {
      if (!isOnline()) return queue(input);
      try {
        return { status: "sent", result: await send(input) };
      } catch (error) {
        if (error instanceof OutboxRejected) return { status: "rejected", code: error.code };
        return queue(input); // réseau coupé en cours de route
      }
    },

    // Rejoue la file dans l'ordre. Réseau coupé : on s'arrête et on garde la suite. Refus : retiré et signalé.
    flush(): Promise<FlushReport> {
      flushing ??= (async () => {
        const report: FlushReport = { sent: [], rejected: [], remaining: 0 };
        const items = await sorted();
        if (!isOnline()) return { ...report, remaining: items.length };
        for (const [index, item] of items.entries()) {
          try {
            await send(item);
            report.sent.push(item);
          } catch (error) {
            if (!(error instanceof OutboxRejected)) { report.remaining = items.length - index; break; }
            report.rejected.push({ item, code: error.code });
          }
          await storage.remove(item.id);
        }
        if (report.sent.length || report.rejected.length) onChange();
        return report;
      })().finally(() => { flushing = null; });
      return flushing;
    },

    async clear() { await storage.clear(); onChange(); },
  };
}

export function memoryStorage(): OutboxStorage {
  const items = new Map<string, OutboxItem>();
  return {
    async all() { return [...items.values()]; },
    async put(item) { items.set(item.id, item); },
    async remove(id) { items.delete(id); },
    async clear() { items.clear(); },
  };
}

export function indexedDbStorage(): OutboxStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("agrotrucks", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("outbox", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction("outbox", mode).objectStore("outbox"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  };
  return {
    all: () => run("readonly", (store) => store.getAll() as IDBRequest<OutboxItem[]>),
    put: async (item) => { await run("readwrite", (store) => store.put(item)); },
    remove: async (id) => { await run("readwrite", (store) => store.delete(id)); },
    clear: async () => { await run("readwrite", (store) => store.clear()); },
  };
}
