import { useEffect, useState } from "react";

// Heure courante rafraîchie régulièrement (« il y a 2 min », signal perdu, lien expiré) :
// les requêtes Convex ne lisent pas l'horloge, c'est l'écran qui compare.
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
