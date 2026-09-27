import { orderStatusLabels, type OrderStatus } from "@/types/order";
import { cn } from "@/lib/utils";

const styles: Record<OrderStatus, string> = {
  pending: "border-warning bg-warning/15 text-[#7a6200]",
  assigned: "border-primary/20 bg-primary/8 text-primary",
  loaded: "border-[#b87400]/30 bg-[#b87400]/10 text-[#8a5700]",
  delivered: "border-emerald-700/20 bg-emerald-50 text-emerald-800",
  cancelled: "border-danger/20 bg-danger/5 text-danger",
};

// Côté transporteur, une mission assignée est « À charger ».
const transporterLabels: Partial<Record<OrderStatus, string>> = { pending: "Disponible", assigned: "À charger" };

export function MissionStatusBadge({ status = "pending", perspective = "producer" }: { status?: OrderStatus; perspective?: "producer" | "transporter" }) {
  const label = (perspective === "transporter" && transporterLabels[status]) || orderStatusLabels[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", styles[status])}>{label}</span>;
}
