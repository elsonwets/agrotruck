"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/components/providers/app-providers";
import { SearchPanel } from "./search-panel";

export function HeroSection() {
  const { t } = useAppSettings();
  return (
    <section className="relative isolate overflow-hidden bg-primary pb-12 pt-16 text-white md:pb-16 md:pt-24">
      <div className="absolute inset-0 -z-10">
        <Image src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2000&q=86" alt="Truck de carga numa estrada da África Ocidental" fill priority sizes="100vw" className="object-cover object-[67%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,33,25,.98)_0%,rgba(11,61,46,.9)_48%,rgba(11,61,46,.28)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-black/10" />
      </div>
      <div className="page-shell">
        <motion.div className="max-w-3xl" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: .08 } } }}>
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} transition={{ duration: .35 }} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#F3E8D1]">
            <CheckCircle2 className="size-4 text-warning" /> {t("hero.badge")}
          </motion.div>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} transition={{ duration: .4 }} className="font-heading text-balance text-[clamp(2.8rem,7vw,5.7rem)] font-extrabold leading-[.96] tracking-[-.055em]">
            {t("hero.title")}
          </motion.h1>
          <motion.p variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} transition={{ duration: .4 }} className="mt-6 max-w-2xl text-base font-light leading-7 text-white/78 md:text-xl md:leading-8">
            {t("hero.subtitle")}
          </motion.p>
          <motion.div variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} transition={{ duration: .35 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-warning text-[#111] shadow-none hover:bg-[#ffd52b]"><Link href="/trucks">{t("hero.find")} <ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" className="border border-white/25 bg-white/10 text-white shadow-none backdrop-blur hover:bg-white/18"><Link href="/devenir-partenaire">{t("hero.publish")}</Link></Button>
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .26, duration: .42 }}><SearchPanel /></motion.div>
      </div>
    </section>
  );
}
