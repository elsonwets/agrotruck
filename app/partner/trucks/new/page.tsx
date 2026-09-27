"use client";

import { useRouter } from "next/navigation";
import { SessionGate } from "@/components/auth/session-gate";
import { TruckForm } from "@/components/partner/truck-form";

export default function NewTruckPage() {
  const router = useRouter();
  return (
    <SessionGate role="partner">
      <div className="page-shell max-w-2xl py-10">
        <h1 className="font-heading text-2xl font-bold">Ajouter un camion</h1>
        <div className="mt-6"><TruckForm onSaved={() => router.push("/partner?tab=camions")} /></div>
      </div>
    </SessionGate>
  );
}
