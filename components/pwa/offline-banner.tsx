"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { getOutbox, OUTBOX_EVENT, type FlushReport } from "@/lib/outbox";

// Bandeau de connexion : hors ligne (avec la date des données affichées), actions en attente, envoi terminé ou refusé.
// Rejoue la file à l'ouverture de l'application et au retour du réseau.
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [report, setReport] = useState<FlushReport | null>(null);

  const refreshPending = useCallback(() => {
    getOutbox().list().then((items) => setPending(items.length), () => undefined);
  }, []);

  const flush = useCallback(() => {
    getOutbox().flush().then((result) => { if (result.sent.length || result.rejected.length) setReport(result); }, () => undefined);
  }, []);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) { setCachedAt(null); flush(); }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "offline-data") { setOnline(false); setCachedAt(event.data.cachedAt ?? null); }
      if (event.data?.type === "online-data") { setOnline(true); setCachedAt(null); flush(); }
    };
    update();
    refreshPending();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(OUTBOX_EVENT, refreshPending);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(OUTBOX_EVENT, refreshPending);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [flush, refreshPending]);

  // Réseau faible : le téléphone peut se dire « connecté » sans internet. Tant que des actions attendent, on réessaie.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(flush, 30_000);
    return () => window.clearInterval(timer);
  }, [pending, flush]);

  const bar = "border-b px-4 py-2.5 text-sm";
  if (!online) {
    return <div data-print-hidden role="status" className={`${bar} border-warning bg-warning/15 text-foreground`}>
      <p className="page-shell flex flex-wrap items-center gap-x-2 gap-y-1">
        <CloudOff className="size-4 shrink-0 text-primary" />
        <strong>Hors ligne</strong>
        <span>{cachedAt ? `— données du ${new Date(cachedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.` : "— dernières données enregistrées."}</span>
        <span>{pending ? `${pending} action${pending > 1 ? "s" : ""} en attente d'envoi.` : "Vos actions seront envoyées au retour du réseau."}</span>
      </p>
    </div>;
  }
  if (report?.rejected.length) {
    return <div data-print-hidden role="alert" className={`${bar} border-danger/20 bg-danger/5 text-danger`}>
      <div className="page-shell flex flex-wrap items-center justify-between gap-2">
        <p>{report.rejected.map(({ item, error }) => `${item.label} : ${error}`).join(" · ")}</p>
        <button type="button" className="focus-ring font-semibold underline" onClick={() => setReport(null)}>Fermer</button>
      </div>
    </div>;
  }
  if (report?.sent.length) {
    return <div data-print-hidden role="status" className={`${bar} border-primary/15 bg-primary/8 text-primary`}>
      <div className="page-shell flex flex-wrap items-center justify-between gap-2">
        <p><strong>{report.sent.length} action{report.sent.length > 1 ? "s" : ""} envoyée{report.sent.length > 1 ? "s" : ""}</strong> depuis la dernière connexion.</p>
        <button type="button" className="focus-ring inline-flex items-center gap-1.5 font-semibold" onClick={() => window.location.reload()}><RefreshCw className="size-4" />Actualiser</button>
      </div>
    </div>;
  }
  if (pending) {
    return <div data-print-hidden role="status" className={`${bar} border-primary/15 bg-white text-muted-foreground`}>
      <p className="page-shell">Envoi de {pending} action{pending > 1 ? "s" : ""} en attente…</p>
    </div>;
  }
  return null;
}
