import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { vehicleCategoryLabels } from "@/data/vehicle-categories";
import { formatDay, missionQuantity, missionRoute } from "@/lib/missions";
import { cn, whatsappUrl } from "@/lib/utils";
import { productTypeLabels, type Order, type OrderEvent } from "@/types/order";
import { MissionStatusBadge } from "./mission-status-badge";

type Perspective = "producer" | "transporter";

export function MissionCard({ order, href, perspective, children }: { order: Order; href: string; perspective: Perspective; children?: React.ReactNode }) {
  return <div className="rounded-2xl border border-primary/10 bg-white p-5 transition hover:border-primary/30">
    <Link href={href} className="focus-ring block">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{missionRoute(order)}</p>
        <MissionStatusBadge status={order.status} perspective={perspective} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.productType ? productTypeLabels[order.productType] : order.cargoDescription}{missionQuantity(order) && ` · ${missionQuantity(order)}`} · le {formatDay(order.neededFrom)}
      </p>
    </Link>
    {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
  </div>;
}

export function MissionFacts({ order }: { order: Order }) {
  const vehicle = order.vehicleCategory === "any" ? "Peu importe" : order.vehicleCategory ? vehicleCategoryLabels[order.vehicleCategory] : "—";
  return <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-primary/10 bg-white p-5 text-sm sm:grid-cols-4">
    <Fact label="Produit" value={order.productType ? productTypeLabels[order.productType] : "—"} />
    <Fact label="Quantité" value={missionQuantity(order) || "—"} />
    <Fact label="Date souhaitée" value={formatDay(order.neededFrom)} />
    <Fact label="Véhicule" value={vehicle} />
    {order.cargoDescription && <div className="col-span-full"><dt className="text-xs text-muted-foreground">Commentaire</dt><dd className="mt-1">{order.cargoDescription}</dd></div>}
  </dl>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

export function ContactCard({ title, name, phone, empty }: { title: string; name?: string; phone?: string; empty: string }) {
  return <section className="rounded-2xl border border-primary/10 bg-white p-5">
    <h2 className="font-heading text-lg font-semibold">{title}</h2>
    {name ? <>
      <p className="mt-2 font-semibold">{name}</p>
      {phone && <>
        <p className="text-sm text-muted-foreground">{phone}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="secondary"><a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" />Appeler</a></Button>
          <Button asChild variant="whatsapp"><a href={whatsappUrl(phone, "Bonjour, je vous contacte pour le transport AgroTrucks.")} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />WhatsApp</a></Button>
        </div>
      </>}
    </> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}
  </section>;
}

const eventLabels: Record<OrderEvent["type"], string> = {
  created: "Demande créée", assigned: "Transporteur assigné", loaded: "Chargé", delivered: "Livré", cancelled: "Demande annulée",
};

export function MissionHistory({ events = [], myId }: { events?: OrderEvent[]; myId?: string }) {
  return <section className="mt-8">
    <h2 className="font-heading text-lg font-semibold">Historique</h2>
    <ol className="mt-3 space-y-3 border-l-2 border-primary/15 pl-4">
      {events.map((event, index) => (
        <li key={index} className="text-sm">
          <p className="font-semibold">{eventLabels[event.type]}{event.accountId && event.accountId === myId ? " (par vous)" : ""}</p>
          <p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}{event.comment ? ` · ${event.comment}` : ""}</p>
        </li>
      ))}
    </ol>
  </section>;
}

export function FilterTabs<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer">
    {options.map(([option, label]) => (
      <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={cn("focus-ring min-h-10 rounded-full border px-4 text-sm font-semibold transition", value === option ? "border-primary bg-primary text-white" : "border-primary/15 bg-white text-primary hover:border-primary/30")}>{label}</button>
    ))}
  </div>;
}
