# Missions — Lot 5 : administration Badora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Badora pilote l'activité :
- tableau de bord mensuel : missions, tonnes livrées, transporteurs actifs, principaux axes ;
- gestion des utilisateurs : bloquer, réactiver, réinitialiser le PIN, créer un transporteur ;
- liste des missions filtrable (date, statut, produit, axe) ;
- export CSV / PDF ;
- assignation manuelle d'une mission sans preneur.

**Architecture:**
- Les règles d'affichage et de calcul vivent dans `lib/missions.ts`, partagé entre navigateur et fonctions : `orderStatus`, `filterOrders`, `missionStats`, `ordersToCsv`. `netlify/functions/_lib/orders.ts` réexporte `orderStatus` et `filterOrders`.
- La vue admin de `orders.mts` enrichit chaque mission avec son transporteur et, si elle est en attente, avec les transporteurs qui correspondent (`candidateIds`).
- Pages client sans dépendance : barres en CSS, CSV via `Blob`, PDF via `window.print()` et une feuille d'impression.

**Tech Stack:** Next.js (export statique), Netlify Functions, Netlify Blobs, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (2D, 3 flux 4, 5 ; lot 5). Suit les lots 1 à 4.

## Global Constraints

- **Indicateurs :** seules les missions suivies non annulées comptent ; les demandes anonymes `/location` sont exclues. Les tonnes = somme des kg des missions **livrées** du mois.
- **CSV :** séparateur `;` et BOM UTF-8 (Excel en français ouvre les accents), guillemets échappés.
- **Assignation manuelle :** uniquement vers un compte `partner` actif (sinon 400), réservée à Badora.
- **Pas de librairie** de graphiques ni d'export : léger pour Android bas de gamme.
- `/admin/users` remplace `/admin/partners` ; l'action `list-partners` est supprimée au profit de `list-users&role=partner`.

---

### Task 1: Règles partagées (TDD)

**Files:** Modify `lib/missions.ts`, `lib/missions.test.ts`, `netlify/functions/_lib/orders.ts`

**Interfaces :**
- `missionStats(orders, "YYYY-MM") → { missions, delivered, tonnes, activeTransporters, topRoutes: { route, count }[] }` (5 axes max).
- `ordersToCsv(orders, transporterNames) → string`.

- [x] 4 tests d'abord → FAIL ; implémentation → 77/77.

### Task 2: Serveur

**Files:** Modify `netlify/functions/orders.mts`, `netlify/functions/auth.mts`, `netlify/functions/_lib/orders.ts`, `types/order.ts` (`MissionView.candidateIds`)

- [x] **`GET /orders` (admin)** : chaque mission avec `transporter` (nom ou entreprise + numéro). Pour une mission en attente, `candidateIds` (règle `matchesTransporter`).
- [x] **`assign`** : 400 « Transporteur actif requis » si le compte n'existe pas, n'est pas `partner` ou est bloqué.
- [x] `matchesTransporter`, `transporterCategories` et `transporterContact` acceptent un `PublicAccount`.

### Task 3: Écrans

**Files:**
- Create `components/admin/mission-stats-panel.tsx`, `app/admin/users/page.tsx`.
- Rewrite `app/admin/orders/page.tsx`.
- Modify `app/admin/page.tsx`, `components/layout/space-nav.tsx`, `app/globals.css` (impression), `README.md`.
- Delete `app/admin/partners/`.

- [x] **`SpaceNav` admin** : Tableau de bord, Missions, Utilisateurs, Validation camions, Mon profil.
- [x] **`/admin`** :
  - choix du mois ;
  - 4 tuiles : missions, tonnes livrées, transporteurs actifs, missions livrées ;
  - bandeau « N missions en attente · M sans transporteur possible → Assigner » ;
  - barres des principaux axes ;
  - puis la flotte, comme avant.
- [x] **`/admin/orders`** :
  - filtres Du / Au / Statut / Produit / Départ / Arrivée (le lien du bandeau ouvre `?status=pending`) ;
  - Export CSV et Export PDF ;
  - étiquette « Demande WhatsApp » pour les demandes anonymes ;
  - assignation par liste : « Correspondent (type + région) » d'abord, puis « Autres transporteurs » ;
  - annulation ;
  - l'impression masque l'en-tête, les onglets, les filtres et les boutons.
- [x] **`/admin/users`** :
  - filtre Tous / Transporteurs / Producteurs / Badora ;
  - véhicules et régions des transporteurs, localité des producteurs ;
  - Bloquer / Réactiver (pas sur soi-même), réinitialiser le PIN en ligne ;
  - formulaire « Créer un compte transporteur ».

- [x] `pnpm build` (routes `/admin`, `/admin/orders`, `/admin/users`), `tsc`, `pnpm lint` 0 erreur, `pnpm test` 77/77.
- [x] **Test de bout en bout en mémoire :**
  - 1 transporteur correspondant pour la mission de Gabú, 0 pour celle de Tombali ;
  - `list-partners` → 400 et `list-users&role=partner` OK ;
  - assignation refusée pour un compte bloqué ou inconnu ; assignation manuelle acceptée ;
  - un producteur ne peut pas assigner (403) ;
  - statistiques et CSV corrects.
- [x] **Navigateur :**
  - déconnexion → accueil ;
  - connexion admin → `/admin` (tableau de bord) ;
  - `/admin/users` liste les comptes réels avec leurs actions.

## Self-Review Notes

- Couverture du lot 5 : tableau de bord, utilisateurs, missions avec filtres et exports, assignation manuelle : tout y est.
- Reste le lot 6 : hors-ligne (précache des écrans, lecture du cache, file d'attente des actions).
