import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Building2, CheckCircle2, Clock3, MapPin, Scale, Truck } from "lucide-react";
import { reviewTruckPublication } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { requireDatabase } from "@/db";
import { trucks, users } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Validação dos trucks" };
export const dynamic = "force-dynamic";

export default async function AdminTrucksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/devenir-partenaire");
  if (!isAdminEmail(session.user.email)) notFound();
  const pending = await requireDatabase().select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).where(eq(trucks.publicationStatus, "pending_payment")).orderBy(desc(trucks.createdAt));
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-10"><div className="page-shell"><p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Administração</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-heading text-4xl font-extrabold tracking-[-.04em] md:text-5xl">Pagamentos e publicações</h1><p className="mt-3 text-sm font-light text-muted-foreground">Confirme o pagamento antes de rendre un truck visible ao público.</p></div><span className="rounded-full bg-warning/20 px-4 py-2 text-sm font-bold text-[#705d00]">{pending.length} em espera</span></div>
    {pending.length ? <div className="mt-9 space-y-4">{pending.map(({ truck, owner }) => <article key={truck.id} className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_10px_35px_rgba(11,61,46,.06)] md:p-6"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold text-[#796300]"><Clock3 className="size-3.5"/>Pagamento pendente</span><span className="text-xs text-muted-foreground">{owner.accountType === "company" ? "Empresa · 1 000 000 FCFA" : "Particular · 50 000 FCFA"}</span></div><h2 className="mt-3 font-heading text-xl font-bold md:text-2xl">{truck.name}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="size-4 text-primary"/>{owner.companyName ?? owner.name} · {owner.email}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70"><span className="flex items-center gap-1.5"><Truck className="size-4 text-primary"/>{truck.registration}</span><span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary"/>{truck.location}</span><span className="flex items-center gap-1.5"><Scale className="size-4 text-primary"/>{truck.capacityTons} t</span></div></div><div className="grid grid-cols-2 gap-2 lg:w-72"><form action={reviewTruckPublication}><input type="hidden" name="truckId" value={truck.id}/><input type="hidden" name="decision" value="reject"/><Button type="submit" variant="secondary" className="w-full">Recusar</Button></form><form action={reviewTruckPublication}><input type="hidden" name="truckId" value={truck.id}/><input type="hidden" name="decision" value="publish"/><Button type="submit" className="w-full"><CheckCircle2 className="size-4"/>Pagamento confirmado</Button></form></div></div></article>)}</div> : <div className="mt-10 rounded-[20px] border border-dashed border-primary/20 bg-white px-6 py-16 text-center"><CheckCircle2 className="mx-auto size-10 text-primary"/><h2 className="mt-4 font-heading text-xl font-bold">Nenhum truck em espera</h2><p className="mt-2 text-sm text-muted-foreground">Todos os pedidos foram tratados.</p></div>}
  </div></main>;
}
