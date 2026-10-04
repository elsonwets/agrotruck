# Gestion de flotte et suivi GPS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un transporteur avec 2 véhicules ou plus suit sa flotte sur une carte OpenStreetMap, ses conducteurs partagent leur position par un lien WhatsApp sans compte, le producteur suit son camion pendant la mission, et le public voit le statut des camions sans aucune coordonnée.

**Architecture:**
- **Données (Convex).** Trois tables : `drivers` (conducteurs sans compte), `trackingLinks` (liens WhatsApp, empreinte SHA-256 du jeton) et `positions` (une ligne par camion : la dernière position connue). Les règles pures (distance, progression, statut affiché, seuils) vivent dans `src/shared/fleet.ts` et sont partagées par le navigateur et Convex.
- **Temps réel.** Le navigateur envoie un point au plus toutes les 30 s ou tous les 100 m (`watchPosition`). La mutation remplace la ligne `positions` du camion, et les requêtes réactives Convex mettent les écrans à jour. Il n'y a ni WebSocket ni historique.
- **Carte.** Leaflet est importé dynamiquement (`import("leaflet")`) dans un `useEffect` : rien côté serveur, pas de WebGL. Tuiles `tile.openstreetmap.org`.

**Tech Stack:** TanStack Start + React 19, Convex 1.46 (`convex-test` + Vitest en `edge-runtime`), Tailwind 4, Leaflet 1.9, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-04-gestion-flotte-gps-design.md`

## Global Constraints

- **Pro :** la flotte s'active dès **2 véhicules** (`FLEET_MIN_TRUCKS = 2`), calculé côté serveur, aucun champ stocké.
- **Seuils :** envoi client toutes les **30 s** ou tous les **100 m** ; au plus **un point toutes les 10 s** par camion côté serveur ; un point de précision supérieure à **1 000 m** est ignoré ; « signal perdu » après **10 min** ; lien valable **7 jours**.
- **Confidentialité :** `fleet.publicList` et `tracking.linkInfo` ne renvoient **jamais** `lat`, `lng`, `accuracy` ni un numéro de téléphone. La position n'est lue que par le propriétaire du camion, le producteur et le transporteur de la mission en cours (`assigned` ou `loaded`), et l'admin.
- **Convex :** pas de `Date.now()` dans une `query` (l'expiration est comparée côté client, avec `useNow`). Des validateurs sur tous les arguments. Des index plutôt que `.filter()`. Lire `convex/_generated/ai/guidelines.md` avant d'écrire du code Convex.
- **Carte :** Leaflet seul (pas de `react-leaflet`, pas de MapLibre), chargé seulement par les composants qui affichent une carte.
- **Interface :** composants existants (`Card`, `Badge`, `PageTitle`, `EmptyState`, `Tabs`, `Button`, `Field`, `Input`, `Select`). Textes en **fr / en / pt** (le type `Dict` de `fr.ts` impose la même forme aux trois langues).
- **Commits :** sous le nom de l'auteur (`elsonwets`) uniquement, **sans** ligne `Co-Authored-By` ni mention de Claude.
- **Types Convex :** après chaque modification de `convex/`, régénérer `convex/_generated/` avec `pnpm exec convex codegen` (il faut le `.env.local` créé par `pnpm dev:backend`). Les tests `convex-test` passent sans cette étape, mais pas `pnpm typecheck`.
- **Routes :** le plugin TanStack régénère `src/routeTree.gen.ts` à chaque `pnpm dev` ou `pnpm build`. Après avoir créé une route, lancer `pnpm build` avant `pnpm typecheck`.

### Écarts assumés par rapport à la spec (décidés en écrivant le plan)

- Le jeton de lien est `newSessionToken()` : 32 octets aléatoires en hexadécimal, comme les sessions, au lieu de base64url.
- L'argument du jeton de lien s'appelle `linkToken`, pour ne pas le confondre avec le jeton de session `token`.
- Codes d'erreur ajoutés : `invalid_position`, `link_invalid`, `no_active_mission`, `driver_unavailable`.
- « Mission en cours » d'un camion : une mission `loaded` passe avant une mission `assigned`.
- Dans `fleet.publicList`, la progression est arrondie à 5 %, pour qu'on ne puisse pas en déduire une position précise.
- La page du conducteur garde l'en-tête normal du site : il est déjà léger.

## Review Focus

1. **Localisation déjà refusée sur le téléphone du conducteur :** le bouton affiche un message clair qui explique comment l'autoriser, sans boucle d'erreurs (Task 7 : état `denied` ; Task 8 : vérification manuelle).
2. **Camion réaffecté ou lien révoqué pendant que l'ancien conducteur a la page ouverte :** ses envois sont refusés, la page arrête le partage et affiche « lien plus valide » (Task 4 : tests serveur ; Task 7 : `FATAL` arrête le partage).
3. **Nom de conducteur ou de camion contenant du HTML (`<img onerror=…>`) :** il s'affiche comme du texte dans la bulle de la carte (Task 1 : test `escapeHtml` ; Task 7 : la bulle passe par `escapeHtml`).
4. **Onglet « Carte » ouvert sur mobile après l'onglet « Liste » :** la carte s'affiche entière au lieu d'un carré gris (Task 7 : `ResizeObserver` → `invalidateSize` ; Task 9 : vérification manuelle).
5. **Transporteur qui supprime des camions jusqu'à n'en avoir qu'un :** les liens de ses conducteurs sont refusés et les pages flotte affichent l'invitation à ajouter un véhicule (Task 4 : test ; Task 9 : `EmptyState`).

---

### Task 1: Règles partagées (zones, distance, progression, statut, seuils)

**Files:**
- Modify: `src/shared/zones.ts`
- Create: `src/shared/fleet.ts`
- Test: `src/shared/fleet.test.ts`

**Interfaces:**
- Produces (`src/shared/fleet.ts`) :
  - constantes `FLEET_MIN_TRUCKS`, `SEND_INTERVAL_MS`, `SEND_DISTANCE_M`, `SERVER_MIN_INTERVAL_MS`, `MAX_ACCURACY_M`, `STALE_AFTER_MS`, `LINK_TTL_MS` ;
  - types `LatLng { lat; lng }`, `Fix extends LatLng { at }`, `DisplayStatus`, `FixCheck` ; tableau `DISPLAY_STATUSES` ;
  - `distanceMeters(a: LatLng, b: LatLng): number`
  - `zoneCenter(zone: Zone): LatLng`
  - `displayStatus(availability: Availability, missionStatus: MissionStatus | null): DisplayStatus`
  - `progress(pickup: Zone, dropoff: Zone, status: MissionStatus, position: LatLng | null): number` (entre 0 et 1)
  - `shouldSend(last: Fix | null, next: Fix): boolean`
  - `checkFix(fix: { lat: number; lng: number; accuracy?: number }): FixCheck` (`"ok" | "invalid" | "imprecise"`)
  - `isStale(at: number, now: number): boolean`, `firstName(name: string): string`
  - `whatsappUrl(phone: string, text: string): string`, `escapeHtml(value: string): string`
- Produces (`src/shared/zones.ts`) : chaque zone a `lat` et `lng`.

- [ ] **Step 1: Write the failing test**

Create `src/shared/fleet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_MS, checkFix, displayStatus, distanceMeters, escapeHtml, firstName, isStale, progress, shouldSend, whatsappUrl, zoneCenter,
} from "./fleet";

const gabu = zoneCenter("gabu");
const bissau = zoneCenter("bissau");

describe("distanceMeters", () => {
  it("measures Bissau → Gabú at about 157 km", () => {
    const distance = distanceMeters(bissau, gabu);
    expect(distance).toBeGreaterThan(140_000);
    expect(distance).toBeLessThan(175_000);
    expect(distanceMeters(bissau, bissau)).toBe(0);
  });
});

describe("progress", () => {
  it("follows the distance already covered once the truck is loaded", () => {
    const halfway = { lat: (gabu.lat + bissau.lat) / 2, lng: (gabu.lng + bissau.lng) / 2 };
    expect(progress("gabu", "bissau", "loaded", gabu)).toBeCloseTo(0, 2);
    expect(progress("gabu", "bissau", "loaded", halfway)).toBeCloseTo(0.5, 1);
    expect(progress("gabu", "bissau", "loaded", bissau)).toBeCloseTo(1, 2);
  });

  it("stays between 0 and 1 when the truck is off the straight line", () => {
    expect(progress("gabu", "bissau", "loaded", { lat: 12.28, lng: -13.0 })).toBe(0);
  });

  it("falls back to the mission steps without a usable position", () => {
    expect(progress("bissau", "bissau", "loaded", bissau)).toBe(0.5);
    expect(progress("gabu", "bissau", "loaded", null)).toBe(0.5);
    expect(progress("gabu", "bissau", "assigned", gabu)).toBe(0);
    expect(progress("gabu", "bissau", "delivered", null)).toBe(1);
  });
});

describe("displayStatus", () => {
  it("puts the ongoing mission before the vehicle availability", () => {
    expect(displayStatus("maintenance", "loaded")).toBe("on_route");
    expect(displayStatus("available", "assigned")).toBe("loading");
    expect(displayStatus("maintenance", null)).toBe("maintenance");
    expect(displayStatus("in_transit", null)).toBe("available");
  });
});

describe("shouldSend", () => {
  const start = { lat: 12, lng: -15, at: 1_000_000 };
  it("sends the first point, then every 30 s or every 100 m", () => {
    expect(shouldSend(null, start)).toBe(true);
    expect(shouldSend(start, { lat: 12.00018, lng: -15, at: start.at + 10_000 })).toBe(false); // ~20 m, 10 s
    expect(shouldSend(start, { lat: 12, lng: -15, at: start.at + 30_000 })).toBe(true);
    expect(shouldSend(start, { lat: 12.00135, lng: -15, at: start.at + 10_000 })).toBe(true); // ~150 m
  });
});

describe("checkFix", () => {
  it("rejects impossible coordinates and ignores imprecise ones", () => {
    expect(checkFix({ lat: 12, lng: -15, accuracy: 20 })).toBe("ok");
    expect(checkFix({ lat: 12, lng: -15 })).toBe("ok");
    expect(checkFix({ lat: 91, lng: -15 })).toBe("invalid");
    expect(checkFix({ lat: Number.NaN, lng: -15 })).toBe("invalid");
    expect(checkFix({ lat: 12, lng: -15, accuracy: -1 })).toBe("invalid");
    expect(checkFix({ lat: 12, lng: -15, accuracy: 1500 })).toBe("imprecise");
  });
});

