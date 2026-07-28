"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Search, SearchX } from "lucide-react";
import type { TransportCompany } from "@/types/company";
import { Input } from "@/components/ui/input";
import { CompanyCard } from "./company-card";

export function CompaniesBrowser({ companies }: { companies: TransportCompany[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return companies;
    return companies.filter((company) => normalize([company.name, company.headquarters, ...company.serviceAreas, ...company.acceptedMaterials].join(" ")).includes(term));
  }, [companies, query]);

  return <>
    <div className="mb-8 flex flex-col gap-4 rounded-[20px] border border-primary/10 bg-white p-4 shadow-[0_10px_35px_rgba(11,61,46,.06)] sm:flex-row sm:items-center sm:justify-between md:p-5">
      <label className="relative block w-full sm:max-w-md"><span className="sr-only">Pesquisar uma empresa</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empresa, cidade ou mercadoria" className="pl-11" /></label>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4 text-primary" /><strong className="text-foreground">{results.length}</strong> empresa{results.length !== 1 ? "s" : ""}</p>
    </div>
    {results.length ? <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: .055 } } }} className="grid gap-5 md:grid-cols-2 xl:gap-6">{results.map((company) => <CompanyCard key={company.slug} company={company} />)}</motion.div> : <div className="rounded-[20px] border border-dashed border-primary/20 bg-white px-6 py-16 text-center"><SearchX className="mx-auto size-10 text-primary/45" /><h2 className="mt-4 font-heading text-xl font-bold">Nenhuma empresa encontrada</h2><p className="mt-2 text-sm font-light text-muted-foreground">Tente pesquisar outra cidade, empresa ou tipo de mercadoria.</p><button type="button" onClick={() => setQuery("")} className="focus-ring mt-6 text-sm font-bold text-primary">Limpar pesquisa</button></div>}
  </>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
