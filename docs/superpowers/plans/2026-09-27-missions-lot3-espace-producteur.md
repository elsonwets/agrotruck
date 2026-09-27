# Missions — Lot 3 : espace producteur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un producteur connecté publie une demande de transport, suit ses demandes (en cours / terminées), voit le transporteur
(nom ou entreprise + son numéro), marque « chargé » / « livré », annule, et consulte l'historique.

**Architecture:** La fonction `orders.mts` distingue une demande anonyme (`/location`, inchangée) d'une mission de producteur connecté.
Lecture d'une mission réservée au producteur, au transporteur assigné et à Badora (`canViewOrder`). Les actions passent par
`transition()` (lot 1). Trois pages client sous `/producteur`, avec les composants UI existants.

**Tech Stack:** Next.js (export statique, `?id=` + `useSearchParams` sous `Suspense`), Netlify Functions, Blobs, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (sections 2B, 3 flux 1 et 3, 4 ; lot 3). Suit les lots 1 et 2.

## Global Constraints

- Le formulaire anonyme `/location` → WhatsApp continue de fonctionner à l'identique.
- Le producteur voit le nom du transporteur, ou son entreprise, avec **le numéro du transporteur**, jamais celui de Badora.
- Une mission = un transporteur (`requestedTruckCount: 1`).
- Quantité obligatoire : nombre de sacs ou poids.
- Actions ouvertes au producteur dans ce lot : `loaded`, `delivered`, `cancel`. `accept` et `assign` → lot 4 (400 d'ici là).
- Une heure d'action envoyée par le client n'est retenue que si elle est valide et pas dans le futur (utile au hors-ligne, lot 6).

---

### Task 1: Règles d'accès et affichage

**Files:** Modify `netlify/functions/_lib/orders.ts` ; Create `netlify/functions/_lib/mission-access.test.ts`, `lib/missions.ts`, `lib/missions.test.ts`

**Interfaces (produites) :**
- `findOrderById(id)`, `saveOrder(order)`.
- `canViewOrder(order, actor): boolean` : admin, producteur propriétaire, transporteur assigné.
- `transporterContact(account | null): { name; phone } | null` : `companyName` sinon `displayName`, et le numéro du transporteur.
- `lib/missions.ts` : `missionRoute(order)` (« Pirada (Gabú) → Porto (Bissau (SAB)) »), `missionQuantity(order)` (« 200 sacs · 16 t »),
  `isFinished(order)`, `formatDay("2026-10-05")`.

- [x] Tests d'abord (8) → FAIL ; implémentation → PASS (68).

### Task 2: Fonction `orders`

**Files:** Modify `netlify/functions/orders.mts`, `netlify/functions/auth.mts` (schémas partagés) ; Create `netlify/functions/_lib/schemas.ts` ; Modify `types/order.ts` (`MissionView`)

- `POST /orders` : producteur connecté → mission validée par Zod (catégorie ou `any`, régions, lieux, produit, sacs/kg, date `YYYY-MM-DD`,
  commentaire), `clientName`/`clientPhone` pris du compte ; sinon demande anonyme (schéma inchangé, honeypot conservé).
- `GET ?scope=mine` (producteur), `GET ?id=` (`canViewOrder`, sinon 404) avec `transporter`, `GET` (admin).
- `POST ?id=&action=loaded|delivered|cancel` avec `{ at?, comment? }` → `transition()` puis `saveOrder()`.

- [x] Test de bout en bout en mémoire (script temporaire supprimé) : anonyme 201 ; sans quantité 400 ; région invalide 400 ; création 201 `pending`
  avec propriétaire ; `mine` ; autre producteur 404 et liste vide ; « chargé » sur `pending` 409 ; `accept` 400 ; contact « Transportes Djaló » +
  numéro du transporteur ; heure future ignorée ; livré ; 2ᵉ confirmation 409 ; annulation après livraison 409 ; historique complet.

### Task 3: Écrans producteur

**Files:** Create `app/producteur/page.tsx`, `app/producteur/demande/nouvelle/page.tsx`, `app/producteur/demande/page.tsx`,
`components/missions/mission-status-badge.tsx` ; Modify `lib/use-session.ts` (`homeForRole.producer = "/producteur"`)

- `/producteur` : « Nouvelle demande de transport », onglets « En cours / Terminées », cartes (trajet, produit, quantité, date, statut).
- `/producteur/demande/nouvelle` : type de véhicule (liste familière + « Peu importe »), chargement (région + lieu, pré-remplis depuis le profil,
  bouton « Ma localisation » si GPS), déchargement, produit, sacs, kg, date (≥ aujourd'hui), commentaire → « Publier la demande » → détail.
- `/producteur/demande?id=` : résumé, transporteur (Appeler `tel:` + WhatsApp), « Marquer comme chargé », « Marquer comme livré »
  ou « Confirmer la livraison », annulation en deux temps (sans boîte de dialogue), historique horodaté.

- [x] `npx tsc --noEmit` 0 erreur, `pnpm lint` 0 erreur, `pnpm test` 68/68, `pnpm build` OK (3 routes `/producteur` générées).

## Self-Review Notes

- Couverture du lot 3 : écrans B de la spec et flux 1 et 3 côté producteur. Les missions n'apparaissent pas encore chez les transporteurs
  (lot 4) ; d'ici là, une mission reste « En attente ».
- Hors périmètre : hors-ligne (lot 6), indicateurs et exports admin (lot 5).
