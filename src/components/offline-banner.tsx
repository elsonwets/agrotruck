import { useCallback, useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { CloudOff, RefreshCw } from "lucide-react";
import { CACHE_EVENT } from "~/lib/cached-query";
import { useT } from "~/lib/i18n";
import { getOutbox, OUTBOX_EVENT } from "~/lib/outbox-client";
import type { FlushReport } from "~/shared/outbox";

// Bandeau de connexion : hors ligne (avec la date des données affichées), actions en attente, envoi terminé ou refusé.
// Rejoue la file à l'ouverture, au retour du réseau, et toutes les 30 s tant que des actions attendent.
export function OfflineBanner() {
  const t = useT();
  const convex = useConvex();
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [report, setReport] = useState<FlushReport | null>(null);

  const refreshPending = useCallback(() => {
    getOutbox()?.list().then((items) => setPending(items.length), () => undefined);
  }, []);
  const flush = useCallback(() => {
    getOutbox()?.flush().then((result) => { if (result.sent.length || result.rejected.length) setReport(result); }, () => undefined);
  }, []);

  useEffect(() => {
    const update = () => {
      const connected = navigator.onLine && convex.connectionState().isWebSocketConnected;
      setOnline(navigator.onLine && (connected || convex.connectionState().hasEverConnected === false));
      if (connected) { setCachedAt(null); flush(); }
    };
    const onCache = (event: Event) => { setOnline(false); setCachedAt((event as CustomEvent<number>).detail); };
    refreshPending();
    const unsubscribe = convex.subscribeToConnectionState(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(OUTBOX_EVENT, refreshPending);
    window.addEventListener(CACHE_EVENT, onCache);
    return () => {
      unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(OUTBOX_EVENT, refreshPending);
      window.removeEventListener(CACHE_EVENT, onCache);
    };
  }, [convex, flush, refreshPending]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(flush, 30_000);
    return () => window.clearInterval(timer);
  }, [pending, flush]);

  const bar = "border-b px-4 py-2.5 text-sm";
  if (!online) {
    return <div data-print-hidden role="status" className={`${bar} border-harvest-300 bg-harvest-100 text-ink`}>
      <p className="container-page flex flex-wrap items-center gap-x-2 gap-y-1">
        <CloudOff className="size-4 shrink-0 text-brand-800" aria-hidden="true" />
        <strong>{t.offline.offline}</strong>
        <span>{cachedAt ? t.offline.dataFrom(t.common.dateTime(cachedAt)) : t.offline.lastData}</span>
        <span>{pending ? t.offline.pending(pending) : t.offline.willSend}</span>
      </p>
    </div>;
  }
  if (report?.rejected.length) {
    return <div data-print-hidden role="alert" className={`${bar} border-flag-500/20 bg-flag-50 text-[#a3201b]`}>
      <div className="container-page flex flex-wrap items-center justify-between gap-2">
        <p>{report.rejected.map(({ item, code }) => `${item.label} : ${t.errors[code] ?? t.common.genericError}`).join(" · ")}</p>
        <button type="button" className="font-semibold underline" onClick={() => setReport(null)}>{t.common.close}</button>
      </div>
    </div>;
  }
  if (report?.sent.length) {
    return <div data-print-hidden role="status" className={`${bar} border-brand-100 bg-brand-50 text-brand-800`}>
      <div className="container-page flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{t.offline.sent(report.sent.length)}</p>
        <button type="button" className="inline-flex items-center gap-1.5 font-semibold" onClick={() => window.location.reload()}><RefreshCw className="size-4" aria-hidden="true" />{t.offline.refresh}</button>
      </div>
    </div>;
  }
  if (pending) {
    return <div data-print-hidden role="status" className={`${bar} border-line bg-white text-muted`}><p className="container-page">{t.offline.sending(pending)}</p></div>;
  }
  return null;
}
