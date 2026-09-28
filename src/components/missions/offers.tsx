import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Phone, Star } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, buttonClass } from "~/components/ui/button";
import { Badge, Card } from "~/components/ui/card";
import { Field, FormMessage, Input, Select, Textarea } from "~/components/ui/form";
import { VehicleIcon } from "~/components/vehicle-icon";
import { useCachedQuery } from "~/lib/cached-query";
import { cn, telUrl, whatsappUrl } from "~/lib/cn";
import { errorMessage } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { isOnline } from "~/lib/outbox-client";
import { useSession, useToken } from "~/lib/session";
import type { OfferStatus } from "~/shared/offers";
import type { MissionView } from "./parts";

type Offer = FunctionReturnType<typeof api.offers.forMission>[number];
type TruckSummary = NonNullable<Offer["truck"]>;

const statusTone: Record<OfferStatus, "harvest" | "success" | "neutral" | "danger"> = {
  pending: "harvest", accepted: "success", declined: "neutral", withdrawn: "neutral",
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const t = useT();
  return <Badge tone={statusTone[status]}>{t.offers.status[status]}</Badge>;
}

// Résumé du camion proposé (photo, type, capacité, note), lien vers son annonce publique.
export function TruckLine({ truck }: { truck: TruckSummary | null }) {
  const t = useT();
  const lang = useLang();
  if (!truck) return <p className="text-sm text-muted">{t.offers.noTruck}</p>;
  const body = <>
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-700">
      {truck.photoUrl ? <img src={truck.photoUrl} alt="" loading="lazy" className="size-full object-cover" /> : <VehicleIcon category={truck.category} className="size-7" />}
    </span>
    <span className="min-w-0">
      <span className="block truncate font-semibold text-ink">{truck.name}</span>
      <span className="block text-sm text-muted">{t.categories[truck.category].label} · {t.common.tonnes(truck.capacityTons)}</span>
      {truck.rating && <span className="mt-0.5 flex items-center gap-1 text-sm"><Star className="size-4 fill-harvest-400 text-harvest-400" aria-hidden="true" />{truck.rating.overall.toLocaleString(t.locale)} <span className="text-muted">· {t.truck.ratingCount(truck.rating.count)}</span></span>}
    </span>
  </>;
  return truck.hidden
    ? <div className="flex items-center gap-3">{body}</div>
    : <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="flex items-center gap-3 rounded-xl hover:bg-brand-50">{body}</Link>;
}

