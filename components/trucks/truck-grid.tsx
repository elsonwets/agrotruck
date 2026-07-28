"use client";

import { motion } from "framer-motion";
import type { Truck } from "@/types/truck";
import { TruckCard } from "./truck-card";

export function TruckGrid({ trucks }: { trucks: Truck[] }) {
  return <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={{ hidden: {}, visible: { transition: { staggerChildren: .045 } } }} className="grid gap-5 md:grid-cols-2 xl:gap-6">
    {trucks.map((truck) => <TruckCard key={truck.id} truck={truck}/>) }
  </motion.div>;
}

