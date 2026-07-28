import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, Check, Info, MapPin, Scale, Truck as TruckIcon, UserRound } from "lucide-react";
import { trucks } from "@/data/trucks";
import { findTruckBySlug } from "@/db/queries";
import { truckTypeLabels } from "@/types/truck";
import { TruckGallery } from "@/components/trucks/truck-gallery";
import { TruckStatusBadge } from "@/components/trucks/truck-status-badge";
import { TruckContactActions } from "@/components/trucks/truck-contact-actions";

export function generateStaticParams() { return trucks.map((truck) => ({ slug: truck.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const truck = await findTruckBySlug((await params).slug);
  return { title: truck?.name ?? "Truck não encontrado", description: truck?.description };
}

export default async function TruckDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const truck = await findTruckBySlug((await params).slug);
  if (!truck) notFound();
  return (
    <div className="page-shell pb-28 pt-8 sm:pb-24">
      <Link href="/" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-primary/70 hover:text-primary"><ArrowLeft className="size-4" /> Voltar aos trucks</Link>
      <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <div>
          <TruckGallery images={truck.images} name={truck.name} />
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-3"><TruckStatusBadge status={truck.availability} />{truck.verified && <span className="flex items-center gap-1 text-xs font-semibold text-primary"><BadgeCheck className="size-4" /> Perfil verificado</span>}</div>
            <h1 className="mt-4 font-heading text-4xl font-extrabold tracking-[-.04em] text-foreground md:text-5xl">{truck.name}</h1>
            <p className="mt-4 max-w-3xl font-light leading-7 text-muted-foreground">{truck.description}</p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact icon={<TruckIcon />} label="Tipo" value={truckTypeLabels[truck.type]} />
              <Fact icon={<Scale />} label="Capacidade" value={`${truck.capacityTons} toneladas`} />
              <Fact icon={<MapPin />} label="Localização" value={truck.location} />
            </div>
          </section>
          <section className="mt-10 grid gap-8 border-t border-primary/10 pt-10 md:grid-cols-2">
            <List title="Zonas de serviço" values={truck.serviceAreas} />
            <List title="Mercadorias aceites" values={truck.acceptedMaterials} />
          </section>
          <section className="mt-10 rounded-[20px] border border-warning/35 bg-warning/8 p-6">
            <div className="flex items-center gap-2 text-foreground"><Info className="size-5 text-[#9b7d00]" /><h2 className="font-heading text-xl font-semibold">Antes de carregar</h2></div>
            <p className="mt-3 text-sm font-light leading-6 text-muted-foreground">Confirme o preço, o horário, os acessos e todas as condições diretamente com o proprietário.</p>
            <ul className="mt-4 space-y-2">{truck.restrictions.map((restriction) => <li key={restriction} className="flex gap-2 text-sm text-foreground/75"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{restriction}</li>)}</ul>
          </section>
        </div>
        <aside>
          <div className="sticky top-28 rounded-[20px] border border-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,.07)]">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-danger">Contacto direto</p>
            <div className="mt-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-primary/8">{truck.companyName ? <Building2 className="text-primary" /> : <UserRound className="text-primary" />}</span><div><h2 className="font-heading text-lg font-semibold text-foreground">{truck.companyName ?? truck.ownerName}</h2>{truck.companyName && <p className="text-xs text-muted-foreground">{truck.ownerName}</p>}</div></div>
            <div className="my-6 h-px bg-primary/10" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" />{truck.location}, Guiné-Bissau</p>
            <p className="mt-3 text-xl font-semibold text-foreground">{truck.phone}</p>
            <div className="mt-6"><TruckContactActions truck={truck} /></div>
            <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">A AgroTruck apenas facilita o contacto. Confirme todos os detalhes com o proprietário.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-primary/10 bg-[#f8f8f5] p-4"><span className="block text-primary [&_svg]:size-5">{icon}</span><span className="mt-4 block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-sm font-semibold text-foreground">{value}</strong></div>; }
function List({ title, values }: { title: string; values: string[] }) { return <div><h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2><ul className="mt-4 space-y-2">{values.map((value) => <li key={value} className="flex items-center gap-2 text-sm text-foreground/75"><Check className="size-4 text-primary" />{value}</li>)}</ul></div>; }
