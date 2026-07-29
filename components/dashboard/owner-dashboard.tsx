"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, CircleGauge, Clock3, HardHat, Phone, Plus, Route, ShieldCheck, Truck as TruckIcon, UsersRound } from "lucide-react";
import { setTruckOnline, updateTruckAvailability, updateTruckCrew } from "@/app/actions/partners";
import type { OwnerTruck, TruckAvailability } from "@/types/truck";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TruckStatusBadge } from "@/components/trucks/truck-status-badge";

export function OwnerDashboard({ initialTrucks, isCompany }: { initialTrucks: OwnerTruck[]; isCompany: boolean }) {
  const [fleet, setFleet] = useState(initialTrucks);
  const [notice, setNotice] = useState("");
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [pending, startTransition] = useTransition();
  const online = fleet.filter((truck) => truck.isOnline).length;
  const inTransit = fleet.filter((truck) => truck.isOnline && truck.availability === "in_transit").length;

  function changeAvailability(id: string, availability: TruckAvailability) {
    const previous = fleet.find((truck) => truck.id === id)?.availability;
    if (!previous) return;
    setFleet((current) => current.map((truck) => truck.id === id ? { ...truck, availability } : truck));
    startTransition(async () => {
      const result = await updateTruckAvailability(id, availability);
      if (!result.success) {
        setFleet((current) => current.map((truck) => truck.id === id ? { ...truck, availability: previous } : truck));
        setNotice(result.error);
      } else setNotice("Estado atualizado.");
    });
  }

  function putOnline(truck: OwnerTruck) {
    if (truck.publicationStatus !== "published") {
      setApprovalDialog(true);
      return;
    }
    startTransition(async () => {
      const result = await setTruckOnline(truck.id);
      if (!result.success) { setNotice(result.error); return; }
      setFleet((current) => current.map((item) => item.id === truck.id ? { ...item, isOnline: true, availability: "available" } : item));
      setNotice("Truck colocado online e visível para os clientes.");
    });
  }

  return <div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={<TruckIcon/>} value={fleet.length} label="Trucks cadastrados" />
      <Metric icon={<CircleGauge/>} value={online} label="Online" />
      <Metric icon={<Route/>} value={inTransit} label="Em trânsito" />
    </div>

    <section className="mt-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-danger">A sua frota</p><h2 className="mt-2 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">Controle claro, ação imediata.</h2></div>
        <Button asChild><Link href="/devenir-partenaire"><Plus className="size-4"/>Adicionar truck</Link></Button>
      </div>
      {notice && <p role="status" className="mt-4 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm text-primary">{notice}</p>}
      {fleet.length ? <div className="mt-6 grid gap-4 xl:grid-cols-2">{fleet.map((truck)=><TruckManagementCard key={truck.id} truck={truck} isCompany={isCompany} pending={pending} onOnline={()=>putOnline(truck)} onAvailability={(status)=>changeAvailability(truck.id,status)} onCrewUpdated={(crew)=>setFleet((current)=>current.map((item)=>item.id===truck.id?{...item,...crew}:item))}/>)}</div> : <EmptyFleet/>}
    </section>

    <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}><DialogContent><span className="grid size-12 place-items-center rounded-full bg-warning/20 text-primary"><Clock3 className="size-6"/></span><DialogHeader className="mt-5"><DialogTitle>Validação necessária</DialogTitle><DialogDescription>Este truck está bem registado, mas a equipa AgroTruck deve confirmar o pagamento e validar os dados antes da primeira publicação. Depois da validação, este mesmo botão ficará disponível.</DialogDescription></DialogHeader><div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/[.04] p-4 text-sm text-primary"><ShieldCheck className="size-5 shrink-0"/>A validação protege proprietários e clientes.</div><Button className="mt-6 w-full" onClick={()=>setApprovalDialog(false)}>Compreendi</Button></DialogContent></Dialog>
  </div>;
}

function TruckManagementCard({ truck, isCompany, pending, onOnline, onAvailability, onCrewUpdated }: { truck: OwnerTruck; isCompany: boolean; pending: boolean; onOnline: ()=>void; onAvailability: (status: TruckAvailability)=>void; onCrewUpdated: (crew: CrewValues)=>void }) {
  const action = !truck.isOnline ? { label: "Colocar online", icon: <Check className="size-4"/>, run: onOnline } : truck.availability === "in_transit" || truck.availability === "maintenance" ? { label: "Marcar disponível", icon: <Check className="size-4"/>, run: ()=>onAvailability("available") } : { label: "Em trânsito", icon: <Route className="size-4"/>, run: ()=>onAvailability("in_transit") };
  return <article className="overflow-hidden rounded-[24px] border border-primary/10 bg-white shadow-[0_18px_55px_rgba(11,61,46,.06)]">
    <div className="relative aspect-[16/8] bg-primary/5"><Image src={truck.images[0]} alt={truck.name} fill sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover"/><div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent"/><div className="absolute bottom-4 left-4 flex flex-wrap gap-2"><PublicationBadge status={truck.publicationStatus}/>{truck.isOnline&&<TruckStatusBadge status={truck.availability}/>}</div></div>
    <div className="p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="font-heading text-xl font-bold tracking-[-.02em]">{truck.name}</h3><p className="mt-1 text-sm font-light text-muted-foreground">{truck.location} · {truck.capacityTons} t · {truck.registration}</p></div><span className={`mt-1 size-2.5 shrink-0 rounded-full ${truck.isOnline?"bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.12)]":"bg-slate-300"}`} aria-label={truck.isOnline?"Online":"Fora de linha"}/></div>
      {isCompany&&<CrewSummary truck={truck} onUpdated={onCrewUpdated}/>}
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button onClick={action.run} disabled={pending}>{action.icon}{action.label}</Button><Button variant="secondary" onClick={()=>onAvailability("maintenance")} disabled={pending||!truck.isOnline}><HardHat className="size-4"/>Manutenção</Button></div>
    </div>
  </article>;
}