describe("helpers", () => {
  it("detects a lost signal after 10 minutes", () => {
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true);
    expect(isStale(0, 60_000)).toBe(false);
  });

  it("keeps only the first name", () => {
    expect(firstName("  Mamadu  Baldé ")).toBe("Mamadu");
  });

  it("builds a wa.me link from a phone typed with spaces and +", () => {
    expect(whatsappUrl("+245 955 000 701", "Olá & bem-vindo")).toBe("https://wa.me/245955000701?text=Ol%C3%A1%20%26%20bem-vindo");
  });

  it("escapes HTML for the map popups", () => {
    expect(escapeHtml(`<b>"A&B"</b>'`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;&#39;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/fleet.test.ts`
Expected: FAIL with `Failed to resolve import "./fleet"`

- [ ] **Step 3: Add the zone centres**

In `src/shared/zones.ts`, replace the `zones` array with:

```ts
// Régions de Guinée-Bissau : liste fixe pour que « Gabu » et « Gabú » désignent la même zone.
// lat / lng : chef-lieu de la région, utilisé pour la barre de progression des trajets.
export const zones = [
  { id: "bissau", label: "Bissau (SAB)", lat: 11.8636, lng: -15.5977 },
  { id: "biombo", label: "Biombo", lat: 11.8833, lng: -15.85 },
  { id: "cacheu", label: "Cacheu", lat: 12.2667, lng: -16.1667 },
  { id: "oio", label: "Oio", lat: 12.4833, lng: -15.2167 },
  { id: "bafata", label: "Bafatá", lat: 12.1667, lng: -14.6667 },
  { id: "gabu", label: "Gabú", lat: 12.2833, lng: -14.2167 },
  { id: "quinara", label: "Quinara", lat: 11.5833, lng: -14.9833 },
  { id: "tombali", label: "Tombali", lat: 11.2833, lng: -15.25 },
  { id: "bolama", label: "Bolama-Bijagós", lat: 11.5778, lng: -15.4767 },
] as const;
```

- [ ] **Step 4: Write the implementation**

Create `src/shared/fleet.ts`:

```ts
import type { Availability, MissionStatus } from "./domain";
import { zones, type Zone } from "./zones";

// Règles de la gestion de flotte et du suivi GPS, partagées par le navigateur et Convex.

export const FLEET_MIN_TRUCKS = 2; // la flotte s'active dès 2 véhicules
export const SEND_INTERVAL_MS = 30_000; // le téléphone envoie au plus toutes les 30 s…
export const SEND_DISTANCE_M = 100; // … ou dès qu'il a bougé de 100 m
export const SERVER_MIN_INTERVAL_MS = 10_000; // le serveur garde au plus un point toutes les 10 s par camion
export const MAX_ACCURACY_M = 1_000; // un point moins précis est ignoré
export const STALE_AFTER_MS = 10 * 60_000; // au-delà : « signal perdu »
export const LINK_TTL_MS = 7 * 24 * 60 * 60_000; // durée d'un lien de suivi

export interface LatLng { lat: number; lng: number }
export interface Fix extends LatLng { at: number }

const EARTH_RADIUS_M = 6_371_000;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// Distance à vol d'oiseau (haversine).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function zoneCenter(zone: Zone): LatLng {
  const found = zones.find((entry) => entry.id === zone) ?? zones[0];
  return { lat: found.lat, lng: found.lng };
}

export const DISPLAY_STATUSES = ["available", "loading", "on_route", "maintenance"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

// Statut montré sur les cartes : la mission en cours passe avant la disponibilité déclarée du véhicule.
export function displayStatus(availability: Availability, missionStatus: MissionStatus | null): DisplayStatus {
  if (missionStatus === "loaded") return "on_route";
  if (missionStatus === "assigned") return "loading";
  return availability === "maintenance" ? "maintenance" : "available";
}

const STEP_PROGRESS: Record<MissionStatus, number> = { pending: 0, assigned: 0, loaded: 0.5, delivered: 1, cancelled: 0 };

// Part du trajet faite, entre le chef-lieu de la zone de départ et celui de la zone d'arrivée.
// Sans position, ou dans une même région, la barre suit simplement les étapes de la mission.
export function progress(pickup: Zone, dropoff: Zone, status: MissionStatus, position: LatLng | null): number {
  if (status !== "loaded" || !position || pickup === dropoff) return STEP_PROGRESS[status];
  const end = zoneCenter(dropoff);
  const total = distanceMeters(zoneCenter(pickup), end);
  return Math.min(1, Math.max(0, 1 - distanceMeters(position, end) / total));
}

export function shouldSend(last: Fix | null, next: Fix): boolean {
  return !last || next.at - last.at >= SEND_INTERVAL_MS || distanceMeters(last, next) >= SEND_DISTANCE_M;
}

export type FixCheck = "ok" | "invalid" | "imprecise";

export function checkFix(fix: { lat: number; lng: number; accuracy?: number }): FixCheck {
  const valid = Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Math.abs(fix.lat) <= 90 && Math.abs(fix.lng) <= 180
    && (fix.accuracy === undefined || (Number.isFinite(fix.accuracy) && fix.accuracy >= 0));
  if (!valid) return "invalid";
  return fix.accuracy !== undefined && fix.accuracy > MAX_ACCURACY_M ? "imprecise" : "ok";
}

export const isStale = (at: number, now: number) => now - at > STALE_AFTER_MS;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Les bulles Leaflet prennent du HTML : tout texte saisi par un utilisateur passe par ici.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/shared/fleet.test.ts src/shared/zones.test.ts`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/shared/zones.ts src/shared/fleet.ts src/shared/fleet.test.ts
git commit -m "feat(flotte): règles partagées de progression, statut et envoi GPS"
```

---

### Task 2: Schéma Convex et plaque d'immatriculation

**Files:**
- Modify: `convex/lib/validators.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/trucks.ts` (`truckFields`, `clean`)
- Modify: `src/components/trucks/truck-form.tsx`
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`, `src/i18n/pt.ts` (`transporter.plate`)
- Test: `convex/fleet.test.ts` (nouveau fichier, repris par les Tasks 3 à 5)

**Interfaces:**
- Produces:
  - tables `drivers`, `trackingLinks`, `positions` ; index `missions.by_truckId_and_status`, `trackingLinks.by_tokenHash | by_driverId | by_truckId | by_expiresAt`, `drivers.by_ownerId`, `positions.by_truckId` ;
  - `trucks.plate?: string` (en majuscules) et `trucks.driverId?: Id<"drivers">` ;
  - `vPositionSource` dans `convex/lib/validators.ts` ;
  - helpers de test dans `convex/fleet.test.ts` : `signup`, `truckInput`, `addTruck`.

- [ ] **Step 1: Write the failing test**

Create `convex/fleet.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

async function signup(t: T, role: "producer" | "transporter", phone: string, extra: Record<string, unknown> = {}) {
  const result = await t.mutation(api.auth.signup, { role, phone, pin: "1234", displayName: `${role} ${phone}`, ...extra });
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

const truckInput = {
  category: "camion" as const, listingMode: "transport" as const, capacityTons: 20, zone: "gabu" as const, location: "Gabú",
  serviceZones: [], goods: [], availability: "available" as const, description: "", photoIds: [],
};

function addTruck(t: T, token: string, name: string, extra: Record<string, unknown> = {}) {
  return t.mutation(api.trucks.create, { token, ...truckInput, name, ...extra });
}

describe("trucks", () => {
  it("stores the licence plate in capitals", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000800");
    await addTruck(t, owner, "Actros", { plate: " ab-123-cd " });
    const [truck] = await t.query(api.trucks.mine, { token: owner });
    expect(truck.plate).toBe("AB-123-CD");
  });
});
```

(The next tasks complete these imports as they need them: `noUnusedLocals` refuses an unused import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: FAIL — `ArgumentValidationError` (the `plate` field is not expected by `trucks:create`)

- [ ] **Step 3: Add the validator**

At the end of `convex/lib/validators.ts`, add:

```ts
export const vPositionSource = v.union(v.literal("owner"), v.literal("link"));
```

- [ ] **Step 4: Extend the schema**

In `convex/schema.ts`:

1. Add `vPositionSource` to the import from `./lib/validators`.
2. In `trucks`, after `ratings`, add:

```ts
    plate: v.optional(v.string()), // plaque d'immatriculation, en majuscules
    driverId: v.optional(v.id("drivers")), // conducteur affecté (gardé en cohérence avec drivers.truckId)
```

3. In `missions`, after `.index("by_clientRequestId", ["clientRequestId"])`, add:

```ts
    .index("by_truckId_and_status", ["truckId", "status"])
```

4. At the end of the object passed to `defineSchema`, after `reviews`, add:

```ts
  // Conducteurs d'une entreprise (transporteur avec 2 véhicules ou plus) : pas de compte, ils partagent leur
  // position par un lien de suivi (trackingLinks).
  drivers: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    phone: v.string(), // numéro WhatsApp, pour le lien wa.me
    truckId: v.optional(v.id("trucks")),
    disabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  // Liens de suivi envoyés par WhatsApp : on ne garde que l'empreinte SHA-256 du jeton, comme pour les sessions.
  trackingLinks: defineTable({
    ownerId: v.id("users"),
    driverId: v.id("drivers"),
    truckId: v.id("trucks"),
    missionId: v.optional(v.id("missions")),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_driverId", ["driverId"])
    .index("by_truckId", ["truckId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Dernière position connue de chaque camion : une ligne par camion, remplacée à chaque envoi (pas d'historique).
  positions: defineTable({
    truckId: v.id("trucks"),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.optional(v.number()), // mètres
    speed: v.optional(v.number()), // m/s
    heading: v.optional(v.number()), // degrés
    at: v.number(), // heure du serveur à la réception
    source: vPositionSource,
    driverId: v.optional(v.id("drivers")),
  }).index("by_truckId", ["truckId"]),
```

- [ ] **Step 5: Accept the plate in `trucks.ts`**

In `convex/trucks.ts`, in `truckFields`, after `whatsapp: v.optional(v.string()),`, add:

```ts
  plate: v.optional(v.string()),
```

In `clean`, in the returned object, after the `whatsapp` line, add:

```ts
    plate: input.plate?.trim().toUpperCase().replace(/\s+/g, " ").slice(0, 15) || undefined,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run convex/fleet.test.ts convex/backend.test.ts convex/missions.test.ts`
Expected: PASS

- [ ] **Step 7: Add the field to the form and the translations**

In `src/i18n/fr.ts`, in `transporter`, after `model: "Modèle",`, add `plate: "Plaque d'immatriculation",`.
In `src/i18n/en.ts`, at the same place, add `plate: "Licence plate",`.
In `src/i18n/pt.ts`, at the same place, add `plate: "Matrícula",`.

In `src/components/trucks/truck-form.tsx`:
- in the initial `useState`, after `model: truck?.model ?? "",`, add `plate: truck?.plate ?? "",`;
- in `fields` (in `submit`), after `model: form.model || undefined,`, add `plate: form.plate || undefined,`;
- replace `<div className="grid gap-4 sm:grid-cols-3">` (the row with brand, model and capacity) with `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">`, and add after the model `Field`:

```tsx
        <Field id="truck-plate" label={`${t.transporter.plate} (${t.common.optional})`}><Input id="truck-plate" value={form.plate} onChange={set("plate")} autoCapitalize="characters" /></Field>
```

- [ ] **Step 8: Regenerate the types and check**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add convex/lib/validators.ts convex/schema.ts convex/trucks.ts convex/fleet.test.ts convex/_generated src/components/trucks/truck-form.tsx src/i18n
git commit -m "feat(flotte): tables conducteurs, liens et positions, plaque des véhicules"
```

---

### Task 3: Conducteurs (règle Pro et gestion)

**Files:**
- Create: `convex/lib/fleet.ts`
- Create: `convex/drivers.ts`
- Test: `convex/fleet.test.ts`

**Interfaces:**
- Consumes: `FLEET_MIN_TRUCKS` (Task 1), tables and indexes from Task 2, `requireUser` (`convex/lib/session.ts`).
- Produces (`convex/lib/fleet.ts`) :
  - `isFleetOwner(ctx: QueryCtx, userId: Id<"users">): Promise<boolean>`
  - `requireFleetOwner(ctx, token: string): Promise<Doc<"users">>`, which throws `ConvexError({ code: "forbidden" })`
  - `currentMission(ctx, truckId): Promise<Doc<"missions"> | null>` (`loaded`, sinon `assigned`)
  - `latestPosition(ctx, truckId): Promise<Doc<"positions"> | null>`
  - `latestLink(ctx, driverId): Promise<Doc<"trackingLinks"> | null>` (le dernier lien non révoqué)
  - `linksOfDriver(ctx, driverId)` et `linksOfTruck(ctx, truckId): Promise<Doc<"trackingLinks">[]>`
  - `revokeLinks(ctx: MutationCtx, links: Doc<"trackingLinks">[]): Promise<void>`
- Produces (`convex/drivers.ts`) :
  - `drivers.list({ token })` → `{ _id, name, phone, disabled, truckId: Id<"trucks"> | null, truckName: string | null, linkExpiresAt: number | null }[]`
  - `drivers.create({ token, name, phone, truckId? })` → `Id<"drivers">`
  - `drivers.update({ token, driverId, name, phone, truckId? })` → `null`
  - `drivers.setDisabled({ token, driverId, disabled })` → `null` (désactiver révoque les liens)
  - helper de test `fleetSetup(t)` → `{ owner, truckA, truckB }`

- [ ] **Step 1: Write the failing tests**

In `convex/fleet.test.ts`, after `import { api } from "./_generated/api";`, add `import type { Id } from "./_generated/dataModel";`. Then, after `addTruck`, add the helper:

```ts
// Transporteur « entreprise » : 2 camions, région Gabú, type camion (il voit les missions de missionInput).
async function fleetSetup(t: T, phone = "+245955000810") {
  const owner = await signup(t, "transporter", phone, { vehicleCategories: ["camion"], workZones: ["gabu"], companyName: "Transportes Gabú" });
  const truckA = await addTruck(t, owner, "Camion A");
  const truckB = await addTruck(t, owner, "Camion B");
  return { owner, truckA, truckB };
}
```

At the end of the file, add:

```ts
describe("drivers", () => {
  it("is reserved to transporters with at least 2 vehicles", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000810");
    const truckA = await addTruck(t, owner, "Camion A");
    await expect(t.query(api.drivers.list, { token: owner })).rejects.toThrow(/forbidden/);
    await addTruck(t, owner, "Camion B");
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245 955 111 222", truckId: truckA });
    expect(await t.query(api.drivers.list, { token: owner })).toEqual([
      expect.objectContaining({ _id: driverId, name: "Mamadu Baldé", truckId: truckA, truckName: "Camion A", linkExpiresAt: null, disabled: false }),
    ]);
  });

  it("keeps one driver per truck and validates the input", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    const first = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const second = await t.mutation(api.drivers.create, { token: owner, name: "Braima", phone: "+245955111333", truckId: truckA });
    const drivers = await t.query(api.drivers.list, { token: owner });
    expect(drivers.find((driver) => driver._id === first)?.truckId).toBeNull();
    expect(drivers.find((driver) => driver._id === second)?.truckId).toBe(truckA);
    const truck = await t.run((ctx) => ctx.db.get("trucks", truckA));
    expect(truck?.driverId).toBe(second);

    const other = await signup(t, "transporter", "+245955000819");
    const foreign = await addTruck(t, other, "Autre");
    await expect(t.mutation(api.drivers.create, { token: owner, name: "Seco", phone: "+245955111444", truckId: foreign })).rejects.toThrow(/invalid_truck/);
    await expect(t.mutation(api.drivers.create, { token: owner, name: "  ", phone: "+245955111444" })).rejects.toThrow(/invalid_name/);
    await expect(t.mutation(api.drivers.create, { token: owner, name: "Seco", phone: "12" })).rejects.toThrow(/invalid_phone/);
  });

  it("lets only the owner edit or disable a driver", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const { owner: rival } = await fleetSetup(t, "+245955000820");
    const driverId: Id<"drivers"> = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    await expect(t.mutation(api.drivers.update, { token: rival, driverId, name: "Volé", phone: "+245955111222" })).rejects.toThrow(/not_found/);
    await expect(t.mutation(api.drivers.setDisabled, { token: rival, driverId, disabled: true })).rejects.toThrow(/not_found/);

    await t.mutation(api.drivers.update, { token: owner, driverId, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckB });
    const [driver] = await t.query(api.drivers.list, { token: owner });
    expect(driver).toMatchObject({ name: "Mamadu Baldé", truckId: truckB, truckName: "Camion B" });
    expect((await t.run((ctx) => ctx.db.get("trucks", truckA)))?.driverId).toBeUndefined();

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: true });
    expect((await t.query(api.drivers.list, { token: owner }))[0].disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: FAIL — `Could not find public function for 'drivers:list'`

- [ ] **Step 3: Write `convex/lib/fleet.ts`**

```ts
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { FLEET_MIN_TRUCKS } from "../../src/shared/fleet";
import { requireUser } from "./session";

// Aides partagées par drivers.ts, tracking.ts, fleet.ts et trucks.ts.

// « Transporteur Pro » : au moins 2 véhicules. Calculé à chaque fois, rien n'est stocké.
export async function isFleetOwner(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", userId)).take(FLEET_MIN_TRUCKS);
  return trucks.length >= FLEET_MIN_TRUCKS;
}

export async function requireFleetOwner(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx, token, ["transporter"]);
  if (!(await isFleetOwner(ctx, user._id))) throw new ConvexError({ code: "forbidden" });
  return user;
}

// Mission en cours du camion : chargée d'abord, sinon à charger (la plus récente).
export async function currentMission(ctx: QueryCtx, truckId: Id<"trucks">): Promise<Doc<"missions"> | null> {
  for (const status of ["loaded", "assigned"] as const) {
    const mission = await ctx.db.query("missions")
      .withIndex("by_truckId_and_status", (q) => q.eq("truckId", truckId).eq("status", status))
      .order("desc")
      .first();
    if (mission) return mission;
  }
  return null;
}

export function latestPosition(ctx: QueryCtx, truckId: Id<"trucks">) {
  return ctx.db.query("positions").withIndex("by_truckId", (q) => q.eq("truckId", truckId)).unique();
}

export function linksOfDriver(ctx: QueryCtx, driverId: Id<"drivers">) {
  return ctx.db.query("trackingLinks").withIndex("by_driverId", (q) => q.eq("driverId", driverId)).take(100);
}

export function linksOfTruck(ctx: QueryCtx, truckId: Id<"trucks">) {
  return ctx.db.query("trackingLinks").withIndex("by_truckId", (q) => q.eq("truckId", truckId)).take(100);
}

// Dernier lien non révoqué du conducteur. L'expiration est comparée par l'appelant : pas d'horloge dans les requêtes.
export async function latestLink(ctx: QueryCtx, driverId: Id<"drivers">) {
  const link = await ctx.db.query("trackingLinks").withIndex("by_driverId", (q) => q.eq("driverId", driverId)).order("desc").first();
  return link && !link.revokedAt ? link : null;
}

export async function revokeLinks(ctx: MutationCtx, links: Doc<"trackingLinks">[]) {
  const now = Date.now();
  for (const link of links) if (!link.revokedAt) await ctx.db.patch("trackingLinks", link._id, { revokedAt: now });
}
```

- [ ] **Step 4: Write `convex/drivers.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { latestLink, linksOfDriver, requireFleetOwner, revokeLinks } from "./lib/fleet";

// Conducteurs d'une entreprise (transporteur avec 2 véhicules ou plus) : pas de compte, au plus un camion chacun.

function clean(input: { name: string; phone: string }) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ConvexError({ code: "invalid_name" });
  const phone = input.phone.trim().slice(0, 25);
  const digits = phone.replace(/\D/g, "").length;
  if (digits < 6 || digits > 15) throw new ConvexError({ code: "invalid_phone" });
  return { name, phone };
}

async function ownedDriver(ctx: MutationCtx, ownerId: Id<"users">, driverId: Id<"drivers">) {
  const driver = await ctx.db.get("drivers", driverId);
  if (!driver || driver.ownerId !== ownerId) throw new ConvexError({ code: "not_found" });
  return driver;
}

async function checkTruck(ctx: MutationCtx, ownerId: Id<"users">, truckId: Id<"trucks"> | undefined) {
  if (!truckId) return;
  const truck = await ctx.db.get("trucks", truckId);
  if (!truck || truck.ownerId !== ownerId) throw new ConvexError({ code: "invalid_truck" });
}

// Garde les deux côtés cohérents (drivers.truckId et trucks.driverId) : un camion n'a qu'un conducteur.
async function assignTruck(ctx: MutationCtx, driverId: Id<"drivers">, previous: Id<"trucks"> | undefined, next: Id<"trucks"> | undefined) {
  if (previous === next) return;
  if (previous) {
    const truck = await ctx.db.get("trucks", previous);
    if (truck?.driverId === driverId) await ctx.db.patch("trucks", previous, { driverId: undefined });
  }
  if (next) {
    const truck = await ctx.db.get("trucks", next);
    if (truck?.driverId && truck.driverId !== driverId) {
      const displaced = await ctx.db.get("drivers", truck.driverId);
      if (displaced) await ctx.db.patch("drivers", displaced._id, { truckId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.patch("trucks", next, { driverId });
  }
}

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireFleetOwner(ctx, token);
    const drivers = await ctx.db.query("drivers").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(200);
    return Promise.all(drivers.map(async (driver) => {
      const truck = driver.truckId ? await ctx.db.get("trucks", driver.truckId) : null;
      const link = await latestLink(ctx, driver._id);
      return {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        disabled: driver.disabled,
        truckId: driver.truckId ?? null,
        truckName: truck?.name ?? null,
        // Un lien créé pour un autre camion ne marche plus : on ne l'affiche pas comme actif.
        linkExpiresAt: link && !driver.disabled && link.truckId === driver.truckId ? link.expiresAt : null,
      };
    }));
  },
});

export const create = mutation({
  args: { token: v.string(), name: v.string(), phone: v.string(), truckId: v.optional(v.id("trucks")) },
  handler: async (ctx, { token, truckId, ...input }) => {
    const user = await requireFleetOwner(ctx, token);
    const fields = clean(input);
    await checkTruck(ctx, user._id, truckId);
    const driverId = await ctx.db.insert("drivers", { ...fields, ownerId: user._id, truckId, disabled: false, updatedAt: Date.now() });
    await assignTruck(ctx, driverId, undefined, truckId);
    return driverId;
  },
});

export const update = mutation({
  args: { token: v.string(), driverId: v.id("drivers"), name: v.string(), phone: v.string(), truckId: v.optional(v.id("trucks")) },
  handler: async (ctx, { token, driverId, truckId, ...input }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ownedDriver(ctx, user._id, driverId);
    const fields = clean(input);
    await checkTruck(ctx, user._id, truckId);
    await assignTruck(ctx, driverId, driver.truckId, truckId);
    await ctx.db.patch("drivers", driverId, { ...fields, truckId, updatedAt: Date.now() });
    return null;
  },
});

export const setDisabled = mutation({
  args: { token: v.string(), driverId: v.id("drivers"), disabled: v.boolean() },
  handler: async (ctx, { token, driverId, disabled }) => {
    const user = await requireFleetOwner(ctx, token);
    await ownedDriver(ctx, user._id, driverId);
    await ctx.db.patch("drivers", driverId, { disabled, updatedAt: Date.now() });
    if (disabled) await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    return null;
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Regenerate the types and check**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add convex/lib/fleet.ts convex/drivers.ts convex/fleet.test.ts convex/_generated
git commit -m "feat(flotte): conducteurs réservés aux transporteurs à 2 véhicules ou plus"
```

---

### Task 4: Liens de suivi et envoi des positions

**Files:**
- Create: `convex/tracking.ts`
- Modify: `convex/crons.ts`
- Test: `convex/fleet.test.ts`

**Interfaces:**
- Consumes: `LINK_TTL_MS`, `SERVER_MIN_INTERVAL_MS`, `checkFix`, `firstName`, `progress` (Task 1) ; `currentMission`, `isFleetOwner`, `latestPosition`, `linksOfDriver`, `requireFleetOwner`, `revokeLinks` (Task 3) ; `newSessionToken`, `sha256` (`convex/lib/security.ts`).
- Produces:
  - `tracking.createLink({ token, driverId })` → `{ linkToken: string; expiresAt: number }`. Crée un nouveau lien et révoque les précédents. Erreurs : `not_found`, `driver_unavailable`.
  - `tracking.revokeLink({ token, driverId })` → `null`
  - `tracking.linkInfo({ linkToken })` → `null | { active: boolean; expiresAt: number; driverName: string; truckName: string; plate: string | null }`
  - `tracking.reportFromLink({ linkToken, lat, lng, accuracy?, speed?, heading? })` → `{ recorded: boolean }`. Erreurs : `link_invalid`, `invalid_position`.
  - `tracking.reportFromOwner({ token, truckId, lat, lng, accuracy?, speed?, heading? })` → `{ recorded: boolean }`. Erreurs : `forbidden`, `no_active_mission`, `invalid_position`.
  - `tracking.missionPosition({ token, missionId })` → `null | { position: { lat; lng; accuracy: number | null; at } | null; driverName: string | null; progress: number }`
  - `internal.tracking.purgeExpiredLinks({})` → `null`
  - helpers de test `missionInput` et `assignedMission(t, transporterToken, truckId)` → `{ producer, missionId }`

- [ ] **Step 1: Write the failing tests**

In `convex/fleet.test.ts`, replace the imports `import { describe, expect, it } from "vitest";` and `import { api } from "./_generated/api";` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
```

Then, after `fleetSetup`, add:

```ts
const missionInput = {
  vehicleCategory: "camion" as const, pickupZone: "gabu" as const, pickupLocation: "Pirada",
  dropoffZone: "bissau" as const, dropoffLocation: "Porto", productType: "cashew" as const, quantitySacks: 200, neededFrom: "2026-10-10",
};

// Mission Gabú → Bissau attribuée au transporteur, avec ce camion (statut « assigned »).
async function assignedMission(t: T, transporter: string, truckId: Id<"trucks">, producerPhone = "+245955000890") {
  const producer = await signup(t, "producer", producerPhone);
  const missionId = await t.mutation(api.missions.create, { token: producer, ...missionInput });
  const offerId = await t.mutation(api.offers.send, { token: transporter, missionId, price: 150_000, truckId });
  await t.mutation(api.offers.choose, { token: producer, offerId });
  return { producer, missionId };
}

const at = (iso: string) => vi.setSystemTime(new Date(iso));
```

At the end of the file, add:

```ts
describe("tracking", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("records a driver's position through the link, at most every 10 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-04T08:00:00Z");
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    expect(await t.query(api.tracking.linkInfo, { linkToken })).toEqual({
      active: true, expiresAt: Date.parse("2026-10-11T08:00:00Z"), driverName: "Mamadu", truckName: "Camion A", plate: null,
    });
    expect(await t.query(api.drivers.list, { token: owner })).toEqual([expect.objectContaining({ linkExpiresAt: Date.parse("2026-10-11T08:00:00Z") })]);

    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22, accuracy: 15 })).toEqual({ recorded: true });
    at("2026-10-04T08:00:05Z");
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.29, lng: -14.23 })).toEqual({ recorded: false });
    at("2026-10-04T08:00:31Z");
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.29, lng: -14.23, accuracy: 5000 })).toEqual({ recorded: false });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken, lat: 200, lng: 0 })).rejects.toThrow(/invalid_position/);
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.3, lng: -14.3 })).toEqual({ recorded: true });

    const position = await t.run((ctx) => ctx.db.query("positions").withIndex("by_truckId", (q) => q.eq("truckId", truckA)).unique());
    expect(position).toMatchObject({ lat: 12.3, lng: -14.3, source: "link", driverId, at: Date.parse("2026-10-04T08:00:31Z") });
  });

  it("refuses replaced, reassigned, revoked and expired links, then purges them", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-04T08:00:00Z");
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const report = (linkToken: string) => t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 });

    const first = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    const second = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await expect(report(first)).rejects.toThrow(/link_invalid/);
    expect(await t.query(api.tracking.linkInfo, { linkToken: first })).toMatchObject({ active: false });
    expect(await report(second)).toEqual({ recorded: true });

    // Le camion A est confié à un autre conducteur : le lien de Mamadu ne marche plus.
    await t.mutation(api.drivers.create, { token: owner, name: "Braima", phone: "+245955111333", truckId: truckA });
    await expect(report(second)).rejects.toThrow(/link_invalid/);

    await t.mutation(api.drivers.update, { token: owner, driverId, name: "Mamadu", phone: "+245955111222", truckId: truckB });
    const third = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await t.mutation(api.tracking.revokeLink, { token: owner, driverId });
    await expect(report(third)).rejects.toThrow(/link_invalid/);

    const fourth = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    at("2026-10-11T08:00:01Z");
    await expect(report(fourth)).rejects.toThrow(/link_invalid/);
    await t.mutation(internal.tracking.purgeExpiredLinks, {});
    expect(await t.query(api.tracking.linkInfo, { linkToken: fourth })).toBeNull();
    await expect(report("not-a-token")).rejects.toThrow(/link_invalid/);
  });

  it("stops the links of a disabled driver, or of an owner left with one vehicle", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: true });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 })).rejects.toThrow(/link_invalid/);
    await expect(t.mutation(api.tracking.createLink, { token: owner, driverId })).rejects.toThrow(/driver_unavailable/);

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: false });
    const again = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await t.mutation(api.trucks.remove, { token: owner, truckId: truckB });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken: again, lat: 12.28, lng: -14.22 })).rejects.toThrow(/link_invalid/);
    expect(await t.query(api.tracking.linkInfo, { linkToken: again })).toMatchObject({ active: false });
  });

  it("lets a solo transporter share from their account only during their own mission", async () => {
    const t = convexTest(schema, modules);
    const solo = await signup(t, "transporter", "+245955000830", { vehicleCategories: ["camion"], workZones: ["gabu"] });
    const truckId = await addTruck(t, solo, "Actros");
    const fix = { lat: 12.28, lng: -14.22, accuracy: 10 };
    await expect(t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, ...fix })).rejects.toThrow(/no_active_mission/);
    await assignedMission(t, solo, truckId);
    expect(await t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, ...fix })).toEqual({ recorded: true });
    const intruder = await signup(t, "transporter", "+245955000831");
    await expect(t.mutation(api.tracking.reportFromOwner, { token: intruder, truckId, ...fix })).rejects.toThrow(/forbidden/);
  });

  it("shows the position only to the producer and the transporter of the ongoing mission", async () => {
    const t = convexTest(schema, modules);
    const solo = await signup(t, "transporter", "+245955000840", { vehicleCategories: ["camion"], workZones: ["gabu"] });
    const truckId = await addTruck(t, solo, "Actros");
    const { producer, missionId } = await assignedMission(t, solo, truckId);
    const stranger = await signup(t, "producer", "+245955000841");

    expect(await t.query(api.tracking.missionPosition, { token: producer, missionId })).toEqual({ position: null, driverName: null, progress: 0 });
    await t.mutation(api.missions.act, { token: solo, missionId, action: "loaded" });
    await t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, lat: 12.0735, lng: -14.9072, accuracy: 10 }); // à mi-chemin

    const seen = await t.query(api.tracking.missionPosition, { token: producer, missionId });
    expect(seen?.position).toMatchObject({ lat: 12.0735, lng: -14.9072, accuracy: 10 });
    expect(seen?.progress).toBeCloseTo(0.5, 1);
    expect(await t.query(api.tracking.missionPosition, { token: solo, missionId })).not.toBeNull();
    expect(await t.query(api.tracking.missionPosition, { token: stranger, missionId })).toBeNull();

    await t.mutation(api.missions.act, { token: solo, missionId, action: "delivered" });
    expect(await t.query(api.tracking.missionPosition, { token: producer, missionId })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: FAIL — `Could not find public function for 'tracking:createLink'`

- [ ] **Step 3: Write `convex/tracking.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { LINK_TTL_MS, SERVER_MIN_INTERVAL_MS, checkFix, firstName, progress } from "../src/shared/fleet";
import { currentMission, isFleetOwner, latestPosition, linksOfDriver, requireFleetOwner, revokeLinks } from "./lib/fleet";
import { newSessionToken, sha256 } from "./lib/security";
import { requireUser } from "./lib/session";

// Suivi GPS. Deux sources : le conducteur d'une entreprise (lien WhatsApp, sans compte) et le transporteur
// particulier (depuis son compte, pendant sa mission). On ne garde que la dernière position de chaque camion.

const fixArgs = {
  lat: v.number(),
  lng: v.number(),
  accuracy: v.optional(v.number()),
  speed: v.optional(v.number()),
  heading: v.optional(v.number()),
};

interface FixInput { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }

async function record(ctx: MutationCtx, truckId: Id<"trucks">, fix: FixInput, source: "owner" | "link", driverId?: Id<"drivers">) {
  const check = checkFix(fix);
  if (check === "invalid") throw new ConvexError({ code: "invalid_position" });
  if (check === "imprecise") return { recorded: false };
  const now = Date.now();
  const existing = await latestPosition(ctx, truckId);
  // Au plus un point toutes les 10 s par camion : les envois trop rapprochés sont ignorés sans erreur.
  if (existing && now - existing.at < SERVER_MIN_INTERVAL_MS) return { recorded: false };
  const position = { truckId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading, at: now, source, driverId };
  if (existing) await ctx.db.replace("positions", existing._id, position);
  else await ctx.db.insert("positions", position);
  return { recorded: true };
}

async function findLink(ctx: QueryCtx, linkToken: string) {
  const tokenHash = await sha256(linkToken);
  return ctx.db.query("trackingLinks").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
}

// Le lien est-il utilisable, hors expiration (comparée par l'appelant : pas d'horloge dans les requêtes) ?
async function linkUsable(ctx: QueryCtx, link: { revokedAt?: number; driverId: Id<"drivers">; truckId: Id<"trucks">; ownerId: Id<"users"> }) {
  if (link.revokedAt) return null;
  const driver = await ctx.db.get("drivers", link.driverId);
  const owner = await ctx.db.get("users", link.ownerId);
  if (!driver || driver.disabled || driver.truckId !== link.truckId || !owner || owner.disabled) return null;
  return (await isFleetOwner(ctx, owner._id)) ? driver : null;
}

export const createLink = mutation({
  args: { token: v.string(), driverId: v.id("drivers") },
  handler: async (ctx, { token, driverId }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ctx.db.get("drivers", driverId);
    if (!driver || driver.ownerId !== user._id) throw new ConvexError({ code: "not_found" });
    if (driver.disabled || !driver.truckId) throw new ConvexError({ code: "driver_unavailable" });
    // Un seul lien valide par conducteur : le nouveau remplace les anciens.
    await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    const linkToken = newSessionToken();
    const expiresAt = Date.now() + LINK_TTL_MS;
    const mission = await currentMission(ctx, driver.truckId);
    await ctx.db.insert("trackingLinks", {
      ownerId: user._id, driverId, truckId: driver.truckId, missionId: mission?._id, tokenHash: await sha256(linkToken), expiresAt,
    });
    return { linkToken, expiresAt };
  },
});

export const revokeLink = mutation({
  args: { token: v.string(), driverId: v.id("drivers") },
  handler: async (ctx, { token, driverId }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ctx.db.get("drivers", driverId);
    if (!driver || driver.ownerId !== user._id) throw new ConvexError({ code: "not_found" });
    await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    return null;
  },
});

// Page du conducteur : prénom, camion et validité du lien. Jamais de position ni de téléphone.
export const linkInfo = query({
  args: { linkToken: v.string() },
  handler: async (ctx, { linkToken }) => {
    const link = await findLink(ctx, linkToken);
    if (!link) return null;
    const driver = await ctx.db.get("drivers", link.driverId);
    const truck = await ctx.db.get("trucks", link.truckId);
    if (!driver || !truck) return null;
    const usable = await linkUsable(ctx, link);
    return { active: Boolean(usable), expiresAt: link.expiresAt, driverName: firstName(driver.name), truckName: truck.name, plate: truck.plate ?? null };
  },
});

export const reportFromLink = mutation({
  args: { linkToken: v.string(), ...fixArgs },
  handler: async (ctx, { linkToken, ...fix }) => {
    const link = await findLink(ctx, linkToken);
    const driver = link && link.expiresAt > Date.now() ? await linkUsable(ctx, link) : null;
    if (!link || !driver) throw new ConvexError({ code: "link_invalid" });
    return record(ctx, link.truckId, fix, "link", driver._id);
  },
});

export const reportFromOwner = mutation({
  args: { token: v.string(), truckId: v.id("trucks"), ...fixArgs },
  handler: async (ctx, { token, truckId, ...fix }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const truck = await ctx.db.get("trucks", truckId);
    if (!truck || truck.ownerId !== user._id) throw new ConvexError({ code: "forbidden" });
    const mission = await currentMission(ctx, truckId);
    if (!mission || mission.transporterId !== user._id) throw new ConvexError({ code: "no_active_mission" });
    return record(ctx, truckId, fix, "owner");
  },
});

// Position du camion d'une mission en cours : producteur et transporteur de la mission, admin.
export const missionPosition = query({
  args: { token: v.string(), missionId: v.id("missions") },
  handler: async (ctx, { token, missionId }) => {
    const user = await requireUser(ctx, token);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission?.truckId) return null;
    const ongoing = mission.status === "assigned" || mission.status === "loaded";
    const party = (user.role === "producer" && mission.producerId === user._id) || (user.role === "transporter" && mission.transporterId === user._id);
    if (user.role !== "admin" && !(ongoing && party)) return null;
    const position = await latestPosition(ctx, mission.truckId);
    const truck = await ctx.db.get("trucks", mission.truckId);
    const driver = position?.source === "link" && truck?.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
    return {
      position: position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy ?? null, at: position.at } : null,
      driverName: driver ? firstName(driver.name) : null,
      progress: progress(mission.pickupZone, mission.dropoffZone, mission.status, position),
    };
  },
});

export const purgeExpiredLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db.query("trackingLinks").withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now())).take(500);
    for (const link of expired) await ctx.db.delete("trackingLinks", link._id);
    return null;
  },
});
```

- [ ] **Step 4: Register the cron**

In `convex/crons.ts`, after the `purge expired sessions` line, add:

```ts
// Liens de suivi expirés (7 jours) : supprimés toutes les heures.
crons.interval("purge expired tracking links", { hours: 1 }, internal.tracking.purgeExpiredLinks, {});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Regenerate the types, check, commit**

Run: `pnpm exec convex codegen && pnpm typecheck && pnpm lint`
Expected: no errors

```bash
git add convex/tracking.ts convex/crons.ts convex/fleet.test.ts convex/_generated
git commit -m "feat(flotte): liens de suivi WhatsApp et envoi des positions GPS"
```

---

### Task 5: Vues de la flotte et nettoyage à la suppression d'un camion

**Files:**
- Create: `convex/fleet.ts`
- Modify: `convex/trucks.ts` (export `card` / `visibleOwner`, `remove`)
- Test: `convex/fleet.test.ts`

**Interfaces:**
- Consumes: `displayStatus`, `firstName`, `progress` (Task 1) ; `currentMission`, `isFleetOwner`, `latestPosition`, `linksOfTruck`, `requireFleetOwner`, `revokeLinks` (Task 3) ; `getSessionUser` (`convex/lib/session.ts`).
- Produces:
  - `fleet.access({ token })` → `{ fleet: boolean }` (ne lève pas d'erreur)
  - `fleet.overview({ token })` → `{ _id, name, plate: string | null, category, capacityTons, photoUrl: string | null, status: DisplayStatus, driver: { _id, name, phone } | null, position: { lat, lng, accuracy: number | null, at } | null, mission: { _id, pickupZone, dropoffZone } | null, progress: number | null }[]`
  - `fleet.publicList({})` → `(TruckCardData & { plate: string | null; status: DisplayStatus; driverName: string | null; route: { pickupZone; dropoffZone } | null; progress: number | null })[]`, **sans** `lat`, `lng`, `accuracy` ni téléphone
  - `card` et `visibleOwner` exportés depuis `convex/trucks.ts`

- [ ] **Step 1: Write the failing tests**

At the end of `convex/fleet.test.ts`, add:

```ts
describe("fleet views", () => {
  it("opens the fleet tab from 2 vehicles", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000850");
    const producer = await signup(t, "producer", "+245955000851");
    await addTruck(t, owner, "Camion A");
    expect(await t.query(api.fleet.access, { token: owner })).toEqual({ fleet: false });
    await expect(t.query(api.fleet.overview, { token: owner })).rejects.toThrow(/forbidden/);
    await addTruck(t, owner, "Camion B");
    expect(await t.query(api.fleet.access, { token: owner })).toEqual({ fleet: true });
    expect(await t.query(api.fleet.access, { token: producer })).toEqual({ fleet: false });
    expect(await t.query(api.fleet.access, { token: "unknown" })).toEqual({ fleet: false });
  });

  it("gives the owner statuses, drivers and positions, and the public no coordinates", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    await t.mutation(api.trucks.setAvailability, { token: owner, truckId: truckB, availability: "maintenance" });
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckA });
    await assignedMission(t, owner, truckA);
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22, accuracy: 12 });

    const overview = await t.query(api.fleet.overview, { token: owner });
    const a = overview.find((truck) => truck._id === truckA);
    const b = overview.find((truck) => truck._id === truckB);
    expect(a).toMatchObject({ status: "loading", driver: { name: "Mamadu Baldé", phone: "+245955111222" }, position: { lat: 12.28, lng: -14.22 }, progress: 0 });
    expect(a?.mission).toMatchObject({ pickupZone: "gabu", dropoffZone: "bissau" });
    expect(b).toMatchObject({ status: "maintenance", driver: null, position: null, mission: null, progress: null });

    const list = await t.query(api.fleet.publicList, {});
    expect(list.find((truck) => truck._id === truckA)).toMatchObject({ status: "loading", driverName: "Mamadu", route: { pickupZone: "gabu", dropoffZone: "bissau" } });
    expect(JSON.stringify(list)).not.toMatch(/"lat"|"lng"|"accuracy"|"phone"|\+245/);
  });

  it("cleans the position, driver and links of a deleted truck", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    await addTruck(t, owner, "Camion C"); // il reste 2 véhicules après la suppression
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 });

    await t.mutation(api.trucks.remove, { token: owner, truckId: truckA });
    expect(await t.run((ctx) => ctx.db.query("positions").collect())).toHaveLength(0);
    expect((await t.query(api.drivers.list, { token: owner }))[0]).toMatchObject({ truckId: null, linkExpiresAt: null });
    expect(await t.query(api.tracking.linkInfo, { linkToken })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/fleet.test.ts`
Expected: FAIL — `Could not find public function for 'fleet:access'`

- [ ] **Step 3: Export the catalog helpers and clean up on removal**

In `convex/trucks.ts`:
- replace `async function card(` with `export async function card(`;
- replace `async function visibleOwner(` with `export async function visibleOwner(`;
- add the import `import { latestPosition, linksOfTruck, revokeLinks } from "./lib/fleet";`;
- in `remove`, just before `await ctx.db.delete("trucks", truckId);`, add:

```ts
    // Suivi GPS : la position disparaît, le conducteur est détaché et les liens vers ce camion sont coupés.
    const position = await latestPosition(ctx, truckId);
    if (position) await ctx.db.delete("positions", position._id);
    if (truck.driverId) {
      const driver = await ctx.db.get("drivers", truck.driverId);
      if (driver) await ctx.db.patch("drivers", driver._id, { truckId: undefined, updatedAt: Date.now() });
    }
    await revokeLinks(ctx, await linksOfTruck(ctx, truckId));
```

- [ ] **Step 4: Write `convex/fleet.ts`**

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { displayStatus, firstName, progress } from "../src/shared/fleet";
import { currentMission, isFleetOwner, latestPosition, requireFleetOwner } from "./lib/fleet";
import { getSessionUser } from "./lib/session";
import { card, visibleOwner } from "./trucks";

// Vues de la flotte : tableau de bord du transporteur Pro, et liste publique « Camions en direct » (sans position).

const PUBLIC_SIZE = 60;

// Les onglets « Ma flotte » et « Conducteurs » ne s'affichent que pour un transporteur avec 2 véhicules ou plus.
export const access = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    return { fleet: Boolean(user && user.role === "transporter" && (await isFleetOwner(ctx, user._id))) };
  },
});

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireFleetOwner(ctx, token);
    const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(100);
    return Promise.all(trucks.map(async (truck) => {
      const mission = await currentMission(ctx, truck._id);
      const position = await latestPosition(ctx, truck._id);
      const driver = truck.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
      return {
        _id: truck._id,
        name: truck.name,
        plate: truck.plate ?? null,
        category: truck.category,
        capacityTons: truck.capacityTons,
        photoUrl: truck.photoIds[0] ? await ctx.storage.getUrl(truck.photoIds[0]) : null,
        status: displayStatus(truck.availability, mission?.status ?? null),
        driver: driver ? { _id: driver._id, name: driver.name, phone: driver.phone } : null,
        position: position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy ?? null, at: position.at } : null,
        mission: mission ? { _id: mission._id, pickupZone: mission.pickupZone, dropoffZone: mission.dropoffZone } : null,
        progress: mission ? progress(mission.pickupZone, mission.dropoffZone, mission.status, position) : null,
      };
    }));
  },
});

// Liste publique : statut, prénom du conducteur et progression arrondie. Jamais de coordonnées ni de téléphone.
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("trucks").withIndex("by_hidden", (q) => q.eq("hidden", false)).order("desc").take(300);
    const cards = [];
    for (const truck of trucks) {
      if (cards.length >= PUBLIC_SIZE) break;
      const owner = await visibleOwner(ctx, truck);
      if (!owner) continue;
      const mission = await currentMission(ctx, truck._id);
      const position = mission?.status === "loaded" ? await latestPosition(ctx, truck._id) : null;
      const driver = truck.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
      cards.push({
        ...(await card(ctx, truck, owner)),
        plate: truck.plate ?? null,
        status: displayStatus(truck.availability, mission?.status ?? null),
        driverName: driver && !driver.disabled ? firstName(driver.name) : null,
        route: mission ? { pickupZone: mission.pickupZone, dropoffZone: mission.dropoffZone } : null,
        // Arrondie à 5 % : on ne peut pas en déduire une position précise.
        progress: mission ? Math.round(progress(mission.pickupZone, mission.dropoffZone, mission.status, position) * 20) / 20 : null,
      });
    }
    return cards;
  },
});
```

- [ ] **Step 5: Run all backend tests**

Run: `pnpm vitest run convex`
Expected: PASS (all files, 12 tests in `fleet.test.ts`)

- [ ] **Step 6: Regenerate the types, check, commit**

Run: `pnpm exec convex codegen && pnpm typecheck && pnpm lint`
Expected: no errors

```bash
git add convex/fleet.ts convex/trucks.ts convex/fleet.test.ts convex/_generated
git commit -m "feat(flotte): vue flotte du transporteur, liste publique sans position, nettoyage des camions supprimés"
```

---

### Task 6: Traductions (fr / en / pt)

**Files:**
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`, `src/i18n/pt.ts`

**Interfaces:**
- Produces: `t.nav.fleet`, `t.meta.fleet.{title,description}`, `t.space.transporterTabs.{fleet,drivers}`, `t.errors.{invalid_position,link_invalid,no_active_mission,driver_unavailable}` and the whole `t.fleet` namespace below. The Tasks 7 to 11 use these exact names.

- [ ] **Step 1: French (reference: it defines the `Dict` type)**

In `src/i18n/fr.ts`:
- `meta`: after `pricing: {…},`, add
  `fleet: { title: "Camions en direct en Guinée-Bissau", description: "Suivez en temps réel le statut des camions AgroTrucks : disponibles, en chargement ou en route vers Bissau, Gabú, Bafatá et toutes les régions." },`
- `nav`: after `sale: "Vente",`, add `fleet: "En direct",`
- `errors`: before `} as Record<string, string>,`, add

```ts
    invalid_position: "Position GPS invalide.",
    link_invalid: "Ce lien de suivi n'est plus valide.",
    no_active_mission: "Aucune mission en cours sur ce véhicule.",
    driver_unavailable: "Ce conducteur est désactivé ou n'a pas de véhicule.",
```

- `space.transporterTabs`: replace with `{ available: "Missions disponibles", assigned: "Mes missions", trucks: "Mes véhicules", fleet: "Ma flotte", drivers: "Conducteurs" },`
- after the `offers: {…},` block, add:

```ts
  fleet: {
    title: "Ma flotte",
    intro: "Vos véhicules et vos conducteurs, en direct.",
    needTwoTrucks: "La gestion de flotte s'active dès 2 véhicules.",
    needTwoTrucksText: "Ajoutez un deuxième véhicule pour suivre vos camions sur la carte et envoyer des liens de suivi à vos conducteurs.",
    stats: { total: "Véhicules", on_route: "En route", available: "Disponibles", maintenance: "En maintenance" },
    status: { available: "Disponible", loading: "En chargement", on_route: "En route", maintenance: "Maintenance" },
    search: "Rechercher un véhicule ou une plaque",
    filterLabel: "Filtrer par statut",
    viewLabel: "Affichage",
    list: "Liste",
    map: "Carte",
    driver: "Conducteur",
    noDriver: "Aucun conducteur",
    noSignal: "Aucun signal",
    signalLost: "Signal perdu",
    lastSignal: (age: string) => `Dernier signal ${age}`,
    ago: (ms: number) => {
      const seconds = Math.max(0, Math.round(ms / 1000));
      if (seconds < 60) return `il y a ${seconds} s`;
      const minutes = Math.floor(seconds / 60);
      return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.floor(minutes / 60)} h`;
    },
    noMatch: "Aucun véhicule ne correspond.",
    progress: "Progression du trajet",
    driversTitle: "Mes conducteurs",
    driversIntro: "Ajoutez vos conducteurs et envoyez-leur un lien de suivi par WhatsApp. Ils n'ont pas besoin de compte.",
    addDriver: "Ajouter un conducteur",
    driverName: "Nom du conducteur",
    driverPhone: "Numéro WhatsApp",
    assignedTruck: "Véhicule affecté",
    noTruck: "Aucun véhicule",
    noDrivers: "Aucun conducteur pour l'instant.",
    sendLink: "Envoyer le lien de suivi",
    openWhatsapp: "Ouvrir WhatsApp",
    copyLink: "Copier le lien",
    copied: "Lien copié",
    revokeLink: "Révoquer le lien",
    linkActive: (date: string) => `Lien actif jusqu'au ${date}`,
    noLink: "Aucun lien actif",
    needsTruck: "Affectez un véhicule pour envoyer un lien.",
    disable: "Désactiver",
    enable: "Réactiver",
    disabled: "Désactivé",
    whatsappMessage: (name: string, truck: string, url: string) =>
      `Bonjour ${name}, voici votre lien de suivi AgroTrucks pour ${truck}. Ouvrez-le au départ et gardez la page ouverte pendant tout le trajet : ${url}`,
    shareTitle: "Partage de position",
    shareIntro: "Votre position est envoyée à votre transporteur et au producteur pendant la mission.",
    start: "Démarrer le partage",
    stop: "Arrêter le partage",
    waitingFix: "Recherche de la position…",
    sent: (age: string) => `Position envoyée ${age}`,
    offline: "Hors ligne : l'envoi reprendra avec le réseau.",
    paused: "Partage en pause pendant que la page était cachée : gardez-la ouverte et l'écran allumé.",
    keepOpen: "Gardez cette page ouverte et l'écran allumé pendant tout le trajet.",
    denied: "La localisation est refusée. Autorisez-la pour ce site dans les réglages du navigateur, puis réessayez.",
    unsupported: "Ce téléphone ne permet pas de partager la position.",
    linkInvalid: "Ce lien n'est plus valide. Demandez un nouveau lien à votre transporteur.",
    trackTitle: "Suivi du trajet",
    hello: (name: string) => `Bonjour ${name}`,
    livePosition: "Position du camion",
    notShared: "Position pas encore partagée.",
    publicEyebrow: "Flotte",
    publicTitle: "Camions en direct",
    publicIntro: "Le statut des camions AgroTrucks en temps réel : disponibles, en chargement ou en route.",
    publicEmpty: "Aucun camion ne correspond.",
    privacyNote: "Pour la sécurité des conducteurs et des cargaisons, la position exacte n'est visible que par le producteur de la mission.",
  },
```

- [ ] **Step 2: English**

In `src/i18n/en.ts`, at the same places:
- `meta`: `fleet: { title: "Live trucks in Guinea-Bissau", description: "Follow the real-time status of AgroTrucks trucks: available, loading or on route to Bissau, Gabú, Bafatá and every region." },`
- `nav`: `fleet: "Live",`
- `errors`:

```ts
    invalid_position: "Invalid GPS position.",
    link_invalid: "This tracking link is no longer valid.",
    no_active_mission: "No ongoing mission on this vehicle.",
    driver_unavailable: "This driver is disabled or has no vehicle.",
```

- `space.transporterTabs`: add `fleet: "My fleet", drivers: "Drivers"`
- after `offers: {…},`:

```ts
  fleet: {
    title: "My fleet",
    intro: "Your vehicles and drivers, live.",
    needTwoTrucks: "Fleet management unlocks from 2 vehicles.",
    needTwoTrucksText: "Add a second vehicle to follow your trucks on the map and send tracking links to your drivers.",
    stats: { total: "Vehicles", on_route: "On route", available: "Available", maintenance: "In maintenance" },
    status: { available: "Available", loading: "Loading", on_route: "On route", maintenance: "Maintenance" },
    search: "Search a vehicle or plate",
    filterLabel: "Filter by status",
    viewLabel: "View",
    list: "List",
    map: "Map",
    driver: "Driver",
    noDriver: "No driver",
    noSignal: "No signal",
    signalLost: "Signal lost",
    lastSignal: (age: string) => `Last signal ${age}`,
    ago: (ms: number) => {
      const seconds = Math.max(0, Math.round(ms / 1000));
      if (seconds < 60) return `${seconds} s ago`;
      const minutes = Math.floor(seconds / 60);
      return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
    },
    noMatch: "No vehicle matches.",
    progress: "Trip progress",
    driversTitle: "My drivers",
    driversIntro: "Add your drivers and send them a tracking link on WhatsApp. They don't need an account.",
    addDriver: "Add a driver",
    driverName: "Driver name",
    driverPhone: "WhatsApp number",
    assignedTruck: "Assigned vehicle",
    noTruck: "No vehicle",
    noDrivers: "No drivers yet.",
    sendLink: "Send tracking link",
    openWhatsapp: "Open WhatsApp",
    copyLink: "Copy link",
    copied: "Link copied",
    revokeLink: "Revoke link",
    linkActive: (date: string) => `Link active until ${date}`,
    noLink: "No active link",
    needsTruck: "Assign a vehicle to send a link.",
    disable: "Disable",
    enable: "Enable",
    disabled: "Disabled",
    whatsappMessage: (name: string, truck: string, url: string) =>
      `Hello ${name}, here is your AgroTrucks tracking link for ${truck}. Open it when you leave and keep the page open for the whole trip: ${url}`,
    shareTitle: "Location sharing",
    shareIntro: "Your position is sent to your transporter and to the farmer during the mission.",
    start: "Start sharing",
    stop: "Stop sharing",
    waitingFix: "Finding your position…",
    sent: (age: string) => `Position sent ${age}`,
    offline: "Offline: sending will resume with the network.",
    paused: "Sharing paused while the page was hidden: keep it open and the screen on.",
    keepOpen: "Keep this page open and the screen on for the whole trip.",
    denied: "Location is blocked. Allow it for this site in your browser settings, then try again.",
    unsupported: "This phone cannot share its location.",
    linkInvalid: "This link is no longer valid. Ask your transporter for a new one.",
    trackTitle: "Trip tracking",
    hello: (name: string) => `Hello ${name}`,
    livePosition: "Truck position",
    notShared: "Position not shared yet.",
    publicEyebrow: "Fleet",
    publicTitle: "Live trucks",
    publicIntro: "The real-time status of AgroTrucks trucks: available, loading or on route.",
    publicEmpty: "No truck matches.",
    privacyNote: "For the safety of drivers and cargo, the exact position is only visible to the farmer of the mission.",
  },
```

- [ ] **Step 3: Portuguese (European, as in the rest of `pt.ts`)**

In `src/i18n/pt.ts`, at the same places:
- `meta`: `fleet: { title: "Camiões em direto na Guiné-Bissau", description: "Acompanhe em tempo real o estado dos camiões AgroTrucks: disponíveis, a carregar ou em rota para Bissau, Gabú, Bafatá e todas as regiões." },`
- `nav`: `fleet: "Em direto",`
- `errors`:

```ts
    invalid_position: "Posição GPS inválida.",
    link_invalid: "Esta ligação de seguimento já não é válida.",
    no_active_mission: "Nenhuma missão em curso nesta viatura.",
    driver_unavailable: "Este motorista está desativado ou não tem viatura.",
```

- `space.transporterTabs`: add `fleet: "A minha frota", drivers: "Motoristas"`
- after `offers: {…},`:

```ts
  fleet: {
    title: "A minha frota",
    intro: "As suas viaturas e motoristas, em direto.",
    needTwoTrucks: "A gestão de frota fica disponível a partir de 2 viaturas.",
    needTwoTrucksText: "Adicione uma segunda viatura para seguir os seus camiões no mapa e enviar ligações de seguimento aos seus motoristas.",
    stats: { total: "Viaturas", on_route: "Em rota", available: "Disponíveis", maintenance: "Em manutenção" },
    status: { available: "Disponível", loading: "A carregar", on_route: "Em rota", maintenance: "Manutenção" },
    search: "Procurar uma viatura ou matrícula",
    filterLabel: "Filtrar por estado",
    viewLabel: "Vista",
    list: "Lista",
    map: "Mapa",
    driver: "Motorista",
    noDriver: "Sem motorista",
    noSignal: "Sem sinal",
    signalLost: "Sinal perdido",
    lastSignal: (age: string) => `Último sinal ${age}`,
    ago: (ms: number) => {
      const seconds = Math.max(0, Math.round(ms / 1000));
      if (seconds < 60) return `há ${seconds} s`;
      const minutes = Math.floor(seconds / 60);
      return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)} h`;
    },
    noMatch: "Nenhuma viatura corresponde.",
    progress: "Progresso da viagem",
    driversTitle: "Os meus motoristas",
    driversIntro: "Adicione os seus motoristas e envie-lhes uma ligação de seguimento pelo WhatsApp. Não precisam de conta.",
    addDriver: "Adicionar motorista",
    driverName: "Nome do motorista",
    driverPhone: "Número de WhatsApp",
    assignedTruck: "Viatura atribuída",
    noTruck: "Nenhuma viatura",
    noDrivers: "Ainda não há motoristas.",
    sendLink: "Enviar ligação de seguimento",
    openWhatsapp: "Abrir o WhatsApp",
    copyLink: "Copiar ligação",
    copied: "Ligação copiada",
    revokeLink: "Revogar ligação",
    linkActive: (date: string) => `Ligação ativa até ${date}`,
    noLink: "Nenhuma ligação ativa",
    needsTruck: "Atribua uma viatura para enviar uma ligação.",
    disable: "Desativar",
    enable: "Reativar",
    disabled: "Desativado",
    whatsappMessage: (name: string, truck: string, url: string) =>
      `Olá ${name}, aqui está a sua ligação de seguimento AgroTrucks para ${truck}. Abra-a à partida e mantenha a página aberta durante toda a viagem: ${url}`,
    shareTitle: "Partilha de localização",
    shareIntro: "A sua posição é enviada ao seu transportador e ao produtor durante a missão.",
    start: "Iniciar partilha",
    stop: "Parar partilha",
    waitingFix: "A procurar a posição…",
    sent: (age: string) => `Posição enviada ${age}`,
    offline: "Sem rede: o envio recomeça quando a rede voltar.",
    paused: "Partilha em pausa enquanto a página esteve escondida: mantenha-a aberta e o ecrã ligado.",
    keepOpen: "Mantenha esta página aberta e o ecrã ligado durante toda a viagem.",
    denied: "A localização está bloqueada. Autorize-a para este site nas definições do navegador e tente de novo.",
    unsupported: "Este telemóvel não permite partilhar a localização.",
    linkInvalid: "Esta ligação já não é válida. Peça uma nova ao seu transportador.",
    trackTitle: "Seguimento da viagem",
    hello: (name: string) => `Olá ${name}`,
    livePosition: "Posição do camião",
    notShared: "Posição ainda não partilhada.",
    publicEyebrow: "Frota",
    publicTitle: "Camiões em direto",
    publicIntro: "O estado dos camiões AgroTrucks em tempo real: disponíveis, a carregar ou em rota.",
    publicEmpty: "Nenhum camião corresponde.",
    privacyNote: "Para a segurança dos motoristas e das cargas, a posição exata só é visível para o produtor da missão.",
  },
```

- [ ] **Step 4: Check that the three dictionaries have the same shape**

Run: `pnpm typecheck`
Expected: no errors (a missing key in `en.ts` or `pt.ts` fails here)

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat(flotte): textes fr, en, pt de la gestion de flotte"
```

---

### Task 7: Briques client (carte, partage de position, barre, badge)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`leaflet`, `@types/leaflet`)
- Create: `src/lib/use-now.ts`
- Create: `src/lib/location-sharing.ts`
- Create: `src/components/fleet/fleet-map.tsx`
- Create: `src/components/fleet/sharing-panel.tsx`
- Create: `src/components/fleet/progress-bar.tsx`
- Create: `src/components/fleet/status-badge.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `shouldSend`, `escapeHtml`, `zoneCenter`, `DisplayStatus` (Task 1) ; `t.fleet.*` (Task 6) ; `errorCode` (`src/lib/errors.ts`).
- Produces:
  - `useNow(intervalMs?: number): number`
  - `type FixPayload = { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }`
  - `useLocationSharing(send: (fix: FixPayload) => Promise<unknown>)` → `{ state: SharingState; lastSentAt: number | null; failure: string | null; paused: boolean; online: boolean; start(): void; stop(): void }`
  - `<SharingPanel send={(fix: FixPayload) => Promise<unknown>} />`
  - `type MapMarker = { id: string; lat: number; lng: number; label: string; title: string; detail: string; stale: boolean }`
  - `<FleetMap markers={MapMarker[]} label={string} follow?={boolean} className?={string} />`
  - `<ProgressBar value={number} from={Zone} to={Zone} />`
  - `<FleetStatusBadge status={DisplayStatus} />`
  - classes CSS `fleet-pin`, `fleet-pin--stale`

- [ ] **Step 1: Install Leaflet**

Run: `pnpm add leaflet@^1.9.4 && pnpm add -D @types/leaflet@^1.9`
Expected: `package.json` lists `leaflet` in `dependencies` and `@types/leaflet` in `devDependencies`

- [ ] **Step 2: Write `src/lib/use-now.ts`**

```ts
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
```

- [ ] **Step 3: Write `src/lib/location-sharing.ts`**

```ts
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
    navigator.wakeLock.request("screen").then((lock) => { wakeLock.current = lock; }).catch(() => undefined);
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
        .then(() => { last.current = fix; setLastSentAt(Date.now()); setFailure(null); setPaused(false); setState("sharing"); })
        .catch((reason: unknown) => {
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
```

- [ ] **Step 4: Write `src/components/fleet/sharing-panel.tsx`**

```tsx
import { MapPin, Pause, WifiOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormMessage } from "~/components/ui/form";
import { useT } from "~/lib/i18n";
import { useLocationSharing, type FixPayload } from "~/lib/location-sharing";
import { useNow } from "~/lib/use-now";

// Bouton « Démarrer / Arrêter le partage » et état en clair. Utilisé par le conducteur (lien) et le transporteur particulier.
export function SharingPanel({ send }: { send: (fix: FixPayload) => Promise<unknown> }) {
  const t = useT();
  const sharing = useLocationSharing(send);
  const now = useNow(5_000);
  const active = sharing.state === "waiting" || sharing.state === "sharing";
  const failure = sharing.failure === "link_invalid"
    ? t.fleet.linkInvalid
    : sharing.failure && sharing.failure !== "network" ? t.errors[sharing.failure] ?? t.common.genericError : null;

  return <div className="grid gap-3">
    {active
      ? <Button size="lg" variant="danger" onClick={sharing.stop}>{t.fleet.stop}</Button>
      : <Button size="lg" onClick={sharing.start} disabled={sharing.state === "unsupported"}><MapPin aria-hidden="true" />{t.fleet.start}</Button>}
    <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-ink">
      {sharing.state === "waiting" && t.fleet.waitingFix}
      {sharing.state === "sharing" && sharing.lastSentAt !== null && t.fleet.sent(t.fleet.ago(now - sharing.lastSentAt))}
    </p>
    {active && !sharing.online && <p className="flex items-center gap-2 text-sm text-muted"><WifiOff className="size-4 shrink-0" aria-hidden="true" />{t.fleet.offline}</p>}
    {active && sharing.paused && <p className="flex items-center gap-2 text-sm text-muted"><Pause className="size-4 shrink-0" aria-hidden="true" />{t.fleet.paused}</p>}
    {active && <p className="text-sm text-muted">{t.fleet.keepOpen}</p>}
    {sharing.state === "denied" && <FormMessage>{t.fleet.denied}</FormMessage>}
    {sharing.state === "unsupported" && <FormMessage>{t.fleet.unsupported}</FormMessage>}
    {failure && <FormMessage>{failure}</FormMessage>}
  </div>;
}
```

- [ ] **Step 5: Write `src/components/fleet/fleet-map.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { cn } from "~/lib/cn";
import { escapeHtml, zoneCenter } from "~/shared/fleet";

export interface MapMarker { id: string; lat: number; lng: number; label: string; title: string; detail: string; stale: boolean }

type Leaflet = typeof import("leaflet");

const DEFAULT_CENTER = zoneCenter("bissau");
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Carte OpenStreetMap avec Leaflet (~40 Ko), chargée seulement quand elle s'affiche : rien côté serveur, pas de WebGL.
// `follow` : la carte suit le repère unique à chaque mise à jour (suivi d'un camion par le producteur).
export function FleetMap({ markers, label, follow = false, className }: { markers: MapMarker[]; label: string; follow?: boolean; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(element);
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
  }, []);

  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, map, layer } = current;
    layer.clearLayers();
    for (const marker of markers) {
      const icon = L.divIcon({
        className: "",
        html: `<span class="${cn("fleet-pin", marker.stale && "fleet-pin--stale")}">${escapeHtml(marker.label)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([marker.lat, marker.lng], { icon, title: marker.title })
        .bindPopup(`<strong>${escapeHtml(marker.title)}</strong><br>${escapeHtml(marker.detail)}`)
        .addTo(layer);
    }
    const [only] = markers;
    if (!fitted.current && markers.length) {
      // Cadrage au premier affichage seulement : les mises à jour ne font pas sauter la carte.
      fitted.current = true;
      if (markers.length === 1 && only) map.setView([only.lat, only.lng], 12);
      else map.fitBounds(L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as [number, number])), { padding: [32, 32], maxZoom: 13 });
    } else if (follow && markers.length === 1 && only) {
      map.panTo([only.lat, only.lng]);
    }
  }, [ready, markers, follow]);

  return <div ref={container} role="region" aria-label={label} className={cn("isolate bg-brand-50", className)} />;
}
```

- [ ] **Step 6: Write `src/components/fleet/progress-bar.tsx` and `status-badge.tsx`**

`src/components/fleet/progress-bar.tsx`:

```tsx
import { useT } from "~/lib/i18n";
import { zoneLabels, type Zone } from "~/shared/zones";

