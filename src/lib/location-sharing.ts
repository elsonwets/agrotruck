import { useCallback, useEffect, useRef, useState } from "react";
import { shouldSend, type Fix } from "~/shared/fleet";
import { errorCode } from "./errors";

export interface FixPayload { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }
export type SharingState = "idle" | "waiting" | "sharing" | "denied" | "unsupported" | "stopped";

// Refus définitifs : réessayer ne servirait à rien, le partage s'arrête.
const FATAL = new Set(["link_invalid", "no_active_mission", "forbidden", "unauthenticated"]);

// Partage de position tant que la page est ouverte (une PWA ne suit pas la position en arrière-plan).
// Un point au plus toutes les 30 s ou tous les 100 m, un envoi à la fois, rien n'est gardé hors ligne :
// une vieille position n'a pas de valeur.
export function useLocationSharing(send: (fix: FixPayload) => Promise<unknown>) {
  const [state, setState] = useState<SharingState>("idle");
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [online, setOnline] = useState(true);
  const sendRef = useRef(send);
  const watchId = useRef<number | null>(null);
  const last = useRef<Fix | null>(null);
  const inFlight = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => { sendRef.current = send; }, [send]);

  const requestWakeLock = useCallback(() => {
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then((lock) => {
      // Arrêt survenu pendant l'octroi : on rend le verrou tout de suite au lieu de le garder.
      if (watchId.current === null) void lock.release().catch(() => undefined);
      else wakeLock.current = lock;
    }).catch(() => undefined);
  }, []);

  const halt = useCallback((next: SharingState) => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    setState(next);
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) { setState("unsupported"); return; }
    if (watchId.current !== null) return;
    last.current = null;
    setFailure(null);
    setPaused(false);
    setState("waiting");
    requestWakeLock();
    watchId.current = navigator.geolocation.watchPosition((position) => {
      const fix: Fix = { lat: position.coords.latitude, lng: position.coords.longitude, at: Date.now() };
      if (inFlight.current || !navigator.onLine || !shouldSend(last.current, fix)) return;
      inFlight.current = true;
      sendRef.current({
        lat: fix.lat, lng: fix.lng, accuracy: position.coords.accuracy,
        speed: position.coords.speed ?? undefined, heading: position.coords.heading ?? undefined,
      })
        .then(() => { if (watchId.current === null) return; last.current = fix; setLastSentAt(Date.now()); setFailure(null); setPaused(false); setState("sharing"); })
        .catch((reason: unknown) => {
          if (watchId.current === null) return; // partage déjà arrêté : réponse périmée
          const code = errorCode(reason);
          setFailure(code ?? "network");
          if (code && FATAL.has(code)) halt("stopped");
        })
        .finally(() => { inFlight.current = false; });
    }, (error) => {
      if (error.code === error.PERMISSION_DENIED) halt("denied");
    }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 });
  }, [halt, requestWakeLock]);

  const stop = useCallback(() => halt("idle"), [halt]);

  useEffect(() => {
    const onVisibility = () => {
      if (watchId.current === null) return;
      if (document.visibilityState === "hidden") setPaused(true);
      else requestWakeLock(); // le navigateur libère le verrou d'écran quand la page est cachée
    };
    const onNetwork = () => setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onNetwork);
    window.addEventListener("offline", onNetwork);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onNetwork);
      window.removeEventListener("offline", onNetwork);
      halt("idle");
    };
  }, [halt, requestWakeLock]);

  return { state, lastSentAt, failure, paused, online, start, stop };
}
