# Missions — Lot 1 : données et règles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les catégories de véhicules, les régions, les types `Account`/`Order` étendus et les règles pures des missions
(machine à états, filtrage transporteur type + zone, filtres admin), entièrement testées, sans aucun écran ni changement de design.

**Architecture:** Deux listes de référence dans `data/` (importables côté navigateur et côté fonctions). Les types restent dans `types/`.
Les règles sont des fonctions pures dans `netlify/functions/_lib/orders.ts`, à côté du store existant, testées avec Vitest.
Aucune Netlify Function ni page n'est modifiée dans ce lot : les lots 2 à 5 consomment ces règles.

**Tech Stack:** TypeScript, Vitest (déjà configuré, `pnpm test`), Netlify Blobs via `jsonStore()`.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (sections 1, 3, 4, 5 et lot 1 de la section 9)

## Global Constraints

- Ne rien changer au design ni aux pages existantes.
- Les nouveaux fichiers de `data/` et `types/` importent en chemins relatifs (`../types/truck`), pas `@/`,
  car ils sont chargés par Vitest et par les fonctions Netlify.
- Champs ajoutés à `Order` et `Account` **optionnels** : les demandes et comptes déjà stockés restent valides.
- Catégories dans cet ordre : Camion, Camionnette / pick-up, Moto tricycle, Tracteur + remorque, Semi-remorque.
- Visibilité d'une mission = catégorie du transporteur **ET** région de chargement dans ses régions de travail.
- `in_transit` n'existe pas : `loaded` = « Chargé – en route ».

---

### Task 1: Catégories de véhicules et régions

**Files:**
- Create: `data/vehicle-categories.ts`, `data/zones.ts`
- Test: `data/vehicle-categories.test.ts`, `data/zones.test.ts`

**Interfaces:**
- Produces: `type VehicleCategory = "camion" | "camionnette" | "moto_tricycle" | "tracteur" | "semi_remorque"`,
  `vehicleCategories: { id; label; truckTypes: TruckType[] }[]`, `vehicleCategoryLabels`, `categoryOfTruckType(type): VehicleCategory | null` ;
  `zones` (9 régions, `as const`), `type Zone`, `zoneLabels`, `isZone(value): value is Zone`.

- [x] **Step 1:** Écrire les tests : ordre des catégories ; chaque `TruckType` du catalogue a exactement une catégorie, sauf la liste
  explicite des exclusions (`crane`, `loader`, `road_machine` et les 9 types voyageurs), ce qui force à classer tout nouveau type ;
  `categoryOfTruckType` ; `isZone` refuse `"Gabu"` et `undefined`.
- [x] **Step 2:** `pnpm test` → FAIL (modules absents).
- [x] **Step 3:** Implémenter les deux fichiers (table de correspondance de la spec, section 1).
- [x] **Step 4:** `pnpm test` → PASS.

### Task 2: Types étendus

**Files:**
- Modify: `types/account.ts`, `types/order.ts`, `netlify/functions/_lib/crypto.ts` (`SessionPayload.role: AccountRole`), `lib/use-session.ts` (`Role`)

**Interfaces:**
- Consumes: `VehicleCategory`, `Zone` (Task 1).
- Produces:
  - `AccountRole = "admin" | "partner" | "producer"`.
  - `Account` avec en plus `updatedAt?`, `disabled?`, `companyName?`, `vehicleCategories?`, `vehicleCapacityTons?`,
    `workZones?`, `mainZone?`, `mainLocation?`.
  - `OrderStatus`, `OrderEventType`, `ProductType`, `OrderEvent { type; accountId?; at; comment? }`.
  - `Order` avec en plus `producerAccountId?`, `transporterAccountId?`, `vehicleCategory?: VehicleCategory | "any"`,
    `pickupZone?`, `dropoffZone?`, `productType?`, `quantitySacks?`, `quantityKg?`, `status?`, `events?`, `updatedAt?`.
  - `orderStatusLabels`, `productTypeLabels`.

