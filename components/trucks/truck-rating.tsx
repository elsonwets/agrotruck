"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TruckRatings } from "@/types/truck";

type Props = { ratings?: TruckRatings; slug: string; detailed?: boolean; className?: string };
type Scores = { vehicleQuality: number; professionalism: number; reliability: number };

const emptyScores: Scores = { vehicleQuality: 0, professionalism: 0, reliability: 0 };

export function TruckRating({ ratings: baseRatings, slug, detailed = false, className }: Props) {
  const [visitorRatings, setVisitorRatings] = useState<TruckRatings | null>(null);
  const [scores, setScores] = useState<Scores>(emptyScores);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!detailed) return;
    fetch(`/.netlify/functions/reviews?slug=${encodeURIComponent(slug)}`).then((response) => response.ok ? response.json() : null).then(setVisitorRatings).catch(() => undefined);
    const saved = localStorage.getItem(`agrotruck-review:${slug}`);
    if (saved) {
      try { const parsed = JSON.parse(saved) as Scores; queueMicrotask(() => setScores(parsed)); } catch { /* Ignore invalid local data. */ }
    }
  }, [detailed, slug]);

  const ratings = useMemo(() => mergeRatings(baseRatings, visitorRatings), [baseRatings, visitorRatings]);
  if (!detailed) return <CompactRating ratings={ratings} slug={slug} className={className} />;

  const criteria = [
    ["Qualidade do camião", "Estado, limpeza e adequação do veículo", "vehicleQuality"],
    ["Profissionalismo", "Atendimento e clareza na comunicação", "professionalism"],
    ["Fiabilidade", "Pontualidade e respeito pelo combinado", "reliability"],
  ] as const;
  const complete = Object.values(scores).every((score) => score > 0);

  const submit = async () => {
    if (!complete) return;
    setStatus("saving");
    let visitorId = localStorage.getItem("agrotruck-visitor-id");
    if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem("agrotruck-visitor-id", visitorId); }
    try {
      const response = await fetch(`/.netlify/functions/reviews?slug=${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorId, ...scores, website: "" }) });
      if (!response.ok) throw new Error("save failed");
      setVisitorRatings(await response.json());
      localStorage.setItem(`agrotruck-review:${slug}`, JSON.stringify(scores));
      setStatus("saved");
      setOpen(false);
    } catch { setStatus("error"); }
  };

  return <section id="avis" className={cn("scroll-mt-28 rounded-[22px] border border-primary/10 bg-[#f8f8f5] p-5 sm:p-6", className)} aria-labelledby="rating-title">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-danger">Avis clients</p><h2 id="rating-title" className="mt-1 font-heading text-xl font-bold">Expérience de transport</h2><p className="mt-1 text-xs text-muted-foreground">Des évaluations utiles, basées sur des critères concrets.</p></div>
      <div className="flex items-center gap-4"><RatingSummary ratings={ratings} /><Button type="button" size="sm" onClick={() => { setOpen((value) => !value); setStatus("idle"); }}><Star className="size-4" />{scores.vehicleQuality ? "Modifier mon avis" : "Donner mon avis"}</Button></div>
    </div>

    {ratings && <dl className="mt-5 grid gap-3 border-t border-primary/10 pt-5 sm:grid-cols-3">{criteria.map(([label, , key]) => <div key={key} className="rounded-xl bg-white p-3"><dt className="text-xs font-medium text-foreground/70">{label}</dt><dd className="mt-1 flex items-center gap-1 font-heading text-sm font-bold"><Star className="size-3.5 fill-warning text-warning" />{format(ratings[key])}</dd></div>)}</dl>}

    {open && <div className="mt-5 border-t border-primary/10 pt-5"><div className="grid gap-5">{criteria.map(([label, description, key]) => <ScoreRow key={key} label={label} description={description} value={scores[key]} onChange={(value) => setScores((current) => ({ ...current, [key]: value }))} />)}</div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className={cn("text-xs", status === "error" ? "text-danger" : "text-muted-foreground")}>{status === "error" ? "A avaliação não foi guardada. Tente novamente." : "Uma avaliação por visitante; pode alterá-la quando quiser."}</p><Button type="button" disabled={!complete || status === "saving"} onClick={submit}>{status === "saving" ? <><LoaderCircle className="size-4 animate-spin" />A guardar…</> : "Publicar avaliação"}</Button></div></div>}
    {status === "saved" && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 className="size-4" />Avaliação publicada. Obrigado.</p>}
  </section>;
}

function CompactRating({ ratings, slug, className }: { ratings?: TruckRatings; slug: string; className?: string }) {
  return <div className={cn("flex items-center justify-between gap-3", className)}>{ratings ? <div aria-label={`Note ${format(ratings.overall)} sur 5, ${ratings.reviewCount} avis`}><span className="inline-flex items-center gap-1 font-heading text-sm font-bold text-foreground"><Star className="size-4 fill-warning text-warning" />{format(ratings.overall)}</span><span className="ml-2 text-xs text-muted-foreground">{ratings.reviewCount} avis</span></div> : <p className="text-xs font-medium text-muted-foreground">Ainda sem avaliações</p>}<a href={`/trucks/${slug}#avis`} className="focus-ring text-xs font-bold text-primary hover:underline">Donner un avis</a></div>;
}

function RatingSummary({ ratings }: { ratings?: TruckRatings }) {
  return ratings ? <div className="text-right"><span className="inline-flex items-center gap-1 font-heading text-2xl font-extrabold"><Star className="size-5 fill-warning text-warning" />{format(ratings.overall)}</span><p className="text-[11px] text-muted-foreground">{ratings.reviewCount} avis</p></div> : <p className="max-w-24 text-right text-xs text-muted-foreground">Soyez le premier à évaluer</p>;
}

function ScoreRow({ label, description, value, onChange }: { label: string; description: string; value: number; onChange: (value: number) => void }) {
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="text-sm font-bold text-foreground">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><div className="flex gap-1" role="radiogroup" aria-label={label}>{[1,2,3,4,5].map((score) => <button key={score} type="button" role="radio" aria-checked={value === score} aria-label={`${score} sur 5`} onClick={() => onChange(score)} className="focus-ring grid size-9 place-items-center rounded-lg hover:bg-warning/15"><Star className={cn("size-6 transition", score <= value ? "fill-warning text-warning" : "text-primary/20")} /></button>)}</div></div>;
}

function mergeRatings(base?: TruckRatings, visitor?: TruckRatings | null): TruckRatings | undefined {
  if (!base) return visitor ?? undefined;
  if (!visitor) return base;
  const count = base.reviewCount + visitor.reviewCount;
  const weighted = (key: keyof Omit<TruckRatings, "reviewCount">) => (base[key] * base.reviewCount + visitor[key] * visitor.reviewCount) / count;
  return { overall: weighted("overall"), vehicleQuality: weighted("vehicleQuality"), professionalism: weighted("professionalism"), reliability: weighted("reliability"), reviewCount: count };
}

function format(value: number) { return value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
