import { useT } from "~/lib/i18n";
import { zoneLabels, type Zone } from "~/shared/zones";

export function ProgressBar({ value, from, to }: { value: number; from: Zone; to: Zone }) {
  const t = useT();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return <div>
    <div role="progressbar" aria-label={t.fleet.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-brand-50">
      <div className="h-full rounded-full bg-harvest-400" style={{ width: `${percent}%` }} />
    </div>
    <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted"><span>{zoneLabels[from]}</span><span>{zoneLabels[to]}</span></div>
  </div>;
}
