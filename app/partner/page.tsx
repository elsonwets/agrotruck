"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionGate } from "@/components/auth/session-gate";
import { AvailableMissions } from "@/components/partner/available-missions";
import { MyMissions } from "@/components/partner/my-missions";
import { MyTrucks } from "@/components/partner/my-trucks";

function PartnerSpace() {
  const tab = useSearchParams().get("tab");
  return <div className="page-shell py-10">
    {tab === "camions" ? <MyTrucks /> : tab === "missions" ? <MyMissions /> : <AvailableMissions />}
  </div>;
}

export default function Page() {
  return <SessionGate role="partner"><Suspense fallback={<p className="page-shell py-10 text-sm text-muted-foreground">Chargement…</p>}><PartnerSpace /></Suspense></SessionGate>;
}
