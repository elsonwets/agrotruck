import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage(){return <main className="grid min-h-[70vh] place-items-center px-5 py-20"><div className="max-w-md text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/8 text-primary"><WifiOff className="size-6"/></span><h1 className="mt-6 font-heading text-3xl font-extrabold">Sem ligação à internet</h1><p className="mt-3 text-sm font-light leading-6 text-muted-foreground">Volte a ligar-se para consultar os trucks disponíveis e os dados atualizados dos proprietários.</p><Button asChild className="mt-7"><Link href="/">Tentar novamente</Link></Button></div></main>}
