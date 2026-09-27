// File d'attente hors ligne : une action (publier une demande, « chargé », « livré ») part tout de suite si le réseau
// répond, sinon elle est gardée sur le téléphone (IndexedDB) et rejouée dans l'ordre au retour de la connexion.
// « Accepter » et « Annuler » n'y passent jamais : il faut être en ligne pour ne pas promettre une mission déjà prise.

export type OutboxKind = "create" | "loaded" | "delivered";

export interface OutboxItem {
  id: string;
  url: string;
  body: unknown;
  kind: OutboxKind;
  label: string;
  queuedAt: string;
}

export interface OutboxStorage {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type SubmitResult = { status: "sent"; response: Response } | { status: "queued"; item: OutboxItem };
export interface FlushReport { sent: OutboxItem[]; rejected: { item: OutboxItem; error: string }[]; remaining: number }

export function createOutbox(storage: OutboxStorage, fetcher: Fetcher, isOnline: () => boolean, onChange: () => void = () => undefined) {
  const send = (item: Pick<OutboxItem, "url" | "body">) =>
    fetcher(item.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.body) });
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
        return { status: "sent", response: await send(input) };
      } catch {
        return queue(input); // réseau coupé en cours de route
      }
    },

    // Rejoue la file dans l'ordre. Réseau coupé ou erreur serveur (5xx) : on s'arrête et on garde la suite.
    // Refus du serveur (4xx, ex. mission déjà livrée) : l'action est retirée et signalée.
    flush(): Promise<FlushReport> {
      flushing ??= (async () => {
        const report: FlushReport = { sent: [], rejected: [], remaining: 0 };
        const items = await sorted();
        if (!isOnline()) return { ...report, remaining: items.length };
        for (const [index, item] of items.entries()) {
          let response: Response;
          try { response = await send(item); } catch { report.remaining = items.length - index; break; }
          if (response.status >= 500) { report.remaining = items.length - index; break; }
          await storage.remove(item.id);
          if (response.ok) report.sent.push(item);
          else report.rejected.push({ item, error: ((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Action refusée" });
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

function indexedDbStorage(): OutboxStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("agrotruck", 1);
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

export const OUTBOX_EVENT = "agrotruck:outbox";

let browserOutbox: ReturnType<typeof createOutbox> | null = null;

// File du navigateur (IndexedDB). Chaque changement émet OUTBOX_EVENT pour mettre l'écran à jour.
export function getOutbox() {
  browserOutbox ??= createOutbox(
    typeof indexedDB === "undefined" ? memoryStorage() : indexedDbStorage(),
    (url, init) => fetch(url, init),
    () => navigator.onLine,
    () => window.dispatchEvent(new Event(OUTBOX_EVENT)),
  );
  return browserOutbox;
}
