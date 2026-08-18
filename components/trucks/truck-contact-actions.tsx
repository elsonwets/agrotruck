import Link from "next/link";
import type { Truck } from "@/types/truck";
import { Button } from "@/components/ui/button";

export function TruckContactActions({ truck }: { truck: Truck }) {
  return (
    <>
      <Button asChild className="w-full"><Link href={`/location?type=${truck.type}`}>Demander ce type de camion</Link></Button>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/10 bg-white/95 p-3 backdrop-blur-xl sm:hidden">
        <Button asChild className="w-full"><Link href={`/location?type=${truck.type}`}>Demander ce type de camion</Link></Button>
      </div>
    </>
  );
}