export function ProgressBar({ value, from, to }: { value: number; from: Zone; to: Zone }) {
  const t = useT();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return <div>
    <div role="progressbar" aria-label={t.fleet.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-brand-50">
      <div className="h-full rounded-full bg-harvest-400" style={{ width: `${percent}%` }} />
    </div>
    <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted"><span>{zoneLabels[from]}</span><span>{zoneLabels[to]}</span></div>
  </div>;
}
```

`src/components/fleet/status-badge.tsx`:

```tsx
import { Badge } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import type { DisplayStatus } from "~/shared/fleet";

const tones = { available: "success", loading: "harvest", on_route: "brand", maintenance: "danger" } as const;

export function FleetStatusBadge({ status }: { status: DisplayStatus }) {
  const t = useT();
  return <Badge tone={tones[status]}>{t.fleet.status[status]}</Badge>;
}
```

- [ ] **Step 7: Style the numbered pins**

At the end of `src/styles/app.css`, add:

```css
/* Repères numérotés de la carte de flotte (aussi utilisés dans la liste, pour retrouver le même camion). */
.fleet-pin { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9999px; border: 2px solid #fff; background: var(--color-brand-800); color: #fff; font: 600 13px/1 Poppins, system-ui, sans-serif; box-shadow: 0 1px 4px rgb(0 0 0 / 0.35); }
.fleet-pin--stale { background: #8a8f98; }
```

- [ ] **Step 8: Check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: no errors, all tests PASS

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/use-now.ts src/lib/location-sharing.ts src/components/fleet src/styles/app.css
git commit -m "feat(flotte): carte Leaflet, partage de position et composants de suivi"
```

---

### Task 8: Page du conducteur et partage depuis le compte

**Files:**
- Create: `src/routes/$lang/track.$token.tsx`
- Modify: `src/routes/$lang/transporter/missions.$missionId.tsx`

**Interfaces:**
- Consumes: `api.tracking.linkInfo`, `api.tracking.reportFromLink`, `api.tracking.reportFromOwner` (Task 4) ; `SharingPanel`, `FixPayload`, `useNow` (Task 7) ; `privateHead`.
- Produces: route `/$lang/track/$token` (sans compte, `noindex`).

- [ ] **Step 1: Write the driver page**

Create `src/routes/$lang/track.$token.tsx`:

```tsx
import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Truck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { SharingPanel } from "~/components/fleet/sharing-panel";
import { Card, EmptyState } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import type { FixPayload } from "~/lib/location-sharing";
import { privateHead } from "~/lib/private-route";
import { useNow } from "~/lib/use-now";

export const Route = createFileRoute("/$lang/track/$token")({
  head: ({ params }) => privateHead(params.lang),
  component: TrackPage,
});

// Page ouverte par le conducteur depuis WhatsApp : pas de compte, le lien suffit.
function TrackPage() {
  const t = useT();
  const { token } = Route.useParams();
  const info = useQuery(api.tracking.linkInfo, { linkToken: token });
  const report = useMutation(api.tracking.reportFromLink);
  const send = useCallback((fix: FixPayload) => report({ linkToken: token, ...fix }), [report, token]);
  const now = useNow(60_000);
  const valid = info && info.active && info.expiresAt > now;

  return <div className="container-page max-w-lg py-10">
    {info === undefined && <p className="text-muted">{t.common.loading}</p>}
    {info !== undefined && !valid && <EmptyState title={t.fleet.linkInvalid} />}
    {info && valid && <Card className="grid gap-5 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{t.fleet.trackTitle}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t.fleet.hello(info.driverName)}</h1>
        <p className="mt-2 flex items-center gap-2 text-muted"><Truck className="size-4 shrink-0" aria-hidden="true" />{info.truckName}{info.plate && ` · ${info.plate}`}</p>
      </div>
      <SharingPanel send={send} />
    </Card>}
  </div>;
}
```

- [ ] **Step 2: Add sharing to the transporter's mission page**

In `src/routes/$lang/transporter/missions.$missionId.tsx`:
- add the imports `import { useMutation } from "convex/react";` and `import { SharingPanel } from "~/components/fleet/sharing-panel";`;
- in `TransporterMission`, after `const [busy, setBusy] = useState(false);`, add `const reportOwner = useMutation(api.tracking.reportFromOwner);`;
- after `const next = …;`, add:

```tsx
  // Transporteur particulier : il partage sa position depuis son compte tant que sa mission est en cours.
  const shareTruckId = mine && (mission.status === "assigned" || mission.status === "loaded") ? mission.truck?._id : undefined;
```

- in the `<div className="mt-6 grid gap-4">` block, after the line `{mine && mission.truck && <Card …><TruckLine … /></Card>}`, add:

```tsx
      {shareTruckId && <Card className="p-5">
        <p className="font-semibold text-ink">{t.fleet.shareTitle}</p>
        <p className="mb-4 mt-1 text-sm text-muted">{t.fleet.shareIntro}</p>
        <SharingPanel send={(fix) => reportOwner({ token, truckId: shareTruckId, ...fix })} />
      </Card>}
```

- [ ] **Step 3: Regenerate the routes and check**

Run: `pnpm build && pnpm typecheck && pnpm lint`
Expected: `src/routeTree.gen.ts` contains `/$lang/track/$token`, no errors

- [ ] **Step 4: Manual check (Review Focus 1 and 2)**

Run `pnpm dev:backend` and `pnpm dev`. With a transporter account that has 2 trucks, create a driver in the Convex dashboard or wait for Task 9; otherwise call `tracking.createLink` from the dashboard's Functions tab.
- Open `http://localhost:3000/fr/track/<linkToken>`, then « Démarrer le partage » and accept the location: « Position envoyée il y a … s » appears, and a row exists in the `positions` table.
- Block location for the site (browser settings), reload and start again: the « La localisation est refusée… » message appears, without repeated errors.
- Revoke the link from the dashboard (`tracking.revokeLink`) while sharing is on: at the next send, sharing stops and « Ce lien n'est plus valide… » appears.
- In DevTools, use Sensors to simulate a position, and Network → Offline: « Hors ligne… » appears and nothing is sent.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/\$lang/track.\$token.tsx" "src/routes/\$lang/transporter/missions.\$missionId.tsx" src/routeTree.gen.ts
git commit -m "feat(flotte): page de suivi du conducteur et partage de position du transporteur"
```

---

### Task 9: Tableau de bord flotte, conducteurs et onglets

**Files:**
- Create: `src/routes/$lang/transporter/fleet.tsx`
- Create: `src/routes/$lang/transporter/drivers.tsx`
- Modify: `src/components/layout/space-nav.tsx`

**Interfaces:**
- Consumes: `api.fleet.access`, `api.fleet.overview` (Task 5) ; `api.drivers.*` (Task 3) ; `api.tracking.createLink|revokeLink` (Task 4) ; `api.trucks.mine` ; `FleetMap`, `MapMarker`, `ProgressBar`, `FleetStatusBadge`, `useNow` (Task 7) ; `DISPLAY_STATUSES`, `isStale`, `firstName`, `whatsappUrl` (Task 1).
- Produces: routes `/$lang/transporter/fleet` and `/$lang/transporter/drivers` ; onglets « Ma flotte » et « Conducteurs » visibles seulement si `fleet.access` renvoie `true`.

- [ ] **Step 1: Write the fleet dashboard**

Create `src/routes/$lang/transporter/fleet.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search, UserRound } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { FleetMap, type MapMarker } from "~/components/fleet/fleet-map";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { FleetStatusBadge } from "~/components/fleet/status-badge";
import { SessionGate } from "~/components/session-gate";
import { buttonClass } from "~/components/ui/button";
import { Card, EmptyState, PageTitle, Tabs } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { cn } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { DISPLAY_STATUSES, isStale, type DisplayStatus } from "~/shared/fleet";

type FleetTruck = FunctionReturnType<typeof api.fleet.overview>[number];

export const Route = createFileRoute("/$lang/transporter/fleet")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><FleetPage /></SessionGate>,
});

