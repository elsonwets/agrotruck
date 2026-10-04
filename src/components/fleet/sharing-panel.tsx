import { MapPin, Pause, WifiOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormMessage } from "~/components/ui/form";
import { useT } from "~/lib/i18n";
import { useLocationSharing, type FixPayload } from "~/lib/location-sharing";
import { useNow } from "~/lib/use-now";

// Bouton « Démarrer / Arrêter le partage » et état en clair. Utilisé par le conducteur (lien) et le transporteur particulier.
export function SharingPanel({ send }: { send: (fix: FixPayload) => Promise<unknown> }) {
  const t = useT();
  const sharing = useLocationSharing(send);
  const now = useNow(5_000);
  const active = sharing.state === "waiting" || sharing.state === "sharing";
  const failure = sharing.failure === "link_invalid"
    ? t.fleet.linkInvalid
    : sharing.failure && sharing.failure !== "network" ? t.errors[sharing.failure] ?? t.common.genericError : null;

  return <div className="grid gap-3">
    {active
      ? <Button size="lg" variant="danger" onClick={sharing.stop}>{t.fleet.stop}</Button>
      : <Button size="lg" onClick={sharing.start} disabled={sharing.state === "unsupported"}><MapPin aria-hidden="true" />{t.fleet.start}</Button>}
    <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-ink">
      {sharing.state === "waiting" && t.fleet.waitingFix}
      {sharing.state === "sharing" && sharing.lastSentAt !== null && t.fleet.sent(t.fleet.ago(now - sharing.lastSentAt))}
    </p>
    {active && !sharing.online && <p className="flex items-center gap-2 text-sm text-muted"><WifiOff className="size-4 shrink-0" aria-hidden="true" />{t.fleet.offline}</p>}
    {active && sharing.paused && <p className="flex items-center gap-2 text-sm text-muted"><Pause className="size-4 shrink-0" aria-hidden="true" />{t.fleet.paused}</p>}
    {active && <p className="text-sm text-muted">{t.fleet.keepOpen}</p>}
    {sharing.state === "denied" && <FormMessage>{t.fleet.denied}</FormMessage>}
    {sharing.state === "unsupported" && <FormMessage>{t.fleet.unsupported}</FormMessage>}
    {failure && <FormMessage>{failure}</FormMessage>}
  </div>;
}
