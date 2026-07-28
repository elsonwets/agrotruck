import type { Truck } from "@/types/truck";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { CallButton } from "@/components/shared/call-button";

export function TruckContactActions({ truck }: { truck: Truck }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <WhatsappButton phone={truck.whatsapp} truckName={truck.name} />
        <CallButton phone={truck.phone} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-primary/10 bg-white/95 p-3 backdrop-blur-xl sm:hidden">
        <WhatsappButton phone={truck.whatsapp} truckName={truck.name} />
        <CallButton phone={truck.phone} compact />
      </div>
    </>
  );
}