// Tableau de bord du transporteur Pro : compteurs, liste des véhicules et carte des positions.
function FleetPage() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const access = useQuery(api.fleet.access, { token });
  const trucks = useQuery(api.fleet.overview, access?.fleet ? { token } : "skip");
  const now = useNow();
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  // Numéro d'un camion = son rang dans toute la flotte : le même dans la liste et sur la carte, quel que soit le filtre.
  const numbered = useMemo(() => (trucks ?? []).map((truck, index) => ({ truck, label: String(index + 1) })), [trucks]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return numbered.filter(({ truck }) => (filter === "all" || truck.status === filter)
      && (!needle || truck.name.toLowerCase().includes(needle) || (truck.plate ?? "").toLowerCase().includes(needle)));
  }, [numbered, filter, search]);
  const markers = useMemo<MapMarker[]>(() => shown.flatMap(({ truck, label }) => truck.position ? [{
    id: truck._id,
    label,
    lat: truck.position.lat,
    lng: truck.position.lng,
    title: truck.plate ? `${truck.name} · ${truck.plate}` : truck.name,
    detail: `${truck.driver?.name ?? t.fleet.noDriver} — ${t.fleet.lastSignal(t.fleet.ago(now - truck.position.at))}`,
    stale: isStale(truck.position.at, now),
  }] : []), [shown, now, t]);

  if (access === undefined) return <p className="text-muted">{t.common.loading}</p>;
  if (!access.fleet) return <EmptyState title={t.fleet.needTwoTrucks} text={t.fleet.needTwoTrucksText}
    action={<Link to="/$lang/transporter/trucks/new" params={{ lang }} className={buttonClass("primary")}>{t.transporter.addTruck}</Link>} />;

  const count = (status: DisplayStatus) => (trucks ?? []).filter((truck) => truck.status === status).length;
  const stats = [
    [t.fleet.stats.total, trucks?.length ?? 0],
    [t.fleet.stats.on_route, count("on_route")],
    [t.fleet.stats.available, count("available")],
    [t.fleet.stats.maintenance, count("maintenance")],
  ] as const;

  return <>
    <PageTitle title={t.fleet.title} intro={t.fleet.intro}
      actions={<Link to="/$lang/transporter/drivers" params={{ lang }} className={buttonClass("secondary", "sm")}><UserRound aria-hidden="true" />{t.fleet.driversTitle}</Link>} />

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([label, value]) => <Card key={label} className="p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold text-ink">{value}</p></Card>)}
    </div>

    <div className="mt-6 flex flex-wrap items-center gap-3">
      <label className="relative w-full sm:max-w-xs">
        <span className="sr-only">{t.fleet.search}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.fleet.search} className="pl-9" />
      </label>
      <Tabs value={filter} onChange={setFilter} label={t.fleet.filterLabel}
        options={[["all", t.common.all] as const, ...DISPLAY_STATUSES.map((status) => [status, t.fleet.status[status]] as const)]} />
      <div className="lg:hidden">
        <Tabs value={view} onChange={setView} label={t.fleet.viewLabel} options={[["list", t.fleet.list], ["map", t.fleet.map]] as const} />
      </div>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className={cn("grid content-start gap-3", view === "map" && "hidden lg:grid")}>
        {trucks === undefined && <p className="text-muted">{t.common.loading}</p>}
        {shown.map(({ truck, label }) => <FleetRow key={truck._id} truck={truck} label={label} now={now} />)}
        {trucks && shown.length === 0 && <EmptyState title={t.fleet.noMatch} />}
      </div>
      <div className={cn("h-[65vh] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]", view === "list" && "hidden lg:block")}>
        <FleetMap markers={markers} label={t.fleet.map} className="size-full overflow-hidden rounded-[var(--radius-card)] border border-line" />
      </div>
    </div>
  </>;
}

