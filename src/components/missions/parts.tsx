import { Link } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { buttonClass } from "~/components/ui/button";
import { Badge, Card } from "~/components/ui/card";
import { VehicleIcon } from "~/components/vehicle-icon";
import type { Dict } from "~/i18n";
import { telUrl, whatsappUrl } from "~/lib/cn";
import { useT } from "~/lib/i18n";
import type { MissionStatus } from "~/shared/domain";
import { zoneLabels } from "~/shared/zones";

export type MissionView = NonNullable<FunctionReturnType<typeof api.missions.get>>;

export function missionRoute(mission: Pick<MissionView, "pickupLocation" | "pickupZone" | "dropoffLocation" | "dropoffZone">) {
  return `${mission.pickupLocation} (${zoneLabels[mission.pickupZone]}) → ${mission.dropoffLocation} (${zoneLabels[mission.dropoffZone]})`;
}

export function missionQuantity(mission: Pick<MissionView, "quantitySacks" | "quantityKg">, t: Dict) {
  return [
    mission.quantitySacks ? t.common.sacks(mission.quantitySacks) : null,
    mission.quantityKg ? (mission.quantityKg >= 1000 ? t.common.tonnes(Number((mission.quantityKg / 1000).toFixed(1))) : t.common.kg(mission.quantityKg)) : null,
  ].filter(Boolean).join(" · ");
}

const statusTone: Record<MissionStatus, "harvest" | "brand" | "neutral" | "success" | "danger"> = {
  pending: "harvest", assigned: "brand", loaded: "brand", delivered: "success", cancelled: "danger",
};

export function StatusBadge({ status, perspective = "producer" }: { status: MissionStatus; perspective?: "producer" | "transporter" }) {
  const t = useT();
  return <Badge tone={statusTone[status]}>{(perspective === "transporter" ? t.missionStatusTransporter : t.missionStatus)[status]}</Badge>;
}

export function PendingBadge() {
  const t = useT();
  return <Badge tone="outline">{t.offline.pendingBadge}</Badge>;
}

type CardMission = Pick<MissionView, "status" | "vehicleCategory" | "pickupLocation" | "pickupZone" | "dropoffLocation" | "dropoffZone" | "productType" | "quantitySacks" | "quantityKg" | "neededFrom">;

export function MissionCard({ mission, link, perspective = "producer", pending, children }: {
  mission: CardMission;
  link?: { to: string; params: Record<string, string> };
  perspective?: "producer" | "transporter";
  pending?: boolean;
  children?: React.ReactNode;
}) {
  const t = useT();
  const summary = <>
    <div className="flex items-start justify-between gap-3">
      <p className="font-semibold leading-snug">{missionRoute(mission)}</p>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">{pending && <PendingBadge />}<StatusBadge status={mission.status} perspective={perspective} /></div>
    </div>
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      {mission.vehicleCategory !== "any" && <VehicleIcon category={mission.vehicleCategory} className="size-4 text-brand-700" />}
      <span>{t.products[mission.productType]}{missionQuantity(mission, t) && ` · ${missionQuantity(mission, t)}`}</span>
      <span>· {t.common.day(mission.neededFrom)}</span>
    </p>
  </>;
  return <Card className={pending ? "border-dashed p-5" : "p-5 hover:border-brand-200"}>
    {link ? <Link to={link.to} params={link.params} className="block">{summary}</Link> : summary}
    {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
  </Card>;
}

export function MissionFacts({ mission }: { mission: MissionView }) {
  const t = useT();
  const vehicle = mission.vehicleCategory === "any" ? t.categories.any : t.categories[mission.vehicleCategory].label;
  const facts = [
    [t.producer.product, t.products[mission.productType]],
    [t.producer.quantity, missionQuantity(mission, t) || "—"],
    [t.producer.date, t.common.day(mission.neededFrom)],
    [t.producer.vehicle, vehicle],
  ];
  return <Card className="p-5">
    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      {facts.map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
    </dl>
    {mission.comment && <p className="mt-4 border-t border-line pt-4 text-sm"><span className="text-muted">{t.producer.comment} : </span>{mission.comment}</p>}
  </Card>;
}

export function ContactCard({ title, contact, empty }: { title: string; contact: { name: string; phone?: string } | null; empty: string }) {
  const t = useT();
  return <Card className="p-5">
    <h2 className="font-semibold text-muted">{title}</h2>
    {contact ? <>
      <p className="mt-1 text-lg font-semibold">{contact.name}</p>
      {contact.phone ? <>
        <p className="text-sm text-muted">{contact.phone}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a href={telUrl(contact.phone)} className={buttonClass("secondary")}><Phone aria-hidden="true" />{t.common.call}</a>
          <a href={whatsappUrl(contact.phone, "AgroTrucks")} target="_blank" rel="noreferrer" className={buttonClass("whatsapp")}><MessageCircle aria-hidden="true" />{t.common.whatsapp}</a>
        </div>
      </> : <p className="mt-2 text-sm text-muted">{empty}</p>}
    </> : <p className="mt-2 text-sm text-muted">{empty}</p>}
  </Card>;
}

export function MissionHistory({ events, myId }: { events: MissionView["events"]; myId?: string }) {
  const t = useT();
  return <section className="mt-8">
    <h2 className="text-lg font-semibold">{t.producer.history}</h2>
    <ol className="mt-3 space-y-3 border-l-2 border-brand-100 pl-5">
      {events.map((event, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-white bg-brand-600" aria-hidden="true" />
          <p className="font-semibold">{t.missionEvents[event.type]}{event.userId && event.userId === myId ? ` ${t.producer.byYou}` : ""}</p>
          <p className="text-xs text-muted">{t.common.dateTime(event.at)}{event.comment ? ` · ${event.comment}` : ""}</p>
        </li>
      ))}
    </ol>
  </section>;
}
