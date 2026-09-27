import { getOutbox } from "./outbox";
import { missionRoute, transition, type Actor } from "./missions";
import type { MissionView } from "../types/order";

export type QueueableAction = "loaded" | "delivered";
export type ActionOutcome =
  | { status: "sent"; order: MissionView }
  | { status: "queued"; order: MissionView }
  | { status: "error"; message: string };

const actionUrl = (id: string, action: string) => `/.netlify/functions/orders?id=${encodeURIComponent(id)}&action=${action}`;

// « Chargé » / « Livré » : envoyé tout de suite, ou gardé sur le téléphone et appliqué localement
// avec les mêmes règles que le serveur, en attendant le retour du réseau.
export async function performQueueableAction(order: MissionView, action: QueueableAction, actor: Actor, at?: string): Promise<ActionOutcome> {
  const body = { at: at ?? new Date().toISOString() }; // l'heure réelle de l'action, même envoyée plus tard
  const result = await getOutbox().submit({
    url: actionUrl(order.id, action), body, kind: action,
    label: `${action === "loaded" ? "Chargé" : "Livré"} (${missionRoute(order)})`,
  });
  if (result.status === "queued") {
    const local = transition(order, action, actor, { at: body.at });
    return local.ok ? { status: "queued", order: { ...order, ...local.order } } : { status: "error", message: local.error };
  }
  const data = (await result.response.json().catch(() => ({}))) as MissionView & { error?: string };
  return result.response.ok ? { status: "sent", order: data } : { status: "error", message: data.error ?? "Action impossible pour le moment." };
}

// Action en ligne uniquement (accepter, annuler) : message clair si le téléphone est hors ligne.
export async function performOnlineAction(order: Pick<MissionView, "id">, action: "accept" | "cancel", label: string): Promise<ActionOutcome> {
  if (!navigator.onLine) return { status: "error", message: `Connexion nécessaire pour ${label}.` };
  try {
    const response = await fetch(actionUrl(order.id, action), { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as MissionView & { error?: string };
    return response.ok ? { status: "sent", order: data } : { status: "error", message: data.error ?? "Action impossible pour le moment." };
  } catch {
    return { status: "error", message: `Connexion nécessaire pour ${label}.` };
  }
}

// Réapplique sur une mission affichée les actions encore en attente sur le téléphone (ex. après un rechargement).
export async function withQueuedActions(order: MissionView, actor: Actor): Promise<{ order: MissionView; pending: number }> {
  const items = (await getOutbox().list()).filter((item) => item.url.startsWith(actionUrl(order.id, "")));
  let current = order;
  for (const item of items) {
    const local = transition(current, item.kind as QueueableAction, actor, { at: (item.body as { at?: string }).at });
    if (local.ok) current = { ...current, ...local.order };
  }
  return { order: current, pending: items.length };
}