function FleetRow({ truck, label, now }: { truck: FleetTruck; label: string; now: number }) {
  const t = useT();
  const stale = !truck.position || isStale(truck.position.at, now);
  const signal = !truck.position ? t.fleet.noSignal : stale ? t.fleet.signalLost : t.fleet.lastSignal(t.fleet.ago(now - truck.position.at));
  return <Card className="p-4">
    <div className="flex items-start gap-3">
      <span className={cn("fleet-pin shrink-0", stale && "fleet-pin--stale")} aria-hidden="true">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate font-semibold text-ink">{truck.name}{truck.plate && <span className="ml-2 text-sm font-normal text-muted">{truck.plate}</span>}</p>
          <FleetStatusBadge status={truck.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{t.fleet.driver} : {truck.driver?.name ?? t.fleet.noDriver} · {signal}</p>
        {truck.mission && truck.progress !== null && <div className="mt-3"><ProgressBar value={truck.progress} from={truck.mission.pickupZone} to={truck.mission.dropoffZone} /></div>}
      </div>
    </div>
  </Card>;
}
```

- [ ] **Step 2: Write the drivers page**

Create `src/routes/$lang/transporter/drivers.tsx`:

```tsx
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, Plus, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SessionGate } from "~/components/session-gate";
import { Button, buttonClass } from "~/components/ui/button";
import { Badge, Card, EmptyState, PageTitle } from "~/components/ui/card";
import { Field, FormMessage, Input, Select } from "~/components/ui/form";
import { errorMessage } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { firstName, whatsappUrl } from "~/shared/fleet";

