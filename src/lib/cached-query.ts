import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

// Lecture Convex avec secours hors ligne : la dernière réponse est gardée sur le téléphone et réaffichée
// tant que le réseau ne répond pas. Réservé aux écrans privés (rendus côté client uniquement).

const PREFIX = "agrotrucks.q.";
export const CACHE_EVENT = "agrotrucks:cache-used";

interface Entry<T> { data: T; at: number }

function readEntry<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch { return null; }
}

export function clearQueryCache() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch { /* stockage indisponible */ }
}

export function useCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
  cacheKey: string | null,
): { data: FunctionReturnType<Query> | undefined; cachedAt: number | null } {
  const live = useQuery(query, args);
  const [cached] = useState(() => (cacheKey ? readEntry<FunctionReturnType<Query>>(cacheKey) : null));

  useEffect(() => {
    if (live === undefined || !cacheKey) return;
    try { localStorage.setItem(PREFIX + cacheKey, JSON.stringify({ data: live, at: Date.now() })); } catch { /* plein ou indisponible */ }
  }, [live, cacheKey]);

  const usingCache = live === undefined && cached !== null;
  useEffect(() => {
    if (usingCache) window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: cached!.at }));
  }, [usingCache, cached]);

  if (live !== undefined) return { data: live, cachedAt: null };
  return usingCache ? { data: cached!.data, cachedAt: cached!.at } : { data: undefined, cachedAt: null };
}