- [x] **Step 1:** Modifier les types.
- [x] **Step 2:** `npx tsc --noEmit -p tsconfig.json` → aucune erreur ; `pnpm test` → PASS (rien de cassé).

### Task 3: Règles des missions

**Files:**
- Modify: `netlify/functions/_lib/orders.ts`, `netlify/functions/_lib/orders.test.ts` (une nouvelle commande est `pending` avec un événement `created`)
- Test: `netlify/functions/_lib/missions.test.ts`

**Interfaces:**
- Consumes: Tasks 1 et 2 ; `Truck` (`types/truck.ts`).
- Produces (consommé par les lots 2 à 5) :
  - `createOrder(input: OrderInput)` : fixe maintenant `status: "pending"` et `events: [created]`.
  - `orderStatus(order): OrderStatus` : un statut absent vaut `"pending"`.
  - `transporterCategories(account, trucks): Set<VehicleCategory>` : catégories du profil + camions **publiés** du transporteur.
  - `matchesTransporter(order, account, trucks): boolean` : partenaire non bloqué, mission `pending`, catégorie
    (ou `"any"` si le transporteur a au moins une catégorie) **et** `pickupZone ∈ workZones`. Les demandes anonymes (sans catégorie ni zone) ne sont proposées à personne.
  - `transition(order, action, actor, { at?, transporterAccountId?, comment? }): TransitionResult`, fonction pure qui ne modifie pas l'entrée :

    | Action | Qui | Depuis | Vers | Erreurs |
    |---|---|---|---|---|
    | `accept` | partner | `pending` | `assigned` (+ `transporterAccountId`) | 403 ; 409 « Mission déjà prise » |
    | `assign` | admin | `pending`, `assigned` | `assigned` | 403 ; 400 sans transporteur ; 409 |
    | `loaded` | transporteur assigné, producteur propriétaire, admin | `assigned` | `loaded` | 403 ; 409 |
    | `delivered` | idem | `loaded` (ou `delivered` : 2ᵉ confirmation, une fois par personne) | `delivered` | 403 ; 409 |
    | `cancel` | producteur propriétaire, admin | `pending`, `assigned` | `cancelled` | 403 ; 409 |

    Chaque transition ajoute `{ type, accountId, at, comment? }` à `events` et met `updatedAt` à jour.
  - `filterOrders(orders, { from?, to?, status?, productType?, pickupZone?, dropoffZone? })` : dates `YYYY-MM-DD` incluses, comparées au jour de création.

- [x] **Step 1:** Écrire `missions.test.ts` (22 tests : statut par défaut, catégories, visibilité type/zone/`any`/bloqué/pris/anonyme,
  parcours complet avec historique, non-mutation, mission déjà prise, droits par rôle, double confirmation, assignation admin, annulation, filtres).
- [x] **Step 2:** `pnpm test` → FAIL (`orderStatus is not a function`, …).
- [x] **Step 3:** Implémenter dans `_lib/orders.ts`.
- [x] **Step 4:** `pnpm test` → PASS.

### Task 4: Vérification

- [x] `npx tsc --noEmit -p tsconfig.json` → 0 erreur
- [x] `pnpm lint` → 0 erreur
- [x] `pnpm test` → 8 fichiers, 50 tests OK
- [x] `pnpm build` → OK

## Self-Review Notes

- **Couverture de la spec (lot 1) :** `data/vehicle-categories.ts`, `data/zones.ts`, types étendus, `transition`,
  `matchesTransporter`, filtres : tout y est. Restent pour les lots suivants : l'écriture conditionnelle (ETag) de `accept`
  (lot 4) et la vérification `disabled` au login (lot 2).
- **Cohérence des types :** `VehicleCategory` et `Zone` sont définis une seule fois dans `data/` et réutilisés partout ;
  `OrderStatus` est défini dans `types/order.ts` et utilisé par `transition` et `filterOrders`.