type Driver = FunctionReturnType<typeof api.drivers.list>[number];
interface TruckOption { id: Id<"trucks">; name: string }

export const Route = createFileRoute("/$lang/transporter/drivers")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><DriversPage /></SessionGate>,
});

// Conducteurs de l'entreprise : ajout, affectation d'un véhicule, lien de suivi WhatsApp.
function DriversPage() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const access = useQuery(api.fleet.access, { token });
  const drivers = useQuery(api.drivers.list, access?.fleet ? { token } : "skip");
  const trucks = useQuery(api.trucks.mine, { token });
  const [adding, setAdding] = useState(false);

  if (access === undefined) return <p className="text-muted">{t.common.loading}</p>;
  if (!access.fleet) return <EmptyState title={t.fleet.needTwoTrucks} text={t.fleet.needTwoTrucksText}
    action={<Link to="/$lang/transporter/trucks/new" params={{ lang }} className={buttonClass("primary")}>{t.transporter.addTruck}</Link>} />;

  const truckOptions: TruckOption[] = (trucks ?? []).map((truck) => ({ id: truck._id, name: truck.plate ? `${truck.name} · ${truck.plate}` : truck.name }));

  return <div className="mx-auto max-w-3xl">
    <PageTitle title={t.fleet.driversTitle} intro={t.fleet.driversIntro}
      actions={!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{t.fleet.addDriver}</Button>} />
    {adding && <div className="mt-6"><DriverForm trucks={truckOptions} onDone={() => setAdding(false)} /></div>}
    <div className="mt-6 grid gap-3">
      {drivers === undefined && <p className="text-muted">{t.common.loading}</p>}
      {drivers?.map((driver) => <DriverCard key={driver._id} driver={driver} trucks={truckOptions} />)}
      {drivers?.length === 0 && !adding && <EmptyState title={t.fleet.noDrivers} />}
    </div>
  </div>;
}

