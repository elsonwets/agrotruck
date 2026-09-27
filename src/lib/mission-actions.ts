import type { Id } from "../../convex/_generated/dataModel";
import type { MissionView } from "~/components/missions/parts";
import { transition } from "~/shared/missions";
import type { Role } from "~/shared/domain";
import { getOutbox } from "./outbox-client";

export type QueueableAction = "loaded" | "delivered";
export type Outcome = { status: "sent" | "queued"; mission: MissionView } | { status: "error"; code: string | null };

// « Chargé » / « Livré » : envoyé tout de suite, ou gardé sur le téléphone et appliqué localement
// avec les mêmes règles que le serveur, en attendant le retour du réseau.
export async function performQueueable(
  token: string,
  mission: MissionView,
  action: QueueableAction,
  actor: { userId: Id<"users">; role: Role },
  label: string,
  at = Date.now(),
): Promise<Outcome> {
  const outbox = getOutbox();
  if (!outbox) return { status: "error", code: null };
  const result = await outbox.submit({ kind: action, label, args: { token, missionId: mission._id, action, at } });
  if (result.status === "rejected") return { status: "error", code: result.code };
  if (result.status === "sent") return { status: "sent", mission: result.result as MissionView };
  const local = transition(mission, action, actor, { at });
  return local.ok ? { status: "queued", mission: local.mission } : { status: "error", code: local.error };
}

// Réapplique sur une mission affichée les actions encore en attente sur le téléphone (ex. après un rechargement).
export async function withQueuedActions(mission: MissionView, actor: { userId: Id<"users">; role: Role }): Promise<{ mission: MissionView; pending: number }> {
  const items = ((await getOutbox()?.list()) ?? []).filter((item) => item.kind !== "create" && item.args.missionId === mission._id);
  let current = mission;
  for (const item of items) {
    const local = transition(current, item.kind as QueueableAction, actor, { at: item.args.at as number });
    if (local.ok) current = local.mission;
  }
  return { mission: current, pending: items.length };
}
