import { Container, Motorbike, Tractor, Truck, Van, type LucideProps } from "lucide-react";
import type { VehicleCategory } from "~/shared/domain";

const icons: Record<VehicleCategory, React.ComponentType<LucideProps>> = {
  camion: Truck,
  camionnette: Van,
  moto_tricycle: Motorbike,
  tracteur: Tractor,
  semi_remorque: Container,
};

export function VehicleIcon({ category, ...props }: { category: VehicleCategory } & LucideProps) {
  const Icon = icons[category];
  return <Icon aria-hidden="true" {...props} />;
}
