"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gauge, MapPin, Package, Search, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { locations, materials } from "@/data/trucks";
import { availabilityLabels } from "@/types/truck";
import { useAppSettings } from "@/components/providers/app-providers";

export function SearchPanel() {
  const router = useRouter();
  const { t } = useAppSettings();
  const [location, setLocation] = useState("");
  const [material, setMaterial] = useState("");
  const [capacity, setCapacity] = useState("");
  const [availability, setAvailability] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (location) query.set("location", location);
    if (material) query.set("material", material);
    if (capacity) query.set("capacity", capacity);
    if (availability) query.set("availability", availability);
    router.push(`/trucks${query.size ? `?${query.toString()}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="relative z-10 mt-10 rounded-[20px] border border-white/20 bg-white/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,.2)] backdrop-blur-md" aria-label={t("search.formLabel")}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1.15fr_.8fr_1fr_auto]">
        <Field icon={<MapPin />}><Select aria-label={t("search.location")} value={location} onChange={(event) => setLocation(event.target.value)}><option value="">{t("search.location")}</option>{locations.map((item) => <option key={item}>{item}</option>)}</Select></Field>
        <Field icon={<Package />}><Select aria-label={t("search.material")} value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">{t("search.material")}</option>{materials.map((item) => <option key={item}>{item}</option>)}</Select></Field>
        <Field icon={<Gauge />}><Input type="number" min="0" inputMode="numeric" aria-label={t("search.capacity")} placeholder={t("search.capacity")} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
        <Field icon={<Signal />}><Select aria-label={t("search.availability")} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">{t("search.availability")}</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Button type="submit" size="lg" className="w-full md:col-span-2 xl:col-span-1 xl:w-auto"><Search className="size-4" />{t("search.submit")}</Button>
      </div>
    </form>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="relative [&_svg]:pointer-events-none [&_svg]:absolute [&_svg]:left-3 [&_svg]:top-4 [&_svg]:z-10 [&_svg]:size-4 [&_svg]:text-primary [&_input]:pl-9 [&_select]:pl-9">{icon}{children}</div>;
}
