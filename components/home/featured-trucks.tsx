import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trucks } from "@/data/trucks";
import { TruckGrid } from "@/components/trucks/truck-grid";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
export function FeaturedTrucks(){ return <section className="section-pad bg-white"><div className="page-shell"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="Disponíveis agora" title="Trucks prontos para trabalhar" description="Veja a capacidade, confirme a disponibilidade e fale diretamente com o proprietário."/><Button asChild variant="outline"><Link href="/trucks">Ver todos os trucks <ArrowRight className="size-4"/></Link></Button></div><div className="mt-10"><TruckGrid trucks={trucks.filter(t=>t.availability === "available").slice(0,4)}/></div></div></section> }
