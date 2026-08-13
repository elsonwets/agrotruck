import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Handshake, MapPinned, PhoneCall, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sobre nós",
  description: "Conheça a missão da AgroTruck na Guiné-Bissau e no Senegal.",
};

const values = [
  [Eye, "Visibilidade", "Mostramos os trucks e a sua disponibilidade de forma clara."],
  [PhoneCall, "Contacto direto", "O cliente fala com o proprietário por chamada ou WhatsApp."],
  [Handshake, "Confiança", "Perfis claros ajudam as duas partes a confirmar as condições."],
] as const;

export default function AboutPage() {
  return <>
    <section className="overflow-hidden bg-primary py-16 text-white md:py-24">
      <div className="page-shell grid items-end gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-warning">Sobre a AgroTruck</p><h1 className="mt-4 max-w-4xl font-heading text-4xl font-extrabold tracking-[-.045em] md:text-6xl">A ponte entre uma carga e um truck disponível.</h1></div>
        <p className="max-w-xl border-l border-white/20 pl-6 font-light leading-7 text-white/72">A AgroTruck não é uma transportadora e não faz reservas. É um anuário independente para encontrar um camião e contactar diretamente o proprietário.</p>
      </div>
    </section>
    <section className="section-pad bg-white"><div className="page-shell grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><MapPinned className="size-8 text-danger"/><h2 className="mt-6 font-heading text-3xl font-bold tracking-[-.035em] md:text-4xl">Pensada para a realidade da região.</h2><p className="mt-4 font-light leading-7 text-muted-foreground">Agricultores, comerciantes, exportadores, empresas e proprietários de frota precisam de uma forma rápida de se encontrar na Guiné-Bissau e no Senegal.</p></div><div className="grid gap-3 sm:grid-cols-3">{values.map(([Icon,title,text])=><article key={title} className="rounded-[20px] border border-primary/10 bg-[#f8f8f5] p-5"><Icon className="size-6 text-primary"/><h3 className="mt-7 font-heading text-lg font-semibold">{title}</h3><p className="mt-2 text-sm font-light leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>
    <section className="border-y border-primary/10 bg-[#f8f8f5] py-16"><div className="page-shell flex flex-col justify-between gap-8 md:flex-row md:items-center"><div className="max-w-2xl"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-5"/><span className="text-xs font-bold uppercase tracking-[.16em]">Simples por decisão</span></div><h2 className="mt-3 font-heading text-3xl font-bold tracking-[-.035em]">Sem conta. Sem reserva. Contacto direto.</h2></div><Button asChild size="lg"><Link href="/"><Truck className="size-4"/> Ver trucks disponíveis <ArrowRight className="size-4"/></Link></Button></div></section>
  </>;
}
