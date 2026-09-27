# Missions — Lot 4 : espace transporteur + navigation connectée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Le transporteur voit les missions de ses régions et de ses types de véhicules, en accepte une (un seul gagnant), marque « J'ai chargé » / « J'ai livré » avec une heure facultative.
- Toute l'interface connectée est adaptée : menu du compte (espace, profil, déconnexion), barre de navigation par espace, et plus d'accès à `/login` ou `/inscription` une fois connecté.

**Architecture:**
- **Serveur.** `orders.mts` ajoute `scope=available|assigned`, la lecture d'une mission proposée et l'action `accept`, revérifiée côté serveur (type + zone). Toutes les actions passent par `updateOrderIfUnchanged` (écriture conditionnelle par ETag, une nouvelle tentative).
- **Client.** La session devient un contexte React partagé (`SessionProvider`) : une seule lecture, rafraîchie à la connexion et déconnexion. `SessionGate` affiche `SpaceNav` ; `GuestOnly` protège les pages de connexion.

**Tech Stack:** Next.js (export statique), Netlify Functions, Netlify Blobs (`getWithMetadata` + `setJSON({ onlyIfMatch })`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-missions-transport-light.md` (2C, 3 flux 2 et 3, 5 ; lot 4). Suit les lots 1 à 3.

## Global Constraints

- **Visibilité :** une mission n'est visible et acceptable que par un partenaire actif dont le type de véhicule **et** la région de chargement correspondent.
- **Contact :** le numéro du producteur n'est montré au transporteur qu'après acceptation.
- **Accepter :** l'action exige d'être en ligne ; une seule acceptation gagne, le perdant reçoit « Mission déjà prise ».
- **Déconnexion :** elle recharge la page d'accueil (aucune page privée ne reste affichée).
- **Design :** mêmes composants, couleurs et cartes ; l'onglet actif est souligné en jaune (`warning`), comme la « brand road ».

---

### Task 1: Règles serveur (TDD)

**Files:**
- Create : `netlify/functions/_lib/test-store.ts` (store de test partagé avec ETag, remplace 4 copies de `fakeStore`).
- Modify : `_lib/accounts.ts` (`BlobStore.getWithEtag`, `setJSONIfMatch`), `_lib/orders.ts`, `_lib/mission-access.test.ts`.

**Interfaces :**
- `missionForViewer(order, actor)` : retire `clientPhone` pour un transporteur non assigné.
- `updateOrderIfUnchanged(id, change)` → `TransitionResult | null`.
- `getWithEtag` retombe sur l'ETag de la liste quand la lecture n'en renvoie pas (bac à sable local).

- [x] 5 tests d'abord → FAIL ; implémentation → 73/73.

### Task 2: Fonction `orders`

**Files:** Modify `netlify/functions/orders.mts`

- [x] `GET ?scope=available` (filtre `matchesTransporter`, sans numéro du producteur).
- [x] `GET ?scope=assigned`.
- [x] `GET ?id=` : mission visible si `canViewOrder` ou si elle est proposée à ce transporteur.
- [x] `POST ?id=&action=accept|assign|loaded|delivered|cancel` avec `{ at?, comment?, transporterAccountId? }`.

### Task 3: Session partagée et navigation

**Files:**
- Rename `lib/use-session.ts` → `lib/use-session.tsx` (`SessionProvider`, `useSession`, `refresh`, `logout`, `homeForRole`) ; Modify `components/providers/app-providers.tsx`.
- Create `components/layout/account-menu.tsx`, `components/layout/space-nav.tsx`.
- Modify `components/auth/session-gate.tsx` (`SessionGate` + `GuestOnly`), `components/layout/navbar.tsx`, `components/layout/mobile-navigation.tsx`, `app/login/page.tsx`, `app/inscription/page.tsx`, `app/profil/page.tsx`.

- [x] **Barre du haut (ordinateur)** : déconnecté, « Se connecter » + « Devenir partenaire » ; connecté, « Mon espace » + menu du compte (initiales, nom, rôle, Mon espace, Mon profil, Se déconnecter).
- [x] **Mobile** : pastille d'initiales vers l'espace. Le menu affiche une carte du compte avec Mon espace, Mon profil et Se déconnecter, ou bien Se connecter, Créer un compte et Devenir partenaire.
- [x] **`SpaceNav`**, onglets par rôle :
  - producteur : Mes transports, Nouvelle demande, Mon profil ;
  - transporteur : Missions disponibles, Mes missions, Mes camions, Mon profil ;
  - admin : Flotte, Validation, Partenaires, Demandes, Mon profil ;
  - « Se déconnecter » toujours visible (à partir de `sm`).
- [x] **`/login` et `/inscription`** : un compte connecté est redirigé vers son espace. Après connexion ou inscription, `refresh()` met à jour la barre du haut et `GuestOnly` redirige.
- [x] Traductions PT / FR / EN des libellés de compte.

### Task 4: Espace transporteur

**Files:**
- Create `components/missions/mission-parts.tsx` (`MissionCard`, `MissionFacts`, `ContactCard`, `MissionHistory`, `FilterTabs`), `components/partner/available-missions.tsx`, `components/partner/my-missions.tsx`, `components/partner/my-trucks.tsx` (déplacé), `app/partner/mission/page.tsx`.
- Modify `app/partner/page.tsx` (onglets `?tab=`), `components/missions/mission-status-badge.tsx` (point de vue transporteur : « Disponible », « À charger »), pages producteur (composants partagés), pages admin (liens redondants retirés, espacement `py-10`), `app/partner/trucks/{new,edit}` (retour vers `?tab=camions`).

- [x] `pnpm lint` 0 erreur, `pnpm test` 73/73, `pnpm build` OK (`/partner/mission` généré).
- [x] Test de bout en bout en mémoire :
  - visibilité A/B/C/D = 1/0/0/1 (type + zone) ;
  - numéro masqué avant acceptation ;
  - B (mauvais type) → 404 ;
  - A accepte → le numéro devient visible ;
  - D → « Mission déjà prise » ;
  - le producteur voit « Transportes A » avec le numéro de A ;
  - D ne peut pas marquer chargé ;
  - heure 08:15 retenue ;
  - livraison puis confirmation du producteur.
- [x] Écriture avec un ETag périmé refusée par le store local.
- [x] Navigateur : `/login` redirige un compte connecté vers `/partner` ; barre d'espace, pastille d'initiales et carte du compte du menu mobile affichées.

## Self-Review Notes

- **Limite connue :** le bac à sable Blobs local vérifie `if-match` puis écrit en deux temps. Deux acceptations *exactement* simultanées peuvent donc toutes deux réussir **en local** (la dernière écrase). Netlify Blobs en production fait l'écriture conditionnelle côté service. La logique de nouvelle tentative est couverte par un test unitaire.
- **Reste à faire :**
  - lot 5 : admin (indicateurs, `/admin/users`, filtres et exports, assignation manuelle dans l'interface) ;
  - lot 6 : hors-ligne.
