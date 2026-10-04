import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { cn } from "~/lib/cn";
import { escapeHtml, zoneCenter } from "~/shared/fleet";

export interface MapMarker { id: string; lat: number; lng: number; label: string; title: string; detail: string; stale: boolean }

type Leaflet = typeof import("leaflet");

const DEFAULT_CENTER = zoneCenter("bissau");
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function frame(L: Leaflet, map: LeafletMap, markers: MapMarker[]) {
  const [only] = markers;
  if (markers.length === 1 && only) map.setView([only.lat, only.lng], 12);
  else map.fitBounds(L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as [number, number])), { padding: [32, 32], maxZoom: 13 });
}

// Carte OpenStreetMap avec Leaflet (~40 Ko), chargée seulement quand elle s'affiche : rien côté serveur, pas de WebGL.
// `follow` : la carte suit le repère unique à chaque mise à jour (suivi d'un camion par le producteur).
export function FleetMap({ markers, label, follow = false, className }: { markers: MapMarker[]; label: string; follow?: boolean; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const fitted = useRef(false);
  const latest = useRef<MapMarker[]>(markers);
  useEffect(() => { latest.current = markers; }, [markers]);
  // Repères existants par id : mis à jour sur place pour ne pas fermer une bulle ouverte.
  const shown = useRef(new Map<string, { marker: Marker; iconKey: string }>());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const known = shown.current;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    // Exports nommés (map, tileLayer…) : c'est la forme décrite par @types/leaflet et fournie par Vite.
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      const element = container.current;
      if (cancelled || !element) return;
      const map = L.map(element, { center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], zoom: 8 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      leaflet.current = { L, map, layer: L.layerGroup().addTo(map) };
      // La carte peut naître cachée (onglet « Liste » sur mobile) : elle se recalcule quand sa taille change.
      // Le premier cadrage attend une taille non nulle : sinon Leaflet calcule un zoom absurde sur une carte 0×0.
      observer = new ResizeObserver(() => {
        map.invalidateSize();
        if (!fitted.current && map.getSize().x > 0 && latest.current.length) {
          fitted.current = true;
          frame(L, map, latest.current);
        }
      });
      observer.observe(element);
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      leaflet.current?.map.remove();
      leaflet.current = null;
      known.clear();
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, map, layer } = current;
    const existing = shown.current;
    const ids = new Set(markers.map((marker) => marker.id));
    for (const [id, entry] of existing) {
      if (ids.has(id)) continue;
      entry.marker.remove();
      existing.delete(id);
    }
    for (const marker of markers) {
      const iconKey = `${marker.label}|${marker.stale}`;
      const icon = () => L.divIcon({
        className: "",
        html: `<span class="${cn("fleet-pin", marker.stale && "fleet-pin--stale")}">${escapeHtml(marker.label)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const popup = `<strong>${escapeHtml(marker.title)}</strong><br>${escapeHtml(marker.detail)}`;
      const entry = existing.get(marker.id);
      if (entry) {
        entry.marker.setLatLng([marker.lat, marker.lng]);
        if (entry.iconKey !== iconKey) {
          entry.marker.setIcon(icon());
          entry.iconKey = iconKey;
        }
        entry.marker.setPopupContent(popup);
      } else {
        const created = L.marker([marker.lat, marker.lng], { icon: icon(), title: marker.title }).bindPopup(popup).addTo(layer);
        existing.set(marker.id, { marker: created, iconKey });
      }
    }
    const [only] = markers;
    if (!fitted.current && markers.length) {
      // Cadrage au premier affichage seulement : les mises à jour ne font pas sauter la carte.
      // Carte cachée (taille 0) : le ResizeObserver cadrera dès qu'elle devient visible.
      if (map.getSize().x > 0) {
        fitted.current = true;
        frame(L, map, markers);
      }
    } else if (follow && markers.length === 1 && only) {
      map.panTo([only.lat, only.lng]);
    }
  }, [ready, markers, follow]);

  return <div ref={container} role="region" aria-label={label} className={cn("isolate bg-brand-50", className)} />;
}
