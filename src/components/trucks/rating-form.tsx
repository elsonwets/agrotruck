import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Star } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { FormMessage } from "~/components/ui/form";
import { cn } from "~/lib/cn";
import { errorMessage } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { useToken } from "~/lib/session";

export const criteria = ["vehicleQuality", "professionalism", "reliability"] as const;
type Scores = Record<(typeof criteria)[number], number>;
export type RatingSummary = FunctionReturnType<typeof api.trucks.rate>;

// Avis d'un producteur sur un camion : proposé seulement après un transport livré par ce transporteur.
export function RatingForm({ truckId, title, onRated }: { truckId: Id<"trucks">; title: string; onRated?: (rating: RatingSummary) => void }) {
  const t = useT();
  const token = useToken();
  const mine = useQuery(api.trucks.myReview, { token, truckId });
  if (!mine) return null;
  if (!mine.allowed) return <p className="mt-4 text-sm text-muted">{t.truck.rateOnlyAfterTrip}</p>;
  return <Form truckId={truckId} title={title} initial={mine.review} onRated={onRated} />;
}

function Form({ truckId, title, initial, onRated }: { truckId: Id<"trucks">; title: string; initial: Scores | null; onRated?: (rating: RatingSummary) => void }) {
  const t = useT();
  const token = useToken();
  const rate = useMutation(api.trucks.rate);
  const [scores, setScores] = useState<Scores>(initial ?? { vehicleQuality: 0, professionalism: 0, reliability: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      onRated?.(await rate({ token, truckId, ...scores }));
      setMessage({ ok: true, text: t.truck.rateThanks });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, t) });
    } finally {
      setBusy(false);
    }
  };

  return <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5">
    <p className="font-semibold">{title}</p>
    {criteria.map((key) => (
      <fieldset key={key} className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm text-muted">{t.truck.criteria[key]}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => setScores({ ...scores, [key]: value })} aria-pressed={scores[key] === value} aria-label={`${t.truck.criteria[key]} ${value}/5`}
              className="grid size-10 place-items-center rounded-lg hover:bg-harvest-100">
              <Star className={cn("size-6", value <= scores[key] ? "fill-harvest-400 text-harvest-400" : "text-line")} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
    ))}
    {message && <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>}
    <Button type="submit" disabled={busy || criteria.some((key) => !scores[key])}>{initial ? t.truck.rateUpdate : t.truck.rateSubmit}</Button>
  </form>;
}