// Producteur : offres reçues, et choix d'une seule.
export function OffersPanel({ mission }: { mission: MissionView }) {
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const { data: offers } = useCachedQuery(api.offers.forMission, { token, missionId: mission._id }, `offers:${session?.userId}:${mission._id}`);
  const choose = useMutation(api.offers.choose);
  const [confirming, setConfirming] = useState<Id<"offers"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = offers?.filter((offer) => offer.status === "pending") ?? [];

  const onChoose = async (offerId: Id<"offers">) => {
    if (!isOnline()) { setError(t.common.offlineAction); return; }
    setBusy(true);
    setError(null);
    try { await choose({ token, offerId }); setConfirming(null); }
    catch (reason) { setError(errorMessage(reason, t)); }
    finally { setBusy(false); }
  };

  return <section aria-labelledby="offers-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="offers-title" className="text-lg font-semibold">{t.offers.title}</h2>
      {offers && pending.length > 0 && <span className="text-sm text-muted">{t.offers.count(pending.length)}</span>}
    </div>
    <p className="mt-1 text-sm text-muted">{pending.length ? t.offers.intro : t.offers.none}</p>
    {error && <div className="mt-3"><FormMessage>{error}</FormMessage></div>}
    <div className="mt-4 grid gap-3">
      {offers === undefined && <p className="text-muted">{t.common.loading}</p>}
      {offers?.map((offer) => (
        <Card key={offer._id} className={cn("p-4 sm:p-5", offer.status !== "pending" && "opacity-70")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{offer.transporter?.name}</p>
              <p className="text-sm text-muted">{offer.transporter?.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-800">{t.common.price(offer.price)}</p>
              {offer.status !== "pending" && <OfferStatusBadge status={offer.status} />}
            </div>
          </div>
          <div className="mt-3"><TruckLine truck={offer.truck} /></div>
          {offer.message && <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm">{offer.message}</p>}
          {offer.status === "pending" && <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {offer.transporter?.phone && <>
              <a href={telUrl(offer.transporter.phone)} className={buttonClass("secondary", "md")}><Phone aria-hidden="true" />{t.common.call}</a>
              <a href={whatsappUrl(offer.transporter.phone, "AgroTrucks")} target="_blank" rel="noreferrer" className={buttonClass("whatsapp", "md")}><MessageCircle aria-hidden="true" />{t.common.whatsapp}</a>
            </>}
            {confirming === offer._id
              ? <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2">
                  <Button onClick={() => onChoose(offer._id)} disabled={busy}>{t.offers.confirmChoose(t.common.price(offer.price))}</Button>
                  <Button variant="ghost" onClick={() => setConfirming(null)}>{t.offers.back}</Button>
                </div>
              : <Button onClick={() => setConfirming(offer._id)} disabled={busy}>{t.offers.choose}</Button>}
          </div>}
        </Card>
      ))}
    </div>
  </section>;
}

// Transporteur : envoyer, modifier ou retirer son offre (tant que le producteur n'a pas choisi).
export function OfferForm({ mission }: { mission: MissionView }) {
  const t = useT();
  const token = useToken();
  const trucks = useQuery(api.trucks.mine, { token });
  const send = useMutation(api.offers.send);
  const withdraw = useMutation(api.offers.withdraw);
  const mine = mission.myOffer;
  const editable = !mine || mine.status === "pending" || mine.status === "withdrawn";
  const [price, setPrice] = useState(mine && mine.status !== "withdrawn" ? String(mine.price) : "");
  const [truckId, setTruckId] = useState<string>(mine?.truckId ?? "");
  const [message, setMessage] = useState(mine?.message ?? "");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const usable = (trucks ?? []).filter((truck) => !truck.hidden && (mission.vehicleCategory === "any" || truck.category === mission.vehicleCategory));
  const selectedTruck = truckId || (usable.length === 1 && !mine ? usable[0]!._id : "");

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (!isOnline()) { setFeedback({ ok: false, text: t.common.offlineAction }); return; }
    setBusy(true);
    setFeedback(null);
    try { await action(); setFeedback({ ok: true, text: success }); }
    catch (reason) { setFeedback({ ok: false, text: errorMessage(reason, t) }); }
    finally { setBusy(false); }
  };

  if (mine?.status === "declined") return <Card className="p-5"><p className="font-semibold">{t.offers.yourOffer} : {t.common.price(mine.price)}</p><p className="mt-1 text-muted">{t.offers.declined}</p></Card>;
  if (!editable) return null;

  return <Card className="p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{mine?.status === "pending" ? t.offers.yourOffer : t.offers.makeOffer}</h2>
      {mine && <OfferStatusBadge status={mine.status} />}
    </div>
    <p className="mt-1 text-sm text-muted">{mine?.status === "pending" ? t.offers.waiting : mine?.status === "withdrawn" ? t.offers.withdrawn : t.offers.hint}</p>
    <form className="mt-4 grid gap-4" onSubmit={(event) => {
      event.preventDefault();
      void run(() => send({ token, missionId: mission._id, price: Number(price), truckId: (selectedTruck || undefined) as Id<"trucks"> | undefined, message }), t.offers.sent);
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="offer-price" label={t.offers.price}>
          <Input id="offer-price" type="number" inputMode="numeric" min="1" step="1" placeholder={t.offers.pricePlaceholder} value={price} onChange={(event) => setPrice(event.target.value)} required />
        </Field>
        <Field id="offer-truck" label={t.offers.truck}>
          <Select id="offer-truck" value={selectedTruck} onChange={(event) => setTruckId(event.target.value)}>
            <option value="">{t.offers.anyTruck}</option>
            {usable.map((truck) => <option key={truck._id} value={truck._id}>{truck.name} · {t.common.tonnes(truck.capacityTons)}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="offer-message" label={t.offers.message}><Textarea id="offer-message" rows={2} maxLength={300} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
      {feedback && <FormMessage tone={feedback.ok ? "success" : "error"}>{feedback.text}</FormMessage>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" size="lg" disabled={busy}>{busy ? t.offers.sending : mine?.status === "pending" ? t.offers.update : t.offers.send}</Button>
        {mine?.status === "pending" && <Button variant="ghost" size="lg" disabled={busy} onClick={() => void run(() => withdraw({ token, missionId: mission._id }), t.offers.withdrawn)}>{t.offers.withdraw}</Button>}
      </div>
    </form>
  </Card>;
}
