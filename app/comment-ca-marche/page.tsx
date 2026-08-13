import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, MessagesSquare, Search, ShieldCheck, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = { title: "Como funciona", description: "Saiba como encontrar e contactar um truck na AgroTruck." };
const paths = [
  { title: "Encontre", icon: Search, text: "Pesquise a capacidade de transporte adequada à sua carga.", steps: ["Escolha a zona", "Indique a mercadoria", "Compare a capacidade"] },
  { title: "Compare", icon: Star, text: "Use informações concretas para escolher com mais confiança.", steps: ["Qualidade do camião", "Profissionalismo", "Fiabilidade"] },
  { title: "Contacte", icon: Truck, text: "Fale diretamente com o contacto indicado na ficha.", steps: ["Abra a ficha do camião", "Ligue ou use o WhatsApp", "Confirme preço e horário"] },
];
const faqs = [
  ["A AgroTruck faz reservas?", "Não. A plataforma mostra os trucks e permite o contacto direto. Preço, horário e condições são combinados com o proprietário."],
  ["Como contacto um proprietário?", "Cada ficha tem apenas duas ações: WhatsApp e chamada telefónica."],
  ["Os proprietários são verificados?", "Os perfis podem mostrar um estado de verificação. Confirme sempre os documentos e as condições antes do carregamento."],
  ["Como são adicionados os trucks?", "O annuário é alimentado por uma fonte externa administrada pela AgroTruck. Não existe cadastro público neste site."],
  ["Que mercadorias são aceites?", "Cada truck indica as mercadorias permitidas, incluindo produtos agrícolas, areia, pedra, cimento, madeira, contentores e carga geral."],
];

export default function HowPage() {
  return <>
    <section className="page-shell pb-14 pt-16 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/8 text-primary"><ShieldCheck /></div><h1 className="mx-auto mt-6 max-w-4xl font-heading text-4xl font-extrabold tracking-[-.04em] text-foreground md:text-6xl">Do carregamento ao contacto, sem desvios.</h1><p className="mx-auto mt-5 max-w-2xl font-light leading-7 text-muted-foreground">A AgroTruck torna os trucks visíveis e o contacto simples, claro e rápido.</p></section>
    <section className="page-shell grid gap-5 pb-24 lg:grid-cols-3">{paths.map(({ title, icon: Icon, text, steps }) => <article key={title} className="rounded-[20px] border border-primary/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(17,17,17,.06)]"><Icon className="size-7 text-primary" /><h2 className="mt-6 font-heading text-2xl font-semibold text-foreground">{title}</h2><p className="mt-2 min-h-12 text-sm font-light leading-6 text-muted-foreground">{text}</p><ol className="mt-7 space-y-5">{steps.map((step, index) => <li key={step} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-warning text-xs font-bold text-[#111]">{index + 1}</span><span className="text-sm text-foreground/75">{step}</span></li>)}</ol></article>)}</section>
    <section className="border-y border-primary/10 bg-[#f8f8f5]"><div className="page-shell section-pad"><SectionHeading eyebrow="Perguntas frequentes" title="O essencial antes de começar" align="center" /><div className="mx-auto mt-10 max-w-3xl space-y-3">{faqs.map(([question, answer]) => <details key={question} className="group rounded-[20px] border border-primary/10 bg-white p-5"><summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 font-heading font-semibold text-foreground"><span>{question}</span><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/7 text-primary transition group-open:bg-primary group-open:text-white"><ChevronDown className="size-5 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" /></span></summary><p className="mt-4 border-t border-primary/10 pt-4 text-sm font-light leading-6 text-muted-foreground">{answer}</p></details>)}</div></div></section>
    <section className="page-shell py-20 text-center"><MessagesSquare className="mx-auto text-primary" /><h2 className="mt-4 font-heading text-3xl font-extrabold tracking-[-.03em]">Pronto para começar?</h2><div className="mt-6 flex justify-center"><Button asChild><Link href="/trucks">Encontrar um truck</Link></Button></div></section>
  </>;
}