type CrewValues = { driverName?: string; driverPhone?: string; apprenticeName?: string; apprenticePhone?: string };
function CrewSummary({ truck, onUpdated }: { truck: OwnerTruck; onUpdated: (crew: CrewValues)=>void }) {
  const [open,setOpen]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [crew,setCrew]=useState({driverName:truck.driverName??"",driverPhone:truck.driverPhone??"",apprenticeName:truck.apprenticeName??"",apprenticePhone:truck.apprenticePhone??""});
  async function save(event:React.FormEvent){event.preventDefault();setSaving(true);setError("");const result=await updateTruckCrew({truckId:truck.id,...crew});setSaving(false);if(!result.success){setError(result.error);return;}onUpdated(crew);setOpen(false)}
  return <div className="mt-5 rounded-2xl bg-[#f6f7f3] p-4"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary"><UsersRound className="size-4"/></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{truck.driverName||"Equipa não atribuída"}</p>{truck.driverPhone&&<a href={`tel:${truck.driverPhone}`} className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Phone className="size-3"/>{truck.driverPhone}</a>}</div></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button className="focus-ring shrink-0 text-xs font-bold text-primary hover:underline">Gerir equipa</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Atribuir motorista e ajudante</DialogTitle><DialogDescription>Mantenha os contactos atualizados para localizar rapidamente a equipa durante o trânsito.</DialogDescription></DialogHeader><form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={save}><CrewField label="Motorista" value={crew.driverName} onChange={(value)=>setCrew({...crew,driverName:value})}/><CrewField label="Telefone do motorista" value={crew.driverPhone} type="tel" onChange={(value)=>setCrew({...crew,driverPhone:value})}/><CrewField label="Ajudante" value={crew.apprenticeName} onChange={(value)=>setCrew({...crew,apprenticeName:value})}/><CrewField label="Telefone do ajudante" value={crew.apprenticePhone} type="tel" onChange={(value)=>setCrew({...crew,apprenticePhone:value})}/>{error&&<p className="text-sm text-danger sm:col-span-2" role="alert">{error}</p>}<Button className="mt-2 sm:col-span-2" disabled={saving}>{saving?"A guardar…":"Guardar atribuição"}</Button></form></DialogContent></Dialog></div>{truck.apprenticeName&&<p className="mt-3 border-t border-primary/10 pt-3 text-xs text-muted-foreground">Ajudante: <span className="font-semibold text-foreground/70">{truck.apprenticeName}</span>{truck.apprenticePhone&&<> · <a href={`tel:${truck.apprenticePhone}`} className="hover:text-primary">{truck.apprenticePhone}</a></>}</p>}</div>;
}
function CrewField({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <div><Label>{label}</Label><Input required minLength={type==="tel"?7:2} type={type} value={value} onChange={(event)=>onChange(event.target.value)}/></div>}
function PublicationBadge({ status }: { status: OwnerTruck["publicationStatus"] }) { const labels={pending_payment:"Validação pendente",published:"Validado",rejected:"Recusado"}; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${status === "published" ? "bg-emerald-100 text-emerald-800" : status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{labels[status]}</span>; }
function Metric({icon,value,label}:{icon:React.ReactNode;value:number;label:string}){return <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_12px_40px_rgba(11,61,46,.045)]"><span className="grid size-10 place-items-center rounded-full bg-primary/8 text-primary [&_svg]:size-5">{icon}</span><strong className="mt-6 block font-heading text-3xl font-bold">{value}</strong><span className="mt-1 block text-sm font-light text-muted-foreground">{label}</span></div>}
function EmptyFleet(){return <div className="mt-6 rounded-[24px] border border-dashed border-primary/20 bg-white px-6 py-14 text-center"><TruckIcon className="mx-auto size-10 text-primary/40"/><h3 className="mt-4 font-heading text-xl font-bold">Ainda não tem trucks</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Cadastre o primeiro veículo e acompanhe a validação a partir daqui.</p><Button asChild className="mt-5"><Link href="/devenir-partenaire">Cadastrar o primeiro truck</Link></Button></div>}
