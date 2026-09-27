import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createOutbox, indexedDbStorage, memoryStorage, OutboxRejected, type OutboxItem } from "~/shared/outbox";
import { errorCode } from "./errors";

// File d'attente du navigateur, branchée sur le client Convex (créé par le routeur).

export const OUTBOX_EVENT = "agrotrucks:outbox";
const SEND_TIMEOUT = 10_000; // au-delà, la connexion est jugée perdue et l'action part en file

let convex: ConvexReactClient | null = null;
let outbox: ReturnType<typeof createOutbox> | null = null;

export function setConvexClient(client: ConvexReactClient) {
  convex = client;
}

export function isOnline(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  return convex?.connectionState().isWebSocketConnected ?? true;
}

async function send(item: Pick<OutboxItem, "kind" | "args">): Promise<unknown> {
  if (!convex) throw new Error("Convex client not ready");
  const call = item.kind === "create"
    ? convex.mutation(api.missions.create, item.args as never)
    : convex.mutation(api.missions.act, item.args as never);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), SEND_TIMEOUT); });
  try {
    return await Promise.race([call, timeout]);
  } catch (error) {
    const code = errorCode(error);
    if (code) throw new OutboxRejected(code); // refus métier : ne pas rejouer
    throw error; // réseau
  } finally {
    clearTimeout(timer);
  }
}

export function getOutbox() {
  if (typeof window === "undefined") return null;
  outbox ??= createOutbox(
    typeof indexedDB === "undefined" ? memoryStorage() : indexedDbStorage(),
    send,
    isOnline,
    () => window.dispatchEvent(new Event(OUTBOX_EVENT)),
  );
  return outbox;
}

export type MissionQueueAction = { missionId: Id<"missions">; action: "loaded" | "delivered"; at: number };