function DriverForm({ driver, trucks, onDone }: { driver?: Driver; trucks: TruckOption[]; onDone: () => void }) {
  const t = useT();
  const token = useToken();
  const create = useMutation(api.drivers.create);
  const update = useMutation(api.drivers.update);
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [truckId, setTruckId] = useState<string>(driver?.truckId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prefix = driver?._id ?? "new-driver";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const fields = { token, name, phone, truckId: truckId ? (truckId as Id<"trucks">) : undefined };
    try {
      if (driver) await update({ ...fields, driverId: driver._id });
      else await create(fields);
      onDone();
    } catch (reason) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  };

  return <Card className="p-5">
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-name`} label={t.fleet.driverName}><Input id={`${prefix}-name`} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field id={`${prefix}-phone`} label={t.fleet.driverPhone}><Input id={`${prefix}-phone`} type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
      </div>
      <Field id={`${prefix}-truck`} label={t.fleet.assignedTruck}>
        <Select id={`${prefix}-truck`} value={truckId} onChange={(event) => setTruckId(event.target.value)}>
          <option value="">{t.fleet.noTruck}</option>
          {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.name}</option>)}
        </Select>
      </Field>
      {error && <FormMessage>{error}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? t.common.saving : t.common.save}</Button>
        <Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button>
      </div>
    </form>
  </Card>;
}

function DriverCard({ driver, trucks }: { driver: Driver; trucks: TruckOption[] }) {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const now = useNow(60_000);
  const createLink = useMutation(api.tracking.createLink);
  const revokeLink = useMutation(api.tracking.revokeLink);
  const setDisabled = useMutation(api.drivers.setDisabled);
  const [editing, setEditing] = useState(false);
  const [shared, setShared] = useState<{ url: string; whatsapp: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await action(); } catch (reason) { setError(errorMessage(reason, t)); } finally { setBusy(false); }
  };

  // Le lien s'ouvre ensuite par un vrai clic sur « Ouvrir WhatsApp » : un window.open après un await serait bloqué.
  const send = () => run(async () => {
    const { linkToken } = await createLink({ token, driverId: driver._id });
    const url = `${window.location.origin}/${lang}/track/${linkToken}`;
    setCopied(false);
    setShared({ url, whatsapp: whatsappUrl(driver.phone, t.fleet.whatsappMessage(firstName(driver.name), driver.truckName ?? "", url)) });
  });
  const copy = (url: string) => void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => undefined);

  if (editing) return <DriverForm driver={driver} trucks={trucks} onDone={() => setEditing(false)} />;

  const expiresAt = driver.linkExpiresAt;
  const linkActive = expiresAt !== null && expiresAt > now;

  return <Card className="grid gap-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{driver.name}</p>
        <p className="text-sm text-muted">{driver.phone} · {driver.truckName ?? t.fleet.noTruck}</p>
        <p className="mt-1 text-sm text-muted">{linkActive ? t.fleet.linkActive(t.common.dateTime(expiresAt)) : t.fleet.noLink}</p>
      </div>
      {driver.disabled && <Badge tone="danger">{t.fleet.disabled}</Badge>}
    </div>
    {shared && <div className="grid gap-2 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-2">
      <a href={shared.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("whatsapp")}><Send aria-hidden="true" />{t.fleet.openWhatsapp}</a>
      <Button variant="secondary" onClick={() => copy(shared.url)}><Copy aria-hidden="true" />{copied ? t.fleet.copied : t.fleet.copyLink}</Button>
    </div>}
    {!driver.truckId && !driver.disabled && <p className="text-sm text-muted">{t.fleet.needsTruck}</p>}
    {error && <FormMessage>{error}</FormMessage>}
    <div className="flex flex-wrap gap-2">
      {!driver.disabled && driver.truckId && <Button size="sm" onClick={send} disabled={busy}><Send aria-hidden="true" />{t.fleet.sendLink}</Button>}
      {linkActive && <Button size="sm" variant="secondary" disabled={busy}
        onClick={() => run(async () => { await revokeLink({ token, driverId: driver._id }); setShared(null); })}>{t.fleet.revokeLink}</Button>}
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t.common.edit}</Button>
      <Button size="sm" variant="ghost" disabled={busy}
        onClick={() => run(() => setDisabled({ token, driverId: driver._id, disabled: !driver.disabled }))}>{driver.disabled ? t.fleet.enable : t.fleet.disable}</Button>
    </div>
  </Card>;
}
```

- [ ] **Step 3: Show the tabs to fleet owners only**

In `src/components/layout/space-nav.tsx`:
- add the imports `import { useQuery } from "convex/react";` and `import { api } from "../../../convex/_generated/api";`;
- replace `const { session, signOut } = useSession();` with:

```tsx
  const { session, signOut, token } = useSession();
  // Onglets « Ma flotte » et « Conducteurs » : seulement pour un transporteur avec 2 véhicules ou plus.
  const access = useQuery(api.fleet.access, session?.role === "transporter" && token ? { token } : "skip");
```

- in `transporter: [...]`, after the `trucks` tab, add:

```tsx
      ...(access?.fleet ? [
        { to: "/$lang/transporter/fleet", label: t.space.transporterTabs.fleet },
        { to: "/$lang/transporter/drivers", label: t.space.transporterTabs.drivers },
      ] : []),
```

- [ ] **Step 4: Regenerate the routes and check**

Run: `pnpm build && pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 5: Manual check (Review Focus 4 and 5)**

With `pnpm dev:backend` and `pnpm dev` running:
- A transporter with **1** truck: no « Ma flotte » tab ; `/fr/transporter/fleet` shows « La gestion de flotte s'active dès 2 véhicules » with the « Ajouter un véhicule » button.
- Add a second truck: the tabs appear without a reload (reactive query).
- `/fr/transporter/drivers`: add « Mamadu Baldé » with a vehicle, then « Envoyer le lien de suivi ». « Ouvrir WhatsApp » opens `wa.me/245…` with the pre-filled message, and « Copier le lien » copies the URL.
- Open the copied link in another browser, start sharing (simulated position in DevTools → Sensors): in `/fr/transporter/fleet`, marker **1** appears, and the row shows « Dernier signal il y a … ».
- On a narrow window (< 1024 px): « Liste » tab, then « Carte » tab: the map is shown whole, not as a grey square.
- Delete a truck to go back to 1 vehicle: the pages show the invitation again, and the driver's page says « Ce lien n'est plus valide » at the next send.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/\$lang/transporter/fleet.tsx" "src/routes/\$lang/transporter/drivers.tsx" src/components/layout/space-nav.tsx src/routeTree.gen.ts
git commit -m "feat(flotte): tableau de bord flotte avec carte et gestion des conducteurs"
```

---

### Task 10: Suivi du camion par le producteur

**Files:**
- Create: `src/components/fleet/live-truck.tsx`
- Modify: `src/routes/$lang/producer/missions.$missionId.tsx`

**Interfaces:**
- Consumes: `api.tracking.missionPosition` (Task 4) ; `FleetMap`, `MapMarker`, `ProgressBar`, `useNow` (Task 7) ; `isStale` (Task 1).
- Produces: `<LiveTruck missionId={Id<"missions">} from={Zone} to={Zone} />`

- [ ] **Step 1: Write the component**

Create `src/components/fleet/live-truck.tsx`:

```tsx
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FleetMap, type MapMarker } from "~/components/fleet/fleet-map";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { Card } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { isStale } from "~/shared/fleet";
import type { Zone } from "~/shared/zones";

// Pour le producteur, pendant la mission : position du camion, progression et conducteur.
export function LiveTruck({ missionId, from, to }: { missionId: Id<"missions">; from: Zone; to: Zone }) {
  const t = useT();
  const token = useToken();
  const live = useQuery(api.tracking.missionPosition, { token, missionId });
  const now = useNow();
  const position = live?.position ?? null;
  const markers = useMemo<MapMarker[]>(() => position ? [{
    id: "truck", label: "1", lat: position.lat, lng: position.lng, title: t.fleet.livePosition,
    detail: t.fleet.lastSignal(t.fleet.ago(now - position.at)), stale: isStale(position.at, now),
  }] : [], [position, now, t]);

  if (!live) return null;
  return <Card className="grid gap-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold text-muted">{t.fleet.livePosition}</p>
      {position && <span className="text-sm text-muted">{isStale(position.at, now) ? t.fleet.signalLost : t.fleet.lastSignal(t.fleet.ago(now - position.at))}</span>}
    </div>
    <ProgressBar value={live.progress} from={from} to={to} />
    {live.driverName && <p className="text-sm">{t.fleet.driver} : <span className="font-semibold">{live.driverName}</span></p>}
    {position
      ? <FleetMap markers={markers} label={t.fleet.livePosition} follow className="h-64 overflow-hidden rounded-xl border border-line" />
      : <p className="text-sm text-muted">{t.fleet.notShared}</p>}
  </Card>;
}
```

- [ ] **Step 2: Show it on the producer's mission page**

In `src/routes/$lang/producer/missions.$missionId.tsx`:
- add the import `import { LiveTruck } from "~/components/fleet/live-truck";`;
- in the `: <>…</>` branch (mission not pending), after `{mission.truck && <Card …><TruckLine … /></Card>}`, add:

```tsx
            {mission.truck && (mission.status === "assigned" || mission.status === "loaded") &&
              <LiveTruck missionId={mission._id} from={mission.pickupZone} to={mission.dropoffZone} />}
```

- [ ] **Step 3: Check**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 4: Manual check**

With a producer and a transporter (solo, 1 truck): the producer publishes Gabú → Bissau, the transporter offers with their truck, and the producer chooses the offer.
- On the producer side, the mission shows « Position du camion », a progress bar at 0 % and « Position pas encore partagée ».
- On the transporter side, the mission shows « Partage de position ». Start it with a simulated position near Bafatá, then « J'ai chargé ».
- The producer sees the marker and the bar moves forward (about 50 %) without a reload.
- Another producer does not see this block. Once the mission is delivered, the block disappears.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/live-truck.tsx "src/routes/\$lang/producer/missions.\$missionId.tsx"
git commit -m "feat(flotte): le producteur suit la position de son camion pendant la mission"
```

---

### Task 11: Page publique « Camions en direct »

**Files:**
- Create: `src/routes/$lang/fleet.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/routes/sitemap[.]xml.ts`

**Interfaces:**
- Consumes: `api.fleet.publicList` (Task 5) ; `ProgressBar`, `FleetStatusBadge` (Task 7) ; `DISPLAY_STATUSES` (Task 1) ; `t.meta.fleet`, `t.nav.fleet`, `t.fleet.public*` (Task 6) ; `seo` (`src/lib/seo.ts`).
- Produces: public route `/$lang/fleet`, rendered on the server and indexed (3 languages + hreflang).

- [ ] **Step 1: Write the page**

Create `src/routes/$lang/fleet.tsx`:

```tsx
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { Scale, ShieldCheck, Star, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { FleetStatusBadge } from "~/components/fleet/status-badge";
import { EmptyState, Tabs } from "~/components/ui/card";
import { VehicleIcon } from "~/components/vehicle-icon";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";
import { DISPLAY_STATUSES, type DisplayStatus } from "~/shared/fleet";

const fleetQuery = convexQuery(api.fleet.publicList, {});
type PublicTruck = FunctionReturnType<typeof api.fleet.publicList>[number];

export const Route = createFileRoute("/$lang/fleet")({
  loader: ({ context }) => context.queryClient.ensureQueryData(fleetQuery),
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/fleet", title: t.meta.fleet.title, description: t.meta.fleet.description });
  },
  component: PublicFleetPage,
});

// Statut des camions en temps réel. Aucune position : seul le producteur de la mission voit la carte.
function PublicFleetPage() {
  const t = useT();
  const { data: trucks } = useSuspenseQuery(fleetQuery);
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");
  const shown = trucks.filter((truck) => filter === "all" || truck.status === filter);

  return <div className="container-page py-12">
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-harvest-700">{t.fleet.publicEyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t.fleet.publicTitle}</h1>
      <p className="mt-3 text-lg text-muted">{t.fleet.publicIntro}</p>
    </header>
    <div className="mt-8">
      <Tabs value={filter} onChange={setFilter} label={t.fleet.filterLabel}
        options={[["all", t.common.all] as const, ...DISPLAY_STATUSES.map((status) => [status, t.fleet.status[status]] as const)]} />
    </div>
    {shown.length > 0
      ? <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{shown.map((truck) => <LiveCard key={truck._id} truck={truck} />)}</div>
      : <div className="mt-6"><EmptyState title={t.fleet.publicEmpty} /></div>}
    <p className="mt-10 flex max-w-3xl items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />{t.fleet.privacyNote}</p>
  </div>;
}

function LiveCard({ truck }: { truck: PublicTruck }) {
  const lang = useLang();
  const t = useT();
  return <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] hover:border-brand-200">
    <div className="flex items-start justify-between gap-3 p-5 pb-0">
      <div className="min-w-0">
        <h2 className="truncate font-semibold text-ink"><Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="hover:text-brand-700">{truck.name}</Link></h2>
        {truck.plate && <p className="text-sm text-muted">{truck.plate}</p>}
      </div>
      <FleetStatusBadge status={truck.status} />
    </div>
    <div className="mx-5 mt-4 aspect-[16/9] overflow-hidden rounded-xl bg-brand-50">
      {truck.photoUrl
        ? <img src={truck.photoUrl} alt="" loading="lazy" decoding="async" width={640} height={360} className="size-full object-cover" />
        : <span className="grid size-full place-items-center text-brand-200"><VehicleIcon category={truck.category} className="size-14" strokeWidth={1.3} /></span>}
    </div>
    <div className="flex flex-1 flex-col gap-4 p-5">
      <p className="flex items-center gap-2 text-sm">
        <UserRound className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span className="text-muted">{t.fleet.driver}</span>
        <span className="font-semibold">{truck.driverName ?? t.fleet.noDriver}</span>
      </p>
      {truck.route && truck.progress !== null && <ProgressBar value={truck.progress} from={truck.route.pickupZone} to={truck.route.dropoffZone} />}
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="flex items-center gap-1.5"><Scale className="size-4 text-brand-700" aria-hidden="true" />{t.common.tonnes(truck.capacityTons)}</span>
        {truck.rating
          ? <span className="flex items-center gap-1 font-semibold"><Star className="size-4 fill-harvest-400 text-harvest-400" aria-hidden="true" />{truck.rating.overall.toLocaleString(t.locale)}</span>
          : <span className="text-muted">{t.truck.noRating}</span>}
      </div>
    </div>
  </article>;
}
```

- [ ] **Step 2: Menu and sitemap**

In `src/components/layout/header.tsx`, in `navLinks`, after `["/$lang/sale", "sale"],`, add `["/$lang/fleet", "fleet"],`.

In `src/routes/sitemap[.]xml.ts`, replace `const PUBLIC_PATHS = ["", "/rental", "/sale", "/how-it-works", "/pricing", "/about", "/signup"];` with:

```ts
const PUBLIC_PATHS = ["", "/rental", "/sale", "/fleet", "/how-it-works", "/pricing", "/about", "/signup"];
```

- [ ] **Step 3: Regenerate the routes and check**

Run: `pnpm build && pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 4: Manual check**

