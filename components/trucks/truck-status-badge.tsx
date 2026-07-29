import { Circle } from "lucide-react";
import { availabilityLabels, type TruckAvailability } from "@/types/truck";
import { cn } from "@/lib/utils";
export function TruckStatusBadge({ status }: { status: TruckAvailability }) {
  const styles = { available: "border-emerald-700/15 bg-white/95 text-emerald-800", in_transit: "border-warning bg-warning text-[#111111]", maintenance: "border-danger/20 bg-white/95 text-danger" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm", styles[status])}><Circle className="size-2 fill-current"/>{availabilityLabels[status]}</span>;
}