- `/fr/fleet` while logged out: truck cards, a status badge, the driver's first name, and a bar during a mission. The filters work.
- In DevTools → Network, the `fleet:publicList` response contains no `lat`, `lng` or phone number.
- « En direct » shows in the menu (desktop and mobile) and does not break the header at 1024 px.
- `/sitemap.xml` lists `/fr/fleet`, `/en/fleet`, `/pt/fleet`.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/\$lang/fleet.tsx" src/components/layout/header.tsx "src/routes/sitemap[.]xml.ts" src/routeTree.gen.ts
git commit -m "feat(flotte): page publique Camions en direct, sans position"
```

---

### Task 12: Vérification finale

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `pnpm exec convex codegen && pnpm build && pnpm check`
Expected: typecheck, lint and all tests PASS (`src/shared/fleet.test.ts`, `convex/fleet.test.ts` and the existing tests)

- [ ] **Step 2: End-to-end scenario on a phone (or DevTools in mobile mode)**

1. A fleet transporter (2 trucks) adds a driver, sends the link, and the driver opens it on their phone and starts sharing.
2. A producer publishes a mission. The fleet transporter offers with the truck that has the driver, and the producer accepts.
3. The transporter's dashboard shows the truck « En chargement » with marker 1. `/fr/fleet` shows the same status, without a map.
4. « J'ai chargé »: the status becomes « En route », the producer's bar moves forward, and the producer sees the marker.
5. Cut the driver's network for 11 min (or wait): the marker turns grey and the row shows « Signal perdu ».
6. « J'ai livré », then the producer confirms: the producer's « Position du camion » block disappears.

- [ ] **Step 3: Push the schema**

Make sure `pnpm dev:backend` (dev) has pushed the schema without errors. For production, the Vercel build runs `npx convex deploy` (see `.env.example`): the new tables are created there, and no existing data needs a migration (all the new fields on `trucks` are optional).
